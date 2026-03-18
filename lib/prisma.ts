import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const isSqlite = url.startsWith("file:");
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  if (isSqlite) {
    const dbPath = path.resolve(process.cwd(), url.replace(/^file:/, "").trim());
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    return new PrismaClient({ adapter, log });
  }
  const pgAdapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter: pgAdapter, log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

