export type CompletedJob = { durationMs: number; verifiedDurationMs?: number };
export function summarizeImpact(jobs: CompletedJob[]) {
  const valid=jobs.filter(j=>Number.isFinite(j.durationMs)&&j.durationMs>=0&&j.durationMs<=24*3600000);
  const verified=valid.filter(j=>typeof j.verifiedDurationMs==="number"&&Number.isFinite(j.verifiedDurationMs)&&j.verifiedDurationMs!>=j.durationMs&&j.verifiedDurationMs!<=24*3600000);
  const total=verified.reduce((sum,j)=>sum+j.verifiedDurationMs!,0)/60000;
  return { completedJobs:valid.length, averageGenerationSeconds:valid.length?valid.reduce((sum,j)=>sum+j.durationMs,0)/valid.length/1000:null,
    verifiedJobs:verified.length, estimatedSavedMinutes:verified.length?{low:verified.length*5-total,high:verified.length*10-total}:null };
}
