import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { setUserCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, phone } = body as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
    };

    if (!email || !password || !name || !phone) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existing) {
      return NextResponse.json({ message: "Email already in use" }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        phoneNumber: normalizedPhone,
      })
      .returning();

    await setUserCookie(newUser.id);

    return NextResponse.json({ ok: true, userId: newUser.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ message: "Failed to sign up" }, { status: 500 });
  }
}
