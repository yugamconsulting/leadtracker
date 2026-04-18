type InvoicesKpiStripProps = {
  compactMode: boolean;
  totalInvoices: number;
  billedValue: string;
  collectedValue: string;
  pendingValue: string;
  overdueCount: number;
  gstCollectedValue: string;
  realizationLabel: string;
  pendingApprovalCount: number;
};

export function InvoicesKpiStrip({
  compactMode,
  totalInvoices,
  billedValue,
  collectedValue,
  pendingValue,
  overdueCount,
  gstCollectedValue,
  realizationLabel,
  pendingApprovalCount,
}: InvoicesKpiStripProps) {
  return (
    <div className={`grid gap-4 ${compactMode ? "md:grid-cols-4" : "md:grid-cols-7"}`}>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <p className="text-xs text-slate-500">Total Invoices</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{totalInvoices}</p>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <p className="text-xs text-slate-500">Billed Value</p>
        <p className="mt-1 text-2xl font-bold text-[#788023]">{billedValue}</p>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <p className="text-xs text-slate-500">Collected</p>
        <p className="mt-1 text-2xl font-bold text-sky-600">{collectedValue}</p>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <p className="text-xs text-slate-500">Pending</p>
        <p className="mt-1 text-2xl font-bold text-rose-600">{pendingValue}</p>
      </div>
      {!compactMode && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-xs text-slate-500">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{overdueCount}</p>
        </div>
      )}
      {!compactMode && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-xs text-slate-500">GST Collected</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{gstCollectedValue}</p>
          <p className="text-[11px] text-slate-500">Realization {realizationLabel}</p>
        </div>
      )}
      {!compactMode && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-xs text-slate-500">Pending Approval</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">{pendingApprovalCount}</p>
        </div>
      )}
    </div>
  );
}
