export const teamId = process.env.HORSEUP_TEAM_ID || 'horseup-dealroom';
export function adminEmails(): string[] {
  return (process.env.HORSEUP_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}
export function appUrl(): string {
  const value = process.env.NEXTAUTH_URL;
  if (!value) throw new Error('Application URL is not configured');
  return new URL(value).origin;
}
/** Display name for every deal room email; the address stays HORSEUP_EMAIL_FROM. */
export const SENDER_NAME = 'HorseUp Deal Room';
export function investorReplyTo(): string {
  return process.env.HORSEUP_INVESTOR_REPLY_TO || 'investors@horseup.de';
}
/** Quiet window: a recipient's batch is sent once no new event arrived for this long. */
export function notificationQuietMs(): number { return Number(process.env.HORSEUP_NOTIFY_QUIET_MS) || 10 * 60 * 1000; }
/** Upper bound so a steady stream of events cannot postpone a batch forever. */
export function notificationMaxWaitMs(): number { return Number(process.env.HORSEUP_NOTIFY_MAX_WAIT_MS) || 60 * 60 * 1000; }
