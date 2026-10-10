import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(
    `/admin?view=payments${q ? `&query=${encodeURIComponent(q.slice(0, 160))}` : ""}`,
  );
}
