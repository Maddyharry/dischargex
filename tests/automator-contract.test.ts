import { describe, expect,it } from "vitest";
import { incidentSchema,normalizeIncidentInput,readBoundedJson } from "../lib/automator-contract";
import { summarizeImpact } from "../lib/summary-impact";
const fixture={schema:1,incidentId:"a".repeat(32),at:"2026-09-09T00:00:00Z",appVersion:"0.12.6.0",failure:1,timeline:[{at:"2026-09-09T00:00:00Z",action:6}],automaticResumeAllowed:false,windowsVersion:"10.0.19045",screenWidth:1920,screenHeight:1080};
describe("incident boundary",()=>{
  it("accepts actual v12.6 numeric enums",()=>expect(incidentSchema.parse(fixture).failure).toBe("HosXpUnresponsive"));
  it("accepts PascalCase exported reports",()=>expect(incidentSchema.parse(normalizeIncidentInput(Object.fromEntries(Object.entries(fixture).map(([k,v])=>[k[0].toUpperCase()+k.slice(1),v])))).timeline[0].action).toBe("Tab"));
  it("rejects extra patient text and action instructions",()=>expect(incidentSchema.safeParse({...fixture,patient:"secret"}).success).toBe(false));
  it("rejects unknown action or resume permission",()=>{expect(incidentSchema.safeParse({...fixture,failure:42}).success).toBe(false);expect(incidentSchema.safeParse({...fixture,automaticResumeAllowed:true}).success).toBe(false);});
  it("rejects casing collisions",()=>expect(()=>normalizeIncidentInput({...fixture,Schema:1})).toThrow());
  it("bounds incoming body even without content-length",async()=>await expect(readBoundedJson(new Request("https://example.test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"x".repeat(500)})}),100)).rejects.toThrow());
});
describe("public impact honesty",()=>{
  it("does not equate generation with verified saved time",()=>{const r=summarizeImpact([{durationMs:30000}]);expect(r.completedJobs).toBe(1);expect(r.estimatedSavedMinutes).toBeNull();});
  it("retains negative savings and excludes bad timings",()=>{const r=summarizeImpact([{durationMs:30000,verifiedDurationMs:12*60000},{durationMs:-1}]);expect(r.completedJobs).toBe(1);expect(r.estimatedSavedMinutes).toEqual({low:-7,high:-2});});
});
