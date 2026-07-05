import * as Y from "yjs";
import { MAX_YJS_UPDATE_BYTES } from "@/lib/constants";

export function bufferToBase64(buffer: Buffer | Uint8Array) {
  return Buffer.from(buffer).toString("base64");
}

export function toNodeBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (
    value &&
    typeof value === "object" &&
    "buffer" in value &&
    value.buffer instanceof Uint8Array
  ) {
    return Buffer.from(value.buffer);
  }
  return Buffer.alloc(0);
}

export function base64ToUpdate(value: string) {
  const update = Buffer.from(value, "base64");
  if (update.byteLength > MAX_YJS_UPDATE_BYTES) {
    const err = new Error("Yjs update payload too large");
    err.name = "PAYLOAD_TOO_LARGE";
    throw err;
  }
  return new Uint8Array(update);
}

export function createEmptyYjsState() {
  const doc = new Y.Doc();
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return Buffer.from(update);
}

export function applyUpdatesToState(
  currentState: Buffer | Uint8Array,
  updates: Uint8Array[]
) {
  const doc = new Y.Doc();
  if (currentState.byteLength > 0) {
    Y.applyUpdate(doc, new Uint8Array(currentState));
  }
  for (const update of updates) {
    Y.applyUpdate(doc, update);
  }
  const nextState = Buffer.from(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return nextState;
}

export function diffState(
  currentState: Buffer | Uint8Array,
  stateVector?: Uint8Array
) {
  const doc = new Y.Doc();
  if (currentState.byteLength > 0) {
    Y.applyUpdate(doc, new Uint8Array(currentState));
  }
  const update = stateVector
    ? Y.encodeStateAsUpdate(doc, stateVector)
    : Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return Buffer.from(update);
}
