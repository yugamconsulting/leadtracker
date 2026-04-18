import { useState } from "react";

type PipelineBoardProps = {
  columns: any[];
  dragOverStatus: string | null;
  draggingLeadId: string | null;
  canShowAdvanced: boolean;
  requiresGstCompliance: boolean;
  invoiceEligibleStatuses: string[];
  pipelineStatuses: string[];
  onDragOverStatus: (status: any) => void;
  onDropLead: (leadId: string, status: string) => void;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onFollowupToday: (leadId: string) => void;
  onMarkDone: (lead: any) => void;
  onCreateInvoice: (lead: any) => void;
  onStatusChange: (lead: any, status: string) => void;
  onOpenDetails: (leadId: string) => void;
  onExpectedChange: (leadId: string, date: string) => void;
  dateTag: (lead: any) => "Overdue" | "Due Today" | "Upcoming" | "Done";
  followupTagClass: (tag: "Overdue" | "Due Today" | "Upcoming" | "Done") => string;
  urgencyLabel: (lead: any) => string;
  neglectRisk: (lead: any) => "Low" | "Medium" | "High";
  neglectRiskClass: (risk: "Low" | "Medium" | "High") => string;
  daysUntil: (date: string) => number | null;
  formatInr: (value: number) => string;
  formatDateDisplay: (value: string) => string;
  priorityScore: (lead: any) => number;
};

export function PipelineBoard({
  columns,
  dragOverStatus,
  draggingLeadId,
  canShowAdvanced,
  requiresGstCompliance,
  invoiceEligibleStatuses,
  pipelineStatuses,
  onDragOverStatus,
  onDropLead,
  onDragStart,
  onDragEnd,
  onFollowupToday,
  onMarkDone,
  onCreateInvoice,
  onStatusChange,
  onOpenDetails,
  onExpectedChange,
  dateTag,
  followupTagClass,
  urgencyLabel,
  neglectRisk,
  neglectRiskClass,
  daysUntil,
  formatInr,
  formatDateDisplay,
  priorityScore,
}: PipelineBoardProps) {
  const [editingExpectedLeadId, setEditingExpectedLeadId] = useState<string | null>(null);
  const activeColumns = columns.filter((column) => column.status !== "Won" && column.status !== "Lost");
  const closedColumns = columns.filter((column) => column.status === "Won" || column.status === "Lost");

  const renderColumn = (column: any, compact = false) => (
    <div
      key={column.status}
      id={`pipeline-stage-${column.status.toLowerCase().replace(/\s+/g, "-")}`}
      className={`relative flex ${compact ? "h-[22rem]" : "h-[32rem]"} flex-col rounded-2xl bg-white p-3 ring-1 transition ${dragOverStatus === column.status ? "ring-[#788023] bg-[#788023]/5" : draggingLeadId ? "ring-slate-200" : "ring-slate-100"}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragOverStatus !== column.status) onDragOverStatus(column.status);
      }}
      onDragLeave={() => {
        if (dragOverStatus === column.status) onDragOverStatus(null);
      }}
      onDrop={(event) => {
        onDragOverStatus(null);
        const leadId = event.dataTransfer.getData("text/plain");
        if (!leadId) return;
        onDropLead(leadId, column.status);
      }}
    >
      {dragOverStatus === column.status && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#788023] bg-[#788023]/10 text-xs font-semibold text-[#5f651f]">
          Drop here to move to {column.status}
        </div>
      )}
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{column.status}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{column.count}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span>{formatInr(column.totalValue)}</span>
          <span>Overdue {column.overdue}</span>
          {canShowAdvanced && <span>Avg age {column.avgAgeDays.toFixed(1)}d</span>}
        </div>
        {typeof column.wipLimit === "number" && (
          <p className={`mt-1 text-[11px] font-medium ${column.overLimit ? "text-rose-600" : "text-slate-600"}`}>
            Daily WIP {column.dailyCount}/{column.wipLimit}
          </p>
        )}
      </div>
      <div className="custom-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {column.leads.map((lead: any) => {
          const tag = dateTag(lead);
          const risk = neglectRisk(lead);
          const closeIn = daysUntil(lead.expectedClosingDate);
          const isEditingExpected = editingExpectedLeadId === lead.id;
          return (
            <div
              key={lead.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", lead.id);
                onDragStart(lead.id);
              }}
              onDragEnd={onDragEnd}
              className={`cursor-grab active:cursor-grabbing rounded-xl border p-3 transition ${draggingLeadId === lead.id ? "scale-[0.99] border-[#788023] bg-[#788023]/5 shadow-lg" : "border-slate-200 hover:border-[#788023]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{lead.leadName}</p>
                  <p className="text-xs text-slate-500">{lead.companyName}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400" title="Drag to move">⋮⋮</span>
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600"
                    title={`Priority Score: ${priorityScore(lead)}. Calculated from temperature, follow-up urgency, source weight, and lead age.`}
                    aria-label={`Priority score ${priorityScore(lead)}`}
                  >
                    i
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${followupTagClass(tag)}`}>{urgencyLabel(lead)}</span>
                <span className={`rounded-full px-2 py-0.5 ${neglectRiskClass(risk)}`}>Neglect Risk: {risk}</span>
                <span className={`rounded-full px-2 py-0.5 ${lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : lead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{lead.leadTemperature}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{lead.assignedTo || "Unassigned"}</span>
                <span className={`rounded-full px-2 py-0.5 ${lead.invoiceFlowStatus === "Sent" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>Invoice {lead.invoiceFlowStatus}</span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-700">{formatInr(lead.dealValue)}</p>
              <p className="mt-1 text-[11px] text-slate-500">Follow-up: {formatDateDisplay(lead.nextFollowupDate)}</p>
              {canShowAdvanced && (
                <div className="mt-1">
                  <p className="text-[11px] text-slate-500">Expected: {formatDateDisplay(lead.expectedClosingDate)} {closeIn !== null ? `(${closeIn >= 0 ? `${closeIn}d left` : `${Math.abs(closeIn)}d late`})` : ""}</p>
                  <button
                    type="button"
                    onClick={() => setEditingExpectedLeadId((prev) => (prev === lead.id ? null : lead.id))}
                    className="mt-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-200"
                  >
                    {isEditingExpected ? "Hide close date edit" : "Edit close date"}
                  </button>
                  {isEditingExpected && (
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                      type="date"
                      value={lead.expectedClosingDate}
                      onChange={(event) => onExpectedChange(lead.id, event.target.value)}
                    />
                  )}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => onFollowupToday(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">Due Today</button>
                <button type="button" onClick={() => onMarkDone(lead)} className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700">Mark Done</button>
              </div>
              {invoiceEligibleStatuses.includes(lead.leadStatus) && (
                <button type="button" onClick={() => onCreateInvoice(lead)} className="mt-2 w-full rounded bg-[#5f56d3] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#4f47b9]">
                  {requiresGstCompliance ? "Create GST Invoice" : "Create Invoice"}
                </button>
              )}
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-1">
                <select className="rounded border border-slate-300 px-2 py-1 text-[11px]" value={lead.leadStatus} onChange={(event) => onStatusChange(lead, event.target.value)}>
                  {pipelineStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="button" onClick={() => onOpenDetails(lead.id)} className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100">Details</button>
              </div>
            </div>
          );
        })}
        {column.leads.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Drop leads here or adjust filters.</p>}
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-16 z-20 rounded-2xl bg-white/90 p-3 ring-1 ring-slate-100 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage Navigator</p>
          <p className="text-[11px] text-slate-500">Drag cards by the grip and drop into a stage</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeColumns.map((column) => (
            <button
              key={`nav-${column.status}`}
              type="button"
              onClick={() => document.getElementById(`pipeline-stage-${column.status.toLowerCase().replace(/\s+/g, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-[#788023] hover:text-[#788023]"
            >
              {column.status} ({column.count})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {activeColumns.map((column) => renderColumn(column))}
      </div>

      {closedColumns.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closed Stages</p>
            <p className="text-[11px] text-slate-500">Won and Lost are kept separate from active execution stages</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {closedColumns.map((column) => renderColumn(column, true))}
          </div>
        </div>
      )}
    </>
  );
}