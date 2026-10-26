export const teamId = process.env.HORSEUP_TEAM_ID || 'horseup-dealroom';
export function adminEmails(): string[] {
  return (process.env.HORSEUP_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}
export function appUrl(): string {
  const value = process.env.NEXTAUTH_URL;
  if (!value) throw new Error('Application URL is not configured');
  return new URL(value).origin;
}
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
