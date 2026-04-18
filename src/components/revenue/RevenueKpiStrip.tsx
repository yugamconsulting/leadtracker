type RevenueKpiStripProps = {
  compactMode: boolean;
  openPipelineTotal: string;
  bookedTotal: string;
  collectedTotal: string;
  outstandingTotal: string;
  forecastMoMClassName: string;
  forecastMoMLabel: string;
};

export function RevenueKpiStrip({
  compactMode,
  openPipelineTotal,
  bookedTotal,
  collectedTotal,
  outstandingTotal,
  forecastMoMClassName,
  forecastMoMLabel,
}: RevenueKpiStripProps) {
  return (
    <div className={`grid gap-4 ${compactMode ? "md:grid-cols-4" : "md:grid-cols-5"}`}>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Open Pipeline</p>
        <p className="mt-2 text-2xl font-bold text-[#788023]">{openPipelineTotal}</p>
        <p className="mt-1 text-[11px] text-slate-500">Directional</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Booked Revenue</p>
        <p className="mt-2 text-2xl font-bold text-emerald-600">{bookedTotal}</p>
        <p className="mt-1 text-[11px] text-slate-500">Exact</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Collected Revenue</p>
        <p className="mt-2 text-2xl font-bold text-sky-600">{collectedTotal}</p>
        <p className="mt-1 text-[11px] text-slate-500">Exact</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
        <p className="text-sm text-slate-500">Outstanding</p>
        <p className="mt-2 text-2xl font-bold text-rose-600">{outstandingTotal}</p>
        <p className="mt-1 text-[11px] text-slate-500">Exact</p>
      </div>
      {!compactMode && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Forecast MoM</p>
          <p className={`mt-2 text-2xl font-bold ${forecastMoMClassName}`}>{forecastMoMLabel}</p>
          <p className="mt-1 text-[11px] text-slate-500">Directional</p>
        </div>
      )}
    </div>
  );
}
