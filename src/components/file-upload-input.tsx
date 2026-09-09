import { useState, useRef, useEffect, type DragEvent, type ClipboardEvent } from "react";
import { extractImageFilesFromClipboard } from "../lib/image-optimizer";

type FileUploadInputProps = {
  label: string;
  accept: string;
  helperText?: string;
  selectedFileName?: string;
  multiple?: boolean;
  disabled?: boolean;
  inputKey?: string;
  onChange: (files: FileList | File[] | null) => void;
};

export function FileUploadInput(props: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Menangkap paste secara global saat mouse sedang hover di atas area upload (cukup arahkan kursor lalu Cmd+V / Ctrl+V)
  useEffect(() => {
    if (!isHovered || props.disabled) return;

    const handleWindowPaste = (e: globalThis.ClipboardEvent) => {
      const imageFiles = extractImageFilesFromClipboard(e.clipboardData);
      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        if (!props.multiple && imageFiles.length > 1) {
          props.onChange([imageFiles[0]]);
        } else {
          props.onChange(imageFiles);
        }
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [isHovered, props.disabled, props.multiple, props.onChange]);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.disabled) return;
    setIsDragging(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (props.disabled) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      if (!props.multiple && droppedFiles.length > 1) {
        props.onChange([droppedFiles[0]]);
      } else {
        props.onChange(droppedFiles);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (props.disabled) return;
    const imageFiles = extractImageFilesFromClipboard(e.clipboardData);
    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      if (!props.multiple && imageFiles.length > 1) {
        props.onChange([imageFiles[0]]);
      } else {
        props.onChange(imageFiles);
      }
    }
  };

  const handleClickDropzone = () => {
    if (!props.disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      tabIndex={props.disabled ? -1 : 0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={handleClickDropzone}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClickDropzone();
        }
      }}
      className={`group relative rounded-[22px] border-2 border-dashed p-3.5 sm:p-4 transition-all duration-200 cursor-pointer outline-none select-none ${
        props.disabled
          ? "cursor-not-allowed opacity-50 bg-[var(--surface-muted)]/30 border-[var(--border-soft)]"
          : isDragging
            ? "border-purple-500 bg-purple-500/15 ring-4 ring-purple-500/20 scale-[1.008] shadow-md shadow-purple-500/10"
            : isHovered
              ? "border-purple-500/80 bg-purple-500/10 shadow-xs ring-2 ring-purple-500/20"
              : "border-[var(--border-soft)] bg-[var(--surface-panel-strong)] hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-xs focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-500/30"
      }`}
    >
      <input
        ref={inputRef}
        key={props.inputKey}
        type="file"
        accept={props.accept}
        multiple={props.multiple}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.files)}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              isDragging
                ? "bg-purple-600 text-white scale-110 shadow-md shadow-purple-500/30"
                : "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20 group-hover:scale-105"
            }`}
          >
            {isDragging ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 animate-bounce"
              >
                <path d="M12 3v12" />
                <path d="m8 11 4 4 4-4" />
                <path d="M20 21H4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <span className="block text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
              {props.label}
            </span>
            <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--text-muted)] flex items-center gap-1.5 flex-wrap">
              {isDragging ? (
                <span className="font-extrabold text-purple-600 dark:text-purple-300">
                  Lepaskan file di sini untuk mengunggah!
                </span>
              ) : props.selectedFileName ? (
                <span className="font-semibold text-purple-600 dark:text-purple-400 truncate">
                  {props.selectedFileName}
                </span>
              ) : (
                <span>
                  {props.helperText || "Klik untuk pilih, tarik & lepas (drag & drop), atau paste (Ctrl+V)"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Badges / Format Hints */}
        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 pl-13 sm:pl-0">
       
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--surface-muted)]/60 text-[var(--text-muted)] border border-[var(--border-soft)]/50 hidden md:inline-block">
            Paste (Ctrl+V)
          </span>
        </div>
      </div>
    </div>
  );
}

