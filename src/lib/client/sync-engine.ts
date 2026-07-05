"use client";

import * as Y from "yjs";
import { base64ToUint8, uint8ToBase64 } from "@/lib/client/base64";
import { localDb, LocalVersion } from "@/lib/client/offline-db";

export function watchOnlineStatus(onChange: (online: boolean) => void) {
  onChange(navigator.onLine);
  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

export async function queueYjsUpdate(documentId: string, update: Uint8Array) {
  await localDb.pendingUpdates.add({
    documentId,
    update: uint8ToBase64(update),
    createdAt: Date.now()
  });
}

export async function flushPendingUpdates(documentId: string, ydoc: Y.Doc) {
  if (!navigator.onLine) return;

  const pending = await localDb.pendingUpdates
    .where("documentId")
    .equals(documentId)
    .sortBy("createdAt");

  const stateVector = uint8ToBase64(Y.encodeStateVector(ydoc));
  const response = await fetch(`/api/documents/${documentId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updates: pending.map((item) => item.update),
      stateVector
    })
  });

  if (!response.ok) return;
  const payload = (await response.json()) as { update?: string };
  if (payload.update) {
    Y.applyUpdate(ydoc, base64ToUint8(payload.update));
  }

  await localDb.documents.update(documentId, {
    yjsState: uint8ToBase64(Y.encodeStateAsUpdate(ydoc))
  });

  const ids = pending
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");
  if (ids.length > 0) await localDb.pendingUpdates.bulkDelete(ids);
}

export async function queueVersion(
  documentId: string,
  localVersionId: string,
  snapshot: string,
  content: string
) {
  await localDb.pendingVersions.add({
    documentId,
    localVersionId,
    snapshot,
    content,
    createdAt: Date.now()
  });
}

export async function flushPendingVersions(documentId: string) {
  if (!navigator.onLine) return [];

  const pending = await localDb.pendingVersions
    .where("documentId")
    .equals(documentId)
    .sortBy("createdAt");

  const createdVersions: LocalVersion[] = [];

  for (const item of pending) {
    const response = await fetch(`/api/documents/${documentId}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: item.snapshot, content: item.content })
    });

    if (!response.ok) continue;

    const payload = (await response.json()) as { version: LocalVersion };
    await localDb.transaction(
      "rw",
      localDb.versions,
      localDb.pendingVersions,
      async () => {
        await localDb.versions.delete(item.localVersionId);
        await localDb.versions.put(payload.version);
        if (typeof item.id === "number") {
          await localDb.pendingVersions.delete(item.id);
        }
      }
    );
    createdVersions.push(payload.version);
  }

  return createdVersions;
}
