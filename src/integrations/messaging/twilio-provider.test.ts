import { expect,it,vi } from "vitest";
import { createTwilioSmsProvider } from "./twilio-provider";
const intent={id:"00000000-0000-4000-8000-000000000001",phone:"+12025550123",body:"Synthetic"};
const config={enabled:true,from:"+12025550124",callbackUrl:"https://example.invalid/api/webhooks/twilio/sms",allowedRecipients:[intent.phone]};
it("is disabled by default and restricts a temporary-number pilot to allowlisted recipients",async()=>{
  const create=vi.fn();
  expect(await createTwilioSmsProvider({...config,enabled:false},{create}).send(intent)).toEqual({kind:"failed"});
  expect(await createTwilioSmsProvider({...config,allowedRecipients:[]},{create}).send(intent)).toEqual({kind:"failed"});
  expect(create).not.toHaveBeenCalled();
});
it("correlates operation ID without claiming provider idempotency",async()=>{
  const sid="SM"+"a".repeat(32); const create=vi.fn(async()=>({sid}));
  expect(await createTwilioSmsProvider(config,{create}).send(intent)).toEqual({kind:"accepted",sid});
  expect(create.mock.calls[0]).toEqual([{to:intent.phone,from:config.from,body:intent.body,statusCallback:config.callbackUrl+"?operation="+intent.id}]);
});
it.each([[429,"retry"],[400,"failed"],[500,"uncertain"],[undefined,"uncertain"]])("classifies explicit status %s as %s",async(status,kind)=>{
  const create=vi.fn(async()=>{throw {status};});
  expect(await createTwilioSmsProvider(config,{create}).send(intent)).toEqual({kind});
});
