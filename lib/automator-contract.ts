import { z } from "zod";
export const failureNames = ["Unknown","HosXpUnresponsive","WrongWindow","ClipboardUnavailable","PartialInput"] as const;
export const actionNames = ["RunStarted","OpenPatient","ReadOrderSheet","FillSummary","FillAssessment","CheckPopup","Tab","Enter","Navigation","TextKey","Shortcut","LeftClick","RightClick","ClipboardRetry","ClipboardRecovered","InputRejected"] as const;
function enumCompat<T extends readonly [string,...string[]]>(values: T) {
  return z.union([z.enum(values), z.number().int().min(0).max(values.length-1).transform(i => values[i])]);
}
const event = z.object({ at: z.string().datetime({ offset:true }), action: enumCompat(actionNames) }).strict();
export const incidentSchema = z.object({
  schema: z.literal(1), incidentId: z.string().regex(/^[a-f0-9]{32}$/), at: z.string().datetime({offset:true}),
  appVersion: z.string().regex(/^\d{1,4}(?:\.\d{1,4}){1,3}$/), failure: enumCompat(failureNames), timeline:z.array(event).max(200),
  automaticResumeAllowed:z.literal(false), windowsVersion:z.string().regex(/^\d+(?:\.\d+){1,3}$/).max(32),
  screenWidth:z.number().int().min(1).max(65536), screenHeight:z.number().int().min(1).max(65536),
}).strict();
// v12.6 sends camelCase/numeric enums; exported local reports use PascalCase/string enums.
export function normalizeIncidentInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out: Record<string,unknown> = {};
  for (const [key,value] of Object.entries(input)) {
    const normalized=key[0].toLowerCase()+key.slice(1);
    if (normalized in out) throw new Error("Duplicate field");
    out[normalized]=normalized==="timeline" && Array.isArray(value) ? value.map(normalizeIncidentInput) : value;
  }
  return out;
}
export async function readBoundedJson(request: Request, limit=128*1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")||0)>limit) throw new Error("Too large");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("JSON required");
  const reader=request.body?.getReader(); if (!reader) throw new Error("Missing body");
  const chunks:Uint8Array[]=[]; let size=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>limit) { await reader.cancel(); throw new Error("Too large"); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
