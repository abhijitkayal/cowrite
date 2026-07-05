"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import DocumentExtension from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base64ToUint8, uint8ToBase64 } from "@/lib/client/base64";
import { localDb, LocalVersion } from "@/lib/client/offline-db";
import {
  flushPendingVersions,
  flushPendingUpdates,
  queueVersion,
  queueYjsUpdate,
  watchOnlineStatus
} from "@/lib/client/sync-engine";
const AVATAR_COLORS = [
  "bg-violet-600", "bg-emerald-600", "bg-sky-600", "bg-rose-600",
  "bg-amber-500", "bg-fuchsia-600", "bg-teal-600", "bg-orange-600"
] as const;

const ROLE_STYLES = {
  OWNER: { badge: "bg-violet-100 text-violet-700 ring-1 ring-violet-200", label: "Owner" },
  EDITOR: { badge: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", label: "Editor" },
  VIEWER: { badge: "bg-sky-100 text-sky-700 ring-1 ring-sky-200", label: "Viewer" }
} as const;

const VERSION_SYNC_STORAGE_PREFIX = "document-version-sync";
const YJS_WS_URL = process.env.NEXT_PUBLIC_YJS_WS_URL ?? "https://document-1-34zn.onrender.com";


type RemoteDocument = {
  id: string;
  title: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  yjsState: string;
  updatedAt: string;
};

type VersionPayload = {
  id: string;
  documentId: string;
  snapshot: string;
  content: string;
  createdBy: string;
  createEmail: string;
  createdAt: string;
};

type SharedUser = {
  email: string;
  role: string;
};


const getInitials = (email: string): string => {
  if (!email) return "?";
  const namePart = email.split("@")[0];
  const chunks = namePart.split(/[.\-_]/).filter(Boolean);
  if (chunks.length >= 2) {
    return (chunks[0][0] + chunks[1][0]).toUpperCase();
  }
  return namePart.slice(0, 2).toUpperCase();
};

const getAvatarColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
};


const Icons = {
  Role: ({ role }: { role: string }) => {
    const paths = {
      OWNER: <path d="m2 8 4 3 6-6 6 6 4-3-2 11H4L2 8Z" />,
      EDITOR: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
      VIEWER: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></>
    };
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[role as keyof typeof paths] || paths.VIEWER}
      </svg>
    );
  },
  Back: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  Share: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
};


export default function DocumentEditor({ 
  documentId, 
  readOnly = false, 
  shareType 
}: { 
  documentId: string; 
  readOnly?: boolean; 
  shareType?: string;
}) {

  const [document, setDocument] = useState<RemoteDocument | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [versions, setVersions] = useState<VersionPayload[]>([]);
  const [online, setOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<string>("");


  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const versionSyncChannelRef = useRef<BroadcastChannel | null>(null);
  const saveTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const versionEventsDoc = useMemo(() => new Y.Doc(), []);
  const versionEvents = useMemo(
    () => versionEventsDoc.getMap<{ versionId: string; nonce: string }>("events"),
    [versionEventsDoc]
  );

  const canEdit = document?.role === "OWNER" || document?.role === "EDITOR";
  const roleStyle = ROLE_STYLES[document?.role ?? "VIEWER"];

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly && canEdit,
    extensions: [
      DocumentExtension,
      Paragraph,
      Text,
      Collaboration.configure({ document: ydoc })
    ],
    editorProps: {
      attributes: {
        class: "min-h-[460px] outline-none text-black leading-relaxed"
      }
    }
  });


  useEffect(() => {
    editor?.setEditable(!readOnly && canEdit);
  }, [editor, canEdit, readOnly]);


  useEffect(() => {
    if (!editor) return;

    const updateCounts = () => {
      const text = editor.getText();
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
      setCharCount(text.length);
    };

    updateCounts();
    editor.on("update", updateCounts);

    return () => {
      editor.off("update", updateCounts);
    };
  }, [editor]);


  useEffect(() => {
    return watchOnlineStatus(setOnline);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      try {
        const local = await localDb.documents.get(documentId);
        
        if (local?.yjsState) {
          Y.applyUpdate(ydoc, base64ToUint8(local.yjsState));
        }
        
        if (local && !cancelled) {
          setDocument({
            id: local.id,
            title: local.title,
            role: local.role,
            yjsState: local.yjsState ?? "",
            updatedAt: local.updatedAt ?? ""
          });
          setTitle(local.title || "Untitled");
        }

        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) throw new Error("Failed to load document");
        
        const payload = (await response.json()) as { document: RemoteDocument };
        Y.applyUpdate(ydoc, base64ToUint8(payload.document.yjsState));
        
        await localDb.documents.put({
          ...payload.document,
          yjsState: uint8ToBase64(Y.encodeStateAsUpdate(ydoc))
        });
        
        if (!cancelled) {
          setDocument(payload.document);
          setTitle(payload.document.title || "Untitled");
        }
      } catch {
        const local = await localDb.documents.get(documentId);
        if (!local && !cancelled) {
          setMessage("Document unavailable while offline");
        }
      }
    };

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [documentId, ydoc]);


  const loadSharedUsers = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/member`);
      if (!response.ok) return;
      const payload = await response.json();
      setSharedUsers(payload.members);
    } catch {
    
    }
  }, [documentId]);

  useEffect(() => {
    if (isShareOpen) {
      loadSharedUsers();
    }
  }, [isShareOpen, loadSharedUsers]);


  useEffect(() => {
    if (!document || !canEdit) {
      setWsConnected(false);
      return;
    }

    const provider = new WebsocketProvider(
      YJS_WS_URL,
      documentId,
      ydoc,
      { connect: true }
    );

    provider.on("status", (event: { status: string }) => {
      setWsConnected(event.status === "connected");
    });

    return () => provider.destroy();
  }, [canEdit, document, documentId, ydoc]);


  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      avatarContainerRef.current &&
      !avatarContainerRef.current.contains(event.target as Node)
    ) {
      setShowAllUsers(false);
    }
  };

  window.document.addEventListener("mousedown", handleClickOutside);

  return () => {
    window.document.removeEventListener(
      "mousedown",
      handleClickOutside
    );
  };
}, []);

  useEffect(() => {
    const handleUpdate = async (update: Uint8Array) => {
      if (!canEdit) return;

      await queueYjsUpdate(documentId, update);
      await localDb.documents.update(documentId, {
        yjsState: uint8ToBase64(Y.encodeStateAsUpdate(ydoc))
      });

      setLastSaved(new Date().toLocaleTimeString());

      if (navigator.onLine) {
        await flushPendingUpdates(documentId, ydoc);
      }
    };

    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
    };
  }, [canEdit, documentId, ydoc]);
  useEffect(() => {
    const syncLocalChanges = async () => {
      if (!online) return;
      await flushPendingUpdates(documentId, ydoc);
      await localDb.documents.update(documentId, {
        yjsState: uint8ToBase64(Y.encodeStateAsUpdate(ydoc))
      });
    };

    syncLocalChanges();
  }, [documentId, online, ydoc]);


  const loadVersions = useCallback(async () => {
    try {
      const localVersions = await localDb.versions
        .where("documentId")
        .equals(documentId)
        .reverse()
        .sortBy("createdAt");
      
      setVersions(
        localVersions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ) as VersionPayload[]
      );

      const response = await fetch(`/api/documents/${documentId}/version`, {
        cache: "no-store"
      });
      
      if (!response.ok) return;
      
      const payload = (await response.json()) as { versions: VersionPayload[] };
      await localDb.versions.bulkPut(payload.versions);
      setVersions(payload.versions);
    } catch {
      
    }
  }, [documentId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  
 
  useEffect(() => {
  if (typeof window === "undefined") return;

  const refreshVersions = () => {
    void loadVersions();
  };

  const intervalId = window.setInterval(refreshVersions, 2500);

  const handleVisibilityChange = () => {
    if (window.document.visibilityState === "visible") {
      refreshVersions();
    }
  };

  window.document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    window.clearInterval(intervalId);

    window.document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, [loadVersions]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channelName = `${VERSION_SYNC_STORAGE_PREFIX}:${documentId}`;
    const channel = new BroadcastChannel(channelName);
    versionSyncChannelRef.current = channel;

    const refreshVersions = () => {
      void loadVersions();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === channelName && event.newValue) {
        refreshVersions();
      }
    };

    channel.addEventListener("message", refreshVersions);
    window.addEventListener("storage", handleStorage);

    return () => {
      channel.removeEventListener("message", refreshVersions);
      window.removeEventListener("storage", handleStorage);
      channel.close();
      versionSyncChannelRef.current = null;
    };
  }, [documentId, loadVersions]);

  
  useEffect(() => {
    if (!document) return;

    const provider = new WebsocketProvider(
      YJS_WS_URL,
      `${documentId}-version-events`,
      versionEventsDoc,
      { connect: true }
    );

    const handleVersionEvent = () => {
      void loadVersions();
    };
    
    versionEvents.observe(handleVersionEvent);

    return () => {
      versionEvents.unobserve(handleVersionEvent);
      provider.destroy();
    };
  }, [document, documentId, loadVersions, versionEvents, versionEventsDoc]);

  
  const publishVersionEvent = useCallback(
    (versionId: string) => {
      const payload = {
        versionId,
        nonce: crypto.randomUUID()
      };

      versionEvents.set("latest", payload);

      const channelName = `${VERSION_SYNC_STORAGE_PREFIX}:${documentId}`;

      try {
        window.localStorage.setItem(channelName, JSON.stringify(payload));
        window.localStorage.removeItem(channelName);
      } catch {
        
      }

      versionSyncChannelRef.current?.postMessage(payload);
    },
    [documentId, versionEvents]
  );

 
  useEffect(() => {
    const flushVersions = async () => {
      if (!online) return;

      const created = await flushPendingVersions(documentId);
      if (created.length > 0) {
        await loadVersions();
        publishVersionEvent(created[created.length - 1].id);
        setMessage("Offline snapshots synced");
      }
    };

    flushVersions();
  }, [documentId, loadVersions, online, publishVersionEvent]);

 
  const saveTitle = useCallback(async (newTitle: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "Title update failed");
        return;
      }

      setDocument((current) =>
        current ? { ...current, title: newTitle } : current
      );

      await localDb.documents.update(documentId, { title: newTitle });
      setLastSaved(new Date().toLocaleTimeString());
    } catch {
      setMessage("Title update failed");
    }
  }, [documentId]);

  useEffect(() => {
    if (!document) return;

    if (saveTitleTimeoutRef.current) {
      clearTimeout(saveTitleTimeoutRef.current);
    }

    saveTitleTimeoutRef.current = setTimeout(() => {
      if (title !== document.title) {
        saveTitle(title);
      }
    }, 1000);

    return () => {
      if (saveTitleTimeoutRef.current) {
        clearTimeout(saveTitleTimeoutRef.current);
      }
    };
  }, [title, document, saveTitle]);

 
  const createVersion = useCallback(async () => {
    if (!canEdit || !editor) return;

    const snapshot = uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
    const content = editor.getHTML() ?? "";
    const localVersion: LocalVersion = {
      id: `local-${crypto.randomUUID()}`,
      documentId,
      snapshot,
      content,
      createdBy: "local",
      createEmail: "Pending sync",
      createdAt: new Date().toISOString()
    };

    await localDb.versions.put(localVersion);
    setVersions((current) => [localVersion as VersionPayload, ...current]);

    if (!navigator.onLine) {
      await queueVersion(documentId, localVersion.id, snapshot, content);
      setMessage("Snapshot saved locally and will sync when online");
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/version`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ snapshot, content }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        await queueVersion(documentId, localVersion.id, snapshot, content);
        setMessage(payload?.error ?? "Snapshot saved locally and will retry when online");
        return;
      }

      const payload = (await response.json()) as { version: VersionPayload };
      await localDb.transaction("rw", localDb.versions, async () => {
        await localDb.versions.delete(localVersion.id);
        await localDb.versions.put(payload.version);
      });
      
      setVersions((current) => [
        payload.version,
        ...current.filter((version) => version.id !== localVersion.id)
      ]);
      
      publishVersionEvent(payload.version.id);
      setMessage("Snapshot created");
    } catch {
      await queueVersion(documentId, localVersion.id, snapshot, content);
      setMessage("Snapshot saved locally and will retry when online");
    }
  }, [canEdit, documentId, editor, publishVersionEvent, ydoc]);


  const restoreVersion = useCallback(async (versionId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/version`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ versionId }),
      });

      if (!response.ok) {
        setMessage("Restore failed");
        return;
      }

      const payload = (await response.json()) as {
        content: string;
        version: VersionPayload;
      };

      editor?.commands.setContent(payload.content);
      await loadVersions();
      publishVersionEvent(payload.version.id);
    } catch {
      setMessage("Restore failed");
    }
  }, [documentId, editor, loadVersions, publishVersionEvent]);


  const share = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setMessage("");
    setIsSharing(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.get("email"),
          role: form.get("role"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "Share failed");
        setIsSharing(false);
        return;
      }

      await response.json();
      setMessage("Document shared successfully");
      setIsSharing(false);
      setIsShareOpen(false);
      formElement.reset();
      await loadSharedUsers();
    } catch {
      setMessage("Share failed");
      setIsSharing(false);
    }
  }, [documentId, loadSharedUsers]);

  if (!document) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-neutral-500">Loading document…</p>
      </main>
    );
  }

  const sortedVersions = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <a
              href="/documents"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-neutral-500 hover:text-black"
            >
              <Icons.Back />
              Back
            </a>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              disabled={readOnly || !canEdit}
              className="w-full min-w-0 truncate bg-transparent text-xl font-semibold text-black outline-none disabled:text-neutral-400"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${roleStyle.badge}`}>
              <Icons.Role role={document.role} />
              {shareType || roleStyle.label}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                online
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
              {online ? "Online" : "Offline"}
            </span>

            <span
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
                wsConnected
                  ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                  : "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-sky-500" : "bg-amber-500"}`} />
              {wsConnected ? "Live sync" : "Not synced"}
            </span>

            {sharedUsers.length > 0 && (
              <div ref={avatarContainerRef} className="flex items-center">
                {(showAllUsers ? sharedUsers : sharedUsers.slice(0, 2)).map((user, index) => (
                  <div
                    key={index}
                    title={`${user.email} (${user.role})`}
                    className={`-ml-2 first:ml-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow ${getAvatarColor(user.email)}`}
                  >
                    {getInitials(user.email)}
                  </div>
                ))}

                {!showAllUsers && sharedUsers.length > 2 && (
                  <button
                    onClick={() => setShowAllUsers(true)}
                    className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-xs font-semibold text-neutral-700 shadow hover:bg-neutral-300"
                  >
                    +{sharedUsers.length - 2}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-6 pb-4">
          <button
            onClick={() => setIsVersionsOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-50"
          >
            <Icons.Clock />
            Versions
            {versions.length > 0 && (
              <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {versions.length}
              </span>
            )}
          </button>

          {document.role === "OWNER" && (
            <button
              onClick={() => setIsShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Icons.Share />
              Share
            </button>
          )}

          <button
            onClick={createVersion}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            <Icons.Plus />
            Create Snapshot
          </button>
        </div>
      </header>

      {message && (
        <div className="mx-auto mt-4 max-w-7xl px-6">
          <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
            <Icons.Info />
            {message}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-semibold text-neutral-500">Document Content</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                {wordCount} Words
              </span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                {charCount} Characters
              </span>
              {lastSaved && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  Saved at {lastSaved}
                </span>
              )}
            </div>
          </div>
          <div className="p-6 bg-white">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {isVersionsOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsVersionsOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-black">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Icons.Clock />
                </span>
                Version History
              </h2>
              <button
                onClick={() => setIsVersionsOpen(false)}
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-black"
                aria-label="Close"
              >
                <Icons.Close />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {sortedVersions.length === 0 ? (
                <p className="text-sm text-neutral-500">No versions yet. Create your first snapshot.</p>
              ) : (
                <ul className="space-y-3">
                  {sortedVersions.map((version, idx) => {
                    const versionNumber = sortedVersions.length - idx;
                    const name = version.createEmail || "Unknown";
                    const isLatest = idx === 0;
                    return (
                      <li
                        key={version.id}
                        className={`rounded-lg border p-4 ${
                          isLatest ? "border-indigo-200 bg-indigo-50/40" : "border-neutral-200"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-black">
                            Version {versionNumber}
                            {isLatest && (
                              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                Latest
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {new Date(version.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${getAvatarColor(name)}`}
                          >
                            {getInitials(name)}
                          </span>
                          <span className="truncate text-sm text-neutral-700">{name}</span>
                        </div>

                        <button
                          onClick={() => restoreVersion(version.id)}
                          disabled={document.role === "VIEWER"}
                          className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-white disabled:text-neutral-300"
                        >
                          Restore this version
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {isShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsShareOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-black">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Icons.Share />
                </span>
                Share document
              </h2>
              <button
                onClick={() => setIsShareOpen(false)}
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-black"
                aria-label="Close"
              >
                <Icons.Close />
              </button>
            </div>

            <form className="space-y-3" onSubmit={share}>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Email address
                </label>
                <Input
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="border-neutral-300 text-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Permission
                </label>
                <select
                  name="role"
                  aria-label="Permission"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-black outline-none focus:border-indigo-500"
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={isSharing}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isSharing ? "Sharing…" : "Share"}
              </Button>
            </form>

            {sharedUsers.length > 0 && (
              <div className="mt-4 border-t border-neutral-200 pt-4">
                <p className="mb-2 text-xs font-medium text-neutral-500">Shared with</p>
                <ul className="space-y-2">
                  {sharedUsers.map((user, i) => {
                    const style = ROLE_STYLES[user.role as keyof typeof ROLE_STYLES] ?? ROLE_STYLES.VIEWER;
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm text-neutral-700">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(user.email)}`}
                        >
                          {getInitials(user.email)}
                        </span>
                        <span className="flex-1 truncate">{user.email}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                          {style.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}