import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Dev + Turbopack/HMR: instance เก่าอาจไม่มี delegate ของ model ใหม่
 * อย่าใช้ `export const prisma = getPrisma()` แบบ snapshot — ต้องอ่าน singleton ทุกครั้ง
 */
function prismaHasExpectedDelegates(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  const c = client as unknown as { opdAssistLabLog?: { findMany?: unknown } };
  return typeof c.opdAssistLabLog?.findMany === "function";
}

function hardenPgConnectionString(rawUrl: string): { value: string; sslmode: string | null } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      return { value: rawUrl, sslmode: null };
    }
    const sslmode = parsed.searchParams.get("sslmode")?.toLowerCase() ?? null;
    if (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca" || sslmode === null) {
      parsed.searchParams.set("sslmode", "verify-full");
      return { value: parsed.toString(), sslmode: "verify-full" };
    }
    return { value: parsed.toString(), sslmode };
  } catch {
    return { value: rawUrl, sslmode: null };
  }
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const isSqlite = url.startsWith("file:");
  const hardened = !isSqlite ? hardenPgConnectionString(url) : { value: url, sslmode: null };

  if (typeof process.env.VERCEL !== "undefined" && isSqlite) {
    throw new Error(
      "On Vercel, DATABASE_URL must be a PostgreSQL connection string (e.g. from Neon). Add it in Vercel → Project → Settings → Environment Variables.",
    );
  }
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  if (isSqlite) {
    const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, "").trim());
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    return new PrismaClient({ adapter, log });
  }
  const pgAdapter = new PrismaPg({ connectionString: hardened.value });
  return new PrismaClient({ adapter: pgAdapter, log });
}

function getPrismaSingleton(): PrismaClient {
  if (prismaHasExpectedDelegates(globalForPrisma.prisma)) {
    return globalForPrisma.prisma!;
  }
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  const created = createPrismaClient();
  globalForPrisma.prisma = created;
  return created;
}

/**
 * Proxy: ทุก property access ไปที่ singleton ล่าสุด (หลัง prisma generate / แก้ stale HMR)
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrismaSingleton();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
