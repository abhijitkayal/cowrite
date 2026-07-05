export const AUTH_COOKIE_NAME = "collab_auth";
export const MAX_JSON_BYTES = 256 * 1024;
export const MAX_YJS_UPDATE_BYTES = 1024 * 1024;
export const MAX_YJS_UPDATES_PER_SYNC = 50;

export const roles = ["OWNER", "EDITOR", "VIEWER"] as const;
export type Role = (typeof roles)[number];
