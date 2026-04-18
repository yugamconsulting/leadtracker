type MonthRangePreset = "1" | "3" | "6" | "12" | "custom";

type InvoicesScopePanelProps = {
  rangePreset: MonthRangePreset;
  onRangePresetChange: (preset: MonthRangePreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  scopeLabel: string;
  controlsSlot?: React.ReactNode;
  noteSlot?: React.ReactNode;
  children?: React.ReactNode;
};

export function InvoicesScopePanel({
  rangePreset,
  onRangePresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  scopeLabel,
  controlsSlot,
  noteSlot,
  children,
}: InvoicesScopePanelProps) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Month Range</span>
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
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Scope: {scopeLabel}</span>
      </div>
      {controlsSlot}
      {noteSlot}
      {children}
    </div>
  );
}
