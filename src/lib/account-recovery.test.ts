import { describe, it, expect } from "vitest";
import { parseRecoveryProof } from "./account-recovery";

describe("recovery proof parsing", () => {
  const token = "a".repeat(64);
  it.each(["recovery", "invite"])("accepts %s proofs", type => {
    expect(parseRecoveryProof(`#type=${type}&token_hash=${token}`)).toEqual({ type, token_hash: token });
  });
  it.each(["", "#type=magiclink&token_hash=" + token, "#type=recovery", "#type=recovery&token_hash=x",
    `#type=invite&type=recovery&token_hash=${token}`, `#type=recovery&token_hash=${token}&token_hash=${token}`,
    `#type=recovery&token_hash=${"a".repeat(257)}`, "#type=recovery&token_hash=" + "%20".repeat(32)])("rejects invalid or ambiguous proof %s", hash => {
    expect(parseRecoveryProof(hash)).toBeNull();
  });
});
