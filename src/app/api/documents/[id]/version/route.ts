import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { error, handleRouteError, json, parseJson } from "@/lib/http";
import {
  assertRole,
  canEditDocument,
  canRestoreVersion,
  canViewDocument
} from "@/lib/permissions";
import {
  createVersionSchema,
  objectIdSchema,
  restoreVersionSchema
} from "@/lib/validation";
import { bufferToBase64, toNodeBuffer } from "@/lib/yjs";
import { Document } from "@/models/Document";
import { DocumentVersion } from "@/models/DocumentVersion";

type RouteContext = { params: Promise<{ id: string }> };

function serializeVersion(version: {
  _id: unknown;
  documentId: unknown;
  createdBy: unknown;
  createdAt: Date;
  createEmail: string;
  snapshot: unknown;
  content: string;
}) {
  return {
    id: String(version._id),
    documentId: String(version.documentId),
    createdBy: String(version.createdBy),
    createEmail: version.createEmail,
    createdAt: version.createdAt,
    snapshot: bufferToBase64(toNodeBuffer(version.snapshot)),
    content: version.content
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    await connectDb();
    if (!(await canViewDocument(id, user.id))) return error("Document not found", 404);

    const versions = await DocumentVersion.find({ documentId: id })
      .sort({ createdAt: -1 })
      .lean();

    return json({ versions: versions.map(serializeVersion) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    const input = await parseJson(request, createVersionSchema);

    await connectDb();
    assertRole(await canEditDocument(id, user.id), "Viewers cannot create versions");

    const document = await Document.findById(id).select("yjsState");
    if (!document) return error("Document not found", 404);

    const version = await DocumentVersion.create({
      documentId: id,
      createdBy: user.id,
      content: input.content,
      createEmail: user.name,
      snapshot: input.snapshot
        ? Buffer.from(input.snapshot, "base64")
        : document.yjsState
      
    });

    return json({ version: serializeVersion(version) }, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "FORBIDDEN") {
      return error(err.message, 403);
    }
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    
    if (!user) return error("Unauthenticated", 401);

    const { id } = await context.params;
    objectIdSchema.parse(id);
    const input = await parseJson(request, restoreVersionSchema);

    await connectDb();
    assertRole(await canRestoreVersion(id, user.id), "Only owners can restore versions");

    const version = await DocumentVersion.findOne({
      _id: input.versionId,
      documentId: id
    }).lean();
    if (!version) return error("Version not found", 404);

   const document = await Document.findByIdAndUpdate(
  id,
  {
    yjsState: version.snapshot,
    content: version.content
  },
  { new: true }
);
    if (!document) return error("Document not found", 404);

   const restoreVersion = await DocumentVersion.create({
  documentId: id,
  createdBy: user.id,
  createEmail: user.name,
  snapshot: version.snapshot,
  content: version.content
});

   return json({
  document: {
    id: String(document._id),
    yjsState: bufferToBase64(document.yjsState),
    updatedAt: document.updatedAt
  },
  content: version.content,
  version: serializeVersion(restoreVersion)
});
  } catch (err) {
    if (err instanceof Error && err.name === "FORBIDDEN") {
      return error(err.message, 403);
    }
    return handleRouteError(err);
  }
}
