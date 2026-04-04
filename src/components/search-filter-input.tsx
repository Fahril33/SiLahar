type SearchFilterInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function SearchFilterInput(props: SearchFilterInputProps) {
  return (
    <input
      value={props.value}
      onChange={(event) => props.onChange(event.target.value.toUpperCase())}
      placeholder={props.placeholder}
      disabled={props.disabled}
      className={`field-input ${props.className ?? ""}`.trim()}
    />
  );
}
