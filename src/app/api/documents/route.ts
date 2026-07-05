import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import {
  error,
  handleRouteError,
  json,
  parseJson,
  RequestError
} from "@/lib/http";
import {
  // assertDocumentTitleAvailable,
    generateUniqueDocumentTitle,
  normalizeDocumentTitle
} from "@/lib/document-titles";
import { createDocumentSchema } from "@/lib/validation";
import { createEmptyYjsState } from "@/lib/yjs";
import { Document } from "@/models/Document";
import { DocumentMember } from "@/models/DocumentMember";

function serializeDocument(document: {
  _id: unknown;
  title: string;
  ownerId: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(document._id),
    title: document.title,
    ownerId: String(document.ownerId),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);

    const input = await parseJson(request, createDocumentSchema);
    await connectDb();

   

  const requestedTitle = normalizeDocumentTitle(input.title);

const title = await generateUniqueDocumentTitle({
  ownerId: user.id,
  title: requestedTitle
});

const document = await Document.create({
  title,
  ownerId: user.id,
  yjsState: createEmptyYjsState()
});

    return json({ document: serializeDocument(document) }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return error("Unauthenticated", 401);
    if (!Types.ObjectId.isValid(user.id)) {
      throw new RequestError("Invalid user id", 400);
    }

    await connectDb();
    const memberships = await DocumentMember.find({ userId: user.id })
      .select("documentId role")
      .lean();
    const sharedIds = memberships.map((member) => member.documentId);

    const documents = await Document.find({
      $or: [{ ownerId: user.id }, { _id: { $in: sharedIds } }]
    })
      .sort({ updatedAt: -1 })
      .lean();

    const roleByDocumentId = new Map(
      memberships.map((member) => [String(member.documentId), member.role])
    );

    return json({
      documents: documents.map((document) => ({
        ...serializeDocument(document),
        role:
          String(document.ownerId) === user.id
            ? "OWNER"
            : roleByDocumentId.get(String(document._id))
      }))
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
