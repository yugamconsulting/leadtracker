// src/utils/format.ts

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatInrSigned(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign} ${formatInr(Math.abs(amount))}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateTimeDisplay(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("en-GB");
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}
