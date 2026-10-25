import { randomUUID } from "node:crypto";

export async function claimFirstCaseAnalyticsToken(input: {
  totalGenerationsBeforeCommit: number;
  insertUniqueMarker: (eventToken: string) => Promise<boolean>;
}): Promise<string | null> {
  if (input.totalGenerationsBeforeCommit > 0) return null;
  const eventToken = randomUUID().replaceAll("-", "");
  return await input.insertUniqueMarker(eventToken) ? eventToken : null;
}
