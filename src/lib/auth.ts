import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "./supabase-admin";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!googleClientId || !googleClientSecret) {
  throw new Error("Missing Google OAuth environment variables.");
}

const appleClientId = process.env.APPLE_CLIENT_ID;
const appleClientSecret = process.env.APPLE_CLIENT_SECRET;

function splitName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { fullName: null } as const;
  }
  return { fullName: trimmed } as const;
}

// Build providers list
const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  }),

  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const email = credentials.email.toLowerCase().trim();

      const { data: user } = await supabaseAdmin
        .from("app_users")
        .select("id, email, full_name, password_hash")
        .eq("email", email)
        .maybeSingle();

      if (!user || !user.password_hash) return null;

      const valid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.full_name };
    },
  }),
];

// Only add Apple provider if credentials are configured
if (appleClientId && appleClientSecret) {
  // Dynamic import not needed — next-auth/providers/apple is a lightweight module
  const AppleProvider = require("next-auth/providers/apple").default;
  providers.push(
    AppleProvider({
      clientId: appleClientId,
      clientSecret: appleClientSecret,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // For credentials, the user was already verified in authorize()
      if (account?.provider === "credentials") return true;

      // For OAuth providers, upsert the user record
      const email = user.email?.toLowerCase();
      if (!email) return false;

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

    async jwt({ token, trigger }: { token: JWT; trigger?: string }) {
      // On sign-in or manual update, embed org membership IDs into the token
      if (trigger === "signIn" || trigger === "update" || !token.organizationIds) {
        const email = token.email?.toLowerCase();
        if (email) {
          const { data: userRow } = await supabaseAdmin
            .from("app_users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (userRow) {
            const { data: memberships } = await supabaseAdmin
              .from("organization_memberships")
              .select("organization_id")
              .eq("user_id", userRow.id);

            token.organizationIds = (memberships ?? [])
              .map((m) => m.organization_id)
              .filter(Boolean);
          } else {
            token.organizationIds = [];
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.email) {
        session.user = session.user ?? {};
        session.user.email = token.email;
      }
      return session;
    },
  },
};
