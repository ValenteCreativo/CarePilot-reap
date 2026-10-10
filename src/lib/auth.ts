import { cookies } from "next/headers";
export async function setUserCookie(userId: string): Promise<void> {
  (await cookies()).set("cp_uid", userId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
}
