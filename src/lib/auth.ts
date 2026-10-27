import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { INVITATION_TICKET_COOKIE, verifyInvitationTicket } from "./invitation-code";
import { oauthIdentityForAccount, resolveOAuthIdentity, registerOAuthMember } from "./oauth-identity";

const providers: NextAuthOptions["providers"] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    checks: ["pkce", "state", "nonce"],
  }));
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(AppleProvider({
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
    checks: ["state", "nonce"],
  }));
}

export const authOptions: NextAuthOptions = {
  providers,
  // Apple's cross-site form POST must retain short-lived state/nonce cookies.
  // Apple requires HTTPS in every environment.
  ...(process.env.NEXTAUTH_URL?.startsWith("https://") ? { cookies: {
    callbackUrl: { name: "__Secure-next-auth.callback-url", options: { sameSite: "none" as const, path: "/", secure: true } },
    state: { name: "__Secure-next-auth.state", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
    nonce: { name: "__Secure-next-auth.nonce", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
    pkceCodeVerifier: { name: "__Secure-next-auth.pkce.code_verifier", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
  } } : {}),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      const identity = oauthIdentityForAccount(account, profile);
      if (!identity) return false;
      if (await resolveOAuthIdentity(identity)) return true;
      const ticket = (await cookies()).get(INVITATION_TICKET_COOKIE)?.value;
      if (!verifyInvitationTicket(ticket)) return "/login?error=identity_link_required";
      // Invitations create new members, never claim existing accounts or roles.
      return await registerOAuthMember(identity, profile)
        ? true : "/login?error=identity_link_required";
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        delete token.verifiedAuthUid;
        token.oauthIdentity = oauthIdentityForAccount(account, profile) ?? undefined;
      }
      // Client session updates never supply authentication proof.
      return token;
    },
    async session({ session, token }) {
      session.oauthIdentity = token.oauthIdentity;
      return session;
    },
  },
};
