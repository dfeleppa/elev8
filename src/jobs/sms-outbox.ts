import type { SmsOutboxStore, SmsProvider, SendOutcome } from "@/features/messaging/contracts";

/** Await this from a durable runner. No browser timers or unawaited work. */
export async function dispatchOneSms(store: SmsOutboxStore, provider: SmsProvider) {
  const job = await store.claim();
  if (!job) return "idle";
  const intent = await store.begin(job.message_id, job.lease_token);
  if (!intent) return "canceled-or-stale";
  let outcome: SendOutcome;
  try { outcome = await provider.send(intent); }
  catch { outcome = { kind: "uncertain" }; }
  // A database failure after acceptance deliberately leaves a sending lease. Recovery
  // quarantines it as uncertain instead of risking a second provider invocation.
  await store.settle(job.message_id, job.lease_token, outcome);
  return outcome.kind;
}
