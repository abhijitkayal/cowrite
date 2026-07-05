import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

const encoder = new TextEncoder();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return encoder.encode(secret);
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signAuthToken(user: AuthUser) {
  return new SignJWT({
    name: user.name,
    email: user.email
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function verifyAuthToken(token?: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.email || !payload.name) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name)
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const tokenUser = await verifyAuthToken(token);
  if (!tokenUser) return null;

  await connectDb();
  const user = await User.findById(tokenUser.id).select("_id name email").lean();
  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function getRequestUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return verifyAuthToken(token);
}
