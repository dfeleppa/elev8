import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { getClientIpFromHeaders, rateLimitByKey } from "./rate-limit";
import { loginWithEmailPassword } from "./supabase-auth-admin";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!googleClientId || !googleClientSecret) {
  throw new Error("Missing Google OAuth environment variables.");
}

const appleClientId = process.env.APPLE_CLIENT_ID;
const appleClientSecret = process.env.APPLE_CLIENT_SECRET;

// 10 attempts per IP per 15 minutes for the credentials login flow. Stops
// brute-force password guessing and limits user-existence probing through
// timing differences between known and unknown emails.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

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
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) return null;

      const ip = req?.headers ? getClientIpFromHeaders(req.headers) : "unknown";
      const limit = rateLimitByKey(ip, "credentials-login", LOGIN_LIMIT, LOGIN_WINDOW_MS);
      if (!limit.allowed) {
        // NextAuth's authorize must return null on failure; the user sees a
        // generic "invalid credentials" message. This is the desired UX for
        // a rate-limit hit too — we don't want to confirm to an attacker
        // that their guesses were close enough to trip the limit.
        return null;
      }

      const email = credentials.email.toLowerCase().trim();
      const result = await loginWithEmailPassword(email, credentials.password);

      if (!result.ok) return null;
      return { id: result.userId, email: result.email, name: result.fullName, verifiedAuthUid: result.supabaseAuthUid };
    },
  }),
];

// Only add Apple provider if credentials are configured
if (appleClientId && appleClientSecret) {
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
    async signIn({ account }) {
      // Invitation tickets and email matches are not identity ownership proof.
      // Keep OAuth gated until explicit provider-subject mapping is proven.
      return account?.provider === "credentials" ? true : "/login?error=identity_link_required";
    },

    async jwt({ token, user, account }) {
      // Only a password proof currently supplies a verified Supabase subject.
      // OAuth provider subjects need an explicit mapping before CRM access;
      // neither email matching nor client-triggered session updates can add it.
      if (user) {
        token.verifiedAuthUid = account?.provider === "credentials" ? user.verifiedAuthUid : undefined;
      }
      return token;
    },

    async session({ session, token }) {
      session.verifiedAuthUid = typeof token.verifiedAuthUid === "string" ? token.verifiedAuthUid : undefined;
      if (token.email) {
        session.user = session.user ?? {};
        session.user.email = token.email;
      }
      return session;
    },
  },
};
