import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { requireIdentity, assertSameOrigin } from "@/lib/care-agent/auth";
import { AgentError } from "@/lib/care-agent/types";
import { body, fail, limit } from "@/lib/care-agent/http";
import { circleStateSchema } from "@/lib/care-circle/schema";
export const runtime = "nodejs";
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(80),
    state: circleStateSchema,
  }),
  z.object({
    action: z.literal("save"),
    circleId: z.uuid(),
    revision: z.number().int().positive(),
    state: circleStateSchema,
  }),
  z.object({ action: z.literal("invite"), circleId: z.uuid() }),
  z.object({
    action: z.literal("join"),
    token: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(1).max(80),
  }),
]);
export async function GET(request: Request) {
  try {
    const identity = await requireIdentity();
    const sql = neon(process.env.DATABASE_URL!);
    const id = new URL(request.url).searchParams.get("id");
    if (id && !z.uuid().safeParse(id).success)
      throw new AgentError("CIRCLE_INVALID", "Invalid care circle.");
    const rows = id
      ? await sql`SELECT c.id,c.state,c.revision,m.slot,c.owner_id FROM care_circles c JOIN care_circle_members m ON m.circle_id=c.id WHERE m.user_id=${identity.id}::uuid AND c.id=${id}::uuid`
      : await sql`SELECT c.id,c.state,c.revision,m.slot,c.owner_id FROM care_circles c JOIN care_circle_members m ON m.circle_id=c.id WHERE m.user_id=${identity.id}::uuid ORDER BY c.updated_at DESC LIMIT 1`;
    if (!rows[0])
      return NextResponse.json(
        { circle: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    const c = rows[0];
    const members =
      await sql`SELECT slot,name FROM care_circle_members WHERE circle_id=${c.id}::uuid ORDER BY slot`;
    return NextResponse.json(
      {
        circle: {
          id: c.id,
          state: c.state,
          revision: c.revision,
          slot: c.slot,
          isOwner: c.owner_id === identity.id,
          members,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireIdentity();
    await limit("circle", identity.id, 150);
    const input = command.parse(await body(request));
    const sql = neon(process.env.DATABASE_URL!);
    if (input.action === "create") {
      const id = randomUUID();
      await sql.transaction([
        sql`INSERT INTO care_circles(id,owner_id,state) VALUES(${id}::uuid,${identity.id}::uuid,${JSON.stringify(input.state)}::jsonb)`,
        sql`INSERT INTO care_circle_members(circle_id,user_id,slot,name) VALUES(${id}::uuid,${identity.id}::uuid,'vale',${input.name})`,
      ]);
      return NextResponse.json({ id });
    }
    if (input.action === "join") {
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      // Lock the circle row while allocating one of the two caregiver seats; consume invite atomically.
      const rows =
        await sql`WITH invite AS (SELECT i.circle_id FROM care_circle_invites i JOIN care_circles c ON c.id=i.circle_id WHERE i.token_hash=${tokenHash} AND i.used_by IS NULL AND i.expires_at>now() FOR UPDATE OF c,i), seat AS (SELECT invite.circle_id,s.slot FROM invite CROSS JOIN (VALUES ('guille'),('helper')) s(slot) WHERE NOT EXISTS (SELECT 1 FROM care_circle_members m WHERE m.circle_id=invite.circle_id AND (m.slot=s.slot OR m.user_id=${identity.id}::uuid)) ORDER BY s.slot LIMIT 1), added AS (INSERT INTO care_circle_members(circle_id,user_id,slot,name) SELECT circle_id,${identity.id}::uuid,slot,${input.name} FROM seat ON CONFLICT DO NOTHING RETURNING circle_id), consumed AS (UPDATE care_circle_invites SET used_by=${identity.id}::uuid WHERE token_hash=${tokenHash} AND circle_id IN (SELECT circle_id FROM added) RETURNING circle_id) SELECT circle_id AS id FROM consumed`;
      if (!rows[0])
        throw new AgentError(
          "INVITE_UNAVAILABLE",
          "This invite expired, was used, or this circle already has three caregivers.",
          409,
        );
      return NextResponse.json(rows[0]);
    }
    const membership =
      await sql`SELECT c.owner_id FROM care_circles c JOIN care_circle_members m ON m.circle_id=c.id WHERE c.id=${input.circleId}::uuid AND m.user_id=${identity.id}::uuid`;
    if (!membership[0])
      throw new AgentError(
        "CIRCLE_FORBIDDEN",
        "This care circle is not available to your account.",
        403,
      );
    if (input.action === "invite") {
      if (membership[0].owner_id !== identity.id)
        throw new AgentError(
          "INVITE_FORBIDDEN",
          "Only the circle coordinator can invite caregivers.",
          403,
        );
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await sql`INSERT INTO care_circle_invites(token_hash,circle_id,expires_at) VALUES(${tokenHash},${input.circleId}::uuid,now()+interval '7 days')`;
      return NextResponse.json({
        path: `/admin?invite=${token}`,
        expiresInDays: 7,
      });
    }
    const rows =
      await sql`UPDATE care_circles SET state=${JSON.stringify(input.state)}::jsonb,revision=revision+1,updated_at=now() WHERE id=${input.circleId}::uuid AND revision=${input.revision} RETURNING revision`;
    if (!rows[0])
      throw new AgentError(
        "CIRCLE_CONFLICT",
        "Another caregiver updated the plan. Your edits are kept; review the shared version before saving.",
        409,
      );
    return NextResponse.json({ revision: rows[0].revision });
  } catch (error) {
    return fail(error);
  }
}
