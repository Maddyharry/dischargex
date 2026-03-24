import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

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
      "On Vercel, DATABASE_URL must be a PostgreSQL connection string (e.g. from Neon). Add it in Vercel → Project → Settings → Environment Variables."
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

