import { NextResponse } from "next/server";
import { authenticateDemo } from "@/lib/fixtures";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginPayload;
  const resident = authenticateDemo(payload.email, payload.password);
  if (!resident) {
    return NextResponse.json(
      { error: "That ID and password do not match the demo access record." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("marsbank-demo-session", resident.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("marsbank-demo-session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
