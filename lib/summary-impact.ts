export type CompletedJob = { durationMs: number };

const MANUAL_MINUTES_PER_CASE = 10;

export function summarizeImpact(jobs: CompletedJob[]) {
  const valid = jobs.filter((job) =>
    Number.isFinite(job.durationMs) && job.durationMs >= 0 && job.durationMs <= 24 * 60 * 60 * 1000,
  );
  const averageGenerationSeconds = valid.length
    ? valid.reduce((sum, job) => sum + job.durationMs, 0) / valid.length / 1000
    : null;
  const estimatedSavedMinutes = averageGenerationSeconds === null
    ? null
    : Math.max(0, MANUAL_MINUTES_PER_CASE - averageGenerationSeconds / 60) * valid.length;

  return {
    timedJobs: valid.length,
    averageGenerationSeconds,
    manualMinutesPerCase: MANUAL_MINUTES_PER_CASE,
    estimatedSavedMinutes,
  };
}

export function formatSavedDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 นาที";
  const totalMinutes = Math.round(minutes);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const remainingMinutes = totalMinutes % 60;
  return [
    days > 0 ? `${days} วัน` : null,
    hours > 0 ? `${hours} ชั่วโมง` : null,
    remainingMinutes > 0 ? `${remainingMinutes} นาที` : null,
  ].filter(Boolean).join(" ") || "0 นาที";
}
