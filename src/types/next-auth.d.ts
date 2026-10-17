import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { verifiedAuthUid?: string }
  interface Session { verifiedAuthUid?: string }
}

declare module "next-auth/jwt" {
  interface JWT { verifiedAuthUid?: string }
}
