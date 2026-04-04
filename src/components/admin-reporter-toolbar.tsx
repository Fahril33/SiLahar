import { useState } from "react";
import { SearchFilterInput } from "./search-filter-input";

export type ReporterSortMode = "name-asc" | "name-desc" | "join-time";

const SORT_CONFIG: Record<
  ReporterSortMode,
  { shortLabel: string; label: string }
> = {
  "name-asc": { shortLabel: "A-Z", label: "Nama A-Z" },
  "name-desc": { shortLabel: "Z-A", label: "Nama Z-A" },
  "join-time": { shortLabel: "Join", label: "Waktu masuk" },
};

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M8 3v18" />
      <path d="m4 7 4-4 4 4" />
      <path d="M16 21V3" />
      <path d="m20 17-4 4-4-4" />
    </svg>
  );
}

function getNextSortMode(mode: ReporterSortMode): ReporterSortMode {
  if (mode === "name-asc") return "name-desc";
  if (mode === "name-desc") return "join-time";
  return "name-asc";
}

export function AdminReporterToolbar(props: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortMode: ReporterSortMode;
  onSortModeChange: (value: ReporterSortMode) => void;
  disabled?: boolean;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const sortConfig = SORT_CONFIG[props.sortMode];

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <SearchFilterInput
          value={props.searchValue}
          onChange={props.onSearchChange}
          placeholder="FILTER NAMA PENGGUNA"
          disabled={props.disabled}
          className="hidden h-[44px] min-w-[220px] flex-1 px-4 py-2 text-sm md:block"
        />

        <button
          type="button"
          onClick={() => setMobileSearchOpen((current) => !current)}
          disabled={props.disabled}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60 md:hidden"
          aria-label="Cari pengguna"
        >
          <SearchIcon />
        </button>

        <button
          type="button"
          onClick={() =>
            props.onSortModeChange(getNextSortMode(props.sortMode))
          }
          disabled={props.disabled}
          className="flex h-[44px] shrink-0 items-center gap-2 rounded-[14px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
          title={sortConfig.label}
        >
          <SortIcon />
          <span>{sortConfig.shortLabel}</span>
        </button>
      </div>

      {mobileSearchOpen ? (
        <SearchFilterInput
          value={props.searchValue}
          onChange={props.onSearchChange}
          placeholder="FILTER NAMA PENGGUNA"
          disabled={props.disabled}
          className="mt-3 h-[48px] w-full px-4 py-2 text-sm md:hidden"
        />
      ) : null}
    </div>
  );
}
