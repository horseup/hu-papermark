import type { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { EmailConfig } from 'next-auth/providers/email';
import { db } from './db';
import { adminEmails, teamId } from './config';
import { sendMail } from './mail';

async function invited(email: string) {
  if (adminEmails().includes(email)) return true;
  return Boolean(await db.huRoomMembership.findFirst({
    where: { email, revokedAt: null, room: { teamId, archivedAt: null } }, select: { id: true },
  }));
}

const mailAttempts = new Map<string, { count: number; until: number }>();
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'database', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login', verifyRequest: '/login?sent=1', error: '/login' },
  providers: [{
    id: 'email', type: 'email', name: 'Email',
    server: {}, from: process.env.HORSEUP_EMAIL_FROM ?? '', options: {},
    maxAge: 15 * 60,
    async sendVerificationRequest({ identifier, url }) {
      const email = identifier.trim().toLowerCase();
      // Unknown addresses receive the same UI response, but never an email.
      if (!(await invited(email))) return;
      const now = Date.now();
      for (const [key, value] of mailAttempts) if (value.until < now) mailAttempts.delete(key);
      const attempt = mailAttempts.get(email) ?? { count: 0, until: now + 60 * 60 * 1000 };
      if (attempt.count >= 5 || mailAttempts.size > 5000) return;
      mailAttempts.set(email, { ...attempt, count: attempt.count + 1 });
      await sendMail(email, 'Sign in to HorseUp deal room', `Use this personal link to sign in:\n\n${url}\n\nIt expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.`);
    },
  } satisfies EmailConfig],
  callbacks: {
    async signIn({ user, email }) {
      if (email?.verificationRequest) return true;
      return Boolean(user.email && await invited(user.email.trim().toLowerCase()));
    },
    async session({ session, user }) {
      if (session.user) Object.assign(session.user, { id: user.id });
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.email) return;
      const email = user.email.trim().toLowerCase();
      await db.huRoomMembership.updateMany({
        where: { email, revokedAt: null, acceptedAt: null, room: { teamId, archivedAt: null } },
        data: { userId: user.id, acceptedAt: new Date() },
      });
      if (adminEmails().includes(email)) {
        await db.team.upsert({ where: { id: teamId }, update: {}, create: {
          id: teamId, name: 'HorseUp', ignoredDomains: [], globalBlockList: [],
        } });
        await db.userTeam.upsert({ where: { userId_teamId: { userId: user.id, teamId } },
          update: { role: 'ADMIN', status: 'ACTIVE' },
          create: { userId: user.id, teamId, role: 'ADMIN', status: 'ACTIVE' },
        });
      }
    },
  },
};
