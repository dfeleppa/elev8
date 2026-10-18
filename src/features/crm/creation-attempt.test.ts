import { describe, expect, it } from "vitest";
import { CreationAttempts, matchesCreation, saveCreation } from "./creation-attempt";
import type { ContactDetail } from "./workflow-contracts";
const empty = { notes:[],opportunities:[],tasks:[] } as unknown as ContactDetail;
const note = { action:"note",body:"Follow up" };
const conflict = () => Response.json({error:"Already saved"},{status:409});
describe("workflow creation retry identity",()=> {
 it("keeps the same operation through lost response, conflict, failed read and subsequent retry",async()=> {
  const attempts=new CreationAttempts(), ids:string[]=[];
  const lost=async(payload:Record<string,unknown>)=>{ids.push(String(payload.id)); throw new Error("Response lost after commit");};
  const retry=async(payload:Record<string,unknown>)=>{ids.push(String(payload.id)); return conflict();};
  await expect(saveCreation(attempts,note,lost,async()=>empty)).rejects.toThrow("Response lost");
  await expect(saveCreation(attempts,note,retry,async()=>{throw new Error("Read offline");})).rejects.toThrow("Read offline");
  await expect(saveCreation(attempts,note,retry,async()=>empty)).rejects.toThrow("Already saved");
  expect(new Set(ids).size).toBe(1);
  const persisted={...empty,notes:[{id:ids[0],body:"Follow up"}]} as ContactDetail;
  await saveCreation(attempts,note,retry,async()=>persisted);
  expect(new Set(ids).size).toBe(1);
  expect(attempts.prepare(note).id).not.toBe(ids[0]);
 });
 it("does not treat a conflicting record with different content as acknowledgement",async()=> {
  const attempts=new CreationAttempts(); const payload=attempts.prepare(note);
  await expect(saveCreation(attempts,note,async()=>conflict(),async()=>({...empty,notes:[{id:payload.id,body:"Different draft"}]} as ContactDetail))).rejects.toThrow();
  expect(attempts.prepare(note).id).toBe(payload.id);
 });
 it("acknowledges POST without depending on a read and leaves other pending action IDs intact",async()=> {
  const attempts=new CreationAttempts(); const first=attempts.prepare(note), task=attempts.prepare({action:"task"}); let reads=0;
  const result = await saveCreation(attempts,note,async()=>Response.json({saved:true}),async()=>{reads++;throw new Error("offline");});
  expect(reads).toBe(1);
  expect(result.refreshError).toBeInstanceOf(Error);
  expect(attempts.prepare(note).id).not.toBe(first.id);
  expect(attempts.prepare({action:"task"}).id).toBe(task.id);
 });
 it("compares normalized submitted fields and requires matching relationship/value/date data",()=> {
  expect(matchesCreation({...empty,notes:[{id:"a",body:"Follow up"}]} as ContactDetail,{id:"a",action:"note",body:" Follow up "})).toBe(true);
  const task={id:"a",title:"Call",assignee_id:null,opportunity_id:"b",due_at:"2026-10-19T14:00:00+00:00"};
  expect(matchesCreation({...empty,tasks:[task]} as ContactDetail,{...task,action:"task",due_at:"2026-10-19T10:00:00-04:00"})).toBe(true);
  expect(matchesCreation({...empty,tasks:[task]} as ContactDetail,{...task,action:"task",opportunity_id:"different"})).toBe(false);
 });
});
