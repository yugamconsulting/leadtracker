import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, MutableRefObject, ReactNode } from "react";

type CaptureSummaryItem = {
  field: string;
  value: string;
  confidence: "High" | "Review";
};

type LeadIntakeModalProps = {
  open: boolean;
  autoMoveNewToContacted: boolean;
  step: 1 | 2;
  onStepChange: (step: 1 | 2) => void;
  onClose: () => void;
  leadNameInputRef: MutableRefObject<HTMLInputElement | null>;
  intake: {
    leadName: string;
    companyName: string;
    phoneNumber: string;
    assignedTo: string;
    leadSource: string;
    serviceInterested: string;
    dateAdded: string;
    nextFollowupDate: string;
    emailId: string;
    leadTemperature: string;
    dealValue: number;
    lastContactedDate: string;
    notes: string;
  };
  setIntake: any;
  inlineErrors: Record<string, string>;
  assigneeOptions: string[];
  leadSources: string[];
  leadTemps: string[];
  services: string[];
  isAssignedScope: boolean;
  currentUserName: string;
  isSavingLead: boolean;
  showOptional: boolean;
  setShowOptional: (value: boolean | ((prev: boolean) => boolean)) => void;
  keyboardEntryMode: boolean;
  setKeyboardEntryMode: (value: boolean) => void;
  onQuickSave: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormKeyDown: (event: KeyboardEvent<HTMLFormElement>) => void;
  loadingNode: ReactNode;
  captureText: string;
  setCaptureText: (value: string) => void;
  isCaptureProcessing: boolean;
  onExtractFromText: () => void;
  onExtractFromImage: (file: File) => void;
  captureSummary: CaptureSummaryItem[];
  onApplyCaptureLine: (line: string, target: "leadName" | "companyName" | "phoneNumber" | "emailId" | "website" | "address" | "notes") => void;
};

export function LeadIntakeModal({
  open,
  autoMoveNewToContacted,
  step,
  onStepChange,
  onClose,
  leadNameInputRef,
  intake,
  setIntake,
  inlineErrors,
  assigneeOptions,
  leadSources,
  leadTemps,
  services,
  isAssignedScope,
  currentUserName,
  isSavingLead,
  showOptional,
  setShowOptional,
  keyboardEntryMode,
  setKeyboardEntryMode,
  onQuickSave,
  onSubmit,
  onFormKeyDown,
  loadingNode,
  captureText,
  setCaptureText,
  isCaptureProcessing,
  onExtractFromText,
  onExtractFromImage,
  captureSummary,
  onApplyCaptureLine,
}: LeadIntakeModalProps) {
  const [lineTargets, setLineTargets] = useState<Record<string, string>>({});

  const captureLines = useMemo(() => captureText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 14), [captureText]);

  useEffect(() => {
    setLineTargets({});
  }, [captureText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Add new lead modal">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Add New Lead</h3>
            <p className="text-xs text-slate-500">{autoMoveNewToContacted ? "Auto flow is ON: lead goes directly to Contacted." : "Auto flow is OFF: lead enters New stage first."}</p>
          </div>
          <button type="button" aria-label="Close add lead modal" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Close</button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-medium ${step === 1 ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600"}`}>Step 1: Quick Capture</span>
          <span className={`rounded-full px-2 py-1 font-medium ${step === 2 ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600"}`}>Step 2: Add Details</span>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Capture just lead name and phone first. You can add full details immediately in Step 2 or later from Lead Details.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Smart Capture (OCR / Paste Text)</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onExtractFromImage(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  {isCaptureProcessing ? "Extracting..." : "Upload Image"}
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Upload a business card/screenshot or paste text from WhatsApp/Email to auto-fill details.</p>
              <textarea
                rows={3}
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Paste text here, then click Extract from Text"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isCaptureProcessing || !captureText.trim()}
                  onClick={onExtractFromText}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCaptureProcessing ? "Extracting..." : "Extract from Text"}
                </button>
                <span className="text-xs text-slate-500">Review and complete missing fields in Step 2.</span>
              </div>
              {captureSummary.length > 0 && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                  <p className="font-semibold">Detected</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {captureSummary.map((item) => (
                      <li key={`${item.field}:${item.value}`} className="inline-flex items-center gap-1.5">
                        <span>- {item.field}: {item.value}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.confidence === "High" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.confidence}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {captureLines.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">OCR Raw Text Preview</p>
                    <span className="text-[11px] text-slate-500">Pick field for each line, then Apply</span>
                  </div>
                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                    {captureLines.map((line, index) => {
                      const key = `${index}:${line}`;
                      const target = lineTargets[key] ?? "";
                      return (
                        <div key={key} className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-1.5 md:grid-cols-[1fr_auto_auto]">
                          <p className="truncate text-xs text-slate-700" title={line}>{line}</p>
                          <select
                            value={target}
                            onChange={(event) => setLineTargets((prev) => ({ ...prev, [key]: event.target.value }))}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="">Select field</option>
                            <option value="leadName">Lead Name</option>
                            <option value="companyName">Company Name</option>
                            <option value="phoneNumber">Phone</option>
                            <option value="emailId">Email</option>
                            <option value="website">Website</option>
                            <option value="address">Address</option>
                            <option value="notes">Notes</option>
                          </select>
                          <button
                            type="button"
                            disabled={!target}
                            onClick={() => {
                              if (!target) return;
                              onApplyCaptureLine(line, target as "leadName" | "companyName" | "phoneNumber" | "emailId" | "website" | "address" | "notes");
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Lead Name
                <input ref={leadNameInputRef} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.leadName} onChange={(event) => setIntake((prev: any) => ({ ...prev, leadName: event.target.value }))} />
                {inlineErrors.leadName && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.leadName}</span>}
              </label>
              <label className="text-sm font-medium text-slate-700">Phone Number
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.phoneNumber} onChange={(event) => setIntake((prev: any) => ({ ...prev, phoneNumber: event.target.value }))} />
                {inlineErrors.phoneNumber && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.phoneNumber}</span>}
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" disabled={isSavingLead} onClick={onQuickSave} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70">{loadingNode}Save Quick Lead</button>
              <button type="button" onClick={() => onStepChange(2)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Continue to Details</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} onKeyDown={onFormKeyDown} className="space-y-4">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Required for capture</h4>
              <p className="text-xs text-slate-500">Keep intake fast. Press Enter to save and continue when keyboard mode is ON.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">Lead Name<input ref={leadNameInputRef} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.leadName} onChange={(event) => setIntake((prev: any) => ({ ...prev, leadName: event.target.value }))} />{inlineErrors.leadName && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.leadName}</span>}</label>
              <label className="text-sm font-medium text-slate-700">Company Name<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.companyName} onChange={(event) => setIntake((prev: any) => ({ ...prev, companyName: event.target.value }))} />{inlineErrors.companyName && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.companyName}</span>}</label>
              <label className="text-sm font-medium text-slate-700">Phone Number<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.phoneNumber} onChange={(event) => setIntake((prev: any) => ({ ...prev, phoneNumber: event.target.value }))} />{inlineErrors.phoneNumber && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.phoneNumber}</span>}</label>
              <label className="text-sm font-medium text-slate-700">Assigned To<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={isAssignedScope ? currentUserName : intake.assignedTo} onChange={(event) => setIntake((prev: any) => ({ ...prev, assignedTo: event.target.value }))} disabled={isAssignedScope}>{(isAssignedScope ? [currentUserName] : assigneeOptions).map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Lead Source<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.leadSource} onChange={(event) => setIntake((prev: any) => ({ ...prev, leadSource: event.target.value }))}>{leadSources.map((source) => <option key={source}>{source}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Service Interested<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.serviceInterested} onChange={(event) => setIntake((prev: any) => ({ ...prev, serviceInterested: event.target.value }))}>{services.map((service) => <option key={service}>{service}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Date Added<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={intake.dateAdded} onChange={(event) => setIntake((prev: any) => ({ ...prev, dateAdded: event.target.value }))} /></label>
              <label className="text-sm font-medium text-slate-700">Next Follow-up Date<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={intake.nextFollowupDate} onChange={(event) => setIntake((prev: any) => ({ ...prev, nextFollowupDate: event.target.value }))} />{inlineErrors.nextFollowupDate && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.nextFollowupDate}</span>}</label>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setShowOptional((prev) => !prev)} className="text-sm font-medium text-[#788023] hover:text-[#646b1d]">
                {showOptional ? "Hide optional context" : "Show optional context"}
              </button>
            </div>

            {showOptional && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">Email ID<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" value={intake.emailId} onChange={(event) => setIntake((prev: any) => ({ ...prev, emailId: event.target.value }))} />{inlineErrors.emailId && <span className="mt-1 block text-xs text-amber-700">{inlineErrors.emailId}</span>}</label>
                <label className="text-sm font-medium text-slate-700">Lead Temperature<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={intake.leadTemperature} onChange={(event) => setIntake((prev: any) => ({ ...prev, leadTemperature: event.target.value }))}>{leadTemps.map((temp) => <option key={temp}>{temp}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Deal Value (INR)<input min={0} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" value={intake.dealValue} onChange={(event) => setIntake((prev: any) => ({ ...prev, dealValue: Number(event.target.value) }))} />{inlineErrors.dealValue && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.dealValue}</span>}</label>
                <label className="text-sm font-medium text-slate-700">Last Contacted Date<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={intake.lastContactedDate} onChange={(event) => setIntake((prev: any) => ({ ...prev, lastContactedDate: event.target.value }))} />{inlineErrors.lastContactedDate && <span className="mt-1 block text-xs text-rose-700">{inlineErrors.lastContactedDate}</span>}</label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4">Notes<textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} value={intake.notes} onChange={(event) => setIntake((prev: any) => ({ ...prev, notes: event.target.value }))} /></label>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={keyboardEntryMode} onChange={(event) => setKeyboardEntryMode(event.target.checked)} />
                Keyboard-first entry (Enter to save & continue)
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => onStepChange(1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Back</button>
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isSavingLead} className="inline-flex items-center gap-2 rounded-lg bg-[#788023] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#646b1d] disabled:cursor-not-allowed disabled:opacity-70">{loadingNode}Add Lead</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}