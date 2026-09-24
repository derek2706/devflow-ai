import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { getEnv } from "../config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export const mailer = {
  async send(message: MailMessage) {
    const env = getEnv();
    if (env.NODE_ENV !== "production") {
      const directory =
        env.MAIL_PREVIEW_DIR ?? resolve(__dirname, "../../.local/mail");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(
        resolve(directory, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify(message, null, 2),
        { mode: 0o600 },
      );
      return;
    }
    if (!env.RESEND_API_KEY || env.MAIL_FROM.includes("example.com")) {
      throw new Error("Production email delivery is not configured");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.MAIL_FROM, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery failed");
  },
};
