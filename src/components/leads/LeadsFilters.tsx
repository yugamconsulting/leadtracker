import type { Dispatch, SetStateAction } from "react";

type OptionalColumn = { key: string; label: string };

type LeadsFiltersProps = {
  isBasicMode: boolean;
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  quickFilter: "all" | "today-followups" | "hot";
  setQuickFilter: Dispatch<SetStateAction<"all" | "today-followups" | "hot">>;
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  filterSource: string;
  setFilterSource: Dispatch<SetStateAction<string>>;
  filterAssignee: string;
  setFilterAssignee: Dispatch<SetStateAction<string>>;
  filterTemp: string;
  setFilterTemp: Dispatch<SetStateAction<string>>;
  statusOptions: string[];
  sourceOptions: string[];
  tempOptions: string[];
  assigneeOptions: string[];
  showLeadColumnPicker: boolean;
  setShowLeadColumnPicker: Dispatch<SetStateAction<boolean>>;
  optionalColumns: OptionalColumn[];
  optionalColumnSet: Set<string>;
  onToggleOptionalColumn: (columnKey: string, checked: boolean) => void;
  onReset: () => void;
};

export function LeadsFilters({
  isBasicMode,
  searchText,
  setSearchText,
  quickFilter,
  setQuickFilter,
  filterStatus,
  setFilterStatus,
  filterSource,
  setFilterSource,
  filterAssignee,
  setFilterAssignee,
  filterTemp,
  setFilterTemp,
  statusOptions,
  sourceOptions,
  tempOptions,
  assigneeOptions,
  showLeadColumnPicker,
  setShowLeadColumnPicker,
  optionalColumns,
  optionalColumnSet,
  onToggleOptionalColumn,
  onReset,
}: LeadsFiltersProps) {
  return (
    <div className={`neo-toolbar grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 md:grid-cols-2 ${isBasicMode ? "xl:grid-cols-5" : "xl:grid-cols-7"}`}>
      <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search leads" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value as "all" | "today-followups" | "hot")}>
        <option value="all">All Leads</option>
        <option value="today-followups">Today&apos;s Follow-ups</option>
        <option value="hot">Hot Leads</option>
      </select>
      <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
        <option>All</option>
        {statusOptions.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {!isBasicMode && (
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option>All</option>
          {sourceOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      )}
      <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
        <option>All</option>
        {assigneeOptions.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      {!isBasicMode && (
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterTemp} onChange={(e) => setFilterTemp(e.target.value)}>
          <option>All</option>
          {tempOptions.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      )}
      {!isBasicMode && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLeadColumnPicker((prev) => !prev)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Columns
          </button>
          {showLeadColumnPicker && (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Optional Columns</p>
              <div className="space-y-1.5">
                {optionalColumns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={optionalColumnSet.has(column.key)}
                      onChange={(e) => onToggleOptionalColumn(column.key, e.target.checked)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={onReset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">Reset Filters</button>
    </div>
  );
}