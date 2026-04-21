import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  inferObGynePathwayHints,
  matchesEarlyPregnancyPainBleedingPathway,
  matchesPostpartumUrgentObPathway,
  matchesPreeclampsiaSevereFeaturesPathway,
} from "../lib/chartAssist/obGynePathways";

describe("matchesEarlyPregnancyPainBleedingPathway", () => {
  it("fires when early GA + bleeding + pain", () => {
    const t = normalizeClinicalText("8 weeks pregnant vaginal bleeding and pelvic pain");
    expect(matchesEarlyPregnancyPainBleedingPathway(t)).toBe(true);
  });

  it("does not fire without pain/cramp cue", () => {
    const t = normalizeClinicalText("8 weeks pregnant vaginal bleeding only");
    expect(matchesEarlyPregnancyPainBleedingPathway(t)).toBe(false);
  });
});

describe("matchesPreeclampsiaSevereFeaturesPathway", () => {
  it("fires for pregnancy + severe headache wording", () => {
    const t = normalizeClinicalText("34 weeks pregnant severe headache and epigastric pain");
    expect(matchesPreeclampsiaSevereFeaturesPathway(t)).toBe(true);
  });

  it("fires for pregnancy + elevated BP language", () => {
    const t = normalizeClinicalText("36 weeks pregnancy blood pressure 170/110");
    expect(matchesPreeclampsiaSevereFeaturesPathway(t)).toBe(true);
  });

  it("does not fire for mild headache alone without severe qualifier", () => {
    const t = normalizeClinicalText("30 weeks pregnant mild headache runny nose");
    expect(matchesPreeclampsiaSevereFeaturesPathway(t)).toBe(false);
  });
});

describe("matchesPostpartumUrgentObPathway", () => {
  it("fires for postpartum + heavy bleeding", () => {
    const t = normalizeClinicalText("postpartum day 1 heavy bleeding soaking pads hypotension");
    expect(matchesPostpartumUrgentObPathway(t)).toBe(true);
  });

  it("fires for postpartum + fever", () => {
    const t = normalizeClinicalText("postpartum fever 39C uterine tenderness");
    expect(matchesPostpartumUrgentObPathway(t)).toBe(true);
  });
});

describe("inferObGynePathwayHints", () => {
  it("returns multiple hints when cues overlap", () => {
    const t = normalizeClinicalText(
      "postpartum heavy bleeding and 8 weeks pregnant vaginal bleeding pelvic pain — complex case",
    );
    const hints = inferObGynePathwayHints(t, "GYNE");
    expect(hints.some((h) => h.includes("early_pregnancy_bleeding_ectopic_miscarriage"))).toBe(true);
    expect(hints.some((h) => h.includes("postpartum_urgent_ob"))).toBe(true);
  });
});
