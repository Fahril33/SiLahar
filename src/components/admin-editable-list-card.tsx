import type { ReactNode } from "react";

type AdminEditableListCardProps = {
  title: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  summary?: ReactNode;
  isEditing: boolean;
  editContent?: ReactNode;
  disableActions?: boolean;
  primaryActionLabel?: string;
  saveLoading?: boolean;
  primaryActionLoading?: boolean;
  deleteLoading?: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPrimaryAction?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  saveLoadingLabel?: string;
  primaryActionLoadingLabel?: string;
  deleteLoadingLabel?: string;
  extraActions?: ReactNode;
};

export function AdminEditableListCard(props: AdminEditableListCardProps) {
  return (
    <article className="surface-card rounded-[24px] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 text-base font-semibold text-[var(--text-primary)]">
              {props.title}
            </div>
            {props.badges}
          </div>

          {props.meta ? (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              {props.meta}
            </div>
          ) : null}

          {props.isEditing ? (
            <div className="mt-4">{props.editContent}</div>
          ) : props.summary ? (
            <div className="mt-3">{props.summary}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {props.isEditing ? (
            <>
              <button
                type="button"
                onClick={props.onSaveEdit}
                disabled={props.disableActions}
                className="btn-secondary min-w-[88px] px-4 py-2 text-sm disabled:opacity-60"
              >
                {props.saveLoading ? (
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {props.saveLoadingLabel ? (
                      <span className="text-[10px] font-medium leading-none opacity-80">
                        {props.saveLoadingLabel}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  "Simpan"
                )}
              </button>
              <button
                type="button"
                onClick={props.onCancelEdit}
                disabled={props.disableActions}
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"
              >
                Batal
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={props.onStartEdit}
              disabled={props.disableActions}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
            >
              Edit
            </button>
          )}

          {props.onPrimaryAction ? (
            <button
              type="button"
              onClick={props.onPrimaryAction}
              disabled={props.disableActions}
              className="btn-secondary min-w-[116px] px-4 py-2 text-sm disabled:opacity-60"
            >
              {props.primaryActionLoading ? (
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {props.primaryActionLoadingLabel ? (
                    <span className="text-[10px] font-medium leading-none opacity-80">
                      {props.primaryActionLoadingLabel}
                    </span>
                  ) : null}
                </div>
              ) : (
                props.primaryActionLabel ?? "Pilih"
              )}
            </button>
          ) : null}

          {props.onDelete ? (
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.disableActions}
              className="btn-danger min-w-[88px] px-4 py-2 text-sm disabled:opacity-60"
            >
              {props.deleteLoading ? (
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {props.deleteLoadingLabel ? (
                    <span className="text-[10px] font-medium leading-none opacity-80">
                      {props.deleteLoadingLabel}
                    </span>
                  ) : null}
                </div>
              ) : (
                props.deleteLabel ?? "Hapus"
              )}
            </button>
          ) : null}

          {props.extraActions}
        </div>
      </div>
    </article>
  );
}
