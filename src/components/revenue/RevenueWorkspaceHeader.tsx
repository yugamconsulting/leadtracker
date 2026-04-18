type RevenueTabKey = "overview" | "forecast" | "collections" | "reconciliation" | "exports";

type RevenueWorkspaceHeaderProps = {
  compactMode: boolean;
  revenueTab: RevenueTabKey;
  onRevenueTabChange: (tab: RevenueTabKey) => void;
};

const REVENUE_TABS: Array<{ key: RevenueTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "forecast", label: "Forecast" },
  { key: "collections", label: "Collections" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "exports", label: "Exports" },
];

export function RevenueWorkspaceHeader({ compactMode, revenueTab, onRevenueTabChange }: RevenueWorkspaceHeaderProps) {
  const modeSummary = compactMode
    ? "What you're seeing: core KPIs, scope controls, and simplified overview blocks. Hidden in Basic mode: deep collections and reconciliation detail panels."
    : "What you're seeing: full forecasting, collections, reconciliation, and export controls for finance reviews.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Revenue Module</p>
          <p className="text-xs text-slate-600">
            {compactMode
              ? "Compact view keeps only essential revenue actions visible."
              : "Advanced view shows full forecasting, collections, and reconciliation intelligence."}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{modeSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REVENUE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onRevenueTabChange(tab.key)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                revenueTab === tab.key ? "bg-[#788023] text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
