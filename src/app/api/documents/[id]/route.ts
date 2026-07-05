import { NextRequest, NextResponse} from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  // assertDocumentTitleAvailable,
   generateUniqueDocumentTitle,
  normalizeDocumentTitle
} from "@/lib/document-titles";
import { connectDb } from "@/lib/db";
import { error, handleRouteError, json, parseJson } from "@/lib/http";
import {
  assertRole,
  canEditDocument,
  getDocumentAccess
} from "@/lib/permissions";
import { objectIdSchema, updateDocumentSchema } from "@/lib/validation";
import {
  applyUpdatesToState,
  base64ToUpdate,
  bufferToBase64,
  toNodeBuffer
} from "@/lib/yjs";

import { Document } from "@/models/Document";

import { DocumentVersion } from "@/models/DocumentVersion";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    await connectDb();

    const access = await getDocumentAccess(id, user.id);
    if (!access?.role) return error("Document not found", 404);

    const document = await Document.findById(id).lean();
    if (!document) return error("Document not found", 404);

    return json({
      document: {
        id: String(document._id),
        title: document.title,
        ownerId: String(document.ownerId),
        role: access.role,
        yjsState: bufferToBase64(toNodeBuffer(document.yjsState)),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    const input = await parseJson(request, updateDocumentSchema);

    await connectDb();
    assertRole(await canEditDocument(id, user.id), "Viewers cannot update documents");

    const existingDocument = await Document.findById(id)
      .select("ownerId title yjsState")
      .lean();
    if (!existingDocument) return error("Document not found", 404);

    const update: Record<string, unknown> = {};
    if (input.title) update.title = input.title;
    if (input.title) {
      const title = normalizeDocumentTitle(input.title);

      if (title !== existingDocument.title) {
        const uniqueTitle = await generateUniqueDocumentTitle({
          ownerId: String(existingDocument.ownerId),
          title,
          excludeDocumentId: id
        });
        update.title = uniqueTitle;
      }

      update.title = title;
    }
    if (input.update) {
      update.yjsState = applyUpdatesToState(toNodeBuffer(existingDocument.yjsState), [
        base64ToUpdate(input.update)
      ]);
    }

    const document = await Document.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    }).lean();
    if (!document) return error("Document not found", 404);

    return json({
      document: {
        id: String(document._id),
        title: document.title,
        ownerId: String(document.ownerId),
        yjsState: bufferToBase64(toNodeBuffer(document.yjsState)),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
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


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDb();

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const document = await Document.findById(id);

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  if (String(document.ownerId) !== String(user.id)) {
    return NextResponse.json(
      { error: "Only owner can delete document" },
      { status: 403 }
    );
  }

  await Document.findByIdAndDelete(id);

  await Document.deleteMany({
    documentId: id,
  });

  await DocumentVersion.deleteMany({
    documentId: id,
  });

  return NextResponse.json({
    success: true,
  });
}
