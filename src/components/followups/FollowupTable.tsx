import { useState } from "react";

type FollowupTableProps = {
  leads: any[];
  isOffline: boolean;
  selectedLeadIds: string[];
  onToggleLead: (leadId: string, checked: boolean) => void;
  onUpdateDate: (leadId: string, nextFollowupDate: string) => void;
  onMoveToday: (leadId: string) => void;
  onSnooze2d: (leadId: string) => void;
  onDone: (lead: any) => void;
  onOpenWhatsApp: (lead: any) => void;
  onOpenDetails: (leadId: string) => void;
  followupQueueKey: (lead: any) => string;
  followupDaysDelta: (lead: any) => number | null;
};

export function FollowupTable({
  leads,
  isOffline,
  selectedLeadIds,
  onToggleLead,
  onUpdateDate,
  onMoveToday,
  onSnooze2d,
  onDone,
  onOpenWhatsApp,
  onOpenDetails,
  followupQueueKey,
  followupDaysDelta,
}: FollowupTableProps) {
  const [touchStartX, setTouchStartX] = useState<Record<string, number>>({});

  const handleTouchStart = (leadId: string, clientX: number) => {
    setTouchStartX((prev) => ({ ...prev, [leadId]: clientX }));
  };

  const handleTouchEnd = (lead: any, clientX: number, queueKey: string) => {
    const startX = touchStartX[lead.id];
    if (typeof startX !== "number") return;
    const delta = clientX - startX;
    if (delta > 70 && (queueKey === "overdue" || queueKey === "today")) {
      onDone(lead);
    }
  };

  return (
    <>
      {isOffline && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          You are offline. Follow-up updates are saved locally and reminders will sync when connection is restored.
        </div>
      )}
      <div className="mt-3 space-y-2 md:hidden">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Swipe right on overdue or due-today cards to mark follow-up as done.
        </div>
        {leads.map((lead) => {
          const queueKey = followupQueueKey(lead);
          const delta = followupDaysDelta(lead);
          const slaClass = queueKey === "overdue" ? "bg-rose-100 text-rose-700" : queueKey === "today" ? "bg-amber-100 text-amber-700" : queueKey === "upcoming" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700";
          return (
            <div
              key={lead.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
              onTouchStart={(event) => handleTouchStart(lead.id, event.changedTouches[0]?.clientX ?? 0)}
              onTouchEnd={(event) => handleTouchEnd(lead, event.changedTouches[0]?.clientX ?? 0, queueKey)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{lead.leadName}</p>
                  <p className="text-xs text-slate-500">{lead.companyName}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${slaClass}`}>{queueKey === "no-date" ? "No Date" : queueKey === "today" ? "Due Today" : queueKey === "overdue" ? "Overdue" : "Upcoming"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>Assignee: <span className="font-medium text-slate-800">{lead.assignedTo || "Unassigned"}</span></p>
                <p>Stage: <span className="font-medium text-slate-800">{lead.leadStatus}</span></p>
                <p className="col-span-2">{delta === null ? "No due date" : delta < 0 ? `${Math.abs(delta)}d overdue` : delta === 0 ? "Due today" : `Due in ${delta}d`}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" onClick={() => onMoveToday(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">Today</button>
                <button type="button" onClick={() => onSnooze2d(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">+2d</button>
                <button type="button" onClick={() => onOpenWhatsApp(lead)} className="rounded bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700">WhatsApp</button>
                <button type="button" onClick={() => onDone(lead)} className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white">Done</button>
                <button type="button" onClick={() => onOpenDetails(lead.id)} className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700">Details</button>
              </div>
            </div>
          );
        })}
        {leads.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">No follow-ups matched this queue and filter combination.</p>}
      </div>

      <div className="mt-3 hidden overflow-x-auto md:block">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-2 py-2">Select</th>
            <th className="px-2 py-2">Lead</th>
            <th className="px-2 py-2">Assignee</th>
            <th className="px-2 py-2">Stage / Temp</th>
            <th className="px-2 py-2">Next Follow-up</th>
            <th className="px-2 py-2">SLA</th>
            <th className="px-2 py-2">Notes</th>
            <th className="px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const queueKey = followupQueueKey(lead);
            const delta = followupDaysDelta(lead);
            const slaClass = queueKey === "overdue" ? "bg-rose-100 text-rose-700" : queueKey === "today" ? "bg-amber-100 text-amber-700" : queueKey === "upcoming" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700";
            return (
              <tr key={lead.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2"><input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={(event) => onToggleLead(lead.id, event.target.checked)} /></td>
                <td className="px-2 py-2">
                  <p className="font-medium text-slate-900">{lead.leadName}</p>
                  <p className="text-xs text-slate-500">{lead.companyName}</p>
                </td>
                <td className="px-2 py-2 text-xs text-slate-700">{lead.assignedTo || "Unassigned"}</td>
                <td className="px-2 py-2 text-xs text-slate-700">
                  <p>{lead.leadStatus}</p>
                  <p className="text-slate-500">{lead.leadTemperature}</p>
                </td>
                <td className="px-2 py-2">
                  <input className="rounded border border-slate-300 px-2 py-1 text-xs" type="date" value={lead.nextFollowupDate} onChange={(event) => onUpdateDate(lead.id, event.target.value)} />
                  <p className="mt-1 text-[11px] text-slate-500">{delta === null ? "No due date" : delta < 0 ? `${Math.abs(delta)}d overdue` : delta === 0 ? "Due today" : `Due in ${delta}d`}</p>
                </td>
                <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${slaClass}`}>{queueKey === "no-date" ? "No Date" : queueKey === "today" ? "Due Today" : queueKey === "overdue" ? "Overdue" : "Upcoming"}</span></td>
                <td className="px-2 py-2 text-xs text-slate-600">{lead.notes ? (lead.notes.length > 56 ? `${lead.notes.slice(0, 56)}...` : lead.notes) : "-"}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => onMoveToday(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">Today</button>
                    <button type="button" onClick={() => onSnooze2d(lead.id)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">+2d</button>
                    <button type="button" onClick={() => onOpenWhatsApp(lead)} className="rounded bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-200">WhatsApp</button>
                    <button type="button" onClick={() => onDone(lead)} className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700">Done</button>
                    <button type="button" onClick={() => onOpenDetails(lead.id)} className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100">Details</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {leads.length === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center text-slate-500">No follow-ups matched this queue and filter combination.</td></tr>}
        </tbody>
      </table>
      </div>
    </>
  );
}