type LeadsTableProps = {
  filteredLeads: any[];
  selectedLeadIds: string[];
  selectedAll: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleLead: (leadId: string, checked: boolean) => void;
  activities: any[];
  leadOptionalColumnSet: Set<string>;
  leadOptionalColumnCount: number;
  canEditAll: boolean;
  assigneeOptions: string[];
  invoiceEligibleStatuses: string[];
  canUseInvoicing: boolean;
  onStatusChange: (lead: any, status: string) => void;
  onReassign: (leadId: string, assignee: string) => void;
  onExpectedChange: (leadId: string, expectedClosingDate: string) => void;
  onCreateInvoice: (lead: any) => void;
  onCallLead: (lead: any) => void;
  onOpenWhatsApp: (lead: any) => void;
  onMarkDone: (lead: any) => void;
  onSnooze2d: (lead: any) => void;
  onOpenDetails: (leadId: string) => void;
  onSoftDelete: (lead: any) => void;
  onEscalateLead: (lead: any) => void;
  canSoftDelete: boolean;
  onResetFilters: () => void;
  dateTag: (lead: any) => "Overdue" | "Due Today" | "Upcoming" | "Done";
  contactabilityBadge: (lead: any) => { label: string; className: string };
  leadHealthScore: (lead: any) => number;
  getLeadSlaMeta: (lead: any) => { tier: string; label: string; className: string; managerCue: string };
  duplicateLeadIdSet: Set<string>;
  formatInr: (value: number) => string;
  formatDateDisplay: (value: string) => string;
  formatDateTimeDisplay: (value: string) => string;
};

export function LeadsTable({
  filteredLeads,
  selectedLeadIds,
  selectedAll,
  onToggleSelectAll,
  onToggleLead,
  activities,
  leadOptionalColumnSet,
  leadOptionalColumnCount,
  canEditAll,
  assigneeOptions,
  invoiceEligibleStatuses,
  canUseInvoicing,
  onStatusChange,
  onReassign,
  onExpectedChange,
  onCreateInvoice,
  onCallLead,
  onOpenWhatsApp,
  onMarkDone,
  onSnooze2d,
  onOpenDetails,
  onSoftDelete,
  onEscalateLead,
  canSoftDelete,
  onResetFilters,
  dateTag,
  contactabilityBadge,
  leadHealthScore,
  getLeadSlaMeta,
  duplicateLeadIdSet,
  formatInr,
  formatDateDisplay,
  formatDateTimeDisplay,
}: LeadsTableProps) {
  return (
    <div className="neo-table-wrap rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={selectedAll}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Select all leads"
                />
              </th>
              <th className="px-2 py-2">Lead</th>
              <th className="px-2 py-2">Company</th>
              {leadOptionalColumnSet.has("source") && <th className="px-2 py-2">Source</th>}
              {leadOptionalColumnSet.has("service") && <th className="px-2 py-2">Service</th>}
              <th className="px-2 py-2">Status</th>
              {leadOptionalColumnSet.has("temperature") && <th className="px-2 py-2">Temperature</th>}
              <th className="px-2 py-2">Assignee</th>
              {leadOptionalColumnSet.has("deal") && <th className="px-2 py-2">Deal Value</th>}
              {leadOptionalColumnSet.has("expected") && <th className="px-2 py-2">Expected Closing</th>}
              <th className="px-2 py-2">Next Follow-up</th>
              <th className="px-2 py-2">Contactability</th>
              <th className="px-2 py-2">Lead Health</th>
              {leadOptionalColumnSet.has("invoice") && <th className="px-2 py-2">Invoice Flow</th>}
              {leadOptionalColumnSet.has("tag") && <th className="px-2 py-2">Tag</th>}
              <th className="px-2 py-2">SLA</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => {
              const latest = activities.find((activity) => activity.leadId === lead.id);
              const tag = dateTag(lead);
              const tagClass = tag === "Overdue"
                ? "bg-rose-100 text-rose-700"
                : tag === "Due Today"
                  ? "bg-amber-100 text-amber-700"
                  : tag === "Done"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-sky-100 text-sky-700";
              const slaMeta = getLeadSlaMeta(lead);
              const contactability = contactabilityBadge(lead);
              const healthScore = leadHealthScore(lead);
              const healthClass = healthScore >= 75
                ? "bg-emerald-100 text-emerald-700"
                : healthScore >= 45
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700";
              const temperatureDotClass = lead.leadTemperature === "Hot"
                ? "bg-rose-500"
                : lead.leadTemperature === "Warm"
                  ? "bg-amber-500"
                  : "bg-sky-500";
              const isPossibleDuplicate = duplicateLeadIdSet.has(lead.id);
              return (
                <tr key={lead.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={(event) => onToggleLead(lead.id, event.target.checked)}
                      aria-label={`Select lead ${lead.leadName}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${temperatureDotClass}`} aria-label={`${lead.leadTemperature} lead`} title={`${lead.leadTemperature} lead`} />
                      <span className="font-medium text-slate-800">{lead.leadName}</span>
                      {isPossibleDuplicate && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="Possible duplicate">Possible Duplicate</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{lead.phoneNumber}</div>
                  </td>
                  <td className="px-2 py-2">{lead.companyName}</td>
                  {leadOptionalColumnSet.has("source") && <td className="px-2 py-2">{lead.leadSource}</td>}
                  {leadOptionalColumnSet.has("service") && <td className="px-2 py-2">{lead.serviceInterested}</td>}
                  <td className="px-2 py-2">
                    <select className="rounded border border-slate-300 px-2 py-1" value={lead.leadStatus} onChange={(event) => onStatusChange(lead, event.target.value)}>
                      {["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won", "Lost"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  {leadOptionalColumnSet.has("temperature") && <td className="px-2 py-2">{lead.leadTemperature}</td>}
                  <td className="px-2 py-2">
                    <select className="rounded border border-slate-300 px-2 py-1" value={lead.assignedTo} onChange={(event) => onReassign(lead.id, event.target.value)} disabled={!canEditAll}>
                      {assigneeOptions.map((assignee) => <option key={assignee}>{assignee}</option>)}
                    </select>
                  </td>
                  {leadOptionalColumnSet.has("deal") && <td className="px-2 py-2">{formatInr(lead.dealValue)}</td>}
                  {leadOptionalColumnSet.has("expected") && (
                    <td className="px-2 py-2">
                      <input className="rounded border border-slate-300 px-2 py-1" type="date" value={lead.expectedClosingDate} onChange={(event) => onExpectedChange(lead.id, event.target.value)} />
                    </td>
                  )}
                  <td className="px-2 py-2">{formatDateDisplay(lead.nextFollowupDate)}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${contactability.className}`}>{contactability.label}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${healthClass}`}>{healthScore}</span>
                  </td>
                  {leadOptionalColumnSet.has("invoice") && (
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${lead.invoiceFlowStatus === "Sent" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>{lead.invoiceFlowStatus}</span>
                        {lead.invoiceSentDate && <span className="text-[11px] text-slate-500">{formatDateDisplay(lead.invoiceSentDate)}</span>}
                        {invoiceEligibleStatuses.includes(lead.leadStatus) && (
                          <button type="button" onClick={() => onCreateInvoice(lead)} className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700">
                            Create / Send
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {leadOptionalColumnSet.has("tag") && <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${tagClass}`}>{tag}</span></td>}
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${slaMeta.className}`}>{slaMeta.label}</span>
                      {(slaMeta.tier === "escalate" || slaMeta.tier === "critical") && (
                        <span className="text-[11px] font-medium text-rose-700">{slaMeta.managerCue}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => onCallLead(lead)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">Call</button>
                      <button type="button" onClick={() => onOpenWhatsApp(lead)} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200">WhatsApp</button>
                      <button type="button" onClick={() => onMarkDone(lead)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Done</button>
                      <button type="button" onClick={() => onSnooze2d(lead)} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200">+2d</button>
                      <button type="button" onClick={() => onOpenDetails(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">Details</button>
                      {canUseInvoicing && invoiceEligibleStatuses.includes(lead.leadStatus) && (
                        <button
                          type="button"
                          onClick={() => onCreateInvoice(lead)}
                          className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
                          aria-label={`Create invoice for ${lead.leadName}`}
                        >
                          Invoice
                        </button>
                      )}
                      {(slaMeta.tier === "escalate" || slaMeta.tier === "critical") && (
                        <button type="button" onClick={() => onEscalateLead(lead)} className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200">Escalate</button>
                      )}
                    </div>
                    {canSoftDelete && (
                      <button
                        type="button"
                        onClick={() => onSoftDelete(lead)}
                        className="ml-1 rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200"
                        aria-label={`Delete lead ${lead.leadName}`}
                      >
                        Delete
                      </button>
                    )}
                    <div className="mt-1 text-[11px] text-slate-500">{latest ? formatDateTimeDisplay(latest.createdAt) : "No logs"}</div>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td className="px-2 py-3" colSpan={10 + leadOptionalColumnCount}>
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-700">No leads match current filters</p>
                    <p className="mt-1 text-xs text-slate-500">Reset filters to widen scope.</p>
                    <button type="button" onClick={onResetFilters} className="mt-3 rounded bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">
                      Reset Filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}