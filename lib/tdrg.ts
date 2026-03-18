import tdrg from "./tdrg633_appendix_g.json";
import { computeAdjRW, type DrgParams } from "./adjrw";

type Table = Record<string, DrgParams>;

const table = tdrg as unknown as Table;

export function calcAdjRwFromDrg(drgCode: string, losDays: number) {
  const params = table[drgCode];
  if (!params) {
    return { ok: false as const, adjrw: null, details: `DRG ${drgCode} not found in Appendix G.` };
  }
  const r = computeAdjRW(drgCode, params, losDays);
  return { ok: true as const, adjrw: r.adjrw, caseType: r.caseType, details: r.details, baseRw: params.rw };
}