"use server";

import { revalidatePath } from "next/cache";
import { requireUserContext } from "../../lib/member";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { hasRole } from "../../lib/member";

export async function createProject(formData: FormData) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  await supabaseAdmin.from("projects").insert({
    name,
    member_id: userId,
  });

  revalidatePath("/management");
}

export async function updateProject(id: string, name: string) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return;
  }

  await supabaseAdmin
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", userId);

  revalidatePath("/management");
}

export async function deleteProject(id: string) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("owner", role)) {
    return;
  }

  await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  revalidatePath("/management");
}
