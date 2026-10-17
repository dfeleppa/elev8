import "server-only";
export {
  requireWebIdentity as requireWebClientContext,
  requireRequestIdentity as requireClientContext,
} from "@/lib/identity-context";

export function allowsMutationOrigin(request: Request) {
  if (request.headers.has("authorization")) return true; // Auth gate validates the token first.
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  return origin === expected;
}
