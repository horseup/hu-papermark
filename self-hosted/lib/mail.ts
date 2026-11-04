import { Resend } from 'resend';
import { appUrl } from './config';

export type MailOptions = { fromName?: string; replyTo?: string; headers?: Record<string, string> };
export type MailTransport = (message: { from: string; to: string; subject: string; text: string; replyTo?: string; headers?: Record<string, string> }) => Promise<void>;

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
  const from = options.fromName ? senderWithName(configured, options.fromName) : configured;
  await transport({ from, to, subject, text, ...(options.replyTo ? { replyTo: options.replyTo } : {}), ...(options.headers ? { headers: options.headers } : {}) });
}

export async function sendRoomInvite(email: string, roomName: string, roomId: string) {
  await sendMail(email, `Your invitation to ${roomName}`, `You have been invited to ${roomName} in the HorseUp deal room.\n\nOpen ${appUrl()}/rooms/${encodeURIComponent(roomId)} and sign in with this email address.\n\nThis invitation is personal. Access can be revoked by the room administrators.`);
}
