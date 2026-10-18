import {expect,it,vi} from "vitest";
import {handleSmsWebhook} from "./twilio-webhook";
const sid="SM"+"a".repeat(32);
const config={publicUrl:"https://example.invalid/api/webhooks/twilio/sms",accountSid:"ACfixture",authToken:"test-only",receivingNumber:"+12025550124"};
const operation="00000000-0000-4000-8000-000000000001";
function request(params: Record<string,string>, query="") {return new Request("http://localhost/api/webhooks/twilio/sms"+query,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","X-Twilio-Signature":"fixture"},body:new URLSearchParams({AccountSid:config.accountSid,MessageSid:sid,...params})});}
it("rejects invalid signatures before durable receipt",async()=>{
  const persist=vi.fn(); const validate=vi.fn(()=>false);
  expect((await handleSmsWebhook(request({MessageStatus:"delivered"},"?operation="+operation),config,validate,persist)).status).toBe(403);
  expect(persist).not.toHaveBeenCalled();
});
it("validates using the configured public callback URL, then awaits persistence before acknowledgement",async()=>{
  const persist=vi.fn(async()=>{}); const validate=vi.fn<(token: string, signature: string, url: string, params: Record<string,string>) => boolean>(()=>true);
  const response=await handleSmsWebhook(request({MessageStatus:"delivered"},"?operation="+operation),config,validate,persist);
  expect(response.status).toBe(200);
  expect(validate.mock.calls[0]?.[2]).toBe(config.publicUrl+"?operation="+operation);
  expect(persist).toHaveBeenCalledWith(expect.objectContaining({kind:"delivered",operationId:operation,sid}));
});
it("does not ACK receipt loss and rejects cross-account callbacks",async()=>{
  const fail=vi.fn(async()=>{throw new Error("offline");});
  expect((await handleSmsWebhook(request({MessageStatus:"sent"},"?operation="+operation),config,()=>true,fail)).status).toBe(503);
  const persist=vi.fn();
  expect((await handleSmsWebhook(request({AccountSid:"ACdifferent",MessageStatus:"sent"},"?operation="+operation),config,()=>true,persist)).status).toBe(400);
  expect(persist).not.toHaveBeenCalled();
});
it("accepts signed STOP only for the configured inbound destination and never infers START consent",async()=>{
  const persist=vi.fn(async()=>{});
  const params={To:config.receivingNumber,From:"+12025550123",Body:"STOP"};
  expect((await handleSmsWebhook(request(params),config,()=>true,persist)).status).toBe(200);
  expect(persist).toHaveBeenCalledWith(expect.objectContaining({kind:"stop",phone:params.From}));
  expect((await handleSmsWebhook(request({...params,Body:"START"}),config,()=>true,persist)).status).toBe(503);
  expect(persist).toHaveBeenCalledTimes(1);
});
it("semantic event keys deduplicate reordered provider retries",async()=>{
  const events: unknown[]=[];
  const persist=async(event:unknown)=>{events.push(event);};
  await handleSmsWebhook(request({MessageStatus:"queued",Extra:"first"},"?operation="+operation),config,()=>true,persist);
  await handleSmsWebhook(request({Extra:"second",MessageStatus:"queued"},"?operation="+operation),config,()=>true,persist);
  expect(events[0]).toEqual(events[1]);
});


