export type SmsIntent = { id: string; phone: string; body: string };
export type SendOutcome =
  | { kind: "accepted"; sid: string }
  | { kind: "retry" | "failed" | "uncertain" };
export interface SmsProvider {
  /** A stable operation ID is for correlation, not a promise of provider idempotency. */
  send(intent: SmsIntent): Promise<SendOutcome>;
}
export interface SmsOutboxStore {
  claim(): Promise<{ message_id: string; lease_token: string } | null>;
  begin(id: string, token: string): Promise<SmsIntent | null>;
  settle(id: string, token: string, outcome: SendOutcome): Promise<void>;
}
