export type RecoveryProof = { token_hash: string; type: "recovery" | "invite" };

/** Proof belongs in a URL fragment, never a query string or server log. */
export function parseRecoveryProof(hash: string): RecoveryProof | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const type = params.get("type");
  const token = params.get("token_hash");
  if (params.getAll("type").length !== 1 || params.getAll("token_hash").length !== 1 ||
      (type !== "recovery" && type !== "invite") || !token || !/^[a-zA-Z0-9_-]{32,256}$/.test(token)) return null;
  return { type, token_hash: token };
}
