type OpenSourceButtonProps = {
  url: string;
  label?: string;
  className?: string;
};

export default function OpenSourceButton({
  url,
  label = "Open source",
  className = "",
}: OpenSourceButtonProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex items-center rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600",
        "hover:bg-zinc-50 dark:hover:bg-zinc-800",
        className,
      ].join(" ")}
    >
      {label}
    </a>
  );
}
