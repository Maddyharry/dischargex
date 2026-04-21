import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildLaborRoomLaborEvaluationOverlay } from "../lib/chartAssist/laborRoomLaborEvaluationOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("laborRoomLaborEvaluationOverlay", () => {
  it("is inactive when not LABOR_ROOM", () => {
    const t = normalizeClinicalText("contractions every 5 minutes");
    const r = buildLaborRoomLaborEvaluationOverlay(t, "ER", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates in LABOR_ROOM with labor keywords", () => {
    const t = normalizeClinicalText("latent labor contractions GA 38 weeks");
    const r = buildLaborRoomLaborEvaluationOverlay(t, "LABOR_ROOM", "labor_room_presentation", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.surfaceEarly.some((x) => /Gestational|pregnancy/i.test(x))).toBe(true);
      expect(r.askNext.length).toBeGreaterThan(4);
    }
  });

  it("flags urgent pathway when bleeding or reduced FM", () => {
    const t = normalizeClinicalText("vaginal bleeding third trimester labor room");
    const r = buildLaborRoomLaborEvaluationOverlay(t, "LABOR_ROOM", "labor_room_presentation", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.urgentPathwayLikely).toBe(true);
      expect(r.urgentPathwayMatched.length).toBeGreaterThan(0);
    }
  });

  it("analyzeOpdCase exposes laborRoomLaborEvaluationOverlay", () => {
    const raw = "ห้องคลอด ตัวคลอดทุก 5 นาที ครบกำหนด";
    const r = analyzeOpdCase(raw, "LABOR_ROOM");
    expect(r.mode).toBe("LABOR_ROOM");
    expect(r.laborRoomLaborEvaluationOverlay.active).toBe(true);
  });
});
