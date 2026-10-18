import { validateRequest } from "twilio";
import { handleSmsWebhook } from "@/integrations/messaging/twilio-webhook";

export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Provider authentication replaces user sessions on this webhook-only endpoint. */
export async function POST(request: Request) {
  const {TWILIO_SMS_WEBHOOK_ENABLED,TWILIO_SMS_WEBHOOK_URL,TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN,TWILIO_SMS_FROM}=process.env;
  if(TWILIO_SMS_WEBHOOK_ENABLED!=="true" || !TWILIO_SMS_WEBHOOK_URL || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_SMS_FROM) {
    return Response.json({error:"Messaging webhook disabled"},{status:503});
  }
  return handleSmsWebhook(request,{publicUrl:TWILIO_SMS_WEBHOOK_URL,accountSid:TWILIO_ACCOUNT_SID,authToken:TWILIO_AUTH_TOKEN,receivingNumber:TWILIO_SMS_FROM},validateRequest,async(event)=>{
    const {supabaseAdmin}=await import("@/lib/supabase-admin");
    const {error}=await supabaseAdmin.rpc("crm_sms_event",{p_key:event.key,p_id:event.operationId,p_sid:event.sid,p_kind:event.kind,p_phone:event.phone});
    if(error) throw new Error("Messaging receipt unavailable");
  });
}
