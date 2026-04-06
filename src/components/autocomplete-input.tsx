import { useMemo, useState } from "react";
import { includesReporterName } from "../lib/reporter-name";

type AutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
  emptyMessage?: string;
  endAdornment?: React.ReactNode;
};

export function AutocompleteInput(props: AutocompleteInputProps) {
  const {
    value,
    onChange,
    options,
    placeholder,
    className = "",
    emptyMessage = "Belum ada saran nama yang cocok.",
    endAdornment,
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const keyword = value.trim();

    if (!keyword) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) => includesReporterName(option, keyword))
      .slice(0, 8);
  }, [options, value]);

  const showPanel = isOpen && (filteredOptions.length > 0 || value.trim().length > 0);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className} ${endAdornment ? "pr-11" : ""}`}
      />
      {endAdornment && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {endAdornment}
        </div>
      )}
      {showPanel ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-panel-strong)] shadow-[var(--shadow-card)] backdrop-blur">
          {filteredOptions.length > 0 ? (
            <div className="max-h-56 overflow-y-auto p-2">
              {filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="block w-full rounded-2xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-[var(--text-muted)]">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
