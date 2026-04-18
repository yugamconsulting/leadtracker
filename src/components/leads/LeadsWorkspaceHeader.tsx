type LeadsWorkspaceHeaderProps = {
  newLeadCount: number;
  onOpenNewQueue: () => void;
  onAddLead: () => void;
  onImportCsv: () => void;
  showInvoiceHint: boolean;
};

export function LeadsWorkspaceHeader({ newLeadCount, onOpenNewQueue, onAddLead, onImportCsv, showInvoiceHint }: LeadsWorkspaceHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce0bd] bg-[#f4f6e7] px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-[#4b5218]">Leads Workspace</p>
        <p className="text-xs text-[#5e6625]">Add leads from here, then manage everything in one unified table.</p>
        {showInvoiceHint && (
          <p className="mt-1 text-[11px] text-[#4f5520]">
            Invoice shortcut is available in row actions for leads in Confirmation, Invoice Sent, and Won.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenNewQueue}
          className="rounded-lg border border-[#cfd7a2] bg-white px-3 py-2 text-sm font-medium text-[#5e6625] hover:bg-[#f8f9ef]"
        >
          New Queue ({newLeadCount})
        </button>
        <button
          type="button"
          onClick={onImportCsv}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Import CSV
        </button>
        <button
          type="button"
          onClick={onAddLead}
          className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]"
        >
          Add Lead
        </button>
      </div>
    </div>
  );
}