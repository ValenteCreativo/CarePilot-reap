import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  assertSameOrigin,
  issueSession,
  requireIdentity,
  sessionCookie,
} from "@/lib/care-agent/auth";
import { fail, limit } from "@/lib/care-agent/http";
import { reapConfig } from "@/lib/reap/client";
import { AgentError } from "@/lib/care-agent/types";
import { hashPassword } from "@/lib/password";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(
    {
      enabled: process.env.CAREPILOT_DEMO_ENABLED === "true",
      simulation: process.env.REAP_SIMULATE_CHECKOUT === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (process.env.CAREPILOT_DEMO_ENABLED !== "true")
      throw new AgentError(
        "DEMO_DISABLED",
        "Judge access is not enabled.",
        403,
      );
    reapConfig(); // Never allow this access against a real payment environment.
    try {
      return NextResponse.json({ identity: await requireIdentity() });
    } catch (error) {
      if (
        !(error instanceof AgentError) ||
        !["LOGIN_REQUIRED", "SESSION_INVALID"].includes(error.code)
      )
        throw error;
    }
    await limit(
      "demo",
      request.headers.get("x-forwarded-for")?.split(",")[0] || "local",
      20,
    );
    const identity = {
      id: randomUUID(),
      email: `judge-${randomUUID()}@example.com`,
      name: "Demo caregiver",
    };
    const sql = neon(process.env.DATABASE_URL!);
    await sql`INSERT INTO users(id,email,name,password_hash) VALUES (${identity.id}::uuid,${identity.email},${identity.name},${hashPassword(randomBytes(32).toString("hex"))})`;
    (await cookies()).set(sessionCookie, issueSession(identity), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    return NextResponse.json(
      { identity },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
