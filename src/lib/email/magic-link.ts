import nodemailer from 'nodemailer';
import type { EmailProviderSendVerificationRequestParams } from '@auth/core/providers/email';
import { currentLogger } from '@/lib/server/requestContext';

/** Email magic-link sender params (Auth.js beta.32). */
export type { EmailProviderSendVerificationRequestParams };

/**
 * Development-only preview of the magic-link sign-in email.
 *
 * Auth.js stores the email token in PostgreSQL as `createHash(rawToken +
 * secret)` — NOT the raw token. So the raw token (which the clickable URL
 * requires) can only be recovered from the URL that `sendMagicLinkEmail`
 * receives at send-time, never reconstructed from the DB. We therefore stash
 * the raw sign-in URL here (dev only) so the preview endpoint can surface it.
 *
 * The stash lives on `globalThis` (the same singleton pattern the repo uses
 * for the Prisma client in `src/lib/db.ts`). A module-private `Map` broke on
 * logout/relogin because the auth-handler route and the dev route are loaded as
 * separate module instances in the Next.js dev server, so each had its own
 * isolated Map and the lookup returned 404 — leaving the user on a "Check your
 * inbox" screen with no visible link. The shared singleton fixes that.
 */
interface DevMagicLinkEntry {
  url: string;
  createdAt: number;
}

declare global {
  var __civicchainDevMagicLinks: Map<string, DevMagicLinkEntry> | undefined;
}

function devMagicLinkStore(): Map<string, DevMagicLinkEntry> {
  if (!globalThis.__civicchainDevMagicLinks) {
    globalThis.__civicchainDevMagicLinks = new Map();
  }
  return globalThis.__civicchainDevMagicLinks;
}

export function getDevMagicLink(email: string): { url: string } | null {
  const entry = devMagicLinkStore().get(email.toLowerCase());
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

  // Stash the raw sign-in URL (dev only) for the guarded preview endpoint.
  // Auth.js already hashed the token into PostgreSQL; only this raw URL can be
  // clicked to complete sign-in when there is no SMTP.
  devMagicLinkStore().set(identifier.toLowerCase(), { url, createdAt: Date.now() });
  currentLogger().debug(
    { email: identifier, url },
    '[CivicChain DEV] Magic-link (no SMTP configured)',
  );
}