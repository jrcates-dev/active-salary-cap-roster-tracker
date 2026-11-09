import Link from "next/link";

export function TeamChip({
  team,
  nick,
  color,
  href = true,
  size = "md",
}: {
  team: string;
  nick?: string;
  color: string;
  href?: boolean;
  size?: "sm" | "md";
}) {
  const inner = (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={size === "sm" ? "h-3 w-3 rounded-[3px]" : "h-4 w-4 rounded-[3px]"}
        style={{ background: color }}
      />
      <span className={`num font-semibold ${size === "sm" ? "text-sm" : "text-lg"}`}>
        {nick ?? team}
      </span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={`/team/${team}`} className="hover:underline underline-offset-4">
      {inner}
    </Link>
  );
}
