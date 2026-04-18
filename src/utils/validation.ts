export function normalizedPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function isValidPhone(value: string) {
  const digits = normalizedPhone(value);
  return digits.length >= 8 && digits.length <= 15;
}

export function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPincode(value: string) {
  return /^\d{6}$/.test(value.trim());
}

export function isValidIfsc(value: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(value.trim());
}

export function isValidGstin(value: string) {
  if (!value.trim()) return false;
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i.test(value.trim());
}

export function stateCodeFromGstin(gstin: string) {
  const clean = gstin.trim().toUpperCase();
  if (!isValidGstin(clean)) return "";
  return clean.slice(0, 2);
}