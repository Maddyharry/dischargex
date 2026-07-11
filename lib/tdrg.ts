import tdrg from "./tdrg633_appendix_g.json";
import { computeAdjRW, type DrgParams } from "./adjrw";

type Table = Record<string, DrgParams>;

const table = tdrg as unknown as Table;

/** Normalize user input to Appendix G keys (5-digit DRG strings). */
export function normalizeThaiDrgCode(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    return s.length <= 5 ? s.padStart(5, "0") : s;
  }
  return s.toUpperCase();
}

export function calcAdjRwFromDrg(drgCode: string, losDays: number) {
  const key = normalizeThaiDrgCode(drgCode);
  const params = table[key];
  if (!params) {
    return { ok: false as const, adjrw: null, details: `DRG ${key || drgCode} not found in Appendix G.` };
  }
  const r = computeAdjRW(key, params, losDays);
  return { ok: true as const, adjrw: r.adjrw, caseType: r.caseType, details: r.details, baseRw: params.rw };
}