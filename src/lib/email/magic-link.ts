import nodemailer from 'nodemailer';
import type { EmailProviderSendVerificationRequestParams } from '@auth/core/providers/email';

/** Email magic-link sender params (Auth.js beta.32). */
export type { EmailProviderSendVerificationRequestParams };

/**
 * In-memory store of the most recent magic-link URL per email address,
 * ONLY used by the development preview endpoint (see
 * src/app/api/auth/dev/magic-link/route.ts). Guarded so it can never be
 * reached in production. Cleared on server restart — acceptable for a dev
 * convenience; the underlying verification token always lives in PostgreSQL.
 */
const devMagicLinks = new Map<string, { url: string; createdAt: number }>();

export function getDevMagicLink(email: string): { url: string } | null {
  const entry = devMagicLinks.get(email);
  return entry ? { url: entry.url } : null;
}

/**
 * Email magic-link sender.
 *
 * - When `EMAIL_SERVER` (SMTP) is configured, a real email is sent.
 * - In local development without SMTP, the link is printed to the server
 *   console and stashed for the guarded dev preview endpoint. Authentication
 *   is never faked: the user must still open the real, one-time token URL.
 * - In production without SMTP, sending FAILS loudly — we never pretend a
 *   login email was delivered.
 */
export async function sendMagicLinkEmail(
  params: EmailProviderSendVerificationRequestParams,
): Promise<void> {
  const { identifier, url, provider } = params;
  const smtpUrl = process.env.EMAIL_SERVER;

  const subject = 'Sign in to CivicChain';
  const text =
    `Hello,\n\n` +
    `Use the link below to sign in to your CivicChain account:\n\n${url}\n\n` +
    `This link expires shortly. If you did not request it, you can ignore this email.\n`;
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">` +
    `<h2>CivicChain</h2>` +
    `<p>Sign in to your CivicChain account:</p>` +
    `<p><a href="${url}" style="background:#2457d6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Sign in</a></p>` +
    `<p style="color:#666;font-size:13px">This link expires shortly.</p>` +
    `</div>`;

  if (smtpUrl) {
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({
      from: provider.from,
      to: identifier,
      subject,
      text,
      html,
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    // Do NOT fake delivery in production.
    throw new Error(
      'EMAIL_SERVER is not configured — the magic link email was NOT sent. Configure SMTP for email sign-in.',
    );
  }

  devMagicLinks.set(identifier, { url, createdAt: Date.now() });
  console.log(
    `\n[CivicChain DEV] Magic-link for ${identifier} (no SMTP configured):\n${url}\n`,
  );
}