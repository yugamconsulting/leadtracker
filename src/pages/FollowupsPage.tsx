export function FollowupsPage({
  children,
  totalLeads = 0,
}: {
  children: React.ReactNode;
  totalLeads?: number;
}) {

  return (
    <div className="neo-module-shell space-y-4">
      <div className="neo-module-head rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Follow-ups Module</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Follow-up Command Center</h2>
        <p className="mt-1 text-xs text-slate-600">Prioritize overdue work first. Use advanced mode for ownerboard and bulk command actions.</p>
        <p className="mt-2 text-[11px] text-slate-500">Trackable leads: {totalLeads}</p>
      </div>
      {children}
    </div>
  );
}
