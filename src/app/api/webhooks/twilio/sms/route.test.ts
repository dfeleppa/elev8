import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {getExpectedTwilioSignature} from "twilio";
const rpc=vi.fn();
vi.mock("@/lib/supabase-admin",()=>({supabaseAdmin:{rpc}}));
const sid="SM"+"b".repeat(32);
const operation="00000000-0000-4000-8000-000000000001";
const publicUrl="https://example.invalid/api/webhooks/twilio/sms";
const token="synthetic-token-only";
const params={AccountSid:"AC"+"a".repeat(32),MessageSid:sid,MessageStatus:"delivered"};
beforeEach(()=>{
  vi.stubEnv("TWILIO_SMS_WEBHOOK_ENABLED","true");vi.stubEnv("TWILIO_SMS_WEBHOOK_URL",publicUrl);
  vi.stubEnv("TWILIO_ACCOUNT_SID",params.AccountSid);vi.stubEnv("TWILIO_AUTH_TOKEN",token);vi.stubEnv("TWILIO_SMS_FROM","+12025550124");
  rpc.mockReset().mockResolvedValue({error:null,data:true});
});
afterEach(()=>vi.unstubAllEnvs());
function signedRequest(body=params, signatureBody=params) {
  const query="?operation="+operation;
  return new Request("http://localhost/api/webhooks/twilio/sms"+query,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Twilio-Signature":getExpectedTwilioSignature(token,publicUrl+query,signatureBody)},body:new URLSearchParams(body)});
}
it("default-disabled webhook never accesses persistence",async()=>{
  vi.stubEnv("TWILIO_SMS_WEBHOOK_ENABLED",""); const {POST}=await import("./route");
  expect((await POST(signedRequest())).status).toBe(503);expect(rpc).not.toHaveBeenCalled();
});
it("uses the actual Twilio SDK to validate canonical URL signatures before receipt RPC",async()=>{
  const {POST}=await import("./route");
  expect((await POST(signedRequest())).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("crm_sms_event",expect.objectContaining({p_id:operation,p_sid:sid,p_kind:"delivered"}));
  rpc.mockClear();
  expect((await POST(signedRequest({...params,MessageStatus:"failed"}))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it("a durable receipt failure returns retryable non-success to the provider",async()=>{
  rpc.mockResolvedValue({error:{message:"unavailable"}});const {POST}=await import("./route");
  expect((await POST(signedRequest())).status).toBe(503);
});
