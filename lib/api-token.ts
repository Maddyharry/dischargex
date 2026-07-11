import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_PREFIX = "dx_";

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Raw token shown to the user exactly once at creation time — never stored. */
export function generateRawToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
}

export async function createApiToken(userId: string, label?: string) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const record = await prisma.apiToken.create({
    data: { userId, tokenHash, label: label?.slice(0, 120) },
    select: { id: true, label: true, createdAt: true },
  });
  return { rawToken, id: record.id, label: record.label, createdAt: record.createdAt };
}

export async function revokeApiToken(userId: string, tokenId: string) {
  const result = await prisma.apiToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export async function listApiTokens(userId: string) {
  return prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
}

/** Resolves a Bearer token from a request's Authorization header to the owning user's email, or null. */
export async function resolveEmailFromBearerToken(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const rawToken = header.slice("Bearer ".length).trim();
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, revokedAt: true, user: { select: { email: true } } },
  });
  if (!record || record.revokedAt || !record.user?.email) return null;

  await prisma.apiToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return record.user.email;
}
