import { redirect } from "next/navigation";

import { isMemberRouteLocked } from "@/lib/feature-flags";
import { hasRole, requireUserContext } from "@/lib/member";
import ChatClient from "./ChatClient";

export default async function MemberChatPage() {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    redirect("/login");
  }
  if (isMemberRouteLocked(role, "/member/chat")) {
    redirect("/member/nutrition");
  }

  return (
    <div className="w-full max-w-none px-0 py-0">
      <ChatClient />
    </div>
  );
}
