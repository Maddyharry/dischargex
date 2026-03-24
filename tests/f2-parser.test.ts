import { describe, expect, it } from "vitest";
import {
  evaluateF2CcExclusionsFromEntries,
  parseF2AppendixText,
  resolveF2Entries,
  sortF2EntriesForLookup,
  type F2RawBundle,
} from "../lib/discharge-engine/f2";

const sampleAppendixText = `
Appendix F2 (CC Exclusion Lists)
A000 Cholera due to Vibrio cholerae 01, biovar cholerae
A000 - A009 A020 A030 - A050
A052 - A062 A070 - A099 P370 - P38
P398 - P399
A001 Cholera due to Vibrio cholerae 01, biovar eltor
A002 Cholera, unspecified
A009 Cholera, unspecified
the same as A000
A010 Typhoid fever
A010 - A014 A021 - A029 A090 - A099
`;

describe("f2 parser and matcher", () => {
  it("parses appendix text into raw entries", () => {
    const entries = parseF2AppendixText(sampleAppendixText);
    expect(entries.some((x) => x.cc_code === "A000")).toBe(true);
    expect(entries.some((x) => x.cc_code === "A009" && x.same_as === "A000")).toBe(true);
    expect(entries.some((x) => x.cc_code === "A001" && x.same_as === "A000")).toBe(true);
  });

  it("resolves same_as list to concrete exclusions", () => {
    const raw: F2RawBundle = {
      source: "test",
      entries: parseF2AppendixText(sampleAppendixText),
    };
    const resolved = resolveF2Entries(raw);
    const a009 = resolved.find((x) => x.ccCode === "A009");
    expect(a009).toBeTruthy();
    expect((a009?.principalExclusions || []).includes("A000-A009")).toBe(true);
  });

  it("matches pdx and sdx with range exclusion", () => {
    const entries = resolveF2Entries({
      source: "test",
      entries: parseF2AppendixText(sampleAppendixText),
    });
    const hits = evaluateF2CcExclusionsFromEntries({
      principalIcd10List: ["A001"],
      secondaryIcd10List: ["A000"],
      entries,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].ccCode).toBe("A000");
  });

  it("uses longest CC code prefix when multiple rows could match SDx", () => {
    const entries = resolveF2Entries({
      source: "test",
      entries: [
        {
          cc_code: "A01",
          cc_label: "Broader CC",
          principal_exclusions: ["X99"],
        },
        {
          cc_code: "A010",
          cc_label: "Specific CC",
          principal_exclusions: ["Y88"],
        },
      ],
    });
    expect(sortF2EntriesForLookup(entries)[0].ccCode).toBe("A010");

    const hitSpecific = evaluateF2CcExclusionsFromEntries({
      principalIcd10List: ["Y880"],
      secondaryIcd10List: ["A010"],
      entries,
    });
    expect(hitSpecific.length).toBe(1);
    expect(hitSpecific[0].ccCode).toBe("A010");

    const hitBroader = evaluateF2CcExclusionsFromEntries({
      principalIcd10List: ["X990"],
      secondaryIcd10List: ["A019"],
      entries,
    });
    expect(hitBroader.length).toBe(1);
    expect(hitBroader[0].ccCode).toBe("A01");
  });
});
