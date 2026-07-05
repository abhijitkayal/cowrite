import { Types } from "mongoose";
import { Role } from "@/lib/constants";
import { Document } from "@/models/Document";
import { DocumentMember } from "@/models/DocumentMember";

export type DocumentAccess = {
  role: Role | null;
  isOwner: boolean;
};

function normalizeId(id: string | Types.ObjectId) {
  return typeof id === "string" ? id : String(id);
}

export async function getDocumentAccess(
  documentId: string,
  userId: string
): Promise<DocumentAccess | null> {
  const document = await Document.findById(documentId).select("ownerId").lean();
  if (!document) return null;

  if (normalizeId(document.ownerId) === userId) {
    return { role: "OWNER", isOwner: true };
  }

  const member = await DocumentMember.findOne({ documentId, userId })
    .select("role")
    .lean();

  if (!member) return { role: null, isOwner: false };
  return { role: member.role as Role, isOwner: false };
}

export async function canViewDocument(documentId: string, userId: string) {
  const access = await getDocumentAccess(documentId, userId);
  return Boolean(access?.role);
}

export async function canEditDocument(documentId: string, userId: string) {
  const access = await getDocumentAccess(documentId, userId);
  return access?.role === "OWNER" || access?.role === "EDITOR";
}

export async function canManageDocument(documentId: string, userId: string) {
  const access = await getDocumentAccess(documentId, userId);
  return access?.role === "OWNER";
}
export async function canRestoreVersion(
  documentId: string,
  userId: string
) {
  const access = await getDocumentAccess(documentId, userId);

  return access?.role === "OWNER" || access?.role === "EDITOR";
}

export function assertRole(
  allowed: boolean,
  message = "You do not have permission"
) {
  if (!allowed) {
    const err = new Error(message);
    err.name = "FORBIDDEN";
    throw err;
  }
}
