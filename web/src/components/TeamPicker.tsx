"use client";

import { useRouter } from "next/navigation";

export function TeamPicker({ teams }: { teams: { team: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-fg-muted">
      <span className="sr-only">Go to team</span>
      <select
        className="rounded-md border border-border bg-panel px-3 py-1.5 text-fg"
        defaultValue=""
        onChange={(e) => e.target.value && router.push(`/team/${e.target.value}`)}
      >
        <option value="" disabled>
          Pick a team
        </option>
        {teams.map((t) => (
          <option key={t.team} value={t.team}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
