import type { AssistCardResult } from "@/lib/chartAssist/cardTypes";
import CardHeader from "./CardHeader";
import ReferenceDrawer from "./ReferenceDrawer";

type CardRailProps = {
  cards: AssistCardResult[];
};

function Section({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;

  return (
    <details className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-900/30">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </summary>
      <ul className="mt-2 space-y-1">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className="text-sm leading-5 text-zinc-800 dark:text-zinc-200">
            • {item}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function CardRail({ cards }: CardRailProps) {
  if (!cards?.length) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No active cards yet — add input and Analyze.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <div key={card.id} className="space-y-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
          <CardHeader
            label={card.label}
            severity={card.severity}
            sourceIds={card.referenceIds}
          />

          <Section title="Why shown" items={card.whyShown} />
          <Section title="Documented" items={card.documented} />
          <Section title="Missing" items={card.missing} />
          <Section title="Check next" items={card.checkNext} />
          <Section title="Diagnosis ideas" items={card.mostSupportedDiagnosisIdeas} />
          <Section title="Avoid routine" items={card.avoidRoutine} />
          <Section title="Action now" items={card.actionNow} />
          <Section title="Disposition" items={card.dispositionHints} />
          <Section title="Red flags" items={card.redFlags} />
          <Section title="Medication class" items={card.medicationClassSuggestions} />

          {card.referenceIds.length > 0 ? (
            <ReferenceDrawer sourceIds={card.referenceIds} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
