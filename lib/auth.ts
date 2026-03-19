import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

type AppJWT = JWT & {
  plan?: string;
  role?: string;
  totalGenerations?: number;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as unknown as Adapter,
  providers: [
    CredentialsProvider({
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) return null;
        const email = credentials?.email?.trim();
        const password = credentials?.password;
        if (email !== adminEmail || password !== adminPassword) return null;
        try {
          let user = await prisma.user.findUnique({
            where: { email: adminEmail },
            select: { id: true, name: true, email: true },
          });
          if (!user) {
            const created = await prisma.user.create({
              data: {
                email: adminEmail,
                name: "Admin",
                plan: "trial",
                role: "admin",
              },
            });
            user = { id: created.id, name: created.name, email: created.email };
          } else {
            await prisma.user.updateMany({
              where: { email: adminEmail },
              data: { role: "admin" },
            });
          }
          return { id: user.id, name: user.name, email: user.email! };
        } catch {
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  allowDangerousEmailAccountLinking: true,
  callbacks: {
    async signIn({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && user?.email && user.email === adminEmail) {
        try {
          await prisma.user.updateMany({
            where: { email: user.email },
            data: { role: "admin" },
          });
        } catch {
          // ignore if user not in DB yet
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      if (!token.email) return token;
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { plan: true, role: true, totalGenerations: true },
        });
        const t = token as AppJWT;
        if (dbUser) {
          t.plan = dbUser.plan ?? "trial";
          t.role = dbUser.role ?? "user";
          t.totalGenerations = dbUser.totalGenerations ?? 0;
        } else {
          t.plan = "trial";
          t.role = "user";
          t.totalGenerations = 0;
        }
      } catch {
        const t = token as AppJWT;
        t.plan = "trial";
        t.role = "user";
        t.totalGenerations = 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as AppJWT;
        (session.user as { plan?: string }).plan = t.plan ?? "trial";
        (session.user as { role?: string }).role = t.role ?? "user";
        (session.user as { totalGenerations?: number }).totalGenerations = t.totalGenerations ?? 0;
      }
      return session;
    },
  },
};

