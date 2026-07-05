import Dexie, { Table } from "dexie";

export type LocalDocument = {
  id: string;
  title: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  yjsState?: string;
  updatedAt?: string;
};

export type PendingUpdate = {
  id?: number;
  documentId: string;
  update: string;
  createdAt: number;
};

export type PendingVersion = {
  id?: number;
  localVersionId: string;
  documentId: string;
  snapshot: string;
  content: string;
  createdAt: number;
};

export type LocalVersion = {
  id: string;
  documentId: string;
  snapshot: string;
  content?: string;
  createdBy: string;
  createEmail?: string;
  createdAt: string;
};

class LocalFirstDb extends Dexie {
  documents!: Table<LocalDocument, string>;
  pendingUpdates!: Table<PendingUpdate, number>;
  pendingVersions!: Table<PendingVersion, number>;
  versions!: Table<LocalVersion, string>;

  constructor() {
    super("collab_docs_local_first");
    this.version(1).stores({
      documents: "id, updatedAt",
      pendingUpdates: "++id, documentId, createdAt",
      versions: "id, documentId, createdAt"
    });
    this.version(2).stores({
      documents: "id, updatedAt",
      pendingUpdates: "++id, documentId, createdAt",
      pendingVersions: "++id, documentId, createdAt, localVersionId",
      versions: "id, documentId, createdAt"
    });
  }
}

export const localDb = new LocalFirstDb();
