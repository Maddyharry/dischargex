// src/lib/adjrw.ts
// Thai DRG v6.3.3 AdjRW calculation (Appendix H) using Appendix G parameters.
// NOTE: You must supply LOS (days) already computed from admit/discharge (minus leave days if any).

export type DrgParams = {
  rw: number;      // RW
  wtlos: number;   // WtLOS
  ot: number;      // OT (3*WtLOS, rounded per Appendix G)
  rw0d: number;    // RW0d
  of: number;      // OF
  desc?: string;
};

export type AdjRwResult = {
  adjrw: number;
  caseType: "low" | "normal" | "high";
  details: string;
};

function ceiling(x: number) {
  return Math.ceil(x);
}

// Determine DRG type (Appendix H):
// - Medical (M): digits 3-4 >= 50
// - Procedural (P): digits 3-4 in 01-49
function drgType(drg: string): "M" | "P" {
  const d34 = parseInt(drg.slice(2, 4), 10); // positions 3-4 (1-indexed)
  return d34 >= 50 ? "M" : "P";
}

function bParams(type: "M" | "P", rw: number) {
  if (type === "M") {
    if (rw >= 0 && rw <= 0.6999) return { b12: 0.0770, b23: 0.0480, set: "M1" as const };
    return { b12: 0.1212, b23: 0.0743, set: "M2" as const };
  } else {
    if (rw >= 0 && rw <= 1.9999) return { b12: 0.0904, b23: 0.0584, set: "P1" as const };
    return { b12: 0.1580, b23: 0.1268, set: "P2" as const };
  }
}

/**
 * Compute AdjRW per Appendix H (Thai DRG v6.3.3)
 * Rules:
 * 1) Low LOS:
 *   - if RW0d==0: use RW
 *   - if LOS < 1 day (<24h): AdjRW = RW0d
 *   - if LOS >=1 day and LOS < (1/3)*WtLOS and WtLOS>3: AdjRW = RW0d + LOS*(RW-RW0d)/CEILING(WtLOS/3)
 * 2) High LOS (LOS > OT):
 *   - if OT < LOS <= 2*OT: AdjRW = RW + OF*b12*(LOS-OT)
 *   - if 2*OT < LOS <= 3*OT: AdjRW = RW + OF*b12*OT + OF*b23*(LOS-2*OT)
 *   - if LOS > 3*OT: AdjRW = RW + OF*OT*(b12+b23)
 * 3) Normal: AdjRW = RW
 */
export function computeAdjRW(drg: string, params: DrgParams, losDays: number): AdjRwResult {
  const { rw, wtlos, ot, rw0d, of } = params;

  // Guard
  if (!Number.isFinite(losDays) || losDays < 0) {
    return { adjrw: rw, caseType: "normal", details: "Invalid LOS; used RW." };
  }

  // Low LOS checks
  const lowThreshold = wtlos / 3; // 1/3 of WtLOS
  if (losDays < 1) {
    if (rw0d === 0) {
      return { adjrw: rw, caseType: "low", details: "LOS<24h but RW0d=0; used RW." };
    }
    return { adjrw: rw0d, caseType: "low", details: "LOS<24h; used RW0d." };
  }
  if (losDays < lowThreshold && wtlos > 3) {
    if (rw0d === 0) {
      return { adjrw: rw, caseType: "low", details: "Low LOS but RW0d=0; used RW." };
    }
    const denom = ceiling(wtlos / 3);
    const adjrw = rw0d + losDays * (rw - rw0d) / denom;
    return {
      adjrw,
      caseType: "low",
      details: `Low LOS (<1/3 WtLOS, WtLOS>3). denom=CEILING(WtLOS/3)=${denom}.`
    };
  }

  // High LOS checks
  if (ot > 0 && losDays > ot) {
    const t = drgType(drg);
    const { b12, b23, set } = bParams(t, rw);

    if (losDays <= 2 * ot) {
      const adjrw = rw + of * b12 * (losDays - ot);
      return { adjrw, caseType: "high", details: `High LOS (<=2*OT). set=${set}.` };
    }
    if (losDays <= 3 * ot) {
      const adjrw = rw + of * b12 * ot + of * b23 * (losDays - 2 * ot);
      return { adjrw, caseType: "high", details: `High LOS (<=3*OT). set=${set}.` };
    }
    const adjrw = rw + of * ot * (b12 + b23);
    return { adjrw, caseType: "high", details: `High LOS (>3*OT). set=${set}.` };
  }

  // Normal
  return { adjrw: rw, caseType: "normal", details: "Normal LOS; used RW." };
}
