import { useEffect, useMemo, useState } from "react";

export type ImportedLeadDraft = {
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  leadSource: string;
  serviceInterested: string;
  assignedTo: string;
  dateAdded: string;
  nextFollowupDate: string;
  leadTemperature: string;
  dealValue: string;
  notes: string;
};

type LeadImportCsvModalProps = {
  open: boolean;
  isImporting: boolean;
  onClose: () => void;
  onImport: (rows: ImportedLeadDraft[]) => void;
};

const TARGET_FIELDS = [
  { key: "leadName", label: "Lead Name" },
  { key: "companyName", label: "Company Name" },
  { key: "phoneNumber", label: "Phone" },
  { key: "emailId", label: "Email" },
  { key: "leadSource", label: "Lead Source" },
  { key: "serviceInterested", label: "Service" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "dateAdded", label: "Date Added" },
  { key: "nextFollowupDate", label: "Next Follow-up" },
  { key: "leadTemperature", label: "Temperature" },
  { key: "dealValue", label: "Deal Value" },
  { key: "notes", label: "Notes" },
] as const;

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessMapping(header: string): string {
  const normalized = normalizeHeader(header);
  const rules: Array<[RegExp, string]> = [
    [/^(leadname|name|contactname|personname)$/i, "leadName"],
    [/^(company|companyname|organization|org|business)$/i, "companyName"],
    [/^(phone|mobileno|mobile|contactno|phonenumber)$/i, "phoneNumber"],
    [/^(email|emailid|mail)$/i, "emailId"],
    [/^(source|leadsource)$/i, "leadSource"],
    [/^(service|serviceinterested|interest)$/i, "serviceInterested"],
    [/^(assignedto|owner|assignee)$/i, "assignedTo"],
    [/^(dateadded|createddate|addedon)$/i, "dateAdded"],
    [/^(nextfollowup|nextfollowupdate|followupdate)$/i, "nextFollowupDate"],
    [/^(temperature|leadtemperature|priority)$/i, "leadTemperature"],
    [/^(dealvalue|value|amount)$/i, "dealValue"],
    [/^(notes|remark|comments)$/i, "notes"],
  ];
  const found = rules.find(([regex]) => regex.test(normalized));
  return found ? found[1] : "";
}

export function LeadImportCsvModal({ open, isImporting, onClose, onImport }: LeadImportCsvModalProps) {
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const parsedRows = useMemo(() => parseCsvRows(csvText), [csvText]);
  const headers = parsedRows[0] ?? [];
  const dataRows = parsedRows.slice(1);

  useEffect(() => {
    if (headers.length === 0) {
      setMapping({});
      return;
    }
    setMapping((prev) => {
      const next: Record<string, string> = {};
      headers.forEach((header) => {
        next[header] = prev[header] ?? guessMapping(header);
      });
      return next;
    });
  }, [headers.join("|")]);

  if (!open) return null;

  const handleFileLoad = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setError("");
  };

  const handleImport = () => {
    if (headers.length === 0 || dataRows.length === 0) {
      setError("Upload or paste a CSV with header and data rows.");
      return;
    }
    const mappedRows: ImportedLeadDraft[] = dataRows
      .map((row) => {
        const draft: ImportedLeadDraft = {
          leadName: "",
          companyName: "",
          phoneNumber: "",
          emailId: "",
          leadSource: "",
          serviceInterested: "",
          assignedTo: "",
          dateAdded: "",
          nextFollowupDate: "",
          leadTemperature: "",
          dealValue: "",
          notes: "",
        };
        headers.forEach((header, index) => {
          const target = mapping[header];
          if (!target || !(target in draft)) return;
          (draft as Record<string, string>)[target] = row[index] ?? "";
        });
        return draft;
      })
      .filter((row) => row.leadName || row.companyName || row.phoneNumber || row.emailId);

    if (mappedRows.length === 0) {
      setError("No usable rows after mapping. Map at least Lead Name or Company and one contact field.");
      return;
    }
    onImport(mappedRows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Import leads from CSV">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Import Leads via CSV</h3>
            <p className="text-xs text-slate-500">Upload your CSV, map columns once, and import leads in bulk.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Close</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFileLoad(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
              Upload CSV
            </label>
            <textarea
              rows={12}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setError("");
              }}
              placeholder="Or paste CSV data here"
            />
            {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Column Mapping</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {headers.length === 0 && <p className="text-xs text-slate-500">Upload CSV to configure mapping.</p>}
                {headers.map((header) => (
                  <div key={header} className="grid grid-cols-[1fr_auto] gap-2">
                    <p className="truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700" title={header}>{header}</p>
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(event) => setMapping((prev) => ({ ...prev, [header]: event.target.value }))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">Ignore</option>
                      {TARGET_FIELDS.map((target) => (
                        <option key={target.key} value={target.key}>{target.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <p className="mt-1 text-xs text-slate-500">{Math.max(dataRows.length, 0)} data rows detected.</p>
              <div className="mt-2 max-h-40 overflow-auto rounded border border-slate-200">
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      {headers.slice(0, 4).map((header) => <th key={header} className="px-2 py-1.5">{header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 4).map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-b border-slate-100">
                        {headers.slice(0, 4).map((header, cellIndex) => (
                          <td key={`${header}-${rowIndex}`} className="px-2 py-1.5 text-slate-700">{row[cellIndex] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            disabled={isImporting}
            onClick={handleImport}
            className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? "Importing..." : "Import Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}
