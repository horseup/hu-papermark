import { Resend } from 'resend';
import { appUrl } from './config';

export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.HORSEUP_EMAIL_FROM;
  if (!key || !from) throw new Error('Email delivery is not configured');
  const result = await new Resend(key).emails.send({ from, to, subject, text });
  if (result.error) throw new Error('Email delivery failed');
}

export async function sendRoomInvite(email: string, roomName: string, roomId: string) {
  await sendMail(email, `Your invitation to ${roomName}`, `You have been invited to ${roomName} in the HorseUp deal room.\n\nOpen ${appUrl()}/rooms/${encodeURIComponent(roomId)} and sign in with this email address.\n\nThis invitation is personal. Access can be revoked by the room administrators.`);
}
