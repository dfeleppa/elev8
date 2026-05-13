import { redirect } from "next/navigation";

export default async function CoachNutritionMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  redirect(`/coach/nutrition?memberId=${encodeURIComponent(memberId)}`);
}
