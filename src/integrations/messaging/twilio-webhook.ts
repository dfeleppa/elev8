import { createHash } from "node:crypto";
import { z } from "zod";

export type SmsWebhookEvent = { key: string; operationId: string | null; sid: string; kind: string; phone: string | null };
type WebhookConfig = { publicUrl: string; accountSid: string; authToken: string; receivingNumber: string };
type SignatureValidator = (token: string, signature: string, url: string, params: Record<string,string>) => boolean;
/** Twilio form-encoded webhook only. The caller injects SDK validateRequest. */
export async function handleSmsWebhook(request: Request, config: WebhookConfig, validate: SignatureValidator,
  persist: (event: SmsWebhookEvent) => Promise<void>) {
  const response = (error: string, status: number) => Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return response("Expected form body",415);
  const raw = await request.text();
  if (Buffer.byteLength(raw)>32768) return response("Payload too large",413);
  const params: Record<string,string> = Object.create(null);
  const form = new URLSearchParams(raw);
  for (const [key,value] of form) {
    if (Object.hasOwn(params,key)) return response("Duplicate parameter",400);
    params[key]=value;
  }
  // Canonical external URL is configured explicitly; never trust Host/X-Forwarded-*.
  const query = new URL(request.url).search;
  const configured = new URL(config.publicUrl);
  if (configured.protocol!=="https:" || configured.search || configured.hash) return response("Webhook unavailable",503);
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!validate(config.authToken,signature,configured.toString()+query,params)) return response("Invalid signature",403);
  if (params.AccountSid!==config.accountSid || !/^SM[0-9a-f]{32}$/i.test(params.MessageSid ?? "")) return response("Invalid provider account or message",400);
  const operation = new URL(request.url).searchParams.get("operation");
  let event: SmsWebhookEvent;
  if (operation) {
    if (!z.uuid().safeParse(operation).success || !["accepted","queued","sending","sent","delivered","failed","undelivered"].includes(params.MessageStatus)) return response("Invalid callback",400);
    event={key:`status:${params.MessageSid}:${params.MessageStatus}`,operationId:operation,sid:params.MessageSid,kind:params.MessageStatus,phone:null};
  } else {
    // STOP has provider Advanced Opt-Out evidence or an exact standard keyword.
    // START never restores consent automatically; new consent requires staff evidence.
    const stop = params.OptOutType==="STOP" || /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test((params.Body??"").trim());
    if (params.To!==config.receivingNumber || !/^\+[1-9][0-9]{6,14}$/.test(params.From??"")) return response("Invalid inbound destination",400);
    if (!stop) return response("Inbound inbox persistence is not enabled",503);
    event={key:`stop:${params.MessageSid}`,operationId:null,sid:params.MessageSid,kind:"stop",phone:params.From};
  }
  // Stable semantic key, independent of parameter order or retry signatures.
  event.key=createHash("sha256").update(event.key).digest("hex");
  try { await persist(event); }
  catch { return response("Receipt persistence unavailable",503); }
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>",{status:200,headers:{"Content-Type":"text/xml","Cache-Control":"no-store"}});
}
