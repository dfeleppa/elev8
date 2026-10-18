import type { SendOutcome, SmsIntent, SmsProvider } from "@/features/messaging/contracts";

/** Injected SDK boundary keeps tests offline and does not configure a live account. */
export interface TwilioMessagesClient {
  create(input: { to: string; from: string; body: string; statusCallback: string }): Promise<{sid: string}>;
}
export function createTwilioSmsProvider(config: {
  enabled: boolean; from: string; callbackUrl: string; allowedRecipients: readonly string[];
}, messages: TwilioMessagesClient): SmsProvider {
  return {
    async send(intent: SmsIntent): Promise<SendOutcome> {
      // A temporary-number pilot must explicitly allow each test destination.
      if (!config.enabled || !config.allowedRecipients.includes(intent.phone)) return {kind: "failed"};
      const callback = new URL(config.callbackUrl);
      if (callback.protocol !== "https:" || callback.search || callback.hash) return {kind:"failed"};
      callback.searchParams.set("operation",intent.id);
      try {
        const result = await messages.create({to:intent.phone,from:config.from,body:intent.body,statusCallback:callback.toString()});
        if (!/^SM[0-9a-f]{32}$/i.test(result.sid)) return {kind:"uncertain"};
        return {kind:"accepted",sid:result.sid};
      } catch (error) {
        const status = (error as {status?: number}).status;
        // Only explicit rate-limit rejection is automatically retried. 5xx, timeouts
        // and transport errors may follow an accepted send and need reconciliation.
        if (status===429) return {kind:"retry"};
        if (status && status>=400 && status<500) return {kind:"failed"};
        return {kind:"uncertain"};
      }
    },
  };
}
