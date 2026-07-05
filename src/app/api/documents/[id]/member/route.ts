import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { error, json, handleRouteError } from "@/lib/http";
import { objectIdSchema } from "@/lib/validation";
import { canViewDocument } from "@/lib/permissions";
import { DocumentMember } from "@/models/DocumentMember";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return error("Unauthenticated", 401);
    }

    const { id } = await context.params;

    objectIdSchema.parse(id);

    await connectDb();

    const allowed = await canViewDocument(id, user.id);

    if (!allowed) {
      return error("Document not found", 404);
    }

    const members = await DocumentMember.find({
      documentId: id,
    })
      .select("userEmail role")
      .lean();

    return json({
      members: members.map((member) => ({
        email: member.userEmail,
        role: member.role,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}