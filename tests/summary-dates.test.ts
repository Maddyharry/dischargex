import { describe, expect, it } from "vitest";
import { extractSummaryDates, normalizeSummaryDate, summaryLosDays } from "../lib/summary-dates";
describe("evidence-bound encounter dates", () => {
  it.each(["F/U", "FU", "follow up", "follow-up", "นัด"])("excludes %s appointments from chart boundaries", label => {
    const r = extractSummaryDates(`01/09/2569 08:00 initial note\n05/09/2569 10:00 final note\n${label} 20/09/2569`);
    expect(r.admit.value).toBe("01/09/2569");
    expect(r.discharge.value).toBe("05/09/2569");
    expect(r.discharge.source).toBe("chart_boundary");
  });
  it("excludes date-first and multiline appointment entries", () => {
    const r = extractSummaryDates("01/09/2569 note\n05/09/2569 note\n20/09/2569 F/U\nนัด\n25/09/2569");
    expect(r.discharge.value).toBe("05/09/2569");
  });
  it("sorts reversed chart chronology", () => {
    const r = extractSummaryDates("05/09/2569 final note\n01/09/2569 first note");
    expect(r.admit.value).toBe("01/09/2569"); expect(r.discharge.value).toBe("05/09/2569");
  });
  it("does not infer both boundaries from one incomplete entry", () => {
    expect(extractSummaryDates("01/09/2569 note").discharge.value).toBeNull();
  });
  it.each(["01/09/2569","01/09/2026","2026-09-01","1/9/69","๑/๙/๒๕๖๙","1 ก.ย. 2569","1 กันยายน 2026"])("normalizes %s", raw => expect(normalizeSummaryDate(raw)).toBe("01/09/2569"));
  it.each(["31/02/2569","29/02/2026","00/09/2569","1/13/2569","unknown","1/9/26"])("rejects invalid or ambiguous %s", raw => expect(normalizeSummaryDate(raw)).toBeNull());
  it("finds dates after explicit labels", () => { const r=extractSummaryDates("Admit: 2026-09-01 Discharge: 2026-09-05"); expect(r.admit.value).toBe("01/09/2569"); expect(r.discharge.value).toBe("05/09/2569"); });
  it("keeps timestamps before orders", () => { const r=extractSummaryDates("01/09/2569 Admit\n05/09/2569 Discharge"); expect(r.admit.value).toBe("01/09/2569"); expect(r.discharge.value).toBe("05/09/2569"); });
  it("does not invent discharge from last note or follow-up", () => { const r=extractSummaryDates("Admit: 01/09/2569\nFollow-up: 12/09/2569"); expect(r.discharge.status).toBe("missing"); });
  it("preserves a known admission when discharge missing", () => expect(extractSummaryDates("Admit: 01/09/2569").admit.value).toBe("01/09/2569"));
  it("marks multiple labelled admissions ambiguous", () => expect(extractSummaryDates("Admit 1/9/2569\nAdmit 3/9/2569").admit.status).toBe("ambiguous"));
  it("rejects discharge before admission", () => expect(extractSummaryDates("Admit 5/9/2569\nDischarge 1/9/2569").discharge.status).toBe("ambiguous"));
  it("does not consume an appointment following a label", () => expect(extractSummaryDates("Discharge follow-up 12/09/2569").discharge.value).toBeNull());
  it("does not use planned events or medication DC", () => { for(const text of ["Plan discharge 5/9/2569", "D/C antibiotic 5/9/2569"]) expect(extractSummaryDates(text).discharge.value).toBeNull(); });
  it("allows adjacent standalone label/date", () => expect(extractSummaryDates("Admission date:\n01/09/2569").admit.value).toBe("01/09/2569"));
  it("computes LOS across Buddhist/Western year consistently", () => expect(summaryLosDays("01/09/2026","05/09/2569")).toBe(4));
});
