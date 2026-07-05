import { redirect } from "next/navigation";
import { objectIdSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getDocumentAccess } from "@/lib/permissions";
import AccessDenied from "./AccessDenied";
import DocumentEditor from "./DocumentEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  objectIdSchema.parse(id);

  await connectDb();

  const access = await getDocumentAccess(id, user.id);

  if (access?.role !== "OWNER") {
    return <AccessDenied />;
  }

  return <DocumentEditor documentId={id} />;
}
