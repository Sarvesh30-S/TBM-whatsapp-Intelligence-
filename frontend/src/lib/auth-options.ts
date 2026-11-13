import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { syncGoogleUser } from './auth-db';

// Ensure NEXTAUTH_URL and NEXTAUTH_SECRET are always set in Vercel / serverless deployments
if (!process.env.NEXTAUTH_URL) {
  if (process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else {
    process.env.NEXTAUTH_URL = 'https://tbm-whatsapp-intelligence.vercel.app';
  }
}

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'tbm-whatsapp-intelligence-secret-key-2026-auth32';
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    // Direct email bypass for testing / verification before Google Cloud OAuth is filled
    CredentialsProvider({
      id: 'dev-login',
      name: 'Developer Bypass',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email.trim().toLowerCase();

        const isAllowedDomain = email.endsWith('@theboredmonkey.com');
        const allowedOverrides = (process.env.ALLOWED_EMAILS || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const isOverride = allowedOverrides.includes(email);

        if (!isAllowedDomain && !isOverride) {
          throw new Error('DOMAIN_RESTRICTED');
        }

        try {
          const profile = await syncGoogleUser({
            email,
            name: email.split('@')[0],
          });
          return {
            id: profile.id,
            email: profile.email,
            name: profile.fullName,
            roles: profile.roles,
            permissions: profile.permissions,
            assignedGroups: profile.assignedGroups,
            jobTitle: profile.jobTitle,
            department: profile.departmentCode,
          } as any;
        } catch (err: any) {
          if (err.message === 'ACCOUNT_DEACTIVATED') {
            throw new Error('ACCOUNT_DEACTIVATED');
          }
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = (user.email || (profile as any)?.email || '').trim().toLowerCase();
        if (!email) return false;

        const isAllowedDomain = email.endsWith('@theboredmonkey.com');
        const allowedOverrides = (process.env.ALLOWED_EMAILS || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const isOverride = allowedOverrides.includes(email);

        if (!isAllowedDomain && !isOverride) {
          return '/login?error=InvalidDomain';
        }

        try {
          const dbProfile = await syncGoogleUser({
            email,
            name: user.name || (profile as any)?.name,
            image: user.image || (profile as any)?.picture,
          });

          user.id = dbProfile.id;
          (user as any).roles = dbProfile.roles;
          (user as any).permissions = dbProfile.permissions;
          (user as any).assignedGroups = dbProfile.assignedGroups;
          (user as any).jobTitle = dbProfile.jobTitle;
          (user as any).department = dbProfile.departmentCode;

          return true;
        } catch (err: any) {
          if (err.message === 'ACCOUNT_DEACTIVATED') {
            return '/login?error=AccountDeactivated';
          }
          return '/login?error=AuthFailed';
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = (user as any).roles || ['ROLE_EMPLOYEE'];
        token.permissions = (user as any).permissions || [];
        token.assignedGroups = (user as any).assignedGroups || [];
        token.jobTitle = (user as any).jobTitle;
        token.department = (user as any).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).roles = token.roles;
        (session.user as any).permissions = token.permissions;
        (session.user as any).assignedGroups = token.assignedGroups;
        (session.user as any).jobTitle = token.jobTitle;
        (session.user as any).department = token.department;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || 'tbm-whatsapp-intelligence-secret-key-2026',
};
