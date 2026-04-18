type MonthRangePreset = "1" | "3" | "6" | "12" | "custom";
type ForecastMode = "unweighted" | "weighted";

type RevenueScopePanelProps = {
  rangePreset: MonthRangePreset;
  onRangePresetChange: (preset: MonthRangePreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  forecastMode: ForecastMode;
  onForecastModeChange: (mode: ForecastMode) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  onReset: () => void;
  filtersSlot?: React.ReactNode;
  scopeLabel: string;
  leadsInScope: number;
  realizationRate: number;
};

export function RevenueScopePanel({
  rangePreset,
  onRangePresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  forecastMode,
  onForecastModeChange,
  showFilters,
  onToggleFilters,
  onReset,
  filtersSlot,
  scopeLabel,
  leadsInScope,
  realizationRate,
}: RevenueScopePanelProps) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Revenue Scope</span>
          {(["1", "3", "6", "12", "custom"] as MonthRangePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onRangePresetChange(preset)}
              className={`rounded px-2 py-1 text-xs ${rangePreset === preset ? "bg-[#788023] text-white" : "bg-slate-200 text-slate-700"}`}
            >
              {preset === "custom" ? "Custom" : `${preset}M`}
            </button>
          ))}
          {rangePreset === "custom" && (
            <>
              <input
                type="month"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                value={customStart}
                onChange={(event) => onCustomStartChange(event.target.value)}
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="month"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                value={customEnd}
                onChange={(event) => onCustomEndChange(event.target.value)}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Forecast Mode</span>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            value={forecastMode}
            onChange={(event) => onForecastModeChange(event.target.value as ForecastMode)}
          >
            <option value="unweighted">Unweighted</option>
            <option value="weighted">Weighted by stage</option>
          </select>
          <button type="button" onClick={onToggleFilters} className="rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-300">
            {showFilters ? "Hide" : "More"} Filters
          </button>
          <button type="button" onClick={onReset} className="rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-300">
            Reset Filters
          </button>
        </div>
      </div>

      {showFilters && filtersSlot}

      <p className="mt-3 text-xs text-slate-500">
        Scope: {scopeLabel} | Leads in scope: {leadsInScope} | Realization: {realizationRate.toFixed(1)}%
      </p>
    </div>
  );
}
