import { createHash } from "node:crypto";
import type { SafeAnalyticsPayload } from "@/lib/analytics-events";

export function getDedupedWebAnalyticsRecordId(payload: SafeAnalyticsPayload): string | null {
  const metadata = payload.metadata;
  const dedupeToken = metadata && "event_id" in metadata
    ? metadata.event_id
    : metadata && "transaction_id" in metadata ? metadata.transaction_id : null;
  if (!dedupeToken) return null;
  return `web_${createHash("sha256").update(`${payload.event}:${dedupeToken}`).digest("hex")}`;
}
