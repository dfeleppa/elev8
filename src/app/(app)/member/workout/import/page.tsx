import { redirect } from "next/navigation";
import { hasRole, requireUserContext } from "@/lib/member";
import { isMemberRouteLocked } from "@/lib/feature-flags";
import ResultsPreview from "./ResultsPreview";

export default async function ResultsImportPage() {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) redirect("/login");
  if (isMemberRouteLocked(role, "/member/workout/import"))
    redirect("/member/nutrition");
  return <ResultsPreview />;
}
