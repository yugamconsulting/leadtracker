type FollowupToolbarProps = {
  isBasicMode: boolean;
  canShowFollowupAdvanced: boolean;
  followupSearch: string;
  onFollowupSearchChange: (value: string) => void;
  followupAssigneeFilter: string;
  onFollowupAssigneeChange: (value: string) => void;
  assigneeOptions: string[];
  followupStageFilter: string;
  onFollowupStageChange: (value: string) => void;
  stageOptions: string[];
  followupTempFilter: string;
  onFollowupTempChange: (value: string) => void;
  tempOptions: string[];
  onReset: () => void;
  followupQueue: string;
  onFollowupQueueChange: (value: string) => void;
  queueOptions: Array<{ key: string; label: string }>;
  selectedAll: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  followupBulkAction: string;
  onFollowupBulkActionChange: (value: string) => void;
  followupBulkAssignee: string;
  onFollowupBulkAssigneeChange: (value: string) => void;
  onOpenReassignPicker: () => void;
  followupBulkDate: string;
  onFollowupBulkDateChange: (value: string) => void;
  onApplyBulk: () => void;
};

export function FollowupToolbar({
  isBasicMode,
  canShowFollowupAdvanced,
  followupSearch,
  onFollowupSearchChange,
  followupAssigneeFilter,
  onFollowupAssigneeChange,
  assigneeOptions,
  followupStageFilter,
  onFollowupStageChange,
  stageOptions,
  followupTempFilter,
  onFollowupTempChange,
  tempOptions,
  onReset,
  followupQueue,
  onFollowupQueueChange,
  queueOptions,
  selectedAll,
  onToggleSelectAll,
  followupBulkAction,
  onFollowupBulkActionChange,
  followupBulkAssignee,
  onFollowupBulkAssigneeChange,
  onOpenReassignPicker,
  followupBulkDate,
  onFollowupBulkDateChange,
  onApplyBulk,
}: FollowupToolbarProps) {
  return (
    <div className="neo-toolbar rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className={`grid gap-2 md:grid-cols-2 ${isBasicMode ? "xl:grid-cols-3" : "xl:grid-cols-5"}`}>
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search lead, company, notes" value={followupSearch} onChange={(e) => onFollowupSearchChange(e.target.value)} />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={followupAssigneeFilter} onChange={(e) => onFollowupAssigneeChange(e.target.value)}><option>All</option>{assigneeOptions.map((name) => <option key={name}>{name}</option>)}</select>
        {canShowFollowupAdvanced && <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={followupStageFilter} onChange={(e) => onFollowupStageChange(e.target.value)}><option>All</option>{stageOptions.map((status) => <option key={status}>{status}</option>)}</select>}
        {canShowFollowupAdvanced && <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={followupTempFilter} onChange={(e) => onFollowupTempChange(e.target.value)}><option>All</option>{tempOptions.map((temp) => <option key={temp}>{temp}</option>)}</select>}
        <button type="button" onClick={onReset} className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">Reset Filters</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {queueOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onFollowupQueueChange(option.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${followupQueue === option.key ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {canShowFollowupAdvanced && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={selectedAll} onChange={(e) => onToggleSelectAll(e.target.checked)} />Select all</label>
          <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={followupBulkAction} onChange={(e) => onFollowupBulkActionChange(e.target.value)}>
            <option value="">Bulk action</option>
            <option value="mark-done">Mark Done</option>
            <option value="move-today">Move to Today</option>
            <option value="snooze-2">Snooze +2d</option>
            <option value="snooze-7">Snooze +7d</option>
            <option value="reassign">Reassign</option>
            <option value="set-date">Set Date</option>
          </select>
          {followupBulkAction === "reassign" && (
            <>
              <button
                type="button"
                onClick={onOpenReassignPicker}
                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {followupBulkAssignee ? `Assignee: ${followupBulkAssignee}` : "Choose assignee"}
              </button>
              {followupBulkAssignee && (
                <button
                  type="button"
                  onClick={() => onFollowupBulkAssigneeChange("")}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  aria-label="Clear selected assignee"
                >
                  Clear
                </button>
              )}
            </>
          )}
          {followupBulkAction === "set-date" && (
            <input type="date" className="rounded border border-slate-300 px-2 py-1 text-xs" value={followupBulkDate} onChange={(e) => onFollowupBulkDateChange(e.target.value)} />
          )}
          <button type="button" onClick={onApplyBulk} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">Apply</button>
        </div>
      )}
    </div>
  );
}