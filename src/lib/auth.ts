import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { supabaseAdmin } from "./supabase-admin";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!googleClientId || !googleClientSecret) {
  throw new Error("Missing Google OAuth environment variables.");
}

function splitName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { fullName: null } as const;
  }
  return { fullName: trimmed } as const;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) {
        return false;
      }

      const { fullName } = splitName(user.name);
      await supabaseAdmin.from("app_users").upsert(
        {
          email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      return true;
    },
  },
};
