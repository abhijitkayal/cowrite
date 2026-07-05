import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getDocumentAccess } from "@/lib/permissions";
import AccessDenied from "../AccessDenied";

import DocumentEditor from "../DocumentEditor"

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ViewDocumentPage({
  params,
}: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  await connectDb();

  const role = await getDocumentAccess(
    id,
    user.id
  );

  if (!role) {
    notFound();
  }

  if (role.role !== "EDITOR") {
    return <AccessDenied />;
  }

  return (
    <DocumentEditor
      documentId={id}
      readOnly={false}
      shareType={"editor"}
    />
  );
}