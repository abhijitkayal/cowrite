import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { MAX_JSON_BYTES } from "@/lib/constants";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseJson<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
  maxBytes = MAX_JSON_BYTES
): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new RequestError("Payload too large", 413);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    throw new RequestError("Malformed request body", 400);
  }

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new RequestError("Payload too large", 413);
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new RequestError("Invalid JSON", 400);
  }

  return schema.parse(body);
}

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function handleRouteError(err: unknown) {
  if (err instanceof RequestError) {
    return error(err.message, err.status, err.details);
  }

  if (err instanceof ZodError) {
    return error("Validation failed", 422, err.flatten());
  }

  console.error(err);
  return error("Internal server error", 500);
}
