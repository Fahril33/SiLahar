import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Placement = "left" | "right";

type Position = {
  left: number;
  top: number;
};

type AnchorMetrics = {
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AnchoredInlineWarning(props: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  summary: ReactNode;
  details: ReactNode;
  moreLabel?: string;
  closeLabel?: string;
  placement?: Placement;
  instanceKey?: string | number | null;
  maxWidth?: number;
  gap?: number;
}) {
  const {
    open,
    anchorRef,
    onClose,
    summary,
    details,
    moreLabel = "Selengkapnya..",
    closeLabel = "Tutup",
    placement = "left",
    instanceKey,
    maxWidth = 420,
    gap = 6,
  } = props;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [anchorMetrics, setAnchorMetrics] = useState<AnchorMetrics | null>(null);

  const viewportPadding = 12;

  const computedMaxWidth = useMemo(() => {
    if (typeof window === "undefined") return maxWidth;
    return Math.min(maxWidth, window.innerWidth - viewportPadding * 2);
  }, [maxWidth]);

  const updatePosition = useCallback(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    setAnchorMetrics({ height: anchorRect.height });

    const targetLeft =
      placement === "left"
        ? anchorRect.left - gap - panelRect.width
        : anchorRect.right + gap;
    const targetTop = anchorRect.top + (anchorRect.height - panelRect.height) / 2;

    const left = clamp(
      targetLeft,
      viewportPadding,
      viewportWidth - viewportPadding - panelRect.width,
    );
    const top = clamp(
      targetTop,
      viewportPadding,
      viewportHeight - viewportPadding - panelRect.height,
    );

    setPosition({ left, top });
  }, [anchorRef, gap, open, placement]);

  useLayoutEffect(() => {
    if (!open) {
      setExpanded(false);
      setPosition(null);
      setAnchorMetrics(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    setExpanded(false);
  }, [instanceKey, open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [expanded, open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  const resolvedPosition = position ?? { left: -9999, top: -9999 };

  const node = (
    <div
      ref={panelRef}
      className="pointer-events-auto fixed z-[70] rounded-lg border border-orange-900/80 shadow-2xl backdrop-blur-sm"
      style={{
        left: resolvedPosition.left,
        top: resolvedPosition.top,
        maxWidth: computedMaxWidth,
        minHeight: anchorMetrics?.height,
        background:
          "color-mix(in srgb, var(--surface-panel-strong) 92%, var(--danger) 8%)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="px-3 py-2 text-xs sm:text-sm">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start gap-0.5">
              <p
                className={`font-semibold text-[var(--danger)] break-words leading-tight ${
                  expanded ? "" : "line-clamp-2"
                }`}
              >
                {summary}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="text-[10px] sm:text-xs font-bold underline decoration-current underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                {expanded ? "Tutup" : moreLabel}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 self-start rounded-full border border-orange-900/70 bg-[color-mix(in_srgb,var(--surface-elevated)_94%,var(--danger) 6%)] px-2 py-0.5 text-sm font-semibold text-[var(--danger)] hover:opacity-90"
            aria-label={closeLabel}
            title={closeLabel}
          >
            ×
          </button>
        </div>
        {expanded ? (
          <p className="mt-2 max-w-[50ch] break-words text-xs leading-snug text-[var(--text-primary)] sm:text-sm">
            {details}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return node;
  }

  return createPortal(node, document.body);
}
