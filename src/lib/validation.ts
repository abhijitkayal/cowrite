import { z } from "zod";
import { roles } from "@/lib/constants";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320).toLowerCase(),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(320).toLowerCase(),
  password: z.string().min(1).max(128)
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  update: z.string().base64().optional()
});

export const shareDocumentSchema = z.object({
  email: z.string().trim().email().max(320).toLowerCase(),
  role: z.enum(roles)
});

export const syncSchema = z.object({
  updates: z.array(z.string().base64()).max(50).default([]),
  stateVector: z.string().base64().optional()
});

export const createVersionSchema = z.object({
  snapshot: z.string().base64().optional(),
  content: z.string()
});

export const restoreVersionSchema = z.object({
  versionId: objectIdSchema
});
