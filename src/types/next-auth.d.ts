import "next-auth";
import "next-auth/jwt";
import type { OAuthIdentity } from "@/lib/oauth-identity";

declare module "next-auth" {
  interface User { verifiedAuthUid?: string }
  interface Session { verifiedAuthUid?: string; oauthIdentity?: OAuthIdentity }
}

declare module "next-auth/jwt" {
  interface JWT { verifiedAuthUid?: string; oauthIdentity?: OAuthIdentity }
}
