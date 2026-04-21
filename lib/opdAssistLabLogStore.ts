import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";

const PREVIEW_MAX = 500;
const ERR_MSG_MAX = 2000;

export type OpdAssistLabLogListRow = {
  id: string;
  userId: string;
  createdAt: Date;
  caseId: string | null;
  source: string;
  demoKey: string | null;
  mode: string | null;
  modeOverride: string | null;
  textLength: number;
  textPreview: string | null;
  ok: boolean;
  errorMessage: string | null;
  cardIds: string | null;
  ruleVersion: string | null;
  user: { email: string | null; name: string | null };
};

/** ใช้ $queryRaw แทน delegate — หลีกเลี่ยงกรณี prisma.opdAssistLabLog เป็น undefined (HMR/Turbopack) */
export async function listOpdAssistLabLogs(limit = 200): Promise<OpdAssistLabLogListRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      createdAt: Date;
      caseId: string | null;
      source: string;
      demoKey: string | null;
      mode: string | null;
      modeOverride: string | null;
      textLength: number;
      textPreview: string | null;
      ok: boolean;
      errorMessage: string | null;
      cardIds: string | null;
      ruleVersion: string | null;
      user_email: string | null;
      user_name: string | null;
    }>
  >(Prisma.sql`
    SELECT
      l."id",
      l."userId",
      l."createdAt",
      l."caseId",
      l."source",
      l."demoKey",
      l."mode",
      l."modeOverride",
      l."textLength",
      l."textPreview",
      l."ok",
      l."errorMessage",
      l."cardIds",
      l."ruleVersion",
      u."email" AS "user_email",
      u."name" AS "user_name"
    FROM "OpdAssistLabLog" l
    LEFT JOIN "User" u ON u."id" = l."userId"
    ORDER BY l."createdAt" DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    createdAt: r.createdAt,
    caseId: r.caseId,
    source: r.source,
    demoKey: r.demoKey,
    mode: r.mode,
    modeOverride: r.modeOverride,
    textLength: r.textLength,
    textPreview: r.textPreview,
    ok: r.ok,
    errorMessage: r.errorMessage,
    cardIds: r.cardIds,
    ruleVersion: r.ruleVersion,
    user: { email: r.user_email, name: r.user_name },
  }));
}

export async function insertOpdAssistLabLog(data: {
  userId: string;
  rawText: string;
  caseId?: string | null;
  source: string;
  demoKey?: string | null;
  mode: string | null;
  modeOverride: AssistMode | null;
  ok: boolean;
  errorMessage?: string | null;
  cardIdsJson?: string | null;
  ruleVersion?: string | null;
}): Promise<void> {
  const id = randomUUID();
  const textPreview = data.rawText.slice(0, PREVIEW_MAX) || null;
  const errorMessage = data.errorMessage ? data.errorMessage.slice(0, ERR_MSG_MAX) : null;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "OpdAssistLabLog" (
        "id",
        "userId",
        "caseId",
        "source",
        "demoKey",
        "mode",
        "modeOverride",
        "textLength",
        "textPreview",
        "ok",
        "errorMessage",
        "cardIds",
        "ruleVersion"
      ) VALUES (
        ${id},
        ${data.userId},
        ${data.caseId ?? null},
        ${data.source},
        ${data.demoKey ?? null},
        ${data.mode},
        ${data.modeOverride},
        ${data.rawText.length},
        ${textPreview},
        ${data.ok},
        ${errorMessage},
        ${data.cardIdsJson ?? null},
        ${data.ruleVersion ?? null}
      )
    `,
  );
}
