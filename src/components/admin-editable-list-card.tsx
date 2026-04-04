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
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPrimaryAction?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
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
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                Simpan
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
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
            >
              {props.primaryActionLabel ?? "Pilih"}
            </button>
          ) : null}

          {props.onDelete ? (
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.disableActions}
              className="btn-danger px-4 py-2 text-sm disabled:opacity-60"
            >
              {props.deleteLabel ?? "Hapus"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
