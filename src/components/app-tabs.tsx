import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { View } from "../hooks/use-report-dashboard";

function ReportTabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8l4 4v16H4V2h4z" />
      <path d="M16 2v4h4" />
      <path d="M8 12h8M8 16h8M8 8h4" />
    </svg>
  );
}

function HistoryTabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5l3 2" />
      <path d="M3.05 11A9 9 0 1 1 4.5 16.5" />
      <path d="M3 16.5V11h5.5" />
    </svg>
  );
}

function StatusTabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l2 2 4-5" />
      <path d="M21 12a9 9 0 1 1-9-9 8.8 8.8 0 0 1 5.3 1.75" />
    </svg>
  );
}

function AdminTabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6l7-4z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

const TABS: Array<{ key: View; label: string; icon: JSX.Element }> = [
  { key: "entry", label: "Laporan", icon: <ReportTabIcon /> },
  { key: "history", label: "Histori", icon: <HistoryTabIcon /> },
  { key: "status", label: "Status", icon: <StatusTabIcon /> },
  { key: "admin", label: "Admin", icon: <AdminTabIcon /> },
];

type SliderMetrics = {
  width: number;
  x: number;
};

export function AppTabs({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sliderMetrics, setSliderMetrics] = useState<SliderMetrics>({
    width: 0,
    x: 0,
  });
  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.key === view),
  );
  const isTabActive = (tabKey: View) => view === tabKey;

  useLayoutEffect(() => {
    const navElement = navRef.current;
    const activeTabElement = tabRefs.current[view];

    if (!navElement || !activeTabElement) {
      return;
    }

    const navRect = navElement.getBoundingClientRect();
    const tabRect = activeTabElement.getBoundingClientRect();

    setSliderMetrics({
      width: tabRect.width,
      x: tabRect.left - navRect.left,
    });
  }, [view]);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }

    const syncSliderMetrics = () => {
      const activeTabElement = tabRefs.current[view];
      if (!navElement || !activeTabElement) {
        return;
      }

      const navRect = navElement.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();

      setSliderMetrics({
        width: tabRect.width,
        x: tabRect.left - navRect.left,
      });
    };

    const resizeObserver = new ResizeObserver(syncSliderMetrics);
    resizeObserver.observe(navElement);
    Object.values(tabRefs.current).forEach((tabElement) => {
      if (tabElement) resizeObserver.observe(tabElement);
    });

    window.addEventListener("resize", syncSliderMetrics);
    syncSliderMetrics();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSliderMetrics);
    };
  }, [view]);

  return (
    <nav
      ref={navRef}
      className="app-tabs-nav"
      style={
        {
          "--active-tab-index": activeIndex,
          "--active-tab-width": `${sliderMetrics.width}px`,
          "--active-tab-x": `${sliderMetrics.x}px`,
        } as CSSProperties
      }
    >
      <span className="app-tabs-slider" aria-hidden="true" />
      {TABS.map((tab) => (
        <button
          key={tab.key}
          ref={(element) => {
            tabRefs.current[tab.key] = element;
          }}
          type="button"
          onClick={() => onChange(tab.key)}
          aria-label={tab.label}
          className={`app-tabs-button ${
            isTabActive(tab.key)
              ? "app-tabs-button-active"
              : "app-tabs-button-idle"
          }`}
        >
          <span className="app-tabs-icon lg:hidden" aria-hidden="true">
            {tab.icon}
          </span>
          <span
            className={`app-tabs-label ${
              isTabActive(tab.key) ? "inline" : "hidden lg:inline"
            }`}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
