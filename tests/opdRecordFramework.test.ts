import { describe, expect, it } from "vitest";
import { buildCaseClinicalProfile, isSkinRashComplaint } from "../lib/chartAssist/caseClinicalProfile";
import {
  applyProblemOrder,
  buildProblemBlocks,
  detectClinicalProblems,
} from "../lib/chartAssist/opdRecordFramework";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("skin-first reasoning", () => {
  it("flags skin complaint when morphology clues present", () => {
    const normalized = normalizeClinicalText("papules and vesicles on trunk, itchy");
    expect(isSkinRashComplaint(normalized)).toBe(true);
  });

  it("prefers skin over URI when rash + URI + fever (secondary URI)", () => {
    const raw = "ผื่นขึ้นทั้งตัว คัน ไอ น้ำมูก ไข้";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    expect(profile.dominantTheme).toBe("skin_rash");
    expect(profile.caseType).toBe("dermatology");
  });
});

describe("detectClinicalProblems", () => {
  it("detects skin primary plus respiratory when rash + URI cues", () => {
    const raw = "ผื่นขึ้นทั้งขา คันมาก ไอ น้ำมูก สองวันแล้ว";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems[0]).toBe("skin");
    expect(systems).toContain("respiratory");
    expect(systems.length).toBeGreaterThanOrEqual(2);
  });

  it("lists back pain and URI as two problems with MSK first when CC emphasizes back pain", () => {
    const raw = "ปวดหลังมา 3 วัน\nไอ น้ำมูก 1 สัปดาห์";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems).toContain("msk");
    expect(systems).toContain("respiratory");
    expect(systems[0]).toBe("msk");
  });

  it("lists rash and fever/URI as separate problems (skin + fever or respiratory)", () => {
    const raw = "ผื่นขึ้นแขน คัน\nไข้ ไอ น้ำมูก";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems).toContain("skin");
    expect(systems.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps dysuria and low back pain as two systems when both cues present", () => {
    const raw = "ปัสสาวะแสบ ขัดปัสสาวะ\nปวดหลังส่วนล่าง";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems).toContain("gu");
    expect(systems).toContain("msk");
  });

  it("orders GU before MSK when CC line emphasizes dysuria", () => {
    const raw = "ปัสสาวะแสบมา 2 วัน\nปวดหลังร่วม";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems[0]).toBe("gu");
    expect(systems).toContain("msk");
  });
});

describe("applyProblemOrder", () => {
  it("reorders blocks by id and resets orderIndex", () => {
    const raw = "ผื่นขึ้นทั้งขา คันมาก ไอ น้ำมูก สองวันแล้ว";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    const blocks = buildProblemBlocks(systems, normalized, profile, []);
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    const reordered = applyProblemOrder(blocks, [...blocks].reverse().map((b) => b.id));
    expect(reordered[0].id).toBe(blocks[blocks.length - 1].id);
    expect(reordered[0].orderIndex).toBe(0);
    expect(reordered[reordered.length - 1].orderIndex).toBe(reordered.length - 1);
  });
});
