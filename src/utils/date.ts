// src/utils/date.ts
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftISODate(baseISO: string, dayDelta: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

export function addDaysFrom(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function monthKeyFromDate(dateValue: string): string {
  if (!dateValue || dateValue.length < 7) return "";
  return dateValue.slice(0, 7);
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function daysSince(dateISO: string): number {
  if (!dateISO) return 0;
  const ts = new Date(dateISO).getTime();
  if (isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

export function daysUntil(dateISO: string): number | null {
  if (!dateISO) return null;
  const end = new Date(dateISO).getTime();
  if (isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}
