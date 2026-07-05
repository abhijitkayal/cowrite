import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import {
  handleRouteError,
  json,
  parseJson,
  RequestError
} from "@/lib/http";
import {
  hashPassword,
  setAuthCookie,
  signAuthToken
} from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const input = await parseJson(request, registerSchema);
    await connectDb();

    const existingUser = await User.findOne({ email: input.email }).lean();
    if (existingUser) {
      throw new RequestError("Email is already registered", 409);
    }

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password)
    });

    const authUser = {
      id: String(user._id),
      name: user.name,
      email: user.email
    };
    const token = await signAuthToken(authUser);
    const response = NextResponse.json({ user: authUser }, { status: 201 });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
