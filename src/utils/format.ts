export function formatPercent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

export function formatDateDisplay(dateISO: string) {
  if (!dateISO) return "-";
  const date = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateISO;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTimeDisplay(valueISO: string) {
  if (!valueISO) return "-";
  const date = new Date(valueISO);
  if (Number.isNaN(date.getTime())) return valueISO;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMonthYear(dateValue: Date | string) {
  const date = typeof dateValue === "string" ? new Date(`${dateValue}-01T00:00:00`) : dateValue;
  if (Number.isNaN(date.getTime())) return typeof dateValue === "string" ? dateValue : "-";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatInr(value: number) {
  return `₹ ${Math.max(0, Number(value) || 0).toLocaleString("en-IN")}`;
}

export function formatInrSigned(value: number) {
  const normalized = Number(value) || 0;
  const sign = normalized < 0 ? "-" : "";
  return `${sign}₹ ${Math.abs(normalized).toLocaleString("en-IN")}`;
}