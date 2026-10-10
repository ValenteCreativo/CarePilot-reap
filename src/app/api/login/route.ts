import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { setUserCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (!existing || !existing.passwordHash) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const ok = verifyPassword(password, existing.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    await setUserCookie(existing.id);

    return NextResponse.json({ ok: true, userId: existing.id });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Failed to login" }, { status: 500 });
  }
}
