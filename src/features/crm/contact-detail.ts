import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ContactDetail, ContactPatch } from "./contracts";

const fields = "id, full_name, email, phone, source, created_at, revision, updated_at";

export async function readContact(id: string) {
  const { data, error } = await supabaseAdmin.from("crm_contacts").select(fields).eq("id", id).maybeSingle();
  return { contact: data as ContactDetail | null, error };
}

export async function editContact(id: string, revision: number, patch: ContactPatch, actor: string) {
  // The revision predicate is part of the UPDATE, not just a preceding read.
  // PostgreSQL rechecks it after a concurrent writer releases its row lock.
  const { data, error } = await supabaseAdmin.from("crm_contacts")
    .update({ ...patch, updated_by: actor }).eq("id", id).eq("revision", revision)
    .select(fields).maybeSingle();
  return { contact: data as ContactDetail | null, error };
}

export async function readPatchBody(request: Request): Promise<{ body?: unknown; tooLarge?: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return {}; }
  finally { reader.releaseLock(); }
}
