type InvoiceWorkspaceTabKey = "workspace" | "collections-inbox" | "client-master";

type InvoicesWorkspaceHeaderProps = {
  compactMode: boolean;
  workspaceTab: InvoiceWorkspaceTabKey;
  onWorkspaceTabChange: (tab: InvoiceWorkspaceTabKey) => void;
};

export function InvoicesWorkspaceHeader({ compactMode, workspaceTab, onWorkspaceTabChange }: InvoicesWorkspaceHeaderProps) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Invoices Module</p>
            <p className="text-xs text-slate-600">
              {compactMode
                ? "Simple mode keeps only daily billing actions on screen."
                : "Advanced mode includes compliance, ledger depth, and monthly summaries."}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{compactMode ? "Simple" : "Advanced"}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onWorkspaceTabChange("workspace")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              workspaceTab === "workspace" ? "bg-[#788023] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Invoice Workspace
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceTabChange("collections-inbox")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              workspaceTab === "collections-inbox" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Dunning Board
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceTabChange("client-master")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              workspaceTab === "client-master" ? "bg-[#5f56d3] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            Client Master
          </button>
        </div>
      </div>

      {workspaceTab === "collections-inbox" && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
          Dunning Board helps teams recover overdue invoices with stage-based reminders, promise-to-pay tracking, and escalation visibility.
        </div>
      )}
    </>
  );
}
