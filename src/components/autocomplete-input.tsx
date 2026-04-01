import { useMemo, useState } from "react";

type AutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
  emptyMessage?: string;
};

export function AutocompleteInput(props: AutocompleteInputProps) {
  const {
    value,
    onChange,
    options,
    placeholder,
    className,
    emptyMessage = "Belum ada saran nama yang cocok.",
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const keyword = value.trim().toUpperCase();

    if (!keyword) {
      return options.slice(0, 8);
    }

    return options.filter((option) => option.includes(keyword)).slice(0, 8);
  }, [options, value]);

  const showPanel = isOpen && (filteredOptions.length > 0 || value.trim().length > 0);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {showPanel ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_18px_36px_rgba(23,32,51,0.12)] backdrop-blur">
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
                  className="block w-full rounded-2xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-ink/55">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
