import nodemailer from "nodemailer";
import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { error, handleRouteError, json, parseJson } from "@/lib/http";
import { assertRole, canManageDocument } from "@/lib/permissions";
import { objectIdSchema, shareDocumentSchema } from "@/lib/validation";

import { Document } from "@/models/Document";
import { DocumentMember } from "@/models/DocumentMember";
import { User } from "@/models/User";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return error("Unauthenticated", 401);
    }

    const { id } = await context.params;

    objectIdSchema.parse(id);

    const input = await parseJson(
      request,
      shareDocumentSchema
    );

    await connectDb();

    assertRole(
      await canManageDocument(id, currentUser.id),
      "Only owners can share documents"
    );

    const targetUser = await User.findOne({
      email: input.email,
    }).select("_id email");

    if (!targetUser) {
      return error("User must register before you can share with them", 400);
    }

    const document = await Document.findById(id)
      .select("ownerId title")
      .lean();

    if (!document) {
      return error("Document not found", 404);
    }

    if (
      String(targetUser._id) ===
      String(document.ownerId)
    ) {
      return json({
        member: {
          userId: String(targetUser._id),
          role: "OWNER",
        },
      });
    }

    const member = await DocumentMember.findOneAndUpdate(
      {
        documentId: id,
        userId: targetUser._id,
      },
      {
    $set: {
      userEmail: input.email,
      role: input.role,
    },
  },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).lean();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const documentUrl = `${appUrl}/documents/${id}/${input.role.toLowerCase()}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: targetUser.email,
        subject: `Document Shared: ${document.title}`,
        html: `
          <h2>Document Shared With You</h2>

          <p>
            You have been granted
            <strong>${input.role}</strong>
            access to:
          </p>

          <p>
            <strong>${document.title}</strong>
          </p>

          <p>
            <a href="${documentUrl}">
              Open Document
            </a>
          </p>
        `,
      });
    } catch (mailError) {
      console.error("Mail Error:", mailError);
    }

    return json({
      member: {
        id: String(member?._id),
        documentId: String(member?.documentId),
        userId: String(member?.userId),
        userEmail: member?.userEmail,
        role: member?.role,
      },

      sharedUser: {
        email: targetUser.email,
        role: input.role,
        documentUrl,
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.name === "FORBIDDEN"
    ) {
      return error(err.message, 403);
    }

    return handleRouteError(err);
  }
}
