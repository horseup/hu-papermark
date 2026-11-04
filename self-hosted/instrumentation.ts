// Next.js calls register() once per server start. The notification outbox is
// flushed in-process; the app runs as a single container.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startNotificationTimer } = await import('./lib/notifications');
  startNotificationTimer();
}
