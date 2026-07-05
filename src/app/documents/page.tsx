"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDb, LocalDocument } from "@/lib/client/offline-db";

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [error, setError] = useState("");

  function getDocumentHref(document: LocalDocument) {
    if (document.role === "EDITOR") {
      return `/documents/${document.id}/editor`;
    }

    if (document.role === "VIEWER") {
      return `/documents/${document.id}/viewer`;
    }

    return `/documents/${document.id}`;
  }

  useEffect(() => {
    localDb.documents.toArray().then(setDocuments);
    fetch("/api/documents")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load documents");
        return response.json();
      })
      .then(async (payload: { documents: LocalDocument[] }) => {
        await localDb.documents.bulkPut(payload.documents);
        setDocuments(payload.documents);
        console.log(payload.documents);
      })
      .catch(() => setError("Showing local documents only"));
  }, []);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const title = String(form.get("title") || "").trim() || "Untitled";

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Could not create document");
      return;
    }
    const payload = (await response.json()) as { document: LocalDocument };
    await localDb.documents.put({ ...payload.document, role: "OWNER" });
    router.push(`/documents/${payload.document.id}`);
  }

    async function deleteDocument(id: string) {
      const confirmed = window.confirm(
        "Are you sure you want to delete this document?"
      );

      if (!confirmed) return;

      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError("Failed to delete document");
        return;
      }

      await localDb.documents.delete(id);

      setDocuments((current) =>
        current.filter((doc) => doc.id !== id)
      );
    }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const ownedCount = documents.filter((d) => d.role === "OWNER").length;
  const editorCount = documents.filter((d) => d.role === "EDITOR").length;
  const viewerCount = documents.filter((d) => d.role === "VIEWER").length;

  const roleStyles: Record<string, { badge: string; icon: string; tile: string }> = {
    OWNER: {
      badge: "bg-violet-100 text-violet-700",
      icon: "bg-violet-600",
      tile: "text-violet-600"
    },
    EDITOR: {
      badge: "bg-emerald-100 text-emerald-700",
      icon: "bg-emerald-600",
      tile: "text-emerald-600"
    },
    VIEWER: {
      badge: "bg-sky-100 text-sky-700",
      icon: "bg-sky-600",
      tile: "text-sky-600"
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
    
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
              <DocIcon />
            </span>
            <div>
              <h1 className="text-xl font-bold leading-tight">CoWrite</h1>
              <p className="text-sm text-neutral-500">
                Manage and collaborate on your documents
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-50"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
       
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total"
            value={documents.length}
            icon={<StackIcon />}
            accent="bg-neutral-900 text-white"
          />
          <StatCard
            label="Owned by you"
            value={ownedCount}
            icon={<CrownIcon />}
            accent="bg-violet-600 text-white"
          />
          <StatCard
            label="Editable"
            value={editorCount}
            icon={<PencilIcon />}
            accent="bg-emerald-600 text-white"
          />
          <StatCard
            label="View only"
            value={viewerCount}
            icon={<EyeIcon />}
            accent="bg-sky-600 text-white"
          />
        </div>

        
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100 text-orange-600">
              <PlusIcon />
            </span>
            <h2 className="text-lg font-semibold">Create New Document</h2>
          </div>

          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={createDocument}
          >
            <Input
              name="title"
              placeholder="Enter document title..."
              className="border-neutral-300 text-black"
            />

            <Button type="submit" className="bg-black text-white hover:bg-neutral-800">
              <span className="mr-2 inline-flex"><PlusIcon /></span>
              Create Document
            </Button>
          </form>
        </div>

      
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <WarningIcon />
            {error}
          </div>
        )}

  
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-6 py-4">
            <h2 className="text-lg font-semibold">Your Documents</h2>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <DocIcon size={28} />
              </div>

              <h3 className="text-lg font-medium">No documents yet</h3>

              <p className="mt-2 text-sm text-neutral-500">
                Create your first document to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {documents.map((document) => {
                const styles = roleStyles[document.role] ?? roleStyles.VIEWER;
                return (
                  <div
                    key={document.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-neutral-50"
                  >
                    <a
                      href={getDocumentHref(document)}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.icon} text-white`}
                      >
                        <DocIcon size={18} />
                      </span>

                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-black">
                          {document.title}
                        </h3>
                        <p className="mt-0.5 text-sm text-neutral-500">
  {document.updatedAt
    ? `Updated on ${new Date(document.updatedAt).toLocaleDateString()}`
    : "Never updated"}
</p>
                      </div>
                    </a>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
                      >
                        {document.role === "OWNER" && <CrownIcon size={12} />}
                        {document.role === "EDITOR" && <PencilIcon size={12} />}
                        {document.role === "VIEWER" && <EyeIcon size={12} />}
                        {document.role}
                      </span>

                      {document.role === "OWNER" && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            deleteDocument(document.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <TrashIcon />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </span>
        <span className="text-2xl font-bold text-black">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-neutral-500">{label}</p>
    </div>
  );
}

function DocIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function CrownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 8 4 3 6-6 6 6 4-3-2 11H4L2 8Z" />
    </svg>
  );
}

function PencilIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}