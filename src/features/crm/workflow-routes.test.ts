import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), from: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), result: { data: {id:"x"} as unknown, error: null as unknown } }));
vi.mock("@/features/crm/context", () => ({ requireClientContext: mocks.context, allowsMutationOrigin: mocks.origin }));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: mocks.from } }));
import { GET, PATCH } from "@/app/api/v1/crm/contacts/[id]/route";
import { POST } from "@/app/api/v1/crm/contacts/[id]/workflow/route";
const id = "00000000-0000-4000-8000-000000000001";
const ctx = () => ({params:Promise.resolve({id})});
const req = (body: unknown = {}) => new Request("https://app.test/api/v1/crm/contacts/"+id, {method:"POST",body:JSON.stringify(body)});
describe("CRM workflow permissions and record boundaries", () => {
 beforeEach(() => {
  vi.clearAllMocks(); mocks.context.mockResolvedValue({userId:id,role:"admin",error:null}); mocks.origin.mockReturnValue(true); mocks.result = {data:{id},error:null};
  const q = { select:()=>q, in:()=>q, not:()=>q, order:()=>q, limit:()=>q, eq:mocks.eq.mockImplementation(()=>q), update:mocks.update.mockImplementation(()=>q), insert:mocks.insert.mockImplementation(()=>q), maybeSingle:()=>Promise.resolve(mocks.result), single:()=>Promise.resolve(mocks.result), then:(resolve:(r:typeof mocks.result)=>unknown)=>Promise.resolve(mocks.result).then(resolve) };
  mocks.from.mockReturnValue(q);
 });
 it.each(["member","coach"])("denies %s every detail/mutation operation before database access",async role=> {
  mocks.context.mockResolvedValue({userId:id,role,error:null});
  expect((await GET(req(),ctx())).status).toBe(403);
  expect((await PATCH(req(),ctx())).status).toBe(403);
  for (const action of ["note","opportunity","opportunity_edit","task","task_status","stage"]) expect((await POST(req({action}),ctx())).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
 });
 it("denies unauthenticated access and cross-origin writes",async()=> {
  mocks.origin.mockReturnValue(false);
  expect((await POST(req(),ctx())).status).toBe(403); expect((await PATCH(req(),ctx())).status).toBe(403);
  mocks.context.mockResolvedValue({userId:null,error:"Unauthorized",role:"member"});
  expect((await GET(req(),ctx())).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled();
 });
 it.each([{action:"note",id,body:"note",created_by:id},{action:"stage",id,stage:"admin",expected_version:1},{action:"task",id,title:"Call",assignee_id:null,opportunity_id:null,due_at:"bad date"}])("rejects forged actors and invalid data",async input=> {
  expect((await POST(req(input),ctx())).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled();
 });
 it("scopes stage changes to the contact and expected version with server actor",async()=> {
  expect((await POST(req({action:"stage",id,stage:"won",expected_version:7}),ctx())).status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("contact_id",id); expect(mocks.eq).toHaveBeenCalledWith("version",7);
  expect(mocks.update).toHaveBeenCalledWith({stage:"won",updated_by:id});
 });
 it("fails closed when contact does not exist",async()=> {
  mocks.result.data=null;
  expect((await POST(req({action:"note",id,body:"Secret"}),ctx())).status).toBe(404);
  expect(mocks.insert).not.toHaveBeenCalled();
 });
 it("returns conflict for stale stage and task versions",async()=> {
  const q = mocks.from();
  q.maybeSingle = vi.fn().mockResolvedValueOnce({data:{id},error:null}).mockResolvedValueOnce({data:null,error:null});
  expect((await POST(req({action:"stage",id,stage:"lost",expected_version:2}),ctx())).status).toBe(409);
 });
 it("sets note actor from verified context and treats repeated creation IDs as conflicts",async()=> {
  const q = mocks.from();
  q.maybeSingle = vi.fn().mockResolvedValue({data:{id},error:null});
  q.single = vi.fn().mockResolvedValue({data:null,error:{code:"23505"}});
  expect((await POST(req({action:"note",id,body:"Call after work"}),ctx())).status).toBe(409);
  expect(mocks.insert).toHaveBeenCalledWith({id,body:"Call after work",contact_id:id,created_by:id});
 });
 it("rejects staff assignments to unavailable or unauthorized accounts",async()=> {
  const q = mocks.from();
  q.maybeSingle = vi.fn().mockResolvedValueOnce({data:{id},error:null}).mockResolvedValueOnce({data:null,error:null});
  expect((await POST(req({action:"opportunity",id,title:"Trial",owner_id:id,value_cents:0,next_action:""}),ctx())).status).toBe(400);
  expect(mocks.insert).not.toHaveBeenCalled();
 });
 it("preserves browser privacy headers",async()=> {
  mocks.result.error={message:"secret database detail"};
  const response = await GET(req(),ctx()); expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toContain("no-store"); expect(await response.text()).not.toContain("secret");
 });
});
