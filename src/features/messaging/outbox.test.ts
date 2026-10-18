import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { dispatchOneSms } from "@/jobs/sms-outbox";
import type { SmsOutboxStore } from "./contracts";

const db = new PGlite();
const contact = "00000000-0000-4000-8000-000000000001";
const operation = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000003";
const phone = "+12025550123";
async function call<T = Record<string, unknown>>(name: string, args: unknown[] = []) {
  return (await db.query<T>(`select * from ${name}(${args.map((_,i) => `$${i+1}`).join(",")})`, args)).rows;
}
const store: SmsOutboxStore = {
  async claim() { return (await call<{ message_id: string; lease_token: string }>("crm_sms_claim"))[0] ?? null; },
  async begin(id, token) { return (await call<{ id: string; phone: string; body: string }>("crm_sms_begin", [id,token]))[0] ?? null; },
  async settle(id, token, outcome) { await call("crm_sms_settle", [id, token, outcome.kind, outcome.kind === "accepted" ? outcome.sid : null]); },
};
async function enqueue(id = operation) { return call("crm_sms_enqueue", [id,contact,phone,"Hello",actor]); }
async function state() { return (await db.query<{state: string; delivery: string}>("select o.state,m.delivery from crm_sms_outbox o join crm_sms_messages m on m.id=o.message_id")).rows[0]; }
async function expire() { await db.exec("update crm_sms_outbox set lease_until=now()-interval '1 minute'"); }
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table app_users(id uuid primary key); insert into app_users values ('${actor}');`);
  await db.exec(readFileSync("supabase/migrations/20261017114730_crm_contacts_foundation.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261018001310_crm_messaging_outbox.sql", "utf8"));
  await db.query("insert into crm_contacts(id,full_name,phone) values ($1,'Synthetic', $2)", [contact,phone]);
}, 30000);
beforeEach(async () => {
  await db.exec("truncate crm_sms_provider_events,crm_sms_outbox,crm_sms_messages,crm_sms_preferences cascade");
  await db.query("insert into crm_sms_preferences(phone,allowed,evidence) values($1,true,'Synthetic consent fixture')", [phone]);
});
afterAll(async () => { await db.close(); });
it("atomically saves intent and outbox once; rejects operation payload changes and absent permission", async () => {
  await enqueue(); await enqueue();
  expect((await db.query("select * from crm_sms_messages")).rows).toHaveLength(1);
  expect((await db.query("select * from crm_sms_outbox")).rows).toHaveLength(1);
  await expect(call("crm_sms_enqueue", [operation,contact,phone,"Changed",actor])).rejects.toThrow(/conflict/);
  await db.exec("update crm_sms_preferences set allowed=false");
  await expect(enqueue("00000000-0000-4000-8000-000000000004")).rejects.toThrow(/suppressed/);
  expect((await db.query("select * from crm_sms_messages")).rows).toHaveLength(1);
});
it("recovers a crash before invocation and fences the stale worker", async () => {
  await enqueue(); const old = (await store.claim())!;
  await expire(); const recovered = (await store.claim())!;
  expect(recovered.lease_token).not.toBe(old.lease_token);
  expect(await store.begin(operation,old.lease_token)).toBeNull();
  const send = vi.fn(async () => ({kind: "accepted" as const, sid: "SMfixture"}));
  // Return the already recovered lease so this models process restart.
  await dispatchOneSms({...store, claim: async () => recovered}, {send});
  expect(send).toHaveBeenCalledTimes(1); expect((await state()).state).toBe("accepted");
});
it("never blindly retries after provider invocation or lost settlement", async () => {
  await enqueue();
  const send = vi.fn(async () => ({kind: "accepted" as const, sid: "SMfixture"}));
  await expect(dispatchOneSms({...store, settle: async () => { throw new Error("db unavailable"); }}, {send})).rejects.toThrow();
  await expire(); expect(await store.claim()).toBeNull();
  expect((await state()).state).toBe("uncertain");
  expect(await dispatchOneSms(store,{send})).toBe("idle"); expect(send).toHaveBeenCalledTimes(1);
  await call("crm_sms_event", ["callback:SMfixture:delivered",operation,"SMfixture","delivered",null]);
  expect(await state()).toMatchObject({state:"accepted",delivery:"delivered"});
});
it("deduplicates callbacks and prevents late queued/failure events from regressing delivery", async () => {
  await enqueue(); await dispatchOneSms(store,{send: async () => ({kind:"accepted",sid:"SMfixture"})});
  const args = ["delivered",operation,"SMfixture","delivered",null];
  await call("crm_sms_event",args); await call("crm_sms_event",args);
  await call("crm_sms_event",["late-queued",operation,"SMfixture","queued",null]);
  await call("crm_sms_event",["late-failed",operation,"SMfixture","failed",null]);
  expect((await state()).delivery).toBe("delivered");
  expect((await db.query("select * from crm_sms_provider_events")).rows).toHaveLength(3);
});
it("STOP cancels pending and claimed messages and prevents future manual enqueues", async () => {
  await enqueue(); const leased = (await store.claim())!;
  await call("crm_sms_event",["stop:SMstop",null,"SMstop","stop",phone]);
  expect(await store.begin(operation,leased.lease_token)).toBeNull();
  expect(await state()).toMatchObject({state:"canceled",delivery:"canceled"});
  await expect(enqueue()).rejects.toThrow(/suppressed/);
});
it("provider exceptions quarantine uncertain outcomes; explicit rejection permits bounded delayed retry", async () => {
  await enqueue(); await dispatchOneSms(store,{send: async () => {throw new Error("timeout");}});
  expect((await state()).state).toBe("uncertain");
  await db.exec("truncate crm_sms_outbox,crm_sms_messages cascade"); await enqueue();
  await dispatchOneSms(store,{send: async () => ({kind:"retry"})});
  expect((await state()).state).toBe("pending"); expect(await store.claim()).toBeNull();
});
it.each(["anon","authenticated"])("denies %s messaging tables and RPCs", async role => {
  await db.exec(`set role ${role}`);
  try {
    await expect(db.query("select * from crm_sms_messages")).rejects.toThrow();
    await expect(call("crm_sms_claim")).rejects.toThrow();
  } finally {await db.exec("reset role");}
});
it("executes invoker RPCs with the service role and retains RLS on all messaging tables", async () => {
  await db.exec("set role service_role");
  try { await enqueue(); expect(await store.claim()).not.toBeNull(); }
  finally { await db.exec("reset role"); }
  expect((await db.query("select relname from pg_class where relname like 'crm_sms_%' and relkind='r' and relrowsecurity")).rows).toHaveLength(4);
});
it("caps explicit rejected retries at five attempts", async () => {
  await enqueue(); const send=vi.fn(async()=>({kind:"retry" as const}));
  for(let attempt=0;attempt<5;attempt++) {
    await db.exec("update crm_sms_outbox set available_at=now()-interval '1 second'");
    await dispatchOneSms(store,{send});
  }
  expect(await state()).toMatchObject({state:"failed",delivery:"failed"});
  expect(await store.claim()).toBeNull(); expect(send).toHaveBeenCalledTimes(5);
});
it("STOP blocks another contact sharing the phone and cancels delayed follow-ups", async () => {
  await enqueue(); await dispatchOneSms(store,{send:async()=>({kind:"retry"})});
  await call("crm_sms_event",["stop-shared",null,"SMstop","stop",phone]);
  const other="00000000-0000-4000-8000-000000000006";
  await db.query("insert into crm_contacts(id,full_name,phone) values($1,'Shared household',$2) on conflict do nothing",[other,phone]);
  await expect(call("crm_sms_enqueue",["00000000-0000-4000-8000-000000000007",other,phone,"Follow-up",actor])).rejects.toThrow(/suppressed/);
  expect((await state()).state).toBe("canceled");
});
it("STOP during provider attempt cancels a later explicit rejection instead of requeueing", async () => {
  await enqueue();
  await dispatchOneSms(store,{send:async()=>{
    await call("crm_sms_event",["stop-in-flight",null,"SMstop","stop",phone]);
    return {kind:"retry"};
  }});
  expect(await state()).toMatchObject({state:"canceled",delivery:"canceled"});
});
it("persists late same-attempt provider acceptance after sending lease recovery without resending", async () => {
  await enqueue(); const job = (await store.claim())!;
  expect(await store.begin(operation,job.lease_token)).not.toBeNull();
  await expire(); expect(await store.claim()).toBeNull();
  expect((await state()).state).toBe("uncertain");
  await store.settle(operation,job.lease_token,{kind:"accepted",sid:"SMlateAccepted"});
  expect(await state()).toMatchObject({state:"accepted",delivery:"accepted"});
  expect((await db.query<{provider_sid:string}>("select provider_sid from crm_sms_messages where id=$1",[operation])).rows[0].provider_sid).toBe("SMlateAccepted");
  const send=vi.fn(async()=>({kind:"accepted" as const,sid:"SMduplicate"}));
  expect(await dispatchOneSms(store,{send})).toBe("idle");
  expect(send).not.toHaveBeenCalled();
});
it("does not accept positive evidence from a wrong lease token after expiry recovery", async () => {
  await enqueue(); const job = (await store.claim())!;
  await store.begin(operation,job.lease_token); await expire(); await store.claim();
  await store.settle(operation,"00000000-0000-4000-8000-000000000099",{kind:"accepted",sid:"SMwrongAttempt"});
  expect(await state()).toMatchObject({state:"uncertain",delivery:"pending"});
  expect((await db.query<{provider_sid:string|null}>("select provider_sid from crm_sms_messages where id=$1",[operation])).rows[0].provider_sid).toBeNull();
});
it.each(["retry","failed","uncertain"] as const)("does not reopen recovered uncertain job with a late %s result", async kind => {
  await enqueue(); const job = (await store.claim())!;
  await store.begin(operation,job.lease_token); await expire(); await store.claim();
  await store.settle(operation,job.lease_token,{kind});
  expect(await state()).toMatchObject({state:"uncertain",delivery:"pending"});
  expect(await store.claim()).toBeNull();
});
it("cannot requeue an expired sending lease before the recovery sweep runs", async () => {
  await enqueue(); const job=(await store.claim())!;
  await store.begin(operation,job.lease_token); await expire();
  await store.settle(operation,job.lease_token,{kind:"retry"});
  await store.claim();
  expect(await state()).toMatchObject({state:"uncertain",delivery:"pending"});
});
