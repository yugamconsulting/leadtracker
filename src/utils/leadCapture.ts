export type LeadCaptureExtract = {
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  website: string;
  address: string;
  rawText: string;
};

export type LeadCaptureEvaluation = {
  extracted: LeadCaptureExtract;
  score: number;
};

const COMPANY_HINTS = ["pvt", "private", "ltd", "llp", "inc", "solutions", "technologies", "company", "consulting", "studio", "agency"];
const ADDRESS_HINTS = ["road", "street", "st", "nagar", "avenue", "floor", "building", "city", "state", "india", "lane", "phase"];
const NON_NAME_HINTS = [
  "manager",
  "director",
  "founder",
  "ceo",
  "coo",
  "marketing",
  "sales",
  "mobile",
  "phone",
  "email",
  "www",
  "gst",
  "address",
  "web",
];

function cleanLine(line: string) {
  return line
    .replace(/[|•]/g, " ")
    .replace(/[“”"'`]/g, "")
    .replace(/\b(MOB|PH|TEL|PHONE|EMAIL|WEB|WEBSITE|ADDRESS)\s*[:\-]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? "";
}

function pickPhone(text: string) {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  const sanitized = matches
    .map((item) => item.replace(/[^\d+]/g, ""))
    .map((item) => item.replace(/^\+91/, ""))
    .map((item) => item.replace(/^0+/, ""))
    .filter((item) => item.length >= 8 && item.length <= 15)
    .filter((item) => !/^\d{15}$/.test(item));
  const indiaMobile = sanitized.find((item) => /^([6-9]\d{9})$/.test(item));
  if (indiaMobile) return indiaMobile;
  const indiaLandline = sanitized.find((item) => /^(0?[1-9]\d{9,10})$/.test(item));
  if (indiaLandline) return indiaLandline;
  return sanitized[0] ?? "";
}

function pickWebsite(text: string) {
  const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[\w./-]*)?/);
  if (!urlMatch) return "";
  return urlMatch[0].replace(/^https?:\/\//, "");
}

function pickCompany(lines: string[]) {
  const filtered = lines.filter((line) => !/@/.test(line) && !/\d{8,}/.test(line) && !/www\.|https?:\/\//i.test(line));
  const printingLike = filtered.find((line) => /printing|studio|agency|solutions|world|technologies|traders|exports/i.test(line));
  if (printingLike) return printingLike;
  const byHint = filtered.find((line) => {
    const lower = line.toLowerCase();
    return COMPANY_HINTS.some((hint) => lower.includes(hint));
  });
  if (byHint) return byHint;
  return filtered.find((line) => /^[A-Za-z][A-Za-z\s.&-]{3,}$/.test(line) && line.split(" ").length >= 2) ?? "";
}

function pickName(lines: string[], companyName: string) {
  const nonCompany = lines.filter((line) => line !== companyName);
  const candidate = nonCompany.find(
    (line) =>
      /^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(line)
      && line.split(" ").length <= 4
      && !NON_NAME_HINTS.some((hint) => line.toLowerCase().includes(hint)),
  );
  if (candidate) return candidate;
  return nonCompany.find(
    (line) =>
      /^[A-Za-z][A-Za-z.'-]{2,20}$/.test(line)
      && !NON_NAME_HINTS.some((hint) => line.toLowerCase().includes(hint)),
  ) ?? "";
}

function pickAddress(lines: string[]) {
  const foundIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return ADDRESS_HINTS.some((hint) => lower.includes(hint));
  });
  if (foundIndex === -1) return "";
  const next = lines[foundIndex + 1] ?? "";
  const current = lines[foundIndex];
  if (next && /\d{3,6}|nagar|street|road|city|state|india/i.test(next.toLowerCase())) {
    return `${current}, ${next}`;
  }
  return current;
}

export function parseLeadCaptureText(rawInput: string): LeadCaptureExtract {
  const rawText = rawInput.trim();
  const normalized = rawText
    .replace(/\bE\s*-?\s*MAIL\b/gi, "EMAIL")
    .replace(/\bM\s*-?\s*OB\b/gi, "MOB")
    .replace(/\s{2,}/g, " ");

  const lines = normalized
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 20);

  const labeledCompany = lines.find((line) => /company\s*[:\-]/i.test(line))?.split(/[:\-]/).slice(1).join(" ").trim() ?? "";
  const labeledName = lines.find((line) => /name\s*[:\-]/i.test(line))?.split(/[:\-]/).slice(1).join(" ").trim() ?? "";
  const labeledAddress = lines.find((line) => /address\s*[:\-]/i.test(line))?.split(/[:\-]/).slice(1).join(" ").trim() ?? "";

  const companyName = pickCompany(lines);
  const leadName = pickName(lines, companyName);
  const emailId = pickEmail(normalized);
  const phoneNumber = pickPhone(normalized);
  const website = pickWebsite(normalized);
  const address = pickAddress(lines);

  return {
    leadName: labeledName || leadName,
    companyName: labeledCompany || companyName,
    phoneNumber,
    emailId,
    website,
    address: labeledAddress || address,
    rawText,
  };
}

export function evaluateLeadCaptureText(rawInput: string): LeadCaptureEvaluation {
  const extracted = parseLeadCaptureText(rawInput);
  let score = 0;
  if (extracted.leadName) score += extracted.leadName.split(" ").length >= 2 ? 20 : 12;
  if (extracted.companyName) score += 20;
  if (extracted.phoneNumber) score += 25;
  if (extracted.emailId) score += 20;
  if (extracted.website) score += 10;
  if (extracted.address) score += 5;
  return { extracted, score };
}
