type FileUploadInputProps = {
  label: string;
  accept: string;
  helperText?: string;
  selectedFileName?: string;
  multiple?: boolean;
  disabled?: boolean;
  inputKey?: string;
  onChange: (files: FileList | null) => void;
};

export function FileUploadInput(props: FileUploadInputProps) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-panel-strong)] p-4">
      <label className="block text-sm font-medium text-[var(--text-muted)]">
        {props.label}
      </label>

      <input
        key={props.inputKey}
        type="file"
        accept={props.accept}
        multiple={props.multiple}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.files)}
        className="mt-3 block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--surface-accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--text-primary)] disabled:opacity-60"
      />

      {props.helperText || props.selectedFileName ? (
        <p className="mt-3 break-all text-sm text-[var(--text-muted)]">
          {props.selectedFileName ? (
            <span className="font-semibold text-[var(--text-primary)]">
              {props.selectedFileName}
            </span>
          ) : (
            props.helperText
          )}
        </p>
      ) : null}
    </div>
  );
}
