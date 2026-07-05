import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { error, handleRouteError, json, parseJson } from "@/lib/http";
import {
  assertRole,
  canEditDocument,
  canViewDocument
} from "@/lib/permissions";
import { objectIdSchema, syncSchema } from "@/lib/validation";
import {
  applyUpdatesToState,
  base64ToUpdate,
  bufferToBase64,
  diffState
} from "@/lib/yjs";
import { Document } from "@/models/Document";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    const input = await parseJson(request, syncSchema);

    await connectDb();
    if (!(await canViewDocument(id, user.id))) return error("Document not found", 404);
    if (input.updates.length > 0) {
      assertRole(await canEditDocument(id, user.id), "Viewers cannot submit updates");
    }

    const document = await Document.findById(id).select("yjsState updatedAt");
    if (!document) return error("Document not found", 404);

    const nextState =
      input.updates.length > 0
        ? applyUpdatesToState(
            document.yjsState,
            input.updates.map(base64ToUpdate)
          )
        : document.yjsState;

    if (input.updates.length > 0) {
      document.yjsState = nextState;
      await document.save();
    }

    const stateVector = input.stateVector
      ? base64ToUpdate(input.stateVector)
      : undefined;

    return json({
      update: bufferToBase64(diffState(document.yjsState, stateVector)),
      updatedAt: document.updatedAt
    });
  } catch (err) {
    if (err instanceof Error && err.name === "FORBIDDEN") {
      return error(err.message, 403);
    }
    if (err instanceof Error && err.name === "PAYLOAD_TOO_LARGE") {
      return error(err.message, 413);
    }
    return handleRouteError(err);
  }
}
