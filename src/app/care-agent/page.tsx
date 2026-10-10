import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  redirect(
    `/admin?view=payments${run ? `&run=${encodeURIComponent(run)}` : ""}`,
  );
}
