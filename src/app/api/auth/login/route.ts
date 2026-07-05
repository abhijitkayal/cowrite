import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import {
  handleRouteError,
  parseJson,
  RequestError
} from "@/lib/http";
import {
  setAuthCookie,
  signAuthToken,
  verifyPassword
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const input = await parseJson(request, loginSchema);
    await connectDb();

    const user = await User.findOne({ email: input.email });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new RequestError("Invalid email or password", 401);
    }

    const authUser = {
      id: String(user._id),
      name: user.name,
      email: user.email
    };
    const token = await signAuthToken(authUser);
    const response = NextResponse.json({ user: authUser });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
