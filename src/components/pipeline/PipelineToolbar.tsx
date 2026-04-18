type PipelineToolbarProps = {
  pipelineSearch: string;
  onPipelineSearchChange: (value: string) => void;
  pipelineAssigneeFilter: string;
  onPipelineAssigneeChange: (value: string) => void;
  assigneeOptions: string[];
  isBasicMode: boolean;
  dailyMode: boolean;
  pipelineShowAdvancedControls: boolean;
  onToggleAdvanced: () => void;
  canShowPipelineAdvanced: boolean;
  pipelineTempFilter: string;
  onPipelineTempChange: (value: string) => void;
  tempOptions: string[];
  pipelineSort: string;
  onPipelineSortChange: (value: string) => void;
  pipelineFocusMode: "all" | "mine";
  onPipelineFocusChange: (value: "all" | "mine") => void;
  pipelineWipScope: string;
  onPipelineWipScopeChange: (value: string) => void;
  pipelineWipDate: string;
  onPipelineWipDateChange: (value: string) => void;
  pipelineShowClosed: boolean;
  onToggleShowClosed: () => void;
  onReset: () => void;
  visibleCount: number;
  openValueLabel: string;
  overdueCount: number;
  wipReferenceLabel: string;
};

export function PipelineToolbar({
  pipelineSearch,
  onPipelineSearchChange,
  pipelineAssigneeFilter,
  onPipelineAssigneeChange,
  assigneeOptions,
  isBasicMode,
  dailyMode,
  pipelineShowAdvancedControls,
  onToggleAdvanced,
  canShowPipelineAdvanced,
  pipelineTempFilter,
  onPipelineTempChange,
  tempOptions,
  pipelineSort,
  onPipelineSortChange,
  pipelineFocusMode,
  onPipelineFocusChange,
  pipelineWipScope,
  onPipelineWipScopeChange,
  pipelineWipDate,
  onPipelineWipDateChange,
  pipelineShowClosed,
  onToggleShowClosed,
  onReset,
  visibleCount,
  openValueLabel,
  overdueCount,
  wipReferenceLabel,
}: PipelineToolbarProps) {
  return (
    <div className="neo-toolbar rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search in pipeline"
          value={pipelineSearch}
          onChange={(e) => onPipelineSearchChange(e.target.value)}
        />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pipelineAssigneeFilter} onChange={(e) => onPipelineAssigneeChange(e.target.value)}>
          <option value="All">All assignees</option>
          {assigneeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {!isBasicMode && !dailyMode && (
          <button
            type="button"
            onClick={onToggleAdvanced}
            className={`rounded-lg px-3 py-2 text-sm ${pipelineShowAdvancedControls ? "bg-[#788023] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {pipelineShowAdvancedControls ? "Hide Advanced" : "Advanced Controls"}
          </button>
        )}
        {canShowPipelineAdvanced && (
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pipelineTempFilter} onChange={(e) => onPipelineTempChange(e.target.value)}>
            <option value="All">All temperatures</option>
            {tempOptions.map((temp) => <option key={temp} value={temp}>{temp}</option>)}
          </select>
        )}
        {canShowPipelineAdvanced && (
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pipelineSort} onChange={(e) => onPipelineSortChange(e.target.value)}>
            <option value="priority">Sort: Priority</option>
            <option value="value">Sort: Deal Value</option>
            <option value="followup">Sort: Follow-up Date</option>
            <option value="expected">Sort: Expected Close</option>
            <option value="age">Sort: Oldest Leads</option>
          </select>
        )}
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pipelineFocusMode} onChange={(e) => onPipelineFocusChange(e.target.value as "all" | "mine") }>
          <option value="all">All visible</option>
          <option value="mine">My queue</option>
        </select>
        {canShowPipelineAdvanced && (
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pipelineWipScope} onChange={(e) => onPipelineWipScopeChange(e.target.value)}>
            <option value="today">WIP Day: Today</option>
            <option value="custom">WIP Day: Custom</option>
            <option value="all">WIP Day: All dates</option>
          </select>
        )}
        {canShowPipelineAdvanced && pipelineWipScope === "custom" && (
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={pipelineWipDate}
            onChange={(e) => onPipelineWipDateChange(e.target.value)}
          />
        )}
        {canShowPipelineAdvanced && (
          <button
            type="button"
            onClick={onToggleShowClosed}
            className={`rounded-lg px-3 py-2 text-sm ${pipelineShowClosed ? "bg-slate-800 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {pipelineShowClosed ? "Hide Won/Lost" : "Show Won/Lost"}
          </button>
        )}
        <button type="button" onClick={onReset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Reset</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <p>Visible leads: <span className="font-semibold text-slate-700">{visibleCount}</span></p>
        <p>Open value: <span className="font-semibold text-slate-700">{openValueLabel}</span></p>
        <p>Overdue follow-ups: <span className="font-semibold text-rose-600">{overdueCount}</span></p>
        <p>WIP reference: <span className="font-semibold text-slate-700">{wipReferenceLabel}</span></p>
      </div>
    </div>
  );
}