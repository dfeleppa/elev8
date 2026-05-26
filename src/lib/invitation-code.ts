import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "./supabase-admin";

export const INVITATION_TICKET_COOKIE = "lyfe_invite_ticket";
const INVITATION_TICKET_TTL_SECONDS = 10 * 60;

export function normalizeInvitationCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function getTicketSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET.");
  }
  return secret;
}

function signValue(value: string) {
  return createHmac("sha256", getTicketSecret()).update(value).digest("base64url");
}

export async function verifyInvitationCode(value: unknown): Promise<boolean> {
  const code = normalizeInvitationCode(value);
  if (!code) return false;

  const { data, error } = await supabaseAdmin
    .from("gym_settings")
    .select("invitation_code")
    .eq("id", 1)
    .single();

  if (error || !data?.invitation_code) return false;

  return normalizeInvitationCode(data.invitation_code) === code;
}

export function createInvitationTicket() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + INVITATION_TICKET_TTL_SECONDS })
  ).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

export function verifyInvitationTicket(ticket: string | null | undefined) {
  if (!ticket) return false;
  const [payload, signature] = ticket.split(".", 2);
  if (!payload || !signature) return false;

  const expected = signValue(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getInvitationTicketMaxAgeSeconds() {
  return INVITATION_TICKET_TTL_SECONDS;
}
