// src/constants/index.ts
import { LeadSource, LeadStatus, LeadTemperature } from "../types";

export const LEAD_SOURCES: LeadSource[] = [
  "Website",
  "WhatsApp",
  "LinkedIn",
  "Meta Ads",
  "Referral",
  "Cold Outreach",
  "Others",
];

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Confirmation",
  "Invoice Sent",
  "Won",
  "Lost",
];

export const LEAD_TEMPS: LeadTemperature[] = ["Hot", "Warm", "Cold"];

export const PAYMENT_STATUSES = [
  "Not Invoiced",
  "Invoiced",
  "Partially Collected",
  "Fully Collected",
] as const;

export const INVOICE_ELIGIBLE_STATUSES: LeadStatus[] = [
  "Confirmation",
  "Invoice Sent",
  "Won",
];

export const PIPELINE_VALUE_STATUSES: LeadStatus[] = [
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Confirmation",
  "Invoice Sent",
];

export const INVOICE_STATUSES = [
  "Draft",
  "Issued",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
] as const;

export const INVOICE_PAYMENT_MODES = [
  "Bank Transfer",
  "UPI",
  "Cash",
  "Card",
  "Cheque",
  "Other",
] as const;

export const INVOICE_RECURRENCES = [
  "none",
  "monthly",
  "quarterly",
  "annually",
] as const;
