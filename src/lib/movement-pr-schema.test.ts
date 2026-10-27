import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    create table workout_results(id text primary key);
    insert into workout_results values ('record'), ('lighter'), ('new-record');
    create table member_movement_prs(
      member_id text not null, movement_id text not null,
      best_weight numeric, best_reps integer, estimated_one_rep_max numeric,
      source_result_id text references workout_results(id) on delete set null,
      recorded_at timestamptz not null, updated_at timestamptz not null,
      unique(member_id, movement_id)
    );
  `);
  await db.exec(readFileSync("supabase/migrations/20261027180901_preserve_movement_personal_records.sql", "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("truncate member_movement_prs; insert into workout_results values ('record'), ('lighter'), ('new-record') on conflict do nothing");
});
async function save(weight: number | null, reps: number | null, estimated: number | null, source = "record", timestamp = "2026-10-26T10:00:00Z") {
  await db.query(`insert into member_movement_prs values ('member','squat',$1,$2,$3,$4,$5,$5)
    on conflict(member_id,movement_id) do update set best_weight=excluded.best_weight,
    best_reps=excluded.best_reps, estimated_one_rep_max=excluded.estimated_one_rep_max,
    source_result_id=excluded.source_result_id, recorded_at=excluded.recorded_at, updated_at=excluded.updated_at`,
  [weight, reps, estimated, source, timestamp]);
}
async function current() {
  return (await db.query("select best_weight::float8, best_reps, estimated_one_rep_max::float8, source_result_id, recorded_at, updated_at from member_movement_prs")).rows[0];
}
it("preserves PRs and their provenance after a lighter workout upsert", async () => {
  await save(225, 5, 262.5);
  const before = await current();
  await save(135, 5, 157.5, "lighter", "2026-10-27T10:00:00Z");
  expect(await current()).toEqual(before);
});
it("merges independent improvements without lowering other records", async () => {
  await save(225, 5, 262.5);
  await save(200, 10, 266.67, "new-record");
  expect(await current()).toMatchObject({ best_weight: 225, best_reps: 10, estimated_one_rep_max: 266.67, source_result_id: "new-record" });
  await save(250, 1, 258.33, "record");
  expect(await current()).toMatchObject({ best_weight: 250, best_reps: 10, estimated_one_rep_max: 266.67 });
});
it.each([true, false])("preserves maxima when overlapping saves complete in either order (%s)", async reverse => {
  const inputs = [[135, 5, 157.5], [225, 5, 262.5]] as const;
  await Promise.all((reverse ? [...inputs].reverse() : inputs).map(values => save(values[0], values[1], values[2])));
  expect(await current()).toMatchObject({ best_weight: 225, best_reps: 5, estimated_one_rep_max: 262.5 });
});
it("fills missing values and never replaces records with null", async () => {
  await save(null, null, null);
  await save(225, 5, 262.5);
  await save(null, null, null);
  expect(await current()).toMatchObject({ best_weight: 225, best_reps: 5, estimated_one_rep_max: 262.5 });
});
it("retains PR values while allowing deletion of the source workout", async () => {
  await save(225, 5, 262.5, "new-record");
  await db.exec("delete from workout_results where id='new-record'");
  expect(await current()).toMatchObject({ best_weight: 225, source_result_id: null });
});
it("does not expose a privileged callable database function", async () => {
  expect((await db.query("select prosecdef from pg_proc where oid='public.preserve_movement_personal_records()'::regprocedure")).rows).toEqual([{ prosecdef: false }]);
  expect((await db.query(`select exists (
    select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
    where p.oid='public.preserve_movement_personal_records()'::regprocedure
      and a.grantee=0 and a.privilege_type='EXECUTE'
  ) as public_execute`)).rows).toEqual([{ public_execute: false }]);
});
