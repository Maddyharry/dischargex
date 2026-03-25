import ReferenceLinkList from "./ReferenceLinkList";

type ReferenceDrawerProps = {
  title?: string;
  sourceIds: string[];
};

export default function ReferenceDrawer({
  title = "References",
  sourceIds,
}: ReferenceDrawerProps) {
  if (!sourceIds?.length) return null;

  return (
    <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {title}
      </summary>

      <div className="mt-3">
        <ReferenceLinkList sourceIds={sourceIds} inlineTopThai collapsible />
      </div>
    </details>
  );
}
