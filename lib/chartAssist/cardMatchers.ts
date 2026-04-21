import type { AssistCardResult, ParsedCaseFact } from "./cardTypes";
import { buildUriWheezeCard, shouldShowUriWheezeCard } from "./cards/uriWheezeCard";
import { buildBloodyDiarrheaCard, shouldShowBloodyDiarrheaCard } from "./cards/bloodyDiarrheaCard";
import { buildHeadInjuryCard, shouldShowHeadInjuryCard } from "./cards/headInjuryCard";
import { buildFeverSepsisCard, shouldShowFeverSepsisCard } from "./cards/feverSepsisCard";
import {
  buildAbdominalPainVomitingCard,
  shouldShowAbdominalPainVomitingCard,
} from "./cards/abdominalPainVomitingCard";
import {
  buildSoftTissueInfectionCard,
  shouldShowSoftTissueInfectionCard,
} from "./cards/softTissueInfectionCard";

export function getActiveDiseaseCards(input: ParsedCaseFact): AssistCardResult[] {
  const cards: AssistCardResult[] = [];

  if (shouldShowHeadInjuryCard(input)) {
    cards.push(buildHeadInjuryCard(input));
  }
  if (shouldShowBloodyDiarrheaCard(input)) {
    cards.push(buildBloodyDiarrheaCard(input));
  }
  if (shouldShowAbdominalPainVomitingCard(input)) {
    cards.push(buildAbdominalPainVomitingCard(input));
  }
  if (shouldShowSoftTissueInfectionCard(input)) {
    cards.push(buildSoftTissueInfectionCard(input));
  }
  if (shouldShowUriWheezeCard(input)) {
    cards.push(buildUriWheezeCard(input));
  }
  /** Fever/sepsis — หลัง URI/ผิวหนัง เพื่อลด over-escalation */
  if (shouldShowFeverSepsisCard(input)) {
    cards.push(buildFeverSepsisCard(input));
  }

  return cards
    .sort((a, b) => {
      const score = { urgent: 3, warn: 2, info: 1 };
      return score[b.severity] - score[a.severity];
    })
    .slice(0, 3);
}
