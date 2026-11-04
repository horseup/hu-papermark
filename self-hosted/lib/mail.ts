import { Resend } from 'resend';
import { appUrl, SENDER_NAME } from './config';
import { invitationEmail } from './emails';

export type MailOptions = { html?: string; replyTo?: string; headers?: Record<string, string> };
export type MailTransport = (message: { from: string; to: string; subject: string; text: string; html?: string; replyTo?: string; headers?: Record<string, string> }) => Promise<void>;

async function resendTransport(message: Parameters<MailTransport>[0]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Email delivery is not configured');
  const result = await new Resend(key).emails.send(message);
  if (result.error) throw new Error('Email delivery failed');
}
let transport: MailTransport = resendTransport;
/** Tests replace the transport so they never send email. */
export function setMailTransport(next: MailTransport | null) { transport = next ?? resendTransport; }

/** Keeps the configured address and replaces only the display name. */
export function senderWithName(from: string, name: string) {
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  return `${name.replace(/["<>]/g, '')} <${address}>`;
}

export async function sendMail(to: string, subject: string, text: string, options: MailOptions = {}) {
  const configured = process.env.HORSEUP_EMAIL_FROM;
  if (!configured) throw new Error('Email delivery is not configured');
  // Every deal room email (sign-in, invitation, notifications) uses the same display name.
  const from = senderWithName(configured, SENDER_NAME);
  await transport({ from, to, subject, text, ...(options.html ? { html: options.html } : {}), ...(options.replyTo ? { replyTo: options.replyTo } : {}), ...(options.headers ? { headers: options.headers } : {}) });
}

export async function sendRoomInvite(email: string, roomName: string, roomId: string) {
  const mail = invitationEmail(roomName, `${appUrl()}/rooms/${encodeURIComponent(roomId)}`);
  await sendMail(email, mail.subject, mail.text, { html: mail.html });
}
