import CareWorkspace from "@/components/care/workspace";
import "./care.css";
export const metadata = { title: "Your care workspace · CarePilot" };
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialView =
    params.view === "payments" || params.run
      ? "payments"
      : params.view === "calendar"
        ? "calendar"
        : "overview";
  return <CareWorkspace initialView={initialView} />;
}
