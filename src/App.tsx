import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import toast, { Toaster } from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { SectionErrorBoundary } from "./components/SectionErrorBoundary";
import type { ImportedLeadDraft } from "./components/leads/LeadImportCsvModal";
import { FollowupsPage } from "./pages/FollowupsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { RevenuePage } from "./pages/RevenuePage";
import { UsersPage } from "./pages/UsersPage";
import { patchLeadById, prependLead } from "./services/leadsService";
import { loadJson, loadText, saveJson, saveText } from "./services/storage";
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatInr,
  formatInrSigned,
  formatMonthYear,
  formatPercent,
} from "./utils/format";
import {
  isValidEmail,
  isValidGstin,
  isValidIfsc,
  isValidPincode,
  isValidPhone,
  normalizedPhone,
  stateCodeFromGstin,
} from "./utils/validation";
import { evaluateLeadCaptureText, parseLeadCaptureText } from "./utils/leadCapture";

const FollowupToolbar = lazy(() => import("./components/followups/FollowupToolbar").then((m) => ({ default: m.FollowupToolbar })));
const FollowupTable = lazy(() => import("./components/followups/FollowupTable").then((m) => ({ default: m.FollowupTable })));
const InvoicesWorkspaceHeader = lazy(() => import("./components/invoices/InvoicesWorkspaceHeader").then((m) => ({ default: m.InvoicesWorkspaceHeader })));
const InvoicesKpiStrip = lazy(() => import("./components/invoices/InvoicesKpiStrip").then((m) => ({ default: m.InvoicesKpiStrip })));
const InvoicesScopePanel = lazy(() => import("./components/invoices/InvoicesScopePanel").then((m) => ({ default: m.InvoicesScopePanel })));
const LeadsFilters = lazy(() => import("./components/leads/LeadsFilters").then((m) => ({ default: m.LeadsFilters })));
const LeadImportCsvModal = lazy(() => import("./components/leads/LeadImportCsvModal").then((m) => ({ default: m.LeadImportCsvModal })));
const LeadIntakeModal = lazy(() => import("./components/leads/LeadIntakeModal").then((m) => ({ default: m.LeadIntakeModal })));
const LeadsTable = lazy(() => import("./components/leads/LeadsTable").then((m) => ({ default: m.LeadsTable })));
const LeadsWorkspaceHeader = lazy(() => import("./components/leads/LeadsWorkspaceHeader").then((m) => ({ default: m.LeadsWorkspaceHeader })));
const PipelineBoard = lazy(() => import("./components/pipeline/PipelineBoard").then((m) => ({ default: m.PipelineBoard })));
const PipelineToolbar = lazy(() => import("./components/pipeline/PipelineToolbar").then((m) => ({ default: m.PipelineToolbar })));
const RevenueWorkspaceHeader = lazy(() => import("./components/revenue/RevenueWorkspaceHeader").then((m) => ({ default: m.RevenueWorkspaceHeader })));
const RevenueKpiStrip = lazy(() => import("./components/revenue/RevenueKpiStrip").then((m) => ({ default: m.RevenueKpiStrip })));
const RevenueScopePanel = lazy(() => import("./components/revenue/RevenueScopePanel").then((m) => ({ default: m.RevenueScopePanel })));
const UsersWorkspaceHeader = lazy(() => import("./components/users/UsersWorkspaceHeader").then((m) => ({ default: m.UsersWorkspaceHeader })));

type LegalType = "privacy" | "terms";
type AuthView = "login" | "trial" | "register" | "forgot";
type PublicView = "landing" | "features" | "pricing" | "comparison" | "contact" | "product-lite" | "product-pro" | "product-full" | "auth";
type MarketingTheme = "elegant" | "futuristic";
type AppView = "mywork" | "dashboard" | "leads" | "pipeline" | "followups" | "revenue" | "invoices" | "sources" | "users";
type UsersTab = "licensees" | "tenant-users" | "platform-controls";
type UserRole = "owner" | "admin" | "sales";
type ProductMode = "lite" | "pro" | "full";
type BillingCycle = "monthly" | "quarterly" | "annual";
type SubscriptionStatus = "active" | "renewal_due" | "grace" | "suspended" | "cancelled";
type BillingRecordStatus = "pending" | "paid" | "failed" | "cancelled";
type BillingRecordType = "renewal" | "upgrade" | "downgrade";
type AccessScope = "all" | "assigned" | "none";
type StaffProfile = "sales" | "followup" | "collections" | "operations";
type MonthRangePreset = "1" | "3" | "6" | "12" | "custom";
type ForecastMode = "unweighted" | "weighted";
type DashboardDateScope = "today" | "yesterday" | "last7" | "last30" | "mtd" | "qtd" | "lastMonth" | "all" | "custom";
type PlanPresetKey = "starter" | "growth" | "scale" | "enterprise";
type CreateLicenseePlanChoice = "custom" | string;
type LicenseTermPreset = "annual" | "trial15";
type PipelineSort = "priority" | "value" | "expected" | "followup" | "age";
type PipelineWipScope = "today" | "custom" | "all";
type FollowupQueue = "all" | "overdue" | "today" | "upcoming" | "no-date";
type FollowupBulkAction = "" | "mark-done" | "move-today" | "snooze-2" | "snooze-7" | "reassign" | "set-date";
type LeadBulkAction = "" | "mark-done" | "snooze-2" | "move-contacted" | "reassign";
type ModuleMode = "basic" | "advanced";
type RevenueTab = "overview" | "forecast" | "collections" | "reconciliation" | "exports";
type LeadOptionalColumn = "source" | "service" | "temperature" | "deal" | "expected" | "invoice" | "tag";
type InvoiceWorkspaceTab = "workspace" | "collections-inbox" | "client-master";
type CollectionsChannel = "email" | "whatsapp" | "both";
type WhatsAppProvider = "meta-cloud" | "twilio" | "gupshup" | "interakt" | "custom-webhook";
type CollectionsDispatchStatus = "queued" | "sent" | "delivered" | "read" | "failed";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
type CaptureSummaryItem = {
  field: string;
  value: string;
  confidence: "High" | "Review";
};

type MarketingProof = {
  revisions: string;
  hours: string;
  releaseCadence: string;
  updatedOn: string;
};

type MarketingRoadmap = {
  inProgress: string[];
  next: string[];
  planned: string[];
};

type MarketingChangelogItem = {
  title: string;
  detail: string;
};

type MarketingContent = {
  proof: MarketingProof;
  changelog: MarketingChangelogItem[];
  roadmap: MarketingRoadmap;
};

const pathToPublicView = (pathname: string): PublicView => {
  if (pathname.startsWith("/login")) return "auth";
  if (pathname.startsWith("/features")) return "features";
  if (pathname.startsWith("/pricing")) return "pricing";
  if (pathname.startsWith("/comparison")) return "comparison";
  if (pathname.startsWith("/contact")) return "contact";
  if (pathname.startsWith("/products/lite")) return "product-lite";
  if (pathname.startsWith("/products/pro")) return "product-pro";
  if (pathname.startsWith("/products/full")) return "product-full";
  return "landing";
};

const PUBLIC_VIEW_PATHS: Record<PublicView, string> = {
  landing: "/",
  features: "/features",
  pricing: "/pricing",
  comparison: "/comparison",
  contact: "/contact",
  "product-lite": "/products/lite",
  "product-pro": "/products/pro",
  "product-full": "/products/full",
  auth: "/login",
};

const getInitialPublicView = (): PublicView => {
  if (typeof window === "undefined") return "landing";
  return pathToPublicView(window.location.pathname);
};

type InvoiceProfile = {
  legalName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  stateCode: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  productMode: ProductMode;
  planTemplateId: string | null;
  isActive: boolean;
  licenseStartDate: string;
  licenseEndDate: string;
  autoRenew: boolean;
  isTrial?: boolean;
  trialDays?: number;
  graceDays: number;
  planName: string;
  maxUsers: number;
  maxLeadsPerMonth: number;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  invoiceProfile: InvoiceProfile;
  auditRetentionDays: number;
  createdAt: string;
};

type TenantSubscription = {
  id: string;
  tenantId: string;
  productMode: ProductMode;
  planName: string;
  planTemplateId: string | null;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  renewalDate: string;
  graceEndsAt: string;
  status: SubscriptionStatus;
  retryCount: number;
  nextRetryAt: string;
  scheduledDowngradePlanTemplateId: string | null;
  scheduledDowngradeAt: string;
  updatedAt: string;
  createdAt: string;
};

type LicenseBillingRecord = {
  id: string;
  tenantId: string;
  subscriptionId: string;
  type: BillingRecordType;
  status: BillingRecordStatus;
  planFrom: string;
  planTo: string;
  planTemplateFromId: string | null;
  planTemplateToId: string | null;
  amount: number;
  currency: "INR";
  gateway: "manual" | "razorpay" | "stripe" | "custom";
  attemptCount: number;
  dueDate: string;
  createdAt: string;
  paidAt: string;
  failedAt: string;
  failureReason: string;
  gatewayRef: string;
};

type UserAccount = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash?: string;
  password?: string;
  isBreakGlass?: boolean;
  role: UserRole;
  staffProfile?: StaffProfile;
  canAccessPipeline?: boolean;
  canAccessFollowups?: boolean;
  accessScope: AccessScope;
  isActive: boolean;
  licenseStartDate: string;
  licenseEndDate: string;
  autoRenew: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
};

const STAFF_PROFILE_LABELS: Record<StaffProfile, string> = {
  sales: "Sales",
  followup: "Follow-up",
  collections: "Accounts / Collections",
  operations: "Operations",
};

function defaultStaffProfileForRole(role: UserRole): StaffProfile {
  return role === "sales" ? "sales" : "operations";
}

function resolveStaffProfile(user: Pick<UserAccount, "role" | "staffProfile"> | null | undefined): StaffProfile {
  if (!user) return "sales";
  return user.staffProfile ?? defaultStaffProfileForRole(user.role);
}

function normalizeWorkflowAccess(role: UserRole, profile: StaffProfile, pipeline: boolean | undefined, followups: boolean | undefined) {
  if (role !== "sales") {
    return { canAccessPipeline: true, canAccessFollowups: true };
  }
  if (profile === "collections") {
    return { canAccessPipeline: false, canAccessFollowups: false };
  }
  if (profile === "followup") {
    return { canAccessPipeline: false, canAccessFollowups: true };
  }
  return {
    canAccessPipeline: pipeline ?? true,
    canAccessFollowups: followups ?? true,
  };
}

function applyMemberWorkflowOverrides(base: AppView[], user: Pick<UserAccount, "role" | "canAccessPipeline" | "canAccessFollowups">) {
  if (user.role !== "sales") return base;
  let scoped = [...base];
  if (!user.canAccessPipeline) {
    scoped = scoped.filter((viewKey) => viewKey !== "pipeline");
  }
  if (!user.canAccessFollowups) {
    scoped = scoped.filter((viewKey) => !["followups", "mywork"].includes(viewKey));
  }
  return scoped;
}

function applySalesStaffProfileViews(base: AppView[], profile: StaffProfile, mode: ProductMode): AppView[] {
  if (profile === "collections") {
    if (mode === "full") return base.filter((viewKey) => ["invoices"].includes(viewKey));
    return base.filter((viewKey) => ["followups"].includes(viewKey));
  }
  if (profile === "followup") return base.filter((viewKey) => ["mywork", "followups", "leads"].includes(viewKey));
  if (profile === "operations") return base.filter((viewKey) => ["mywork", "leads", "pipeline", "followups"].includes(viewKey));
  return base;
}

function staffProfileAccessHint(profile: StaffProfile, mode: ProductMode, invoicingEnabled: boolean) {
  if (profile === "sales") return "Full lead lifecycle access by default. You can make member-specific pipeline/follow-up restrictions below.";
  if (profile === "followup") return "Can view leads and execute follow-up queues. Lead creation and invoicing are restricted.";
  if (profile === "operations") return "Can work on leads, pipeline movement, and follow-ups. Revenue and invoicing are restricted.";
  if (!invoicingEnabled || mode !== "full") {
    return "Accounts / Collections profile requires Full Suite with invoicing enabled.";
  }
  return "Collections-only access: invoices, payment follow-ups, and dunning actions. No lead creation access.";
}

type StaffPermissionLevel = "yes" | "limited" | "no";

type StaffPermissionMatrix = {
  leads: StaffPermissionLevel;
  pipeline: StaffPermissionLevel;
  followups: StaffPermissionLevel;
  invoices: StaffPermissionLevel;
};

function getStaffPermissionMatrix(profile: StaffProfile, mode: ProductMode, invoicingEnabled: boolean): StaffPermissionMatrix {
  const invoiceEnabled = mode === "full" && invoicingEnabled;
  if (profile === "sales") {
    return {
      leads: "yes",
      pipeline: "limited",
      followups: "limited",
      invoices: invoiceEnabled ? "limited" : "no",
    };
  }
  if (profile === "followup") {
    return {
      leads: "limited",
      pipeline: "no",
      followups: "yes",
      invoices: "no",
    };
  }
  if (profile === "operations") {
    return {
      leads: "yes",
      pipeline: "yes",
      followups: "yes",
      invoices: "no",
    };
  }
  return {
    leads: "no",
    pipeline: "no",
    followups: "no",
    invoices: invoiceEnabled ? "yes" : "no",
  };
}

function StaffPermissionTooltip({ profile, mode, invoicingEnabled }: { profile: StaffProfile; mode: ProductMode; invoicingEnabled: boolean }) {
  const matrix = getStaffPermissionMatrix(profile, mode, invoicingEnabled);
  const valueClass = (value: StaffPermissionLevel) => {
    if (value === "yes") return "text-emerald-700";
    if (value === "limited") return "text-amber-700";
    return "text-slate-500";
  };

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`${STAFF_PROFILE_LABELS[profile]} permission matrix`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-600"
      >
        i
      </button>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-52 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-xl group-hover:block group-focus-within:block">
        <span className="mb-1 block font-semibold text-slate-800">{STAFF_PROFILE_LABELS[profile]} Profile</span>
        <span className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
          <span>Leads</span>
          <span className={valueClass(matrix.leads)}>{matrix.leads}</span>
          <span>Pipeline</span>
          <span className={valueClass(matrix.pipeline)}>{matrix.pipeline}</span>
          <span>Follow-ups</span>
          <span className={valueClass(matrix.followups)}>{matrix.followups}</span>
          <span>Invoices</span>
          <span className={valueClass(matrix.invoices)}>{matrix.invoices}</span>
        </span>
      </span>
    </span>
  );
}

type ArchivedUser = UserAccount & {
  archivedAt: string;
  archivedBy: string;
  archiveReason: "expired" | "inactive" | "removed";
};

type RegistrationRequest = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
};

type PasswordResetCode = {
  id: string;
  tenantId: string;
  email: string;
  code: string;
  expiresAt: string;
  usedAt?: string;
};

type BreakGlassSecret = {
  id: string;
  tenantId: string;
  email: string;
  password: string;
  generatedAt: string;
  acknowledged: boolean;
};

type Employee = {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
};

type LeadSource = "Website" | "WhatsApp" | "LinkedIn" | "Meta Ads" | "Referral" | "Cold Outreach" | "Others";
type ServiceType = "SEO" | "Performance Marketing" | "Social Media" | "Branding" | "Website Development" | "Others" | string;
type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal Sent" | "Negotiation" | "Confirmation" | "Invoice Sent" | "Won" | "Lost";
type LeadTemperature = "Hot" | "Warm" | "Cold";
type FollowupStatus = "Pending" | "Done";
type PaymentStatus = "Not Invoiced" | "Invoiced" | "Partially Collected" | "Fully Collected";
type InvoiceStatus = "Draft" | "Issued" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";
type GstMode = "Intra" | "Inter";
type InvoicePaymentMode = "Bank Transfer" | "UPI" | "Cash" | "Card" | "Cheque" | "Other";
type InvoiceApprovalStatus = "Not Required" | "Pending" | "Approved" | "Rejected";
type InvoiceRecurrence = "none" | "monthly" | "quarterly" | "annually";
type InvoiceAdjustmentType = "Credit" | "Debit";
type InvoiceFlowStatus = "Not Sent" | "Sent";

type InvoiceLineItem = {
  id: string;
  serviceName: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
};

type Lead = {
  id: string;
  tenantId: string;
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  leadSource: LeadSource;
  serviceInterested: ServiceType;
  leadStatus: LeadStatus;
  leadTemperature: LeadTemperature;
  dealValue: number;
  expectedClosingDate: string;
  assignedTo: string;
  dateAdded: string;
  nextFollowupDate: string;
  followupStatus: FollowupStatus;
  notes: string;
  lastContactedDate: string;
  wonDate: string;
  wonDealValue: number | null;
  paymentStatus: PaymentStatus;
  collectionsOwner: string;
  collectedDate: string;
  collectedAmount: number | null;
  invoiceFlowStatus: InvoiceFlowStatus;
  invoiceSentDate: string;
  isDuplicate: boolean;
  lossReason: string;
  deletedAt?: string;
  deletedBy?: string;
};

type LeadActivity = {
  id: string;
  tenantId: string;
  leadId: string;
  actor: string;
  action: string;
  changes: string[];
  createdAt: string;
};

type Invoice = {
  id: string;
  tenantId: string;
  leadId: string;
  customerProfileId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  billedToName: string;
  billedToCompany: string;
  billedToEmail: string;
  billedToPhone: string;
  billedToAddress: string;
  billedToCity: string;
  billedToState: string;
  billedToPincode: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  paymentTermsDays: number;
  poNumber: string;
  bankBeneficiaryName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  supplierName: string;
  supplierAddress: string;
  supplierCity: string;
  supplierState: string;
  supplierPincode: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierStateCode: string;
  supplierGstin: string;
  buyerGstin: string;
  placeOfSupplyStateCode: string;
  sacCode: string;
  reverseCharge: boolean;
  lineItems: InvoiceLineItem[];
  serviceName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstMode: GstMode;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  paidAt: string;
  status: InvoiceStatus;
  approvalStatus: InvoiceApprovalStatus;
  approvalRequestedBy: string;
  approvalRequestedAt: string;
  approvedBy: string;
  approvedAt: string;
  approvalRemarks: string;
  recurrence: InvoiceRecurrence;
  recurrenceCount: number;
  recurrenceParentId: string | null;
  recurrenceIndex: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type InvoiceDraft = {
  leadId: string;
  customerProfileId: string;
  issueDate: string;
  dueDate: string;
  billedToName: string;
  billedToCompany: string;
  billedToEmail: string;
  billedToPhone: string;
  billedToAddress: string;
  billedToCity: string;
  billedToState: string;
  billedToPincode: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  useBillingAsShipping: boolean;
  paymentTermsDays: number;
  poNumber: string;
  bankBeneficiaryName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  supplierName: string;
  supplierAddress: string;
  supplierCity: string;
  supplierState: string;
  supplierPincode: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierStateCode: string;
  supplierGstin: string;
  buyerGstin: string;
  placeOfSupplyStateCode: string;
  sacCode: string;
  reverseCharge: boolean;
  lineItems: InvoiceLineItem[];
  serviceName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstMode: GstMode;
  recurrence: InvoiceRecurrence;
  recurrenceCount: number;
  notes: string;
};

type InvoicePayment = {
  id: string;
  tenantId: string;
  invoiceId: string;
  leadId: string;
  amount: number;
  paidAt: string;
  mode: InvoicePaymentMode;
  reference: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

type InvoiceAdjustment = {
  id: string;
  tenantId: string;
  invoiceId: string;
  leadId: string;
  kind: InvoiceAdjustmentType;
  amount: number;
  noteDate: string;
  reason: string;
  createdBy: string;
  createdAt: string;
};

type InvoicePromise = {
  id: string;
  tenantId: string;
  invoiceId: string;
  leadId: string;
  promisedAmount: number;
  promisedDate: string;
  status: "Open" | "Honored" | "Missed" | "Cancelled";
  notes: string;
  createdBy: string;
  createdAt: string;
  fulfilledAt: string;
};

type CustomerProfile = {
  id: string;
  tenantId: string;
  profileName: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  buyerGstin: string;
  paymentTermsDays: number;
  poNumber: string;
  bankBeneficiaryName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type AppSettings = {
  autoMoveNewToContacted: boolean;
  promptExpectedClosingOnQualified: boolean;
  slaEscalationDays: number;
  reminderWebhookEnabled: boolean;
  dunningAutomationEnabled: boolean;
  collectionsChannel: CollectionsChannel;
  whatsappProvider: WhatsAppProvider;
  whatsappTemplateName: string;
  deliverySyncEnabled: boolean;
  delegatedApproverUserId: string;
  delegationEndsAt: string;
};

type UiPreferences = {
  appView: AppView;
  moduleModes: Record<AppView, ModuleMode>;
  focusMode: boolean;
  dailyMode: boolean;
  leadOptionalColumns: LeadOptionalColumn[];
  quickFilter: "all" | "today-followups" | "hot";
  filterStatus: LeadStatus | "All";
  filterSource: LeadSource | "All";
  filterAssignee: string;
  filterTemp: LeadTemperature | "All";
  dashboardDateScope: DashboardDateScope;
  dashboardCustomStart: string;
  dashboardCustomEnd: string;
  revenueRangePreset: MonthRangePreset;
  revenueCustomStart: string;
  revenueCustomEnd: string;
  sourcesRangePreset: MonthRangePreset;
  sourcesCustomStart: string;
  sourcesCustomEnd: string;
  pipelineAssigneeFilter: string;
  pipelineTempFilter: LeadTemperature | "All";
  pipelineSort: PipelineSort;
  pipelineShowClosed: boolean;
  followupQueue: FollowupQueue;
};

type UserOnboardingState = {
  loginCount: number;
  firstLoginAt: string;
  lastLoginAt: string;
  dismissedAt: string;
};

type DunningAutomationLog = {
  id: string;
  tenantId: string;
  invoiceId: string;
  stage: "D1" | "D7" | "D15";
  sentAt: string;
  action: string;
};

type LeadStatusTransition = {
  from: LeadStatus;
  to: LeadStatus;
  at: string;
};

type ReminderDispatchLog = {
  tenantId: string;
  status: "idle" | "success" | "failed";
  lastAttemptAt: string;
  lastSuccessAt: string;
  lastError: string;
  pendingCount: number;
  mode: "auto" | "manual";
};

type CollectionsDispatchLog = {
  id: string;
  tenantId: string;
  invoiceId: string;
  leadId: string;
  invoiceNumber: string;
  recipient: string;
  channel: CollectionsChannel;
  provider: WhatsAppProvider;
  status: CollectionsDispatchStatus;
  dispatchId: string;
  messageId: string;
  requestedAt: string;
  lastEventAt: string;
  deliveredAt: string;
  readAt: string;
  error: string;
  triggeredBy: string;
};

type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  monthlyPriceInr: number;
  offerLabel: string;
  maxUsers: number;
  maxLeadsPerMonth: number;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  auditRetentionDays: number;
  graceDays: number;
  isSystemPreset: boolean;
  isActive: boolean;
  updatedAt: string;
};

type TenantEntitlementDraft = {
  name: string;
  slug: string;
  productMode: ProductMode;
  planName: string;
  maxUsers: number;
  maxLeadsPerMonth: number;
  graceDays: number;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  invoiceProfile: InvoiceProfile;
  auditRetentionDays: number;
};

type TrialAccount = {
  id: string;
  tenantId: string;
  ownerName: string;
  ownerEmail: string;
  workspaceName: string;
  signupSource: "trial-form" | "google" | "owner-created";
  trialStartAt: string;
  trialEndAt: string;
  status: "active" | "expired" | "converted";
  convertedAt: string;
  lastLoginAt: string;
  createdAt: string;
};

type PipelineWipLimitMap = Partial<Record<LeadStatus, number>>;

const STORAGE_USERS = "sales-lead-tracker:v2:users";
const STORAGE_TENANTS = "sales-lead-tracker:v2:tenants";
const STORAGE_REQUESTS = "sales-lead-tracker:v2:registration-requests";
const STORAGE_CODES = "sales-lead-tracker:v2:reset-codes";
const STORAGE_SESSION = "sales-lead-tracker:v2:session";
const STORAGE_LEADS = "sales-lead-tracker:v2:leads";
const STORAGE_ACTIVITIES = "sales-lead-tracker:v2:lead-activities";
const STORAGE_EMPLOYEES = "sales-lead-tracker:v2:employees";
const STORAGE_SERVICES = "sales-lead-tracker:v2:services";
const STORAGE_SETTINGS = "sales-lead-tracker:v2:settings";
const STORAGE_BREAKGLASS = "sales-lead-tracker:v2:breakglass-secrets";
const STORAGE_OLD_USERS = "sales-lead-tracker:v2:old-users";
const STORAGE_PLAN_TEMPLATES = "sales-lead-tracker:v2:plan-templates";
const STORAGE_INVOICES = "sales-lead-tracker:v2:invoices";
const STORAGE_INVOICE_PAYMENTS = "sales-lead-tracker:v2:invoice-payments";
const STORAGE_INVOICE_ADJUSTMENTS = "sales-lead-tracker:v2:invoice-adjustments";
const STORAGE_INVOICE_PROMISES = "sales-lead-tracker:v2:invoice-promises";
const STORAGE_CUSTOMER_PROFILES = "sales-lead-tracker:v2:customer-profiles";
const STORAGE_REMINDER_DISPATCH = "sales-lead-tracker:v2:reminder-dispatch";
const STORAGE_COLLECTIONS_DISPATCH = "sales-lead-tracker:v2:collections-dispatch";
const STORAGE_DUNNING_AUTOMATION = "sales-lead-tracker:v2:dunning-automation";
const STORAGE_UI_PREFS = "sales-lead-tracker:v2:ui-preferences";
const STORAGE_TRIAL_ACCOUNTS = "sales-lead-tracker:v2:trial-accounts";
const STORAGE_USER_ONBOARDING = "sales-lead-tracker:v2:user-onboarding";
const STORAGE_SUBSCRIPTIONS = "sales-lead-tracker:v2:subscriptions";
const STORAGE_BILLING_RECORDS = "sales-lead-tracker:v2:billing-records";
const STORAGE_PWA_INSTALL_DISMISSED = "sales-lead-tracker:v2:pwa-install-dismissed";
const STORAGE_MARKETING_CONTENT = "sales-lead-tracker:v2:marketing-content";
const STORAGE_PIPELINE_WIP_LIMITS = "sales-lead-tracker:v2:pipeline-wip-limits";
const STORAGE_MARKETING_THEME = "sales-lead-tracker:v2:marketing-theme";

const LEAD_SOURCES: LeadSource[] = ["Website", "WhatsApp", "LinkedIn", "Meta Ads", "Referral", "Cold Outreach", "Others"];
const LEAD_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won", "Lost"];
const LEAD_TEMPS: LeadTemperature[] = ["Hot", "Warm", "Cold"];
const INVOICE_ELIGIBLE_STATUSES: LeadStatus[] = ["Confirmation", "Invoice Sent", "Won"];
const PIPELINE_VALUE_STATUSES: LeadStatus[] = ["Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent"];
const FORECAST_STAGE_WEIGHTS: Record<LeadStatus, number> = {
  New: 0.15,
  Contacted: 0.35,
  Qualified: 0.55,
  "Proposal Sent": 0.75,
  Negotiation: 0.9,
  Confirmation: 0.95,
  "Invoice Sent": 0.98,
  Won: 1,
  Lost: 0,
};
const PIPELINE_BOARD_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won", "Lost"];
const PIPELINE_WIP_LIMITS: Partial<Record<LeadStatus, number>> = {
  Contacted: 25,
  Qualified: 18,
  "Proposal Sent": 12,
  Negotiation: 10,
  Confirmation: 8,
  "Invoice Sent": 8,
};
const PIPELINE_WIP_CONFIGURABLE_STATUSES = Object.keys(PIPELINE_WIP_LIMITS) as LeadStatus[];
const PAYMENT_STATUSES: PaymentStatus[] = ["Not Invoiced", "Invoiced", "Partially Collected", "Fully Collected"];
const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Issued", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const INVOICE_PAYMENT_MODES: InvoicePaymentMode[] = ["Bank Transfer", "UPI", "Cash", "Card", "Cheque", "Other"];
const INVOICE_RECURRENCES: InvoiceRecurrence[] = ["none", "monthly", "quarterly", "annually"];
const DEFAULT_SERVICES: ServiceType[] = [
  "SEO",
  "Performance Marketing",
  "Social Media",
  "Branding",
  "Website Development",
  "Others",
];

const DEFAULT_TENANT_ID = "tenant-yugam";
const DEFAULT_GRACE_DAYS = 7;
const DEFAULT_TRIAL_DAYS = 15;
const LEAD_RECYCLE_RETENTION_DAYS = 30;
const GUIDED_SESSIONS_LIMIT = 3;
const DEFAULT_BILLING_CYCLE: BillingCycle = "annual";
const RETRY_DAY_GAPS = [2, 5, 8] as const;
const DEFAULT_OWNER_EMAIL = "admin@oruyugam.com";
const DEFAULT_OWNER_PASSWORD = "Admin@123";
const CUSTOM_PLAN_ID = "custom";
const SYSTEM_PLAN_TEMPLATE_PREFIX = "tpl-system-";
const DEFAULT_APP_SETTINGS: AppSettings = {
  autoMoveNewToContacted: false,
  promptExpectedClosingOnQualified: true,
  slaEscalationDays: 7,
  reminderWebhookEnabled: false,
  dunningAutomationEnabled: true,
  collectionsChannel: "whatsapp",
  whatsappProvider: "custom-webhook",
  whatsappTemplateName: "invoice_payment_reminder",
  deliverySyncEnabled: true,
  delegatedApproverUserId: "",
  delegationEndsAt: "",
};

const DEFAULT_MARKETING_CONTENT: MarketingContent = {
  proof: {
    revisions: "240+",
    hours: "1,200+",
    releaseCadence: "Weekly product updates",
    updatedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  },
  changelog: [
    {
      title: "Follow-up Lite Launch",
      detail: "Introduced a standalone daily follow-up mode for teams that need speed without full CRM complexity.",
    },
    {
      title: "Lead Capture Intelligence",
      detail: "Added OCR and text parsing with confidence tags and manual field mapping for faster business card onboarding.",
    },
    {
      title: "Integrated Invoice + Collections",
      detail: "Connected lead conversion, invoicing, payment ledger, and dunning actions into one workflow.",
    },
    {
      title: "Role and Package Controls",
      detail: "Enabled Lite / Pro / Full product gating with member-specific access to follow-up, pipeline, and billing.",
    },
  ],
  roadmap: {
    inProgress: [
      "Production-grade billing backend with payment webhook verification and retry automation",
      "Field-sales mobile experience with offline-safe follow-up execution",
      "Collections Inbox v2 with owner-level recovery and escalation playbooks",
    ],
    next: [
      "Client portal for invoice visibility, payment tracking, and document downloads",
      "Role-based command palette and faster keyboard-first workflows",
      "Advanced reporting drill-down with team and source performance views",
    ],
    planned: [
      "SSO, enterprise-grade security controls, and policy enforcement",
      "AI-assisted lead enrichment and auto-prioritization suggestions",
      "Workflow marketplace for reusable sales and collections automation templates",
    ],
  },
};

function normalizeMarketingContent(content?: Partial<MarketingContent> | null): MarketingContent {
  const proof = content?.proof;
  const roadmap = content?.roadmap;
  const sanitizeList = (value: unknown, fallback: string[]) => {
    if (!Array.isArray(value)) return fallback;
    const cleaned = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  };
  const changelog = Array.isArray(content?.changelog)
    ? content.changelog
        .map((item) => ({
          title: typeof item?.title === "string" ? item.title.trim() : "",
          detail: typeof item?.detail === "string" ? item.detail.trim() : "",
        }))
        .filter((item) => item.title && item.detail)
    : [];
  return {
    proof: {
      revisions: typeof proof?.revisions === "string" && proof.revisions.trim() ? proof.revisions.trim() : DEFAULT_MARKETING_CONTENT.proof.revisions,
      hours: typeof proof?.hours === "string" && proof.hours.trim() ? proof.hours.trim() : DEFAULT_MARKETING_CONTENT.proof.hours,
      releaseCadence:
        typeof proof?.releaseCadence === "string" && proof.releaseCadence.trim()
          ? proof.releaseCadence.trim()
          : DEFAULT_MARKETING_CONTENT.proof.releaseCadence,
      updatedOn: typeof proof?.updatedOn === "string" && proof.updatedOn.trim() ? proof.updatedOn.trim() : DEFAULT_MARKETING_CONTENT.proof.updatedOn,
    },
    changelog: changelog.length > 0 ? changelog : DEFAULT_MARKETING_CONTENT.changelog,
    roadmap: {
      inProgress: sanitizeList(roadmap?.inProgress, DEFAULT_MARKETING_CONTENT.roadmap.inProgress),
      next: sanitizeList(roadmap?.next, DEFAULT_MARKETING_CONTENT.roadmap.next),
      planned: sanitizeList(roadmap?.planned, DEFAULT_MARKETING_CONTENT.roadmap.planned),
    },
  };
}

const WHATSAPP_PROVIDER_OPTIONS: WhatsAppProvider[] = ["meta-cloud", "twilio", "gupshup", "interakt", "custom-webhook"];
const PLAN_PRICING_MONTHLY_INR: Record<PlanPresetKey, number> = {
  starter: 2499,
  growth: 5999,
  scale: 14999,
  enterprise: 29999,
};

function normalizeCollectionsDispatchStatus(status: string | undefined): CollectionsDispatchStatus {
  if (status === "queued" || status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return "queued";
}

function normalizeAppSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const channel = settings?.collectionsChannel;
  const provider = settings?.whatsappProvider;
  return {
    autoMoveNewToContacted: settings?.autoMoveNewToContacted ?? DEFAULT_APP_SETTINGS.autoMoveNewToContacted,
    promptExpectedClosingOnQualified: settings?.promptExpectedClosingOnQualified ?? DEFAULT_APP_SETTINGS.promptExpectedClosingOnQualified,
    slaEscalationDays: Math.max(1, Number(settings?.slaEscalationDays ?? DEFAULT_APP_SETTINGS.slaEscalationDays) || DEFAULT_APP_SETTINGS.slaEscalationDays),
    reminderWebhookEnabled: settings?.reminderWebhookEnabled ?? DEFAULT_APP_SETTINGS.reminderWebhookEnabled,
    dunningAutomationEnabled: settings?.dunningAutomationEnabled ?? DEFAULT_APP_SETTINGS.dunningAutomationEnabled,
    collectionsChannel: channel === "email" || channel === "whatsapp" || channel === "both" ? channel : DEFAULT_APP_SETTINGS.collectionsChannel,
    whatsappProvider: provider && WHATSAPP_PROVIDER_OPTIONS.includes(provider) ? provider : DEFAULT_APP_SETTINGS.whatsappProvider,
    whatsappTemplateName: (settings?.whatsappTemplateName ?? DEFAULT_APP_SETTINGS.whatsappTemplateName).trim() || DEFAULT_APP_SETTINGS.whatsappTemplateName,
    deliverySyncEnabled: settings?.deliverySyncEnabled ?? DEFAULT_APP_SETTINGS.deliverySyncEnabled,
    delegatedApproverUserId: settings?.delegatedApproverUserId ?? "",
    delegationEndsAt: settings?.delegationEndsAt ?? "",
  };
}

const DEFAULT_INVOICE_PROFILE: InvoiceProfile = {
  legalName: "Yugam Consulting",
  addressLine: "",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "",
  phone: "+91 90925 07004",
  email: "info@oruyugam.com",
  gstin: "",
  stateCode: "33",
};

const PLAN_PRESETS: Record<PlanPresetKey, Omit<TenantEntitlementDraft, "name" | "slug">> = {
  starter: {
    productMode: "pro",
    planName: "Starter",
    maxUsers: 5,
    maxLeadsPerMonth: 250,
    graceDays: 5,
    featureExports: false,
    featureAdvancedForecast: false,
    featureInvoicing: false,
    requireGstCompliance: false,
    invoiceProfile: DEFAULT_INVOICE_PROFILE,
    auditRetentionDays: 90,
  },
  growth: {
    productMode: "full",
    planName: "Growth",
    maxUsers: 15,
    maxLeadsPerMonth: 1000,
    graceDays: 7,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    invoiceProfile: DEFAULT_INVOICE_PROFILE,
    auditRetentionDays: 365,
  },
  scale: {
    productMode: "full",
    planName: "Scale",
    maxUsers: 35,
    maxLeadsPerMonth: 3000,
    graceDays: 10,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    invoiceProfile: DEFAULT_INVOICE_PROFILE,
    auditRetentionDays: 540,
  },
  enterprise: {
    productMode: "full",
    planName: "Enterprise",
    maxUsers: 100,
    maxLeadsPerMonth: 10000,
    graceDays: 15,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    invoiceProfile: DEFAULT_INVOICE_PROFILE,
    auditRetentionDays: 730,
  },
};

const PRODUCT_MODE_LABELS: Record<ProductMode, string> = {
  lite: "Follow-up Lite",
  pro: "Lead Tracker Pro",
  full: "Full Suite",
};

function inferProductModeFromTenantFlags(featureInvoicing: boolean, featureAdvancedForecast: boolean, featureExports: boolean): ProductMode {
  if (featureInvoicing) return "full";
  if (!featureAdvancedForecast && !featureExports) return "lite";
  return "pro";
}

const DEFAULT_TENANT_ENTITLEMENTS = PLAN_PRESETS.growth;

const PLAN_PRESET_OPTIONS: Array<{ key: PlanPresetKey; label: string }> = [
  { key: "starter", label: "Apply Starter" },
  { key: "growth", label: "Apply Growth" },
  { key: "scale", label: "Apply Scale" },
  { key: "enterprise", label: "Apply Enterprise" },
];

const DASHBOARD_SCOPE_OPTIONS: Array<{ value: DashboardDateScope; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "mtd", label: "Month to Date" },
  { value: "qtd", label: "Quarter to Date" },
  { value: "lastMonth", label: "Last Month" },
  { value: "all", label: "All-time" },
  { value: "custom", label: "Custom Range" },
];

const APP_VIEW_LABELS: Record<AppView, string> = {
  mywork: "My Work",
  dashboard: "Dashboard",
  leads: "Leads",
  pipeline: "Pipeline",
  followups: "Follow-ups",
  revenue: "Revenue",
  invoices: "Invoices",
  sources: "Sources",
  users: "Users",
};

function ViewIcon({ view, className = "h-4 w-4" }: { view: AppView; className?: string }) {
  const common = { className, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (view) {
    case "mywork":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="14" height="14" rx="3" />
          <path d="M6.5 10h7" />
          <path d="M6.5 7h4" />
          <path d="M6.5 13h5" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="6" rx="1.5" />
          <rect x="11" y="3" width="6" height="10" rx="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" />
          <rect x="11" y="15" width="6" height="2" rx="1" />
        </svg>
      );
    case "leads":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <path d="M3.5 15c1.2-2.1 3-3.2 4.5-3.2S11.3 12.9 12.5 15" />
          <path d="M13 9.5h4" />
          <path d="M15 7.5v4" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...common}>
          <path d="M3 6h5v8H3z" />
          <path d="M9 9h5v5H9z" />
          <path d="M15 4h2v10h-2z" />
        </svg>
      );
    case "followups":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l2.5 2" />
        </svg>
      );
    case "revenue":
      return (
        <svg {...common}>
          <path d="M4 14V9" />
          <path d="M8 14V6" />
          <path d="M12 14v-3" />
          <path d="M16 14V4" />
          <path d="M3 16h14" />
        </svg>
      );
    case "invoices":
      return (
        <svg {...common}>
          <path d="M5 3h8l2 2v12H5z" />
          <path d="M13 3v3h3" />
          <path d="M7.5 10h5" />
          <path d="M7.5 13h5" />
        </svg>
      );
    case "sources":
      return (
        <svg {...common}>
          <path d="M10 2.5v15" />
          <path d="M2.5 10h15" />
          <circle cx="10" cy="10" r="6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M4.5 14c.8-1.4 2-2.2 3.5-2.2s2.7.8 3.5 2.2" />
          <circle cx="14.5" cy="7" r="1.8" />
          <path d="M12.7 12.7c.5-.9 1.1-1.3 1.8-1.3.8 0 1.4.4 1.9 1.3" />
        </svg>
      );
    default:
      return null;
  }
}

function getRoleViewsForMode(role: UserRole, mode: ProductMode): AppView[] {
  if (mode === "lite") {
    if (role === "sales") return ["mywork", "leads", "followups"];
    return ["mywork", "leads", "followups", "users"];
  }
  if (mode === "pro") {
    if (role === "sales") return ["mywork", "leads", "pipeline", "followups"];
    return ["mywork", "dashboard", "leads", "pipeline", "followups", "revenue", "sources", "users"];
  }
  if (role === "sales") return ["mywork", "leads", "pipeline", "followups"];
  return ["mywork", "dashboard", "leads", "pipeline", "followups", "revenue", "invoices", "sources", "users"];
}

function getRoleDefaultViewForMode(role: UserRole, mode: ProductMode): AppView {
  if (mode === "lite") return "mywork";
  if (role === "sales") return "followups";
  if (role === "admin") return "leads";
  return "dashboard";
}

const BASIC_MODULE_MODES: Record<AppView, ModuleMode> = {
  mywork: "basic",
  dashboard: "basic",
  leads: "basic",
  pipeline: "basic",
  followups: "basic",
  revenue: "basic",
  invoices: "basic",
  sources: "basic",
  users: "basic",
};

const LEAD_OPTIONAL_COLUMNS: Array<{ key: LeadOptionalColumn; label: string }> = [
  { key: "source", label: "Source" },
  { key: "service", label: "Service" },
  { key: "temperature", label: "Temperature" },
  { key: "deal", label: "Deal Value" },
  { key: "expected", label: "Expected Close" },
  { key: "invoice", label: "Invoice Flow" },
  { key: "tag", label: "Follow-up Tag" },
];

const SYSTEM_PLAN_TEMPLATE_IDS: Record<PlanPresetKey, string> = {
  starter: `${SYSTEM_PLAN_TEMPLATE_PREFIX}starter`,
  growth: `${SYSTEM_PLAN_TEMPLATE_PREFIX}growth`,
  scale: `${SYSTEM_PLAN_TEMPLATE_PREFIX}scale`,
  enterprise: `${SYSTEM_PLAN_TEMPLATE_PREFIX}enterprise`,
};

const DEFAULT_PLAN_TEMPLATE_ID = SYSTEM_PLAN_TEMPLATE_IDS.growth;

const SYSTEM_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.starter,
    name: "Starter",
    description: "Small teams getting started with lead management.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.starter,
    offerLabel: "Best for solo founders",
    ...PLAN_PRESETS.starter,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.growth,
    name: "Growth",
    description: "Balanced package for growing sales teams.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.growth,
    offerLabel: "Most popular for agencies",
    ...PLAN_PRESETS.growth,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.scale,
    name: "Scale",
    description: "High throughput plan for larger teams.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.scale,
    offerLabel: "Built for multi-team ops",
    ...PLAN_PRESETS.scale,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.enterprise,
    name: "Enterprise",
    description: "Custom-grade limits with long retention windows.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.enterprise,
    offerLabel: "Custom onboarding and governance",
    ...PLAN_PRESETS.enterprise,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
];

const makeId = () => Math.random().toString(36).slice(2, 10);

function generateRecoveryPassword(length = 24) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += charset[Math.floor(Math.random() * charset.length)];
  }
  return output;
}

function oneYearFrom(dateISO: string) {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

function addDaysFrom(dateISO: string, days: number) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

type GoogleJwtPayload = {
  email?: string;
  name?: string;
};

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function loadServicesByTenant() {
  const loaded = loadJson<Record<string, ServiceType[]> | ServiceType[]>(STORAGE_SERVICES, {
    [DEFAULT_TENANT_ID]: DEFAULT_SERVICES,
  });
  if (Array.isArray(loaded)) {
    return { [DEFAULT_TENANT_ID]: loaded.length > 0 ? loaded : DEFAULT_SERVICES };
  }
  return { ...loaded, [DEFAULT_TENANT_ID]: loaded[DEFAULT_TENANT_ID] ?? DEFAULT_SERVICES };
}

function loadSettingsByTenant(): Record<string, AppSettings> {
  const loaded = loadJson<Record<string, AppSettings> | AppSettings>(
    STORAGE_SETTINGS,
    { [DEFAULT_TENANT_ID]: DEFAULT_APP_SETTINGS },
  );
  if (typeof loaded === "object" && loaded !== null && "autoMoveNewToContacted" in loaded) {
    const legacySettings = loaded as Partial<AppSettings>;
    return {
      [DEFAULT_TENANT_ID]: normalizeAppSettings(legacySettings),
    };
  }
  const scoped = loaded as Record<string, AppSettings>;
  return {
    ...Object.fromEntries(
      Object.entries(scoped).map(([tenantId, settings]) => [tenantId, normalizeAppSettings(settings)]),
    ),
    [DEFAULT_TENANT_ID]: normalizeAppSettings(scoped[DEFAULT_TENANT_ID] ?? DEFAULT_APP_SETTINGS),
  };
}

function normalizePipelineWipLimits(limitMap?: PipelineWipLimitMap | null): PipelineWipLimitMap {
  const normalized: PipelineWipLimitMap = {};
  PIPELINE_WIP_CONFIGURABLE_STATUSES.forEach((status) => {
    const fallback = PIPELINE_WIP_LIMITS[status] ?? 0;
    const raw = limitMap?.[status];
    const parsed = Number(raw);
    normalized[status] = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  });
  return normalized;
}

function loadPipelineWipLimitsByTenant(): Record<string, PipelineWipLimitMap> {
  const loaded = loadJson<Record<string, PipelineWipLimitMap>>(STORAGE_PIPELINE_WIP_LIMITS, {});
  const normalized: Record<string, PipelineWipLimitMap> = Object.fromEntries(
    Object.entries(loaded).map(([tenantId, limits]) => [tenantId, normalizePipelineWipLimits(limits)]),
  );
  return {
    ...normalized,
    [DEFAULT_TENANT_ID]: normalizePipelineWipLimits(normalized[DEFAULT_TENANT_ID]),
  };
}

function stageCadenceDays(status: LeadStatus) {
  if (status === "New" || status === "Contacted") return 1;
  if (status === "Qualified") return 2;
  if (status === "Proposal Sent" || status === "Negotiation" || status === "Confirmation" || status === "Invoice Sent") return 1;
  return 0;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyFromDate(dateValue: string) {
  if (!dateValue || dateValue.length < 7) return "";
  return dateValue.slice(0, 7);
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function quarterStartISODate() {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

function shiftISODate(baseISO: string, dayDelta: number) {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

function shiftISOMonths(baseISO: string, monthDelta: number) {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setMonth(d.getMonth() + monthDelta);
  return d.toISOString().slice(0, 10);
}

function recurrenceMonthStep(recurrence: InvoiceRecurrence) {
  if (recurrence === "monthly") return 1;
  if (recurrence === "quarterly") return 3;
  if (recurrence === "annually") return 12;
  return 0;
}

function resolveDashboardDateRange(scope: DashboardDateScope, customStart: string, customEnd: string) {
  const today = todayISODate();
  if (scope === "all") {
    return { start: null as string | null, end: null as string | null, label: "All-time" };
  }
  if (scope === "today") {
    return { start: today, end: today, label: "Today" };
  }
  if (scope === "yesterday") {
    const yesterday = shiftISODate(today, -1);
    return { start: yesterday, end: yesterday, label: "Yesterday" };
  }
  if (scope === "last7") {
    return { start: shiftISODate(today, -6), end: today, label: "Last 7 days" };
  }
  if (scope === "last30") {
    return { start: shiftISODate(today, -29), end: today, label: "Last 30 days" };
  }
  if (scope === "mtd") {
    return { start: `${currentMonthKey()}-01`, end: today, label: "Month to date" };
  }
  if (scope === "qtd") {
    return { start: quarterStartISODate(), end: today, label: "Quarter to date" };
  }
  if (scope === "lastMonth") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
      label: "Last month",
    };
  }
  if (scope === "custom") {
    if (!customStart || !customEnd) {
      return { start: null as string | null, end: null as string | null, label: "Custom range (set start and end dates)" };
    }
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { start, end, label: `Custom: ${start} to ${end}` };
  }
  return { start: null as string | null, end: null as string | null, label: "All-time" };
}

function extractStatusFromChange(change: string) {
  const match = change.match(/^Lead Status:\s.+->\s(.+)$/);
  return match ? match[1].trim() : "";
}

function parseLeadStatusTransition(change: string) {
  const match = change.match(/^Lead Status:\s(.+)\s->\s(.+)$/);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}

function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function resolveRangeBounds(preset: MonthRangePreset, customStart: string, customEnd: string) {
  if (preset === "custom") {
    if (!customStart || !customEnd) return null;
    return customStart <= customEnd ? { start: customStart, end: customEnd } : { start: customEnd, end: customStart };
  }
  const end = currentMonthKey();
  const span = Number(preset);
  const start = shiftMonthKey(end, -(span - 1));
  return { start, end };
}

function filterRowsByMonthRange<T extends { monthKey: string }>(
  rows: T[],
  preset: MonthRangePreset,
  customStart: string,
  customEnd: string,
) {
  const bounds = resolveRangeBounds(preset, customStart, customEnd);
  if (!bounds) return rows;
  return rows.filter((row) => row.monthKey >= bounds.start && row.monthKey <= bounds.end);
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, payload: unknown) {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
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

function getTrend(current: number, previous: number) {
  const delta = current - previous;
  if (previous === 0) {
    if (current === 0) return { arrow: "->", className: "text-slate-500", value: "0.0%" };
    return { arrow: "↑", className: "text-emerald-600", value: "100.0%" };
  }
  const pct = (delta / previous) * 100;
  if (Math.abs(pct) < 0.05) return { arrow: "->", className: "text-slate-500", value: "0.0%" };
  return pct > 0
    ? { arrow: "↑", className: "text-emerald-600", value: `${Math.abs(pct).toFixed(1)}%` }
    : { arrow: "↓", className: "text-rose-600", value: `${Math.abs(pct).toFixed(1)}%` };
}

function dateTag(lead: Lead): "Overdue" | "Due Today" | "Upcoming" | "Done" {
  if (lead.followupStatus === "Done") return "Done";
  if (!lead.nextFollowupDate) return "Upcoming";
  const today = todayISODate();
  if (lead.nextFollowupDate < today) return "Overdue";
  if (lead.nextFollowupDate === today) return "Due Today";
  return "Upcoming";
}

function followupTagClass(tag: ReturnType<typeof dateTag>) {
  if (tag === "Overdue") return "bg-rose-100 text-rose-700";
  if (tag === "Due Today") return "bg-amber-100 text-amber-700";
  if (tag === "Done") return "bg-emerald-100 text-emerald-700";
  return "bg-sky-100 text-sky-700";
}

function safeDealValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function daysSince(dateISO: string) {
  if (!dateISO) return 0;
  const ts = new Date(dateISO).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

function daysUntil(dateISO: string) {
  if (!dateISO) return null;
  const end = new Date(dateISO).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

function sourcePriorityWeight(source: LeadSource) {
  const weights: Record<LeadSource, number> = {
    Referral: 20,
    LinkedIn: 14,
    Website: 12,
    "Meta Ads": 10,
    WhatsApp: 8,
    "Cold Outreach": 6,
    Others: 5,
  };
  return weights[source] ?? 5;
}

function contactabilityBadge(lead: Lead) {
  const phoneOk = isValidPhone(lead.phoneNumber);
  const emailOk = isValidEmail(lead.emailId) && !!lead.emailId.trim();
  if (phoneOk && emailOk) return { label: "Strong", className: "bg-emerald-100 text-emerald-700" };
  if (phoneOk || emailOk) return { label: "Partial", className: "bg-amber-100 text-amber-700" };
  return { label: "Weak", className: "bg-rose-100 text-rose-700" };
}

function leadHealthScore(lead: Lead) {
  if (!isOpenLeadStatus(lead.leadStatus)) return 100;
  const tag = dateTag(lead);
  const neglectPenalty = Math.min(35, neglectDays(lead) * 3);
  const followupPenalty =
    lead.followupStatus === "Done"
      ? 0
      : tag === "Overdue"
        ? 28
        : tag === "Due Today"
          ? 14
          : lead.nextFollowupDate
            ? 6
            : 18;
  const contactBoost = contactabilityBadge(lead).label === "Strong"
    ? 10
    : contactabilityBadge(lead).label === "Partial"
      ? 4
      : -8;
  const stageBoost = lead.leadTemperature === "Hot" ? 8 : lead.leadTemperature === "Warm" ? 5 : 2;
  return Math.max(1, Math.min(100, 72 + stageBoost + contactBoost - followupPenalty - neglectPenalty));
}

function isOpenLeadStatus(status: LeadStatus) {
  return status !== "Won" && status !== "Lost";
}

function neglectDays(lead: Lead) {
  return daysSince(lead.lastContactedDate || lead.dateAdded);
}

type LeadSlaTier = "ok" | "watch" | "escalate" | "critical";

function leadSlaTier(lead: Lead): LeadSlaTier {
  if (!isOpenLeadStatus(lead.leadStatus)) return "ok";
  const days = neglectDays(lead);
  if (days >= 21) return "critical";
  if (days >= 14) return "escalate";
  if (days >= 7) return "watch";
  return "ok";
}

function pipelinePriorityScore(lead: Lead) {
  const followupBoost =
    lead.followupStatus === "Pending"
      ? lead.nextFollowupDate && lead.nextFollowupDate < todayISODate()
        ? 24
        : lead.nextFollowupDate === todayISODate()
          ? 16
          : 8
      : 2;
  const tempBoost = lead.leadTemperature === "Hot" ? 30 : lead.leadTemperature === "Warm" ? 18 : 8;
  const sourceBoost = sourcePriorityWeight(lead.leadSource);
  const valueBoost = Math.min(22, Math.floor(safeDealValue(lead.dealValue) / 50000));
  const inactivityPenalty = Math.min(18, neglectDays(lead));
  return Math.max(1, Math.min(100, tempBoost + sourceBoost + followupBoost + valueBoost - inactivityPenalty));
}

function urgencyLabel(lead: Lead) {
  const tag = dateTag(lead);
  return `Urgency: ${tag}`;
}

function neglectRisk(lead: Lead): "Low" | "Medium" | "High" {
  const days = neglectDays(lead);
  if (days >= 10) return "High";
  if (days >= 5) return "Medium";
  return "Low";
}

function neglectRiskClass(risk: ReturnType<typeof neglectRisk>) {
  if (risk === "High") return "bg-rose-100 text-rose-700";
  if (risk === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function followupQueueKey(lead: Lead): FollowupQueue {
  if (!lead.nextFollowupDate) return "no-date";
  const today = todayISODate();
  if (lead.nextFollowupDate < today) return "overdue";
  if (lead.nextFollowupDate === today) return "today";
  return "upcoming";
}

function followupDaysDelta(lead: Lead) {
  if (!lead.nextFollowupDate) return null;
  const dueMs = new Date(`${lead.nextFollowupDate}T00:00:00`).getTime();
  if (Number.isNaN(dueMs)) return null;
  const todayMs = new Date(`${todayISODate()}T00:00:00`).getTime();
  return Math.floor((dueMs - todayMs) / (24 * 60 * 60 * 1000));
}

function wonRevenueValue(lead: Lead) {
  if (lead.wonDealValue !== null && Number.isFinite(lead.wonDealValue)) {
    return lead.wonDealValue;
  }
  return safeDealValue(lead.dealValue);
}

function outstandingAmount(lead: Lead) {
  if (lead.leadStatus !== "Won") return 0;
  return Math.max(0, wonRevenueValue(lead) - Math.max(0, lead.collectedAmount ?? 0));
}

function inferPaymentStatus(lead: Lead): PaymentStatus {
  if (lead.leadStatus !== "Won") return "Not Invoiced";
  const wonValue = wonRevenueValue(lead);
  const collected = Math.max(0, lead.collectedAmount ?? 0);
  if (wonValue > 0 && collected >= wonValue) return "Fully Collected";
  if (collected > 0) return "Partially Collected";
  return "Not Invoiced";
}

function sanitizeInvoiceLineItem(item: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: item.id ?? makeId(),
    serviceName: (item.serviceName ?? "").trim(),
    description: item.description ?? "",
    sacCode: (item.sacCode ?? "").replace(/\D/g, "").slice(0, 8),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    gstRate: Math.max(0, Number(item.gstRate) || 0),
  };
}

function invoiceAmountsFromItems(items: InvoiceLineItem[], gstMode: GstMode) {
  const normalizedItems = items.map((item) => sanitizeInvoiceLineItem(item));
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = normalizedItems.reduce((sum, item) => sum + ((item.quantity * item.unitPrice * item.gstRate) / 100), 0);
  const cgstAmount = gstMode === "Intra" ? taxTotal / 2 : 0;
  const sgstAmount = gstMode === "Intra" ? taxTotal / 2 : 0;
  const igstAmount = gstMode === "Inter" ? taxTotal : 0;
  return {
    items: normalizedItems,
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: subtotal + cgstAmount + sgstAmount + igstAmount,
  };
}

function invoiceAmountsFromDraft(draft: InvoiceDraft) {
  const derivedItems = draft.lineItems && draft.lineItems.length > 0
    ? draft.lineItems
    : [{
      id: makeId(),
      serviceName: draft.serviceName,
      description: draft.description,
      sacCode: draft.sacCode,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      gstRate: draft.gstRate,
    }];
  const amounts = invoiceAmountsFromItems(derivedItems, draft.gstMode);
  const primary = amounts.items[0] ?? sanitizeInvoiceLineItem({});
  return {
    lineItems: amounts.items,
    quantity: primary.quantity,
    unitPrice: primary.unitPrice,
    gstRate: primary.gstRate,
    subtotal: amounts.subtotal,
    cgstAmount: amounts.cgstAmount,
    sgstAmount: amounts.sgstAmount,
    igstAmount: amounts.igstAmount,
    totalAmount: amounts.totalAmount,
  };
}

function normalizeInvoiceStatus(invoice: Invoice, effectiveTotal = invoice.totalAmount): InvoiceStatus {
  if (invoice.status === "Cancelled") return "Cancelled";
  if (invoice.amountPaid >= effectiveTotal && effectiveTotal > 0) return "Paid";
  if (invoice.amountPaid > 0) {
    if (invoice.dueDate && invoice.dueDate < todayISODate()) return "Overdue";
    return "Partially Paid";
  }
  if (invoice.status === "Draft") return "Draft";
  if (invoice.dueDate && invoice.dueDate < todayISODate()) return "Overdue";
  return "Issued";
}

function isInvoiceSentStatus(status: InvoiceStatus) {
  return status === "Issued" || status === "Partially Paid" || status === "Paid" || status === "Overdue";
}

function invoiceTaxTotal(invoice: Invoice) {
  return invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
}

function invoiceLabelForDoc(invoice: Pick<Invoice, "supplierGstin" | "cgstAmount" | "sgstAmount" | "igstAmount">) {
  const hasGstSignal = Boolean(invoice.supplierGstin?.trim()) || invoice.cgstAmount > 0 || invoice.sgstAmount > 0 || invoice.igstAmount > 0;
  return hasGstSignal ? "GST Invoice" : "Invoice";
}

function invoiceAdjustmentSummary(adjustments: InvoiceAdjustment[]) {
  return adjustments.reduce(
    (acc, adjustment) => {
      if (adjustment.kind === "Credit") acc.credit += adjustment.amount;
      if (adjustment.kind === "Debit") acc.debit += adjustment.amount;
      return acc;
    },
    { credit: 0, debit: 0 },
  );
}

function invoiceEffectiveTotal(invoice: Invoice, adjustments: InvoiceAdjustment[]) {
  const summary = invoiceAdjustmentSummary(adjustments);
  return Math.max(0, invoice.totalAmount + summary.debit - summary.credit);
}

function invoiceOverdueDays(invoice: Invoice, effectiveTotal: number) {
  const status = normalizeInvoiceStatus(invoice, effectiveTotal);
  if (status !== "Overdue") return 0;
  if (!invoice.dueDate) return 0;
  return Math.max(0, daysSince(invoice.dueDate));
}

function dunningStageFromDays(overdueDays: number): "On Track" | "D1-D3" | "D4-D7" | "D8-D15" | "D15+" {
  if (overdueDays <= 0) return "On Track";
  if (overdueDays <= 3) return "D1-D3";
  if (overdueDays <= 7) return "D4-D7";
  if (overdueDays <= 15) return "D8-D15";
  return "D15+";
}

function dunningPlaybookForStage(stage: "On Track" | "D1-D3" | "D4-D7" | "D8-D15" | "D15+") {
  if (stage === "D1-D3") return "Gentle reminder with invoice and due-date context";
  if (stage === "D4-D7") return "Follow-up on payment promise and confirm collection timeline";
  if (stage === "D8-D15") return "Escalate tone, request committed date, tag collections owner";
  if (stage === "D15+") return "Manager escalation with final collection commitment";
  return "Invoice is on track";
}

function nextInvoiceNumber(existingInvoices: Invoice[], tenantSlug: string) {
  const year = new Date().getFullYear();
  const prefix = `${tenantSlug.toUpperCase()}-${year}-`;
  const maxSeq = existingInvoices
    .filter((invoice) => invoice.invoiceNumber.startsWith(prefix))
    .map((invoice) => Number(invoice.invoiceNumber.slice(prefix.length)))
    .filter((seq) => Number.isFinite(seq))
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

function tenantLifecycle(tenant: Tenant) {
  const nowMs = Date.now();
  const endMs = new Date(tenant.licenseEndDate).getTime();
  const daysToExpiry = Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000));
  const daysPastDue = Math.max(0, Math.ceil((nowMs - endMs) / (24 * 60 * 60 * 1000)));
  const inGrace = daysToExpiry < 0 && daysPastDue <= tenant.graceDays;
  let status: "Active" | "Grace" | "Expired" | "Suspended" = "Active";
  if (!tenant.isActive) {
    status = "Suspended";
  } else if (inGrace) {
    status = "Grace";
  } else if (daysToExpiry < 0) {
    status = "Expired";
  }
  return {
    status,
    daysToExpiry,
    daysPastDue,
    inGrace,
    isBlocked: status === "Suspended" || status === "Expired",
  };
}

function cycleMonths(cycle: BillingCycle) {
  if (cycle === "monthly") return 1;
  if (cycle === "quarterly") return 3;
  return 12;
}

function addMonthsIso(baseIso: string, months: number) {
  const dt = new Date(baseIso);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString();
}

function planKeyFromName(planName: string): PlanPresetKey {
  const value = planName.trim().toLowerCase();
  if (value.includes("starter") || value.includes("lite")) return "starter";
  if (value.includes("scale")) return "scale";
  if (value.includes("enterprise")) return "enterprise";
  return "growth";
}

function planAmountForCycle(planName: string, cycle: BillingCycle) {
  const monthly = PLAN_PRICING_MONTHLY_INR[planKeyFromName(planName)] ?? PLAN_PRICING_MONTHLY_INR.growth;
  return monthly * cycleMonths(cycle);
}

function buildSubscriptionFromTenant(tenant: Tenant): TenantSubscription {
  const renewalDate = tenant.licenseEndDate || oneYearFrom(new Date().toISOString());
  const graceEndsAt = addDaysFrom(renewalDate, Math.max(0, tenant.graceDays || DEFAULT_GRACE_DAYS));
  return {
    id: `sub-${tenant.id}`,
    tenantId: tenant.id,
    productMode: tenant.productMode,
    planName: tenant.planName,
    planTemplateId: tenant.planTemplateId ?? null,
    billingCycle: DEFAULT_BILLING_CYCLE,
    autoRenew: tenant.autoRenew,
    renewalDate,
    graceEndsAt,
    status: tenant.isActive ? "active" : "suspended",
    retryCount: 0,
    nextRetryAt: "",
    scheduledDowngradePlanTemplateId: null,
    scheduledDowngradeAt: "",
    createdAt: tenant.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function computeUpgradeProration(fromPlan: string, toPlan: string, cycle: BillingCycle, renewalDate: string) {
  const currentAmount = planAmountForCycle(fromPlan, cycle);
  const targetAmount = planAmountForCycle(toPlan, cycle);
  const delta = targetAmount - currentAmount;
  if (delta <= 0) return 0;
  const remainingDays = Math.max(0, Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const cycleDays = cycleMonths(cycle) * 30;
  const fraction = Math.min(1, remainingDays / cycleDays);
  return Math.round(delta * fraction);
}

function toTenantDraft(tenant: Tenant): TenantEntitlementDraft {
  return {
    name: tenant.name,
    slug: tenant.slug,
    productMode: tenant.productMode,
    planName: tenant.planName,
    maxUsers: tenant.maxUsers,
    maxLeadsPerMonth: tenant.maxLeadsPerMonth,
    graceDays: tenant.graceDays,
    featureExports: tenant.featureExports,
    featureAdvancedForecast: tenant.featureAdvancedForecast,
    featureInvoicing: tenant.featureInvoicing,
    requireGstCompliance: tenant.requireGstCompliance,
    invoiceProfile: tenant.invoiceProfile,
    auditRetentionDays: tenant.auditRetentionDays,
  };
}

function inferSystemTemplateId(planName: string) {
  const normalized = planName.trim().toLowerCase();
  const found = SYSTEM_PLAN_TEMPLATES.find((template) => template.name.toLowerCase() === normalized);
  return found?.id ?? null;
}

function templateToTenantPatch(template: PlanTemplate): Partial<TenantEntitlementDraft> {
  return {
    planName: template.name,
    maxUsers: template.maxUsers,
    maxLeadsPerMonth: template.maxLeadsPerMonth,
    graceDays: template.graceDays,
    featureExports: template.featureExports,
    featureAdvancedForecast: template.featureAdvancedForecast,
    featureInvoicing: template.featureInvoicing,
    requireGstCompliance: template.requireGstCompliance,
    auditRetentionDays: template.auditRetentionDays,
  };
}

function normalizePlanTemplates(loaded: PlanTemplate[]) {
  const userTemplates = loaded
    .filter((template) => !template.isSystemPreset)
    .map((template) => ({
      ...template,
      description: template.description ?? "",
      monthlyPriceInr: Math.max(0, Number(template.monthlyPriceInr) || 0),
      offerLabel: (template.offerLabel ?? "").trim(),
      maxUsers: Math.max(1, template.maxUsers ?? 1),
      maxLeadsPerMonth: Math.max(1, template.maxLeadsPerMonth ?? 1),
      graceDays: Math.max(0, template.graceDays ?? DEFAULT_GRACE_DAYS),
      featureExports: template.featureExports ?? true,
      featureAdvancedForecast: template.featureAdvancedForecast ?? true,
      featureInvoicing: template.featureInvoicing ?? true,
      requireGstCompliance: template.requireGstCompliance ?? true,
      auditRetentionDays: Math.max(30, template.auditRetentionDays ?? 365),
      isActive: template.isActive ?? true,
      updatedAt: template.updatedAt ?? new Date().toISOString(),
    }));
  const mergedSystem = SYSTEM_PLAN_TEMPLATES.map((systemTemplate) => {
    const existing = loaded.find((template) => template.id === systemTemplate.id);
    return existing
      ? {
          ...existing,
          ...systemTemplate,
          isSystemPreset: true,
          isActive: true,
          updatedAt: existing.updatedAt ?? systemTemplate.updatedAt,
        }
      : systemTemplate;
  });
  return [...mergedSystem, ...userTemplates];
}

function BrandLogo({ className = "h-11" }: { className?: string }) {
  // Try common logo locations so branding still works if deployment paths differ.
  const logoCandidates = [
    "/images/yugam-logo.png",
    "/yugam-logo.png",
    "/images/yugam-logo.svg",
    "/yugam-logo.svg",
    "/images/logo.png",
    "/logo.png",
    "/images/logo.svg",
    "/logo.svg",
    "/images/yugam.png",
    "/yugam.png",
  ];
  const [logoIndex, setLogoIndex] = useState(0);
  if (logoIndex >= logoCandidates.length) {
    return (
      <div className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500" aria-label="Brand logo unavailable">
        Upload logo
      </div>
    );
  }
  return (
    <div className="inline-flex items-center rounded-md bg-white/95 p-1">
      <img
        src={logoCandidates[logoIndex]}
        alt="Yugam"
        className={className}
        onError={() => setLogoIndex((current) => current + 1)}
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  className,
  containerClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  className?: string;
  containerClassName?: string;
}) {
  const [visible, setVisible] = useState(false);
  const inputClass =
    className ??
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-16 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40";
  return (
    <div className={containerClassName ?? "relative mt-1.5"}>
      <input
        className={inputClass}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1.5 my-auto h-8 rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function LoadingSpinner({ className = "h-4 w-4 border-2 border-white/80 border-t-transparent" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full ${className}`} aria-hidden="true" />;
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-[#788023]/15 text-2xl leading-[3rem] text-[#788023]" aria-hidden="true">
        o
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-md bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function LegalModal({ type, onClose }: { type: LegalType; onClose: () => void }) {
  const title = type === "privacy" ? "Privacy Policy" : "Terms and Conditions";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button type="button" aria-label="Close legal modal" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          This section is ready for your final legal copy. Share your approved Privacy Policy and Terms content and it can be inserted as-is.
        </p>
      </div>
    </div>
  );
}

function Footer({ onOpenLegal }: { onOpenLegal: (type: LegalType) => void }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-auto" />
          <p className="text-sm text-slate-600">Copyright 2026 Yugam Consulting. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onOpenLegal("privacy")} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Privacy Policy
          </button>
          <button type="button" onClick={() => onOpenLegal("terms")} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Terms and Conditions
          </button>
          <a href="mailto:info@oruyugam.com" className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const now = new Date().toISOString();
  const defaultTenant: Tenant = {
    id: DEFAULT_TENANT_ID,
    name: "Yugam Consulting",
    slug: "yugam",
    productMode: "full",
    planTemplateId: DEFAULT_PLAN_TEMPLATE_ID,
    isActive: true,
    licenseStartDate: now,
    licenseEndDate: oneYearFrom(now),
    autoRenew: true,
    isTrial: false,
    trialDays: 0,
    graceDays: DEFAULT_GRACE_DAYS,
    planName: DEFAULT_TENANT_ENTITLEMENTS.planName,
    maxUsers: DEFAULT_TENANT_ENTITLEMENTS.maxUsers,
    maxLeadsPerMonth: DEFAULT_TENANT_ENTITLEMENTS.maxLeadsPerMonth,
    featureExports: DEFAULT_TENANT_ENTITLEMENTS.featureExports,
    featureAdvancedForecast: DEFAULT_TENANT_ENTITLEMENTS.featureAdvancedForecast,
    featureInvoicing: DEFAULT_TENANT_ENTITLEMENTS.featureInvoicing,
    requireGstCompliance: DEFAULT_TENANT_ENTITLEMENTS.requireGstCompliance,
    invoiceProfile: DEFAULT_INVOICE_PROFILE,
    auditRetentionDays: DEFAULT_TENANT_ENTITLEMENTS.auditRetentionDays,
    createdAt: now,
  };
  const adminDefault: UserAccount = {
    id: "admin-1",
    tenantId: DEFAULT_TENANT_ID,
    name: "Admin",
    email: DEFAULT_OWNER_EMAIL,
    password: DEFAULT_OWNER_PASSWORD,
    role: "owner",
    staffProfile: "operations",
    canAccessPipeline: true,
    canAccessFollowups: true,
    accessScope: "all",
    isActive: true,
    licenseStartDate: now,
    licenseEndDate: oneYearFrom(now),
    autoRenew: true,
    mustChangePassword: false,
    createdAt: now,
  };

  const [legalOpen, setLegalOpen] = useState<LegalType | null>(null);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>(() => {
    const loaded = loadJson<PlanTemplate[]>(STORAGE_PLAN_TEMPLATES, []);
    return normalizePlanTemplates(loaded);
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const loaded = loadJson<Tenant[]>(STORAGE_TENANTS, [defaultTenant]);
    if (loaded.length === 0) return [defaultTenant];
    return loaded.map((tenant) => ({
      ...tenant,
      productMode: tenant.productMode ?? inferProductModeFromTenantFlags(tenant.featureInvoicing ?? DEFAULT_TENANT_ENTITLEMENTS.featureInvoicing, tenant.featureAdvancedForecast ?? DEFAULT_TENANT_ENTITLEMENTS.featureAdvancedForecast, tenant.featureExports ?? DEFAULT_TENANT_ENTITLEMENTS.featureExports),
      planTemplateId: tenant.planTemplateId ?? inferSystemTemplateId(tenant.planName ?? "") ?? null,
      isActive: tenant.isActive ?? true,
      licenseStartDate: tenant.licenseStartDate ?? tenant.createdAt ?? now,
      licenseEndDate: tenant.licenseEndDate ?? oneYearFrom(tenant.createdAt ?? now),
      autoRenew: tenant.autoRenew ?? true,
      isTrial: tenant.isTrial ?? false,
      trialDays: tenant.trialDays ?? 0,
      graceDays: tenant.graceDays ?? DEFAULT_GRACE_DAYS,
      planName: tenant.planName ?? DEFAULT_TENANT_ENTITLEMENTS.planName,
      maxUsers: tenant.maxUsers ?? DEFAULT_TENANT_ENTITLEMENTS.maxUsers,
      maxLeadsPerMonth: tenant.maxLeadsPerMonth ?? DEFAULT_TENANT_ENTITLEMENTS.maxLeadsPerMonth,
      featureExports: tenant.featureExports ?? DEFAULT_TENANT_ENTITLEMENTS.featureExports,
      featureAdvancedForecast: tenant.featureAdvancedForecast ?? DEFAULT_TENANT_ENTITLEMENTS.featureAdvancedForecast,
      featureInvoicing: tenant.featureInvoicing ?? DEFAULT_TENANT_ENTITLEMENTS.featureInvoicing,
      requireGstCompliance: tenant.requireGstCompliance ?? DEFAULT_TENANT_ENTITLEMENTS.requireGstCompliance,
      invoiceProfile: {
        legalName: tenant.invoiceProfile?.legalName ?? tenant.name,
        addressLine: tenant.invoiceProfile?.addressLine ?? "",
        city: tenant.invoiceProfile?.city ?? "",
        state: tenant.invoiceProfile?.state ?? "",
        pincode: tenant.invoiceProfile?.pincode ?? "",
        phone: tenant.invoiceProfile?.phone ?? "",
        email: tenant.invoiceProfile?.email ?? "",
        gstin: tenant.invoiceProfile?.gstin ?? "",
        stateCode: tenant.invoiceProfile?.stateCode ?? "",
      },
      auditRetentionDays: tenant.auditRetentionDays ?? DEFAULT_TENANT_ENTITLEMENTS.auditRetentionDays,
    }));
  });
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const loaded = loadJson<UserAccount[]>(STORAGE_USERS, [adminDefault]);
    return loaded.map((u) => {
      const resolvedProfile = (u.staffProfile ?? defaultStaffProfileForRole(u.role)) as StaffProfile;
      const workflowAccess = normalizeWorkflowAccess(u.role, resolvedProfile, u.canAccessPipeline, u.canAccessFollowups);
      return {
        ...u,
        tenantId: u.tenantId ?? DEFAULT_TENANT_ID,
        isBreakGlass: u.isBreakGlass ?? false,
        staffProfile: resolvedProfile,
        canAccessPipeline: workflowAccess.canAccessPipeline,
        canAccessFollowups: workflowAccess.canAccessFollowups,
        accessScope: (u.accessScope ?? (u.role === "admin" || u.role === "owner" ? "all" : "assigned")) as AccessScope,
        licenseStartDate: u.licenseStartDate ?? u.createdAt ?? now,
        licenseEndDate: u.licenseEndDate ?? oneYearFrom(u.createdAt ?? now),
        autoRenew: u.autoRenew ?? true,
        mustChangePassword: u.mustChangePassword ?? false,
      };
    });
  });
  const [breakGlassSecrets, setBreakGlassSecrets] = useState<BreakGlassSecret[]>(() => loadJson<BreakGlassSecret[]>(STORAGE_BREAKGLASS, []));
  const [revealedBreakGlassTenantId, setRevealedBreakGlassTenantId] = useState<string | null>(null);
  const [breakGlassRevealAckByTenant, setBreakGlassRevealAckByTenant] = useState<Record<string, boolean>>({});
  const [oldUsers, setOldUsers] = useState<ArchivedUser[]>(() => {
    const loaded = loadJson<ArchivedUser[]>(STORAGE_OLD_USERS, []);
    return loaded.map((user) => ({ ...user, tenantId: user.tenantId ?? DEFAULT_TENANT_ID }));
  });
  const [requests, setRequests] = useState<RegistrationRequest[]>(() => {
    const loaded = loadJson<RegistrationRequest[]>(STORAGE_REQUESTS, []);
    return loaded.map((request) => ({ ...request, tenantId: request.tenantId ?? DEFAULT_TENANT_ID }));
  });
  const [resetCodes, setResetCodes] = useState<PasswordResetCode[]>(() => {
    const loaded = loadJson<PasswordResetCode[]>(STORAGE_CODES, []);
    return loaded.map((code) => ({ ...code, tenantId: code.tenantId ?? DEFAULT_TENANT_ID }));
  });
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => loadJson(STORAGE_SESSION, null));
  const [leads, setLeads] = useState<Lead[]>(() => {
    const loaded = loadJson<Lead[]>(STORAGE_LEADS, []);
    return loaded.map((lead) => ({
      ...lead,
      tenantId: lead.tenantId ?? DEFAULT_TENANT_ID,
      wonDate: lead.wonDate ?? (lead.leadStatus === "Won" ? lead.lastContactedDate || lead.expectedClosingDate || lead.dateAdded || "" : ""),
      wonDealValue:
        typeof lead.wonDealValue === "number"
          ? lead.wonDealValue
          : lead.leadStatus === "Won"
            ? safeDealValue(lead.dealValue)
            : null,
      paymentStatus: (lead.paymentStatus as PaymentStatus | undefined) ?? inferPaymentStatus(lead),
      collectionsOwner: lead.collectionsOwner ?? lead.assignedTo ?? "",
      collectedDate: lead.collectedDate ?? "",
      collectedAmount: typeof lead.collectedAmount === "number" ? Math.max(0, lead.collectedAmount) : null,
      invoiceFlowStatus: (lead.invoiceFlowStatus as InvoiceFlowStatus | undefined) ?? "Not Sent",
      invoiceSentDate: lead.invoiceSentDate ?? "",
      isDuplicate: lead.isDuplicate ?? false,
      lossReason: lead.lossReason ?? "",
      deletedAt: lead.deletedAt ?? "",
      deletedBy: lead.deletedBy ?? "",
    }));
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const loaded = loadJson<Invoice[]>(STORAGE_INVOICES, []);
    return loaded.map((invoice) => {
      const subtotal = Number.isFinite(invoice.subtotal) ? Math.max(0, invoice.subtotal) : 0;
      const totalAmount = Number.isFinite(invoice.totalAmount) ? Math.max(0, invoice.totalAmount) : subtotal;
      const amountPaid = Number.isFinite(invoice.amountPaid) ? Math.max(0, invoice.amountPaid) : 0;
      const balanceAmount = Math.max(0, totalAmount - amountPaid);
      const normalized: Invoice = {
        ...invoice,
        tenantId: invoice.tenantId ?? DEFAULT_TENANT_ID,
        billedToAddress: invoice.billedToAddress ?? "",
        billedToCity: invoice.billedToCity ?? "",
        billedToState: invoice.billedToState ?? "",
        billedToPincode: invoice.billedToPincode ?? "",
        customerProfileId: invoice.customerProfileId ?? "",
        shippingAddress: invoice.shippingAddress ?? invoice.billedToAddress ?? "",
        shippingCity: invoice.shippingCity ?? invoice.billedToCity ?? "",
        shippingState: invoice.shippingState ?? invoice.billedToState ?? "",
        shippingPincode: invoice.shippingPincode ?? invoice.billedToPincode ?? "",
        paymentTermsDays: Number.isFinite(invoice.paymentTermsDays) ? Math.max(1, Number(invoice.paymentTermsDays)) : 15,
        poNumber: invoice.poNumber ?? "",
        bankBeneficiaryName: invoice.bankBeneficiaryName ?? "",
        bankName: invoice.bankName ?? "",
        bankAccountNumber: invoice.bankAccountNumber ?? "",
        bankIfsc: invoice.bankIfsc ?? "",
        supplierName: invoice.supplierName ?? "Yugam Consulting",
        supplierAddress: invoice.supplierAddress ?? "",
        supplierCity: invoice.supplierCity ?? "",
        supplierState: invoice.supplierState ?? "",
        supplierPincode: invoice.supplierPincode ?? "",
        supplierPhone: invoice.supplierPhone ?? "",
        supplierEmail: invoice.supplierEmail ?? "",
        supplierStateCode: invoice.supplierStateCode ?? "",
        supplierGstin: invoice.supplierGstin ?? "",
        buyerGstin: invoice.buyerGstin ?? "",
        placeOfSupplyStateCode: invoice.placeOfSupplyStateCode ?? "",
        sacCode: invoice.sacCode ?? "",
        reverseCharge: invoice.reverseCharge ?? false,
        lineItems: (invoice.lineItems && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{
            id: makeId(),
            serviceName: invoice.serviceName ?? "Service",
            description: invoice.description ?? "",
            sacCode: invoice.sacCode ?? "",
            quantity: Number.isFinite(invoice.quantity) ? Math.max(1, invoice.quantity) : 1,
            unitPrice: Number.isFinite(invoice.unitPrice) ? Math.max(0, invoice.unitPrice) : 0,
            gstRate: Number.isFinite(invoice.gstRate) ? Math.max(0, invoice.gstRate) : 18,
          }]).map((item) => sanitizeInvoiceLineItem(item)),
        issueDate: invoice.issueDate || todayISODate(),
        dueDate: invoice.dueDate || invoice.issueDate || todayISODate(),
        quantity: Number.isFinite(invoice.quantity) ? Math.max(1, invoice.quantity) : 1,
        unitPrice: Number.isFinite(invoice.unitPrice) ? Math.max(0, invoice.unitPrice) : 0,
        gstRate: Number.isFinite(invoice.gstRate) ? Math.max(0, invoice.gstRate) : 18,
        gstMode: invoice.gstMode === "Inter" ? "Inter" : "Intra",
        subtotal,
        cgstAmount: Number.isFinite(invoice.cgstAmount) ? Math.max(0, invoice.cgstAmount) : 0,
        sgstAmount: Number.isFinite(invoice.sgstAmount) ? Math.max(0, invoice.sgstAmount) : 0,
        igstAmount: Number.isFinite(invoice.igstAmount) ? Math.max(0, invoice.igstAmount) : 0,
        totalAmount,
        amountPaid,
        balanceAmount,
        paidAt: invoice.paidAt ?? "",
        status: INVOICE_STATUSES.includes(invoice.status) ? invoice.status : "Draft",
        approvalStatus: invoice.approvalStatus ?? (invoice.status === "Issued" ? "Approved" : "Not Required"),
        approvalRequestedBy: invoice.approvalRequestedBy ?? invoice.createdBy ?? "System",
        approvalRequestedAt: invoice.approvalRequestedAt ?? invoice.createdAt ?? new Date().toISOString(),
        approvedBy: invoice.approvedBy ?? "",
        approvedAt: invoice.approvedAt ?? "",
        approvalRemarks: invoice.approvalRemarks ?? "",
        recurrence: INVOICE_RECURRENCES.includes(invoice.recurrence) ? invoice.recurrence : "none",
        recurrenceCount: Number.isFinite(invoice.recurrenceCount) ? Math.max(1, invoice.recurrenceCount) : 1,
        recurrenceParentId: invoice.recurrenceParentId ?? null,
        recurrenceIndex: Number.isFinite(invoice.recurrenceIndex) ? Math.max(1, invoice.recurrenceIndex) : 1,
        notes: invoice.notes ?? "",
        createdBy: invoice.createdBy ?? "System",
        createdAt: invoice.createdAt ?? new Date().toISOString(),
        updatedAt: invoice.updatedAt ?? new Date().toISOString(),
      };
      return { ...normalized, status: normalizeInvoiceStatus(normalized) };
    });
  });
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>(() => {
    const loaded = loadJson<InvoicePayment[]>(STORAGE_INVOICE_PAYMENTS, []);
    return loaded.map((payment) => ({
      ...payment,
      tenantId: payment.tenantId ?? DEFAULT_TENANT_ID,
      amount: Math.max(0, Number(payment.amount) || 0),
      paidAt: payment.paidAt || todayISODate(),
      mode: INVOICE_PAYMENT_MODES.includes(payment.mode) ? payment.mode : "Bank Transfer",
      reference: payment.reference ?? "",
      notes: payment.notes ?? "",
      createdBy: payment.createdBy ?? "System",
      createdAt: payment.createdAt ?? new Date().toISOString(),
    }));
  });
  const [invoiceAdjustments, setInvoiceAdjustments] = useState<InvoiceAdjustment[]>(() => {
    const loaded = loadJson<InvoiceAdjustment[]>(STORAGE_INVOICE_ADJUSTMENTS, []);
    return loaded.map((entry) => ({
      ...entry,
      tenantId: entry.tenantId ?? DEFAULT_TENANT_ID,
      amount: Math.max(0, Number(entry.amount) || 0),
      noteDate: entry.noteDate || todayISODate(),
      reason: entry.reason ?? "",
      createdBy: entry.createdBy ?? "System",
      createdAt: entry.createdAt ?? new Date().toISOString(),
    }));
  });
  const [invoicePromises, setInvoicePromises] = useState<InvoicePromise[]>(() => {
    const loaded = loadJson<InvoicePromise[]>(STORAGE_INVOICE_PROMISES, []);
    return loaded.map((entry) => ({
      ...entry,
      tenantId: entry.tenantId ?? DEFAULT_TENANT_ID,
      promisedAmount: Math.max(0, Number(entry.promisedAmount) || 0),
      promisedDate: entry.promisedDate || todayISODate(),
      status: ["Open", "Honored", "Missed", "Cancelled"].includes(entry.status) ? entry.status : "Open",
      notes: entry.notes ?? "",
      createdBy: entry.createdBy ?? "System",
      createdAt: entry.createdAt ?? new Date().toISOString(),
      fulfilledAt: entry.fulfilledAt ?? "",
    }));
  });
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>(() => {
    const loaded = loadJson<CustomerProfile[]>(STORAGE_CUSTOMER_PROFILES, []);
    return loaded.map((profile) => ({
      ...profile,
      tenantId: profile.tenantId ?? DEFAULT_TENANT_ID,
      profileName: profile.profileName ?? profile.companyName ?? "Customer Profile",
      companyName: profile.companyName ?? "",
      contactName: profile.contactName ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      billingAddress: profile.billingAddress ?? "",
      billingCity: profile.billingCity ?? "",
      billingState: profile.billingState ?? "",
      billingPincode: profile.billingPincode ?? "",
      shippingAddress: profile.shippingAddress ?? profile.billingAddress ?? "",
      shippingCity: profile.shippingCity ?? profile.billingCity ?? "",
      shippingState: profile.shippingState ?? profile.billingState ?? "",
      shippingPincode: profile.shippingPincode ?? profile.billingPincode ?? "",
      buyerGstin: profile.buyerGstin ?? "",
      paymentTermsDays: Number.isFinite(profile.paymentTermsDays) ? Math.max(1, Number(profile.paymentTermsDays)) : 15,
      poNumber: profile.poNumber ?? "",
      bankBeneficiaryName: profile.bankBeneficiaryName ?? "",
      bankName: profile.bankName ?? "",
      bankAccountNumber: profile.bankAccountNumber ?? "",
      bankIfsc: profile.bankIfsc ?? "",
      isDefault: profile.isDefault ?? false,
      createdAt: profile.createdAt ?? new Date().toISOString(),
      updatedAt: profile.updatedAt ?? new Date().toISOString(),
    }));
  });
  const [activities, setActivities] = useState<LeadActivity[]>(() => {
    const loaded = loadJson<LeadActivity[]>(STORAGE_ACTIVITIES, []);
    return loaded.map((activity) => ({ ...activity, tenantId: activity.tenantId ?? DEFAULT_TENANT_ID }));
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const loaded = loadJson<Employee[]>(STORAGE_EMPLOYEES, []);
    return loaded.map((employee) => ({ ...employee, tenantId: employee.tenantId ?? DEFAULT_TENANT_ID }));
  });
  const [servicesByTenant, setServicesByTenant] = useState<Record<string, ServiceType[]>>(() => loadServicesByTenant());
  const [settingsByTenant, setSettingsByTenant] = useState<Record<string, AppSettings>>(() => loadSettingsByTenant());
  const [pipelineWipLimitsByTenant, setPipelineWipLimitsByTenant] = useState<Record<string, PipelineWipLimitMap>>(() => loadPipelineWipLimitsByTenant());
  const [reminderDispatchByTenant, setReminderDispatchByTenant] = useState<Record<string, ReminderDispatchLog>>(() =>
    loadJson<Record<string, ReminderDispatchLog>>(STORAGE_REMINDER_DISPATCH, {}),
  );
  const [collectionsDispatchLogs, setCollectionsDispatchLogs] = useState<CollectionsDispatchLog[]>(() => {
    const loaded = loadJson<CollectionsDispatchLog[]>(STORAGE_COLLECTIONS_DISPATCH, []);
    return loaded.map((entry) => ({
      ...entry,
      tenantId: entry.tenantId ?? DEFAULT_TENANT_ID,
      channel: entry.channel === "email" || entry.channel === "both" ? entry.channel : "whatsapp",
      provider: entry.provider && WHATSAPP_PROVIDER_OPTIONS.includes(entry.provider) ? entry.provider : "custom-webhook",
      status: normalizeCollectionsDispatchStatus(entry.status),
      dispatchId: entry.dispatchId ?? "",
      messageId: entry.messageId ?? "",
      requestedAt: entry.requestedAt ?? new Date().toISOString(),
      lastEventAt: entry.lastEventAt ?? entry.requestedAt ?? new Date().toISOString(),
      deliveredAt: entry.deliveredAt ?? "",
      readAt: entry.readAt ?? "",
      error: entry.error ?? "",
      triggeredBy: entry.triggeredBy ?? "System",
      recipient: entry.recipient ?? "",
      invoiceNumber: entry.invoiceNumber ?? "",
      invoiceId: entry.invoiceId ?? "",
      leadId: entry.leadId ?? "",
    }));
  });
  const [dunningAutomationLogs, setDunningAutomationLogs] = useState<DunningAutomationLog[]>(() =>
    loadJson<DunningAutomationLog[]>(STORAGE_DUNNING_AUTOMATION, []),
  );
  const [trialAccounts, setTrialAccounts] = useState<TrialAccount[]>(() => {
    const loaded = loadJson<TrialAccount[]>(STORAGE_TRIAL_ACCOUNTS, []);
    const normalized: TrialAccount[] = loaded.map((entry) => ({
      ...entry,
      signupSource:
        entry.signupSource === "google" || entry.signupSource === "owner-created" || entry.signupSource === "trial-form"
          ? entry.signupSource
          : "trial-form",
      status: entry.status === "expired" || entry.status === "converted" || entry.status === "active" ? entry.status : "active",
      convertedAt: entry.convertedAt ?? "",
      lastLoginAt: entry.lastLoginAt ?? "",
      createdAt: entry.createdAt ?? entry.trialStartAt,
    }));
    if (normalized.length > 0) return normalized;
    return loadJson<Tenant[]>(STORAGE_TENANTS, [])
      .filter((tenant) => tenant.isTrial)
      .map((tenant) => ({
        id: makeId(),
        tenantId: tenant.id,
        ownerName: tenant.name,
        ownerEmail: tenant.invoiceProfile?.email ?? "",
        workspaceName: tenant.name,
        signupSource: "owner-created" as const,
        trialStartAt: tenant.licenseStartDate,
        trialEndAt: tenant.licenseEndDate,
        status: "active" as const,
        convertedAt: "",
        lastLoginAt: "",
        createdAt: tenant.createdAt,
      }));
  });
  const [subscriptions, setSubscriptions] = useState<TenantSubscription[]>(() => {
    const loaded = loadJson<TenantSubscription[]>(STORAGE_SUBSCRIPTIONS, []);
    if (loaded.length > 0) {
      return loaded.map((entry) => ({
        ...entry,
        billingCycle: entry.billingCycle ?? DEFAULT_BILLING_CYCLE,
        status: entry.status ?? "active",
        retryCount: Number.isFinite(entry.retryCount) ? Math.max(0, Number(entry.retryCount)) : 0,
        nextRetryAt: entry.nextRetryAt ?? "",
        scheduledDowngradePlanTemplateId: entry.scheduledDowngradePlanTemplateId ?? null,
        scheduledDowngradeAt: entry.scheduledDowngradeAt ?? "",
        updatedAt: entry.updatedAt ?? new Date().toISOString(),
        createdAt: entry.createdAt ?? new Date().toISOString(),
      }));
    }
    return loadJson<Tenant[]>(STORAGE_TENANTS, [defaultTenant]).map((tenant) => buildSubscriptionFromTenant(tenant));
  });
  const [billingRecords, setBillingRecords] = useState<LicenseBillingRecord[]>(() => {
    const loaded = loadJson<LicenseBillingRecord[]>(STORAGE_BILLING_RECORDS, []);
    return loaded.map((entry) => ({
      ...entry,
      status: entry.status ?? "pending",
      type: entry.type ?? "renewal",
      amount: Math.max(0, Number(entry.amount) || 0),
      attemptCount: Math.max(1, Number(entry.attemptCount) || 1),
      currency: "INR",
      gateway: entry.gateway ?? "manual",
      dueDate: entry.dueDate || todayISODate(),
      createdAt: entry.createdAt || new Date().toISOString(),
      paidAt: entry.paidAt ?? "",
      failedAt: entry.failedAt ?? "",
      failureReason: entry.failureReason ?? "",
      gatewayRef: entry.gatewayRef ?? "",
      planTemplateFromId: entry.planTemplateFromId ?? null,
      planTemplateToId: entry.planTemplateToId ?? null,
    }));
  });
  const [userOnboarding, setUserOnboarding] = useState<Record<string, UserOnboardingState>>(() =>
    loadJson<Record<string, UserOnboardingState>>(STORAGE_USER_ONBOARDING, {}),
  );
  const [marketingContent, setMarketingContent] = useState<MarketingContent>(() =>
    normalizeMarketingContent(loadJson<MarketingContent>(STORAGE_MARKETING_CONTENT, DEFAULT_MARKETING_CONTENT)),
  );
  const [marketingTheme, setMarketingTheme] = useState<MarketingTheme>(() => {
    const loaded = loadText(STORAGE_MARKETING_THEME, "elegant");
    return loaded === "futuristic" ? "futuristic" : "elegant";
  });
  const [marketingJsonDraft, setMarketingJsonDraft] = useState("");
  const [marketingJsonError, setMarketingJsonError] = useState("");

  const [view, setView] = useState<AuthView>("login");
  const [publicView, setPublicView] = useState<PublicView>(() => getInitialPublicView());
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [sectionRecoveryNonce, setSectionRecoveryNonce] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstallDismissed, setPwaInstallDismissed] = useState(() => loadText(STORAGE_PWA_INSTALL_DISMISSED, "0") === "1");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [trialName, setTrialName] = useState("");
  const [trialWorkspace, setTrialWorkspace] = useState("");
  const [trialEmail, setTrialEmail] = useState("");
  const [trialPassword, setTrialPassword] = useState("");
  const [trialSeedDemoData, setTrialSeedDemoData] = useState(true);
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("sales");
  const [newUserProfile, setNewUserProfile] = useState<StaffProfile>("sales");
  const [newUserCanAccessPipeline, setNewUserCanAccessPipeline] = useState(true);
  const [newUserCanAccessFollowups, setNewUserCanAccessFollowups] = useState(true);
  const [newUserScope, setNewUserScope] = useState<AccessScope>("assigned");
  const [newUserTenantId, setNewUserTenantId] = useState(DEFAULT_TENANT_ID);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
  const [isWorkspaceUrlNameManual, setIsWorkspaceUrlNameManual] = useState(false);
  const [showWorkspaceUrlNameEditor, setShowWorkspaceUrlNameEditor] = useState(false);
  const [workspaceAdminName, setWorkspaceAdminName] = useState("");
  const [workspaceAdminEmail, setWorkspaceAdminEmail] = useState("");
  const [workspaceAdminPassword, setWorkspaceAdminPassword] = useState("");
  const [newWorkspaceProductMode, setNewWorkspaceProductMode] = useState<ProductMode>("full");
  const [newWorkspacePlanChoice, setNewWorkspacePlanChoice] = useState<CreateLicenseePlanChoice>(DEFAULT_PLAN_TEMPLATE_ID);
  const [newWorkspaceLicenseTerm, setNewWorkspaceLicenseTerm] = useState<LicenseTermPreset>("annual");
  const [newWorkspacePlanName, setNewWorkspacePlanName] = useState(DEFAULT_TENANT_ENTITLEMENTS.planName);
  const [newWorkspaceMaxUsers, setNewWorkspaceMaxUsers] = useState(DEFAULT_TENANT_ENTITLEMENTS.maxUsers);
  const [newWorkspaceMaxLeads, setNewWorkspaceMaxLeads] = useState(DEFAULT_TENANT_ENTITLEMENTS.maxLeadsPerMonth);
  const [newWorkspaceGraceDays, setNewWorkspaceGraceDays] = useState(DEFAULT_TENANT_ENTITLEMENTS.graceDays);
  const [newWorkspaceAuditRetention, setNewWorkspaceAuditRetention] = useState(DEFAULT_TENANT_ENTITLEMENTS.auditRetentionDays);
  const [newWorkspaceFeatureExports, setNewWorkspaceFeatureExports] = useState(DEFAULT_TENANT_ENTITLEMENTS.featureExports);
  const [newWorkspaceFeatureForecast, setNewWorkspaceFeatureForecast] = useState(DEFAULT_TENANT_ENTITLEMENTS.featureAdvancedForecast);
  const [newWorkspaceFeatureInvoicing, setNewWorkspaceFeatureInvoicing] = useState(DEFAULT_TENANT_ENTITLEMENTS.featureInvoicing);
  const [newWorkspaceRequireGstCompliance, setNewWorkspaceRequireGstCompliance] = useState(DEFAULT_TENANT_ENTITLEMENTS.requireGstCompliance);
  const [newWorkspaceInvoiceLegalName, setNewWorkspaceInvoiceLegalName] = useState(DEFAULT_INVOICE_PROFILE.legalName);
  const [newWorkspaceInvoiceAddress, setNewWorkspaceInvoiceAddress] = useState(DEFAULT_INVOICE_PROFILE.addressLine);
  const [newWorkspaceInvoiceCity, setNewWorkspaceInvoiceCity] = useState(DEFAULT_INVOICE_PROFILE.city);
  const [newWorkspaceInvoiceState, setNewWorkspaceInvoiceState] = useState(DEFAULT_INVOICE_PROFILE.state);
  const [newWorkspaceInvoicePincode, setNewWorkspaceInvoicePincode] = useState(DEFAULT_INVOICE_PROFILE.pincode);
  const [newWorkspaceInvoicePhone, setNewWorkspaceInvoicePhone] = useState(DEFAULT_INVOICE_PROFILE.phone);
  const [newWorkspaceInvoiceEmail, setNewWorkspaceInvoiceEmail] = useState(DEFAULT_INVOICE_PROFILE.email);
  const [newWorkspaceInvoiceGstin, setNewWorkspaceInvoiceGstin] = useState(DEFAULT_INVOICE_PROFILE.gstin);
  const [newWorkspaceInvoiceStateCode, setNewWorkspaceInvoiceStateCode] = useState(DEFAULT_INVOICE_PROFILE.stateCode);
  const [createLicenseeStep, setCreateLicenseeStep] = useState<1 | 2 | 3>(1);
  const [customizeCreateEntitlements, setCustomizeCreateEntitlements] = useState(false);
  const [showCreateAdvancedSettings, setShowCreateAdvancedSettings] = useState(false);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
const [templateMonthlyPrice, setTemplateMonthlyPrice] = useState(5999);
const [templateOfferLabel, setTemplateOfferLabel] = useState("");
  const [templateMaxUsers, setTemplateMaxUsers] = useState(10);
  const [templateMaxLeads, setTemplateMaxLeads] = useState(500);
  const [templateGraceDays, setTemplateGraceDays] = useState(DEFAULT_GRACE_DAYS);
  const [templateAuditRetention, setTemplateAuditRetention] = useState(365);
  const [templateFeatureExports, setTemplateFeatureExports] = useState(true);
  const [templateFeatureForecast, setTemplateFeatureForecast] = useState(true);
  const [templateFeatureInvoicing, setTemplateFeatureInvoicing] = useState(true);
  const [templateRequireGstCompliance, setTemplateRequireGstCompliance] = useState(true);

  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");

  const [searchText, setSearchText] = useState("");
  const [showLeadRecycleBin, setShowLeadRecycleBin] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "All">("All");
  const [filterSource, setFilterSource] = useState<LeadSource | "All">("All");
  const [filterAssignee, setFilterAssignee] = useState<string>("All");
  const [filterTemp, setFilterTemp] = useState<LeadTemperature | "All">("All");
  const [quickFilter, setQuickFilter] = useState<"all" | "today-followups" | "hot">("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadBulkAction, setLeadBulkAction] = useState<LeadBulkAction>("");
  const [leadBulkAssignee, setLeadBulkAssignee] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [loginViewFilter, setLoginViewFilter] = useState<"active" | "expired" | "inactive" | "old">("active");
  const [loginDepartmentFilter, setLoginDepartmentFilter] = useState<StaffProfile | "All">("All");
  const [auditEventFilter, setAuditEventFilter] = useState<"all" | "lead" | "registration" | "password" | "trial">("all");
  const [auditDateRangeFilter, setAuditDateRangeFilter] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [usersTab, setUsersTab] = useState<UsersTab>("licensees");
  const [selectedUsersTenantId, setSelectedUsersTenantId] = useState(DEFAULT_TENANT_ID);
  const [tenantDrafts, setTenantDrafts] = useState<Record<string, TenantEntitlementDraft>>({});
  const [closingDatePrompt, setClosingDatePrompt] = useState<{ leadId: string; nextStatus: LeadStatus; isMandatory: boolean } | null>(null);
  const [closingDateDraft, setClosingDateDraft] = useState("");
  const [lostReasonPrompt, setLostReasonPrompt] = useState<{ leadId: string } | null>(null);
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [revenueRangePreset, setRevenueRangePreset] = useState<MonthRangePreset>("6");
  const [revenueCustomStart, setRevenueCustomStart] = useState("");
  const [revenueCustomEnd, setRevenueCustomEnd] = useState("");
  const [revenueAssigneeFilter, setRevenueAssigneeFilter] = useState<string>("All");
  const [revenueSourceFilter, setRevenueSourceFilter] = useState<LeadSource | "All">("All");
  const [revenueServiceFilter, setRevenueServiceFilter] = useState<string>("All");
  const [revenueForecastMode, setRevenueForecastMode] = useState<ForecastMode>("unweighted");
  const [revenueShowEmptyMonths, setRevenueShowEmptyMonths] = useState(false);
  const [revenueBookedTarget, setRevenueBookedTarget] = useState(0);
  const [revenueCollectedTarget, setRevenueCollectedTarget] = useState(0);
  const [revenueTab, setRevenueTab] = useState<RevenueTab>("overview");
  const [revenueShowFilters, setRevenueShowFilters] = useState(false);
  const [revenueShowAdvanced, setRevenueShowAdvanced] = useState(false);
  const [revenueExportType, setRevenueExportType] = useState<"projection" | "closed" | "forecast">("projection");
  const [sourcesRangePreset, setSourcesRangePreset] = useState<MonthRangePreset>("3");
  const [sourcesCustomStart, setSourcesCustomStart] = useState("");
  const [sourcesCustomEnd, setSourcesCustomEnd] = useState("");
  const [sourcesComparePrevious, setSourcesComparePrevious] = useState(false);
  const [sourceDrilldown, setSourceDrilldown] = useState<{ source: string | null; monthKey: string | null } | null>(null);
  const [revenueDrilldown, setRevenueDrilldown] = useState<{ monthKey: string; type: "projection" | "won" | "lost" } | null>(null);
  const [dashboardDateScope, setDashboardDateScope] = useState<DashboardDateScope>("all");
  const [dashboardCustomStart, setDashboardCustomStart] = useState("");
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState("");
  const [moduleModes, setModuleModes] = useState<Record<AppView, ModuleMode>>({
    mywork: "basic",
    dashboard: "advanced",
    leads: "advanced",
    pipeline: "advanced",
    followups: "advanced",
    revenue: "advanced",
    invoices: "advanced",
    sources: "advanced",
    users: "advanced",
  });
  const [quickCommandOpen, setQuickCommandOpen] = useState(false);
  const [quickCommandSearch, setQuickCommandSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dailyMode, setDailyMode] = useState(false);
  const [quickFollowLeadId, setQuickFollowLeadId] = useState("");
  const [quickFollowAction, setQuickFollowAction] = useState<"done" | "today">("done");
  const [showOptionalIntake, setShowOptionalIntake] = useState(false);
  const [leadIntakeStep, setLeadIntakeStep] = useState<1 | 2>(1);
  const [leadIntakeModalOpen, setLeadIntakeModalOpen] = useState(false);
  const [leadImportModalOpen, setLeadImportModalOpen] = useState(false);
  const [isImportingLeads, setIsImportingLeads] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isCaptureProcessing, setIsCaptureProcessing] = useState(false);
  const [captureSummary, setCaptureSummary] = useState<CaptureSummaryItem[]>([]);
  const [showLeadColumnPicker, setShowLeadColumnPicker] = useState(false);
  const [leadOptionalColumns, setLeadOptionalColumns] = useState<LeadOptionalColumn[]>([]);
  const [keyboardEntryMode, setKeyboardEntryMode] = useState(true);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineAssigneeFilter, setPipelineAssigneeFilter] = useState<string>("All");
  const [pipelineTempFilter, setPipelineTempFilter] = useState<LeadTemperature | "All">("All");
  const [pipelineSort, setPipelineSort] = useState<PipelineSort>("priority");
  const [pipelineShowClosed, setPipelineShowClosed] = useState(false);
  const [pipelineFocusMode, setPipelineFocusMode] = useState<"all" | "mine">("all");
  const [pipelineShowAdvancedControls, setPipelineShowAdvancedControls] = useState(false);
  const [pipelineWipScope, setPipelineWipScope] = useState<PipelineWipScope>("today");
  const [pipelineWipDate, setPipelineWipDate] = useState(todayISODate());
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [pipelineDragOverStatus, setPipelineDragOverStatus] = useState<LeadStatus | null>(null);
  const [followupSearch, setFollowupSearch] = useState("");
  const [followupAssigneeFilter, setFollowupAssigneeFilter] = useState<string>("All");
  const [followupStageFilter, setFollowupStageFilter] = useState<LeadStatus | "All">("All");
  const [followupTempFilter, setFollowupTempFilter] = useState<LeadTemperature | "All">("All");
  const [followupQueue, setFollowupQueue] = useState<FollowupQueue>("overdue");
  const [followupShowAdvancedControls, setFollowupShowAdvancedControls] = useState(false);
  const [selectedFollowupLeadIds, setSelectedFollowupLeadIds] = useState<string[]>([]);
  const [followupBulkAction, setFollowupBulkAction] = useState<FollowupBulkAction>("");
  const [followupBulkAssignee, setFollowupBulkAssignee] = useState("");
  const [followupBulkDate, setFollowupBulkDate] = useState(todayISODate());
  const [followupReassignPickerOpen, setFollowupReassignPickerOpen] = useState(false);
  const [followupReassignSearch, setFollowupReassignSearch] = useState("");
  const [invoiceLeadFilter, setInvoiceLeadFilter] = useState<string>("All");
  const [invoiceClientFilter, setInvoiceClientFilter] = useState<string>("All");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [invoiceWorkspaceTab, setInvoiceWorkspaceTab] = useState<InvoiceWorkspaceTab>("workspace");
  const [clientMasterSearch, setClientMasterSearch] = useState("");
  const [clientMasterImportCsv, setClientMasterImportCsv] = useState("");
  const [clientMasterTenantId, setClientMasterTenantId] = useState(DEFAULT_TENANT_ID);
  const [invoiceRangePreset, setInvoiceRangePreset] = useState<MonthRangePreset>("6");
  const [invoiceCustomStart, setInvoiceCustomStart] = useState("");
  const [invoiceCustomEnd, setInvoiceCustomEnd] = useState("");
  const [invoiceComposerOpen, setInvoiceComposerOpen] = useState(false);
  const [invoiceIssuerConfirmed, setInvoiceIssuerConfirmed] = useState(false);
  const [invoiceIssuerEditMode, setInvoiceIssuerEditMode] = useState(false);
  const [invoiceActionMenuId, setInvoiceActionMenuId] = useState<string | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>({
    leadId: "",
    customerProfileId: "",
    issueDate: todayISODate(),
    dueDate: shiftISODate(todayISODate(), 15),
    billedToName: "",
    billedToCompany: "",
    billedToEmail: "",
    billedToPhone: "",
    billedToAddress: "",
    billedToCity: "",
    billedToState: "",
    billedToPincode: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    useBillingAsShipping: true,
    paymentTermsDays: 15,
    poNumber: "",
    bankBeneficiaryName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    supplierName: DEFAULT_INVOICE_PROFILE.legalName,
    supplierAddress: DEFAULT_INVOICE_PROFILE.addressLine,
    supplierCity: DEFAULT_INVOICE_PROFILE.city,
    supplierState: DEFAULT_INVOICE_PROFILE.state,
    supplierPincode: DEFAULT_INVOICE_PROFILE.pincode,
    supplierPhone: DEFAULT_INVOICE_PROFILE.phone,
    supplierEmail: DEFAULT_INVOICE_PROFILE.email,
    supplierStateCode: DEFAULT_INVOICE_PROFILE.stateCode,
    supplierGstin: "",
    buyerGstin: "",
    placeOfSupplyStateCode: "33",
    sacCode: "9983",
    reverseCharge: false,
    lineItems: [
      {
        id: makeId(),
        serviceName: "",
        description: "",
        sacCode: "9983",
        quantity: 1,
        unitPrice: 0,
        gstRate: 18,
      },
    ],
    serviceName: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    gstRate: 18,
    gstMode: "Intra",
    recurrence: "none",
    recurrenceCount: 1,
    notes: "",
  });
  const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({
    amount: 0,
    paidAt: todayISODate(),
    mode: "Bank Transfer" as InvoicePaymentMode,
    reference: "",
    notes: "",
  });
  const [ledgerInvoiceId, setLedgerInvoiceId] = useState<string | null>(null);
  const [adjustmentModalInvoiceId, setAdjustmentModalInvoiceId] = useState<string | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<{ kind: InvoiceAdjustmentType; amount: number; noteDate: string; reason: string }>({
    kind: "Credit",
    amount: 0,
    noteDate: todayISODate(),
    reason: "",
  });
  const [promiseModalInvoiceId, setPromiseModalInvoiceId] = useState<string | null>(null);
  const [promiseDraft, setPromiseDraft] = useState({
    promisedAmount: 0,
    promisedDate: shiftISODate(todayISODate(), 3),
    notes: "",
  });
  const [directPasswordUserId, setDirectPasswordUserId] = useState<string | null>(null);
  const [directPasswordDraft, setDirectPasswordDraft] = useState("");
  const [directPasswordConfirmDraft, setDirectPasswordConfirmDraft] = useState("");
  const [approvalRemarkDraft, setApprovalRemarkDraft] = useState("");
  const [customerProfileNameDraft, setCustomerProfileNameDraft] = useState("");
  const leadNameInputRef = useRef<HTMLInputElement | null>(null);
  const uiPrefsLoadedForUserRef = useRef<string | null>(null);

  const debouncedLeadSearch = useDebouncedValue(searchText);
  const debouncedPipelineSearch = useDebouncedValue(pipelineSearch);
  const debouncedFollowupSearch = useDebouncedValue(followupSearch);
  const debouncedClientMasterSearch = useDebouncedValue(clientMasterSearch);
  const debouncedQuickCommandSearch = useDebouncedValue(quickCommandSearch);

  const [intake, setIntake] = useState<Omit<Lead, "id" | "tenantId">>({
    leadName: "",
    companyName: "",
    phoneNumber: "",
    emailId: "",
    leadSource: "Website",
    serviceInterested: "SEO",
    leadStatus: "New",
    leadTemperature: "Warm",
    dealValue: 0,
    expectedClosingDate: "",
    assignedTo: "",
    dateAdded: todayISODate(),
    nextFollowupDate: todayISODate(),
    followupStatus: "Pending",
    notes: "",
    lastContactedDate: "",
    wonDate: "",
    wonDealValue: null,
    paymentStatus: "Not Invoiced",
    collectionsOwner: "",
    collectedDate: "",
    collectedAmount: null,
    invoiceFlowStatus: "Not Sent",
    invoiceSentDate: "",
    isDuplicate: false,
    lossReason: "",
  });

  const leadInlineErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!intake.leadName.trim()) errors.leadName = "Lead name is required.";
    if (!intake.companyName.trim()) errors.companyName = "Company name is required.";
    if (!intake.phoneNumber.trim()) {
      errors.phoneNumber = "Phone number is required.";
    } else if (!isValidPhone(intake.phoneNumber)) {
      errors.phoneNumber = "Enter 8 to 15 digits.";
    }
    if (intake.emailId.trim() && !isValidEmail(intake.emailId)) {
      errors.emailId = "Email format looks invalid.";
    }
    if (safeDealValue(intake.dealValue) < 0) {
      errors.dealValue = "Deal value cannot be negative.";
    }
    if (intake.nextFollowupDate && intake.dateAdded && intake.nextFollowupDate < intake.dateAdded) {
      errors.nextFollowupDate = "Follow-up date cannot be earlier than Date Added.";
    }
    if (intake.lastContactedDate && intake.lastContactedDate > todayISODate()) {
      errors.lastContactedDate = "Last contacted date cannot be in the future.";
    }
    return errors;
  }, [intake]);

  useEffect(() => saveJson(STORAGE_TENANTS, tenants), [tenants]);
  useEffect(() => saveJson(STORAGE_PLAN_TEMPLATES, planTemplates), [planTemplates]);
  useEffect(() => saveJson(STORAGE_USERS, users), [users]);
  useEffect(() => saveJson(STORAGE_REQUESTS, requests), [requests]);
  useEffect(() => saveJson(STORAGE_CODES, resetCodes), [resetCodes]);
  useEffect(() => saveJson(STORAGE_SESSION, sessionUserId), [sessionUserId]);
  useEffect(() => saveJson(STORAGE_LEADS, leads), [leads]);
  useEffect(() => saveJson(STORAGE_INVOICES, invoices), [invoices]);
  useEffect(() => saveJson(STORAGE_INVOICE_PAYMENTS, invoicePayments), [invoicePayments]);
  useEffect(() => saveJson(STORAGE_INVOICE_ADJUSTMENTS, invoiceAdjustments), [invoiceAdjustments]);
  useEffect(() => saveJson(STORAGE_INVOICE_PROMISES, invoicePromises), [invoicePromises]);
  useEffect(() => saveJson(STORAGE_CUSTOMER_PROFILES, customerProfiles), [customerProfiles]);
  useEffect(() => saveJson(STORAGE_ACTIVITIES, activities), [activities]);
  useEffect(() => saveJson(STORAGE_EMPLOYEES, employees), [employees]);
  useEffect(() => saveJson(STORAGE_SERVICES, servicesByTenant), [servicesByTenant]);
  useEffect(() => saveJson(STORAGE_SETTINGS, settingsByTenant), [settingsByTenant]);
  useEffect(() => saveJson(STORAGE_PIPELINE_WIP_LIMITS, pipelineWipLimitsByTenant), [pipelineWipLimitsByTenant]);
  useEffect(() => saveJson(STORAGE_REMINDER_DISPATCH, reminderDispatchByTenant), [reminderDispatchByTenant]);
  useEffect(() => saveJson(STORAGE_COLLECTIONS_DISPATCH, collectionsDispatchLogs), [collectionsDispatchLogs]);
  useEffect(() => saveJson(STORAGE_DUNNING_AUTOMATION, dunningAutomationLogs), [dunningAutomationLogs]);
  useEffect(() => saveJson(STORAGE_BREAKGLASS, breakGlassSecrets), [breakGlassSecrets]);
  useEffect(() => saveJson(STORAGE_OLD_USERS, oldUsers), [oldUsers]);
  useEffect(() => saveJson(STORAGE_USER_ONBOARDING, userOnboarding), [userOnboarding]);
  useEffect(() => saveJson(STORAGE_TRIAL_ACCOUNTS, trialAccounts), [trialAccounts]);
  useEffect(() => saveJson(STORAGE_SUBSCRIPTIONS, subscriptions), [subscriptions]);
  useEffect(() => saveJson(STORAGE_BILLING_RECORDS, billingRecords), [billingRecords]);
  useEffect(() => saveJson(STORAGE_MARKETING_CONTENT, marketingContent), [marketingContent]);
  useEffect(() => saveText(STORAGE_MARKETING_THEME, marketingTheme), [marketingTheme]);
  useEffect(() => setMarketingJsonDraft(JSON.stringify(marketingContent, null, 2)), [marketingContent]);

  useEffect(() => {
    if (!revealedBreakGlassTenantId) return undefined;
    const hideTimer = window.setTimeout(() => setRevealedBreakGlassTenantId(null), 20_000);
    return () => window.clearTimeout(hideTimer);
  }, [revealedBreakGlassTenantId]);

  useEffect(() => {
    // Keep tenant subscription model aligned as licensees are created/edited.
    setSubscriptions((prev) => {
      const next = [...prev];
      const now = new Date().toISOString();
      tenants.forEach((tenant) => {
        const existing = next.find((entry) => entry.tenantId === tenant.id);
        if (!existing) {
          next.push(buildSubscriptionFromTenant(tenant));
          return;
        }
        existing.planName = tenant.planName;
        existing.planTemplateId = tenant.planTemplateId ?? existing.planTemplateId;
        existing.productMode = tenant.productMode;
        existing.autoRenew = tenant.autoRenew;
        existing.graceEndsAt = addDaysFrom(existing.renewalDate || tenant.licenseEndDate, Math.max(0, tenant.graceDays || DEFAULT_GRACE_DAYS));
        existing.updatedAt = now;
      });
      return next.filter((entry) => tenants.some((tenant) => tenant.id === entry.tenantId));
    });
  }, [tenants]);

  useEffect(() => {
    const missingTenants = tenants.filter((tenant) => !users.some((user) => user.tenantId === tenant.id && user.isBreakGlass));
    if (missingTenants.length === 0) return;
    const createdAt = new Date().toISOString();
    const newUsers: UserAccount[] = [];
    const newSecrets: BreakGlassSecret[] = [];

    missingTenants.forEach((tenant) => {
      const email = `recovery.${tenant.slug}@oruyugam.com`;
      const password = generateRecoveryPassword();
      newUsers.push({
        id: makeId(),
        tenantId: tenant.id,
        name: `${tenant.name} Recovery Owner`,
        email,
        password,
        isBreakGlass: true,
        role: "owner",
        canAccessPipeline: true,
        canAccessFollowups: true,
        accessScope: "all",
        isActive: true,
        licenseStartDate: createdAt,
        licenseEndDate: oneYearFrom(createdAt),
        autoRenew: true,
        mustChangePassword: false,
        createdAt,
      });
      newSecrets.push({
        id: makeId(),
        tenantId: tenant.id,
        email,
        password,
        generatedAt: createdAt,
        acknowledged: false,
      });
    });

    setUsers((prev) => [...newUsers, ...prev]);
    setBreakGlassSecrets((prev) => {
      const untouched = prev.filter((secret) => !missingTenants.some((tenant) => tenant.id === secret.tenantId));
      return [...newSecrets, ...untouched];
    });
  }, [tenants, users]);

  useEffect(() => {
    // Backfill won date/snapshot for legacy won leads using latest activity timestamp.
    setLeads((prev) => {
      let changed = false;
      const next = prev.map((lead) => {
        if (lead.leadStatus !== "Won") return lead;
        const latestActivityStamp = activities
          .filter((entry) => entry.leadId === lead.id)
          .reduce((latest, entry) => {
            const currentMs = new Date(entry.createdAt).getTime();
            const latestMs = latest ? new Date(latest).getTime() : 0;
            if (Number.isNaN(currentMs)) return latest;
            return currentMs > latestMs ? entry.createdAt : latest;
          }, "");
        const nextWonDate =
          lead.wonDate ||
          (latestActivityStamp ? latestActivityStamp.slice(0, 10) : "") ||
          lead.lastContactedDate ||
          lead.expectedClosingDate ||
          lead.dateAdded ||
          "";
        const nextWonDealValue =
          lead.wonDealValue !== null && Number.isFinite(lead.wonDealValue)
            ? lead.wonDealValue
            : safeDealValue(lead.dealValue);
        if (nextWonDate !== lead.wonDate || nextWonDealValue !== lead.wonDealValue) {
          changed = true;
          return { ...lead, wonDate: nextWonDate, wonDealValue: nextWonDealValue };
        }
        return lead;
      });
      return changed ? next : prev;
    });
  }, [activities]);

  const currentUser = useMemo(() => users.find((u) => u.id === sessionUserId) ?? null, [users, sessionUserId]);
  const isStandalonePwa = useMemo(() => {
    if (typeof window === "undefined") return false;
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
  }, []);
  const currentUserOnboarding = currentUser ? userOnboarding[currentUser.id] : null;
  const guidedExperienceActive = Boolean(
    currentUserOnboarding
    && !currentUserOnboarding.dismissedAt
    && currentUserOnboarding.loginCount <= GUIDED_SESSIONS_LIMIT,
  );
  const uiPrefsStorageKey = currentUser ? `${STORAGE_UI_PREFS}:${currentUser.id}` : "";

  useEffect(() => {
    const updateOnline = () => setIsOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setPwaInstallDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    saveText(STORAGE_PWA_INSTALL_DISMISSED, pwaInstallDismissed ? "1" : "0");
  }, [pwaInstallDismissed]);

  useEffect(() => {
    if (!currentUser) {
      uiPrefsLoadedForUserRef.current = null;
      return;
    }
    const loaded = loadJson<UiPreferences | null>(uiPrefsStorageKey, null);
    if (loaded) {
      setAppView(loaded.appView);
      setModuleModes(loaded.moduleModes);
      setFocusMode(loaded.focusMode);
      setDailyMode(loaded.dailyMode);
      setLeadOptionalColumns(loaded.leadOptionalColumns);
      setQuickFilter(loaded.quickFilter);
      setFilterStatus(loaded.filterStatus);
      setFilterSource(loaded.filterSource);
      setFilterAssignee(loaded.filterAssignee);
      setFilterTemp(loaded.filterTemp);
      setDashboardDateScope(loaded.dashboardDateScope);
      setDashboardCustomStart(loaded.dashboardCustomStart);
      setDashboardCustomEnd(loaded.dashboardCustomEnd);
      setRevenueRangePreset(loaded.revenueRangePreset);
      setRevenueCustomStart(loaded.revenueCustomStart);
      setRevenueCustomEnd(loaded.revenueCustomEnd);
      setSourcesRangePreset(loaded.sourcesRangePreset);
      setSourcesCustomStart(loaded.sourcesCustomStart);
      setSourcesCustomEnd(loaded.sourcesCustomEnd);
      setPipelineAssigneeFilter(loaded.pipelineAssigneeFilter);
      setPipelineTempFilter(loaded.pipelineTempFilter);
      setPipelineSort(loaded.pipelineSort);
      setPipelineShowClosed(loaded.pipelineShowClosed);
      setFollowupQueue(loaded.followupQueue);
    }
    uiPrefsLoadedForUserRef.current = currentUser.id;
  }, [currentUser, uiPrefsStorageKey]);

  useEffect(() => {
    if (!currentUser || uiPrefsLoadedForUserRef.current !== currentUser.id) return;
    const payload: UiPreferences = {
      appView,
      moduleModes,
      focusMode,
      dailyMode,
      leadOptionalColumns,
      quickFilter,
      filterStatus,
      filterSource,
      filterAssignee,
      filterTemp,
      dashboardDateScope,
      dashboardCustomStart,
      dashboardCustomEnd,
      revenueRangePreset,
      revenueCustomStart,
      revenueCustomEnd,
      sourcesRangePreset,
      sourcesCustomStart,
      sourcesCustomEnd,
      pipelineAssigneeFilter,
      pipelineTempFilter,
      pipelineSort,
      pipelineShowClosed,
      followupQueue,
    };
    saveJson(uiPrefsStorageKey, payload);
  }, [
    currentUser,
    uiPrefsStorageKey,
    appView,
    moduleModes,
    focusMode,
    dailyMode,
    leadOptionalColumns,
    quickFilter,
    filterStatus,
    filterSource,
    filterAssignee,
    filterTemp,
    dashboardDateScope,
    dashboardCustomStart,
    dashboardCustomEnd,
    revenueRangePreset,
    revenueCustomStart,
    revenueCustomEnd,
    sourcesRangePreset,
    sourcesCustomStart,
    sourcesCustomEnd,
    pipelineAssigneeFilter,
    pipelineTempFilter,
    pipelineSort,
    pipelineShowClosed,
    followupQueue,
  ]);

  const directPasswordUser = useMemo(
    () => users.find((row) => row.id === directPasswordUserId) ?? null,
    [users, directPasswordUserId],
  );
  const currentTenantId = currentUser?.tenantId ?? DEFAULT_TENANT_ID;
  const currentTenant = useMemo(() => tenants.find((tenant) => tenant.id === currentTenantId) ?? null, [tenants, currentTenantId]);
  const isOwner = currentUser?.role === "owner";
  const isLiteProduct = (currentTenant?.productMode ?? "full") === "lite";
  const canUseExports = currentTenant?.featureExports ?? true;
  const canUseAdvancedForecast = currentTenant?.featureAdvancedForecast ?? true;
  const canUseInvoicing = (currentTenant?.productMode ?? "full") === "full" && (currentTenant?.featureInvoicing ?? true);
  const requiresGstCompliance = currentTenant?.requireGstCompliance ?? true;
  const showPwaInstallPrompt = Boolean(currentUser && deferredInstallPrompt && !pwaInstallDismissed && !isStandalonePwa);

  const invoiceInlineErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (invoiceDraft.supplierPhone.trim() && !isValidPhone(invoiceDraft.supplierPhone)) errors.supplierPhone = "Enter valid phone (8-15 digits).";
    if (invoiceDraft.supplierEmail.trim() && !isValidEmail(invoiceDraft.supplierEmail)) errors.supplierEmail = "Enter valid email format.";
    if (invoiceDraft.supplierPincode.trim() && !isValidPincode(invoiceDraft.supplierPincode)) errors.supplierPincode = "Pincode must be 6 digits.";
    if (invoiceDraft.billedToPhone.trim() && !isValidPhone(invoiceDraft.billedToPhone)) errors.billedToPhone = "Enter valid phone (8-15 digits).";
    if (invoiceDraft.billedToEmail.trim() && !isValidEmail(invoiceDraft.billedToEmail)) errors.billedToEmail = "Enter valid email format.";
    if (invoiceDraft.billedToPincode.trim() && !isValidPincode(invoiceDraft.billedToPincode)) errors.billedToPincode = "Pincode must be 6 digits.";
    if (invoiceDraft.shippingPincode.trim() && !isValidPincode(invoiceDraft.shippingPincode)) errors.shippingPincode = "Pincode must be 6 digits.";
    if (invoiceDraft.bankIfsc.trim() && !isValidIfsc(invoiceDraft.bankIfsc)) errors.bankIfsc = "IFSC format is invalid.";
    if (requiresGstCompliance) {
      if (!invoiceDraft.supplierGstin.trim()) {
        errors.supplierGstin = "Supplier GSTIN is required in strict mode.";
      } else if (!isValidGstin(invoiceDraft.supplierGstin)) {
        errors.supplierGstin = "Supplier GSTIN format is invalid.";
      }
      if (invoiceDraft.buyerGstin.trim() && !isValidGstin(invoiceDraft.buyerGstin)) errors.buyerGstin = "Buyer GSTIN format is invalid.";
      if (!/^\d{2}$/.test(invoiceDraft.placeOfSupplyStateCode.trim())) errors.placeOfSupplyStateCode = "Use 2-digit state code.";
      if (!/^\d{4,8}$/.test(invoiceDraft.sacCode.trim())) errors.sacCode = "SAC/HSN must be 4 to 8 digits.";
    } else {
      if (invoiceDraft.supplierGstin.trim() && !isValidGstin(invoiceDraft.supplierGstin)) errors.supplierGstin = "Supplier GSTIN format is invalid.";
      if (invoiceDraft.buyerGstin.trim() && !isValidGstin(invoiceDraft.buyerGstin)) errors.buyerGstin = "Buyer GSTIN format is invalid.";
      if (invoiceDraft.placeOfSupplyStateCode.trim() && !/^\d{2}$/.test(invoiceDraft.placeOfSupplyStateCode.trim())) errors.placeOfSupplyStateCode = "Use 2-digit state code.";
      if (invoiceDraft.sacCode.trim() && !/^\d{4,8}$/.test(invoiceDraft.sacCode.trim())) errors.sacCode = "SAC/HSN must be 4 to 8 digits.";
    }
    return errors;
  }, [invoiceDraft, requiresGstCompliance]);

  const invoiceIssuerMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!invoiceDraft.supplierName.trim()) missing.push("Legal Name");
    if (!invoiceDraft.supplierAddress.trim()) missing.push("Address");
    if (!invoiceDraft.supplierCity.trim()) missing.push("City");
    if (!invoiceDraft.supplierState.trim()) missing.push("State");
    if (!invoiceDraft.supplierPincode.trim()) missing.push("Pincode");
    if (!invoiceDraft.supplierPhone.trim()) missing.push("Phone");
    if (!invoiceDraft.supplierEmail.trim()) missing.push("Email");
    if (requiresGstCompliance && !invoiceDraft.supplierGstin.trim()) missing.push("Supplier GSTIN");
    return missing;
  }, [invoiceDraft, requiresGstCompliance]);

  const invoiceIssuerProfileReady = invoiceIssuerMissingFields.length === 0;

  useEffect(() => {
    const profile = currentTenant?.invoiceProfile ?? DEFAULT_INVOICE_PROFILE;
    setInvoiceDraft((prev) => ({
      ...prev,
      supplierName: prev.supplierName || profile.legalName,
      supplierAddress: prev.supplierAddress || profile.addressLine,
      supplierCity: prev.supplierCity || profile.city,
      supplierState: prev.supplierState || profile.state,
      supplierPincode: prev.supplierPincode || profile.pincode,
      supplierPhone: prev.supplierPhone || profile.phone,
      supplierEmail: prev.supplierEmail || profile.email,
      supplierStateCode: prev.supplierStateCode || profile.stateCode,
      supplierGstin: prev.supplierGstin || profile.gstin,
      placeOfSupplyStateCode: prev.placeOfSupplyStateCode || profile.stateCode || "33",
    }));
  }, [currentTenant]);
  const activePlanTemplates = useMemo(
    () => planTemplates.filter((template) => template.isActive || template.isSystemPreset),
    [planTemplates],
  );

  useEffect(() => {
    if (newWorkspacePlanChoice === CUSTOM_PLAN_ID) return;
    const template = activePlanTemplates.find((entry) => entry.id === newWorkspacePlanChoice);
    if (!template) return;
    setNewWorkspacePlanName(template.name);
    setNewWorkspaceMaxUsers(template.maxUsers);
    setNewWorkspaceMaxLeads(template.maxLeadsPerMonth);
    setNewWorkspaceGraceDays(template.graceDays);
    setNewWorkspaceAuditRetention(template.auditRetentionDays);
    setNewWorkspaceFeatureExports(template.featureExports);
    setNewWorkspaceFeatureForecast(template.featureAdvancedForecast);
    setNewWorkspaceFeatureInvoicing(template.featureInvoicing);
    setNewWorkspaceRequireGstCompliance(template.requireGstCompliance);
  }, [newWorkspacePlanChoice, activePlanTemplates]);

  useEffect(() => {
    if (newWorkspacePlanChoice === CUSTOM_PLAN_ID) return;
    if (!activePlanTemplates.some((template) => template.id === newWorkspacePlanChoice)) {
      setNewWorkspacePlanChoice(DEFAULT_PLAN_TEMPLATE_ID);
    }
  }, [activePlanTemplates, newWorkspacePlanChoice]);

  useEffect(() => {
    setTenants((prev) =>
      prev.map((tenant) => {
        const matchedTemplate = planTemplates.find(
          (template) => template.name.toLowerCase() === tenant.planName.toLowerCase(),
        );
        const nextTemplateId = matchedTemplate?.id ?? tenant.planTemplateId;
        if (nextTemplateId === tenant.planTemplateId) return tenant;
        return { ...tenant, planTemplateId: nextTemplateId };
      }),
    );
  }, [planTemplates]);

  useEffect(() => {
    if (!currentUser) {
      setSelectedUsersTenantId(DEFAULT_TENANT_ID);
      return;
    }
    if (!isOwner) {
      setSelectedUsersTenantId(currentTenantId);
      return;
    }
    setSelectedUsersTenantId((prev) => (tenants.some((tenant) => tenant.id === prev) ? prev : currentTenantId));
  }, [currentUser, isOwner, tenants, currentTenantId]);

  useEffect(() => {
    if (!currentUser) return;
    setNewUserTenantId(isOwner ? selectedUsersTenantId : currentTenantId);
  }, [currentUser, isOwner, selectedUsersTenantId, currentTenantId]);

  useEffect(() => {
    if (!currentUser) return;
    const mode = (currentTenant?.productMode ?? "full") as ProductMode;
    const allowedBase = getRoleViewsForMode(currentUser.role, mode);
    const allowed = canUseInvoicing ? allowedBase : allowedBase.filter((viewKey) => viewKey !== "invoices");
    if (!allowed.includes(appView)) {
      const nextView = getRoleDefaultViewForMode(currentUser.role, mode);
      setAppView(allowed.includes(nextView) ? nextView : allowed[0]);
    }
  }, [currentUser, currentTenant?.productMode, appView, canUseInvoicing]);

  useEffect(() => {
    if (!guidedExperienceActive) return;
    setDailyMode(true);
    setFocusMode(false);
    setModuleModes((prev) => {
      const alreadyBasic = Object.keys(BASIC_MODULE_MODES).every(
        (key) => prev[key as AppView] === BASIC_MODULE_MODES[key as AppView],
      );
      return alreadyBasic ? prev : BASIC_MODULE_MODES;
    });
  }, [guidedExperienceActive]);

  useEffect(() => {
    if (!currentUser || !isLiteProduct) return;
    setDailyMode(true);
    setFocusMode(false);
    setModuleModes((prev) => ({
      ...prev,
      mywork: "basic",
      leads: "basic",
      followups: "basic",
    }));
  }, [currentUser, isLiteProduct]);

  useEffect(() => {
    if (!currentUser) return;
    const mode = (currentTenant?.productMode ?? "full") as ProductMode;
    setAppView(getRoleDefaultViewForMode(currentUser.role, mode));
  }, [currentUser?.id, currentTenant?.productMode]);

  useEffect(() => {
    if (appView !== "leads") {
      setShowLeadColumnPicker(false);
    }
    setMobileNavOpen(false);
  }, [appView]);

  useEffect(() => {
    if (!currentUser) {
      document.title = "Yugam Consulting | Lead Tracker";
      return;
    }
    document.title = `Yugam Consulting | ${APP_VIEW_LABELS[appView]}`;
  }, [currentUser, appView]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending" && (isOwner || request.tenantId === currentTenantId)),
    [requests, isOwner, currentTenantId],
  );

  const services = useMemo(() => servicesByTenant[currentTenantId] ?? DEFAULT_SERVICES, [servicesByTenant, currentTenantId]);
  const settings = useMemo(
    () => settingsByTenant[currentTenantId] ?? DEFAULT_APP_SETTINGS,
    [settingsByTenant, currentTenantId],
  );
  const pipelineWipLimits = useMemo(
    () => normalizePipelineWipLimits(pipelineWipLimitsByTenant[currentTenantId]),
    [pipelineWipLimitsByTenant, currentTenantId],
  );
  const reminderDispatch = useMemo(
    () => reminderDispatchByTenant[currentTenantId] ?? null,
    [reminderDispatchByTenant, currentTenantId],
  );
  const tenantCollectionsDispatch = useMemo(
    () => collectionsDispatchLogs.filter((entry) => entry.tenantId === currentTenantId),
    [collectionsDispatchLogs, currentTenantId],
  );

  const renewLicenseIfNeeded = (user: UserAccount) => {
    if (!user.autoRenew) return user;
    let end = new Date(user.licenseEndDate);
    while (end.getTime() < Date.now()) {
      end.setFullYear(end.getFullYear() + 1);
    }
    if (end.toISOString() !== user.licenseEndDate) {
      return { ...user, licenseEndDate: end.toISOString() };
    }
    return user;
  };

  useEffect(() => {
    setUsers((prev) => prev.map((u) => renewLicenseIfNeeded(u)));
  }, []);

  const activeUserNames = useMemo(
    () => users.filter((user) => user.isActive && !user.isBreakGlass && (isOwner || user.tenantId === currentTenantId)).map((user) => user.name),
    [users, isOwner, currentTenantId],
  );
  const activeEmployeeNames = useMemo(
    () => employees.filter((employee) => employee.isActive && (isOwner || employee.tenantId === currentTenantId)).map((employee) => employee.name),
    [employees, isOwner, currentTenantId],
  );
  const assigneeOptions = useMemo(() => Array.from(new Set([...activeUserNames, ...activeEmployeeNames])).sort(), [activeUserNames, activeEmployeeNames]);
  const filteredFollowupReassignOptions = useMemo(() => {
    const needle = followupReassignSearch.trim().toLowerCase();
    if (!needle) return assigneeOptions;
    return assigneeOptions.filter((name) => name.toLowerCase().includes(needle));
  }, [assigneeOptions, followupReassignSearch]);

  useEffect(() => {
    if (followupBulkAction !== "reassign") {
      setFollowupReassignPickerOpen(false);
      setFollowupReassignSearch("");
    }
  }, [followupBulkAction]);

  useEffect(() => {
    if (!intake.assignedTo && assigneeOptions.length > 0) {
      setIntake((prev) => ({ ...prev, assignedTo: assigneeOptions[0] }));
    }
  }, [assigneeOptions, intake.assignedTo]);

  const resetMessages = () => {
    setError("");
    setNotice("");
  };

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    try {
      await deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === "accepted") {
        setNotice("App install started. You can now launch it from your home screen.");
      } else {
        setNotice("Install dismissed. You can install later from this prompt.");
      }
    } catch {
      setError("Unable to open install prompt on this device.");
    } finally {
      setDeferredInstallPrompt(null);
    }
  };

  const slugifyWorkspace = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);

  const generateWorkspaceSlug = (workspaceName: string) => {
    const base = slugifyWorkspace(workspaceName) || `workspace-${makeId()}`;
    const existing = new Set(tenants.map((tenant) => tenant.slug));
    if (!existing.has(base)) return base;
    let index = 2;
    let candidate = `${base}-${index}`;
    while (existing.has(candidate)) {
      index += 1;
      candidate = `${base}-${index}`;
    }
    return candidate;
  };

  useEffect(() => {
    if (!isWorkspaceUrlNameManual) {
      setNewWorkspaceSlug(slugifyWorkspace(newWorkspaceName));
    }
  }, [newWorkspaceName, isWorkspaceUrlNameManual]);

  const buildDemoLeads = (tenantId: string, assignee: string): Lead[] => {
    const today = todayISODate();
    const twoDays = shiftISODate(today, 2);
    return [
      {
        id: makeId(),
        tenantId,
        leadName: "Ravi Kumar",
        companyName: "UrbanNest Interiors",
        phoneNumber: "9876543210",
        emailId: "ravi@urbannest.in",
        leadSource: "Website",
        serviceInterested: "SEO",
        leadStatus: "Contacted",
        leadTemperature: "Hot",
        dealValue: 85000,
        expectedClosingDate: shiftISODate(today, 14),
        assignedTo: assignee,
        dateAdded: today,
        nextFollowupDate: today,
        followupStatus: "Pending",
        notes: "Demo lead seeded for trial workspace.",
        lastContactedDate: today,
        wonDate: "",
        wonDealValue: null,
        paymentStatus: "Not Invoiced",
        collectionsOwner: assignee,
        collectedDate: "",
        collectedAmount: null,
        invoiceFlowStatus: "Not Sent",
        invoiceSentDate: "",
        isDuplicate: false,
        lossReason: "",
      },
      {
        id: makeId(),
        tenantId,
        leadName: "Maya D",
        companyName: "Cafe Bloom",
        phoneNumber: "9898989898",
        emailId: "maya@cafebloom.in",
        leadSource: "Referral",
        serviceInterested: "Social Media",
        leadStatus: "Qualified",
        leadTemperature: "Warm",
        dealValue: 42000,
        expectedClosingDate: shiftISODate(today, 10),
        assignedTo: assignee,
        dateAdded: shiftISODate(today, -1),
        nextFollowupDate: twoDays,
        followupStatus: "Pending",
        notes: "Demo qualified lead.",
        lastContactedDate: today,
        wonDate: "",
        wonDealValue: null,
        paymentStatus: "Not Invoiced",
        collectionsOwner: assignee,
        collectedDate: "",
        collectedAmount: null,
        invoiceFlowStatus: "Not Sent",
        invoiceSentDate: "",
        isDuplicate: false,
        lossReason: "",
      },
    ];
  };

  const createTrialWorkspace = async (payload: {
    ownerName: string;
    workspaceName: string;
    email: string;
    password: string;
    seedDemoData?: boolean;
    signupSource?: TrialAccount["signupSource"];
  }) => {
    const start = new Date().toISOString();
    const trialEnd = addDaysFrom(start, DEFAULT_TRIAL_DAYS);
    const tenantId = `tenant-${makeId()}`;
    const slug = generateWorkspaceSlug(payload.workspaceName);
    const ownerHash = await sha256(payload.password);

    const tenant: Tenant = {
      id: tenantId,
      name: payload.workspaceName.trim(),
      slug,
      productMode: "full",
      planTemplateId: SYSTEM_PLAN_TEMPLATE_IDS.growth,
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: trialEnd,
      autoRenew: false,
      isTrial: true,
      trialDays: DEFAULT_TRIAL_DAYS,
      graceDays: 0,
      planName: "Growth Trial",
      maxUsers: PLAN_PRESETS.growth.maxUsers,
      maxLeadsPerMonth: PLAN_PRESETS.growth.maxLeadsPerMonth,
      featureExports: PLAN_PRESETS.growth.featureExports,
      featureAdvancedForecast: PLAN_PRESETS.growth.featureAdvancedForecast,
      featureInvoicing: PLAN_PRESETS.growth.featureInvoicing,
      requireGstCompliance: false,
      invoiceProfile: {
        ...DEFAULT_INVOICE_PROFILE,
        legalName: payload.workspaceName.trim(),
        email: payload.email.trim().toLowerCase(),
      },
      auditRetentionDays: PLAN_PRESETS.growth.auditRetentionDays,
      createdAt: start,
    };

    const ownerUser: UserAccount = {
      id: makeId(),
      tenantId,
      name: payload.ownerName.trim(),
      email: payload.email.trim().toLowerCase(),
      passwordHash: ownerHash,
      role: "owner",
      canAccessPipeline: true,
      canAccessFollowups: true,
      accessScope: "all",
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: trialEnd,
      autoRenew: false,
      mustChangePassword: false,
      createdAt: start,
    };

    const seededLeads = payload.seedDemoData ? buildDemoLeads(tenantId, ownerUser.name) : [];

    setTenants((prev) => [tenant, ...prev]);
    setUsers((prev) => [ownerUser, ...prev]);
    setServicesByTenant((prev) => ({ ...prev, [tenantId]: [...DEFAULT_SERVICES] }));
    setSettingsByTenant((prev) => ({ ...prev, [tenantId]: DEFAULT_APP_SETTINGS }));
    setPipelineWipLimitsByTenant((prev) => ({ ...prev, [tenantId]: normalizePipelineWipLimits(PIPELINE_WIP_LIMITS) }));
    setTenantDrafts((prev) => ({ ...prev, [tenantId]: toTenantDraft(tenant) }));
    setTrialAccounts((prev) => [
      {
        id: makeId(),
        tenantId,
        ownerName: ownerUser.name,
        ownerEmail: ownerUser.email,
        workspaceName: tenant.name,
        signupSource: payload.signupSource ?? "trial-form",
        trialStartAt: start,
        trialEndAt: trialEnd,
        status: "active",
        convertedAt: "",
        lastLoginAt: start,
        createdAt: start,
      },
      ...prev.filter((entry) => entry.tenantId !== tenantId),
    ]);
    if (seededLeads.length > 0) {
      setLeads((prev) => [...seededLeads, ...prev]);
    }
    setSelectedUsersTenantId(tenantId);
    logTenantAction(tenantId, "Trial workspace created", [
      `Workspace: ${tenant.name}`,
      `Trial: ${DEFAULT_TRIAL_DAYS} days`,
      `Owner: ${ownerUser.email}`,
    ]);
    return ownerUser;
  };

  useEffect(() => {
    if (!notice) return;
    toast.success(notice);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const confirmToast = (message: string, confirmText = "Confirm") =>
    new Promise<boolean>((resolve) => {
      const toastId = toast.custom(
        (t) => (
          <div className="max-w-md rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
            <p className="text-sm text-slate-800">{message}</p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-[#788023] px-2.5 py-1 text-xs font-medium text-white"
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
              >
                {confirmText}
              </button>
            </div>
          </div>
        ),
        { duration: 12000 },
      );
      window.setTimeout(() => {
        toast.dismiss(toastId);
        resolve(false);
      }, 12000);
    });

  const toastUndo = (message: string, onUndo: () => void) => {
    toast.custom((t) => (
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
        <span>{message}</span>
        <button
          type="button"
          onClick={() => {
            onUndo();
            toast.dismiss(t.id);
          }}
          className="rounded-md bg-white/20 px-2 py-1 text-xs font-medium"
        >
          Undo
        </button>
      </div>
    ));
  };

  const showWebhookRetryToast = (message: string, hint: string, retry: () => void) => {
    toast.custom((t) => (
      <div className="max-w-md rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-800">{message}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            onClick={() => toast.dismiss(t.id)}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-md bg-[#788023] px-2.5 py-1 text-xs font-medium text-white"
            onClick={() => {
              retry();
              toast.dismiss(t.id);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    ));
  };

  const renewTenantIfNeeded = (tenant: Tenant) => {
    if (!tenant.autoRenew) return tenant;
    let end = new Date(tenant.licenseEndDate);
    while (end.getTime() < Date.now()) {
      end.setFullYear(end.getFullYear() + 1);
    }
    if (end.toISOString() !== tenant.licenseEndDate) {
      return { ...tenant, licenseEndDate: end.toISOString() };
    }
    return tenant;
  };

  const isExpired = (user: UserAccount) => new Date(user.licenseEndDate).getTime() < Date.now();
  const isWorkspaceBlocked = (tenant: Tenant | null) => !tenant || tenantLifecycle(tenant).isBlocked;

  useEffect(() => {
    setTenants((prev) =>
      prev.map((tenant) => {
        const renewed = renewTenantIfNeeded(tenant);
        const lifecycle = tenantLifecycle(renewed);
        if (renewed.isActive && lifecycle.status === "Expired") {
          return { ...renewed, isActive: false };
        }
        return renewed;
      }),
    );
  }, []);

  useEffect(() => {
    const syncTrialLifecycle = () => {
      setTenants((prev) =>
        prev.map((tenant) => {
          const renewed = renewTenantIfNeeded(tenant);
          const lifecycle = tenantLifecycle(renewed);
          if (renewed.isActive && lifecycle.status === "Expired") {
            return { ...renewed, isActive: false };
          }
          return renewed;
        }),
      );
    };
    const timer = window.setInterval(syncTrialLifecycle, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTrialAccounts((prev) => {
      let changed = false;
      const next: TrialAccount[] = prev.map((entry) => {
        const tenant = tenants.find((row) => row.id === entry.tenantId);
        if (!tenant) return entry;
        if (!tenant.isTrial && entry.status !== "converted") {
          changed = true;
          return {
            ...entry,
            status: "converted" as const,
            convertedAt: entry.convertedAt || new Date().toISOString(),
          };
        }
        const lifecycle = tenantLifecycle(tenant);
        if (tenant.isTrial && lifecycle.status === "Expired" && entry.status === "active") {
          changed = true;
          return {
            ...entry,
            status: "expired" as const,
          };
        }
        return entry;
      });
      return changed ? next : prev;
    });
  }, [tenants]);

  useEffect(() => {
    let cancelled = false;
    const ensureDefaultOwnerAccess = async () => {
      const ownerHash = await sha256(DEFAULT_OWNER_PASSWORD);
      if (cancelled) return;

      setTenants((prev) => {
        const existing = prev.find((tenant) => tenant.id === DEFAULT_TENANT_ID);
        if (!existing) {
          return [defaultTenant, ...prev];
        }
        const renewed = renewTenantIfNeeded(existing);
        const lifecycle = tenantLifecycle(renewed);
        const patched = {
          ...renewed,
          isActive: true,
          autoRenew: true,
          licenseEndDate: lifecycle.status === "Expired" ? oneYearFrom(new Date().toISOString()) : renewed.licenseEndDate,
        };
        return prev.map((tenant) => (tenant.id === DEFAULT_TENANT_ID ? patched : tenant));
      });

      setUsers((prev) => {
        const owner = prev.find((user) => user.email.toLowerCase() === DEFAULT_OWNER_EMAIL.toLowerCase());
        if (!owner) {
          const createdAt = new Date().toISOString();
          return [
            {
              id: "admin-1",
              tenantId: DEFAULT_TENANT_ID,
              name: "Admin",
              email: DEFAULT_OWNER_EMAIL,
              passwordHash: ownerHash,
              role: "owner",
              canAccessPipeline: true,
              canAccessFollowups: true,
              accessScope: "all",
              isActive: true,
              licenseStartDate: createdAt,
              licenseEndDate: oneYearFrom(createdAt),
              autoRenew: true,
              mustChangePassword: false,
              createdAt,
            },
            ...prev,
          ];
        }

        const refreshedEndDate =
          new Date(owner.licenseEndDate).getTime() < Date.now() ? oneYearFrom(new Date().toISOString()) : owner.licenseEndDate;

        return prev.map((user) =>
          user.id === owner.id
            ? {
                ...user,
                tenantId: DEFAULT_TENANT_ID,
                role: "owner",
                canAccessPipeline: true,
                canAccessFollowups: true,
                accessScope: "all",
                isActive: true,
                autoRenew: true,
                mustChangePassword: false,
                licenseEndDate: refreshedEndDate,
                passwordHash: ownerHash,
                password: undefined,
              }
            : user,
        );
      });
    };

    ensureDefaultOwnerAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const verifyPassword = async (user: UserAccount, inputPassword: string) => {
    if (user.passwordHash) {
      const hash = await sha256(inputPassword);
      return hash === user.passwordHash;
    }
    return user.password === inputPassword;
  };

  const maybeMigratePassword = async (user: UserAccount, plainPassword: string) => {
    if (user.passwordHash) return;
    const hash = await sha256(plainPassword);
    setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, passwordHash: hash, password: undefined } : row)));
  };

  const sendResetCodeEmail = async (email: string, code: string, tenantName: string) => {
    const webhook = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_RESET_EMAIL_WEBHOOK_URL;
    if (!webhook) return false;
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, tenantName }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const issueResetForUser = async (user: UserAccount, triggeredByAdmin = false) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    setResetCodes((prev) => [
      { id: makeId(), tenantId: user.tenantId, email: user.email.toLowerCase(), code, expiresAt },
      ...prev.filter((row) => row.email !== user.email.toLowerCase() || !!row.usedAt),
    ]);
    if (triggeredByAdmin) {
      setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, mustChangePassword: true } : row)));
    }
    const tenant = tenants.find((row) => row.id === user.tenantId);
    const mailed = await sendResetCodeEmail(user.email, code, tenant?.name ?? "Yugam Consulting");
    setGeneratedCode(mailed ? "" : code);
    setNotice(
      mailed
        ? `Reset code sent to ${user.email}.`
        : `Demo mode: reset code for ${user.email} is ${code}. Configure webhook for real emails.`,
    );
  };

  const setUserPasswordDirectly = (user: UserAccount) => {
    resetMessages();
    if (!isOwner) {
      setError("Only owner can set passwords directly.");
      return;
    }
    if (user.isBreakGlass) {
      setError("Break-glass owner password must be rotated from Recovery Safeguards.");
      return;
    }
    setDirectPasswordUserId(user.id);
    setDirectPasswordDraft("");
    setDirectPasswordConfirmDraft("");
  };

  const submitDirectPasswordChange = async () => {
    resetMessages();
    if (!directPasswordUserId) return;
    const user = users.find((row) => row.id === directPasswordUserId);
    if (!user) {
      setError("Selected user was not found.");
      return;
    }
    if (directPasswordDraft.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (directPasswordDraft !== directPasswordConfirmDraft) {
      setError("Password confirmation does not match.");
      return;
    }
    const hash = await sha256(directPasswordDraft);
    setUsers((prev) =>
      prev.map((row) =>
        row.id === directPasswordUserId
          ? { ...row, passwordHash: hash, password: undefined, mustChangePassword: false }
          : row,
      ),
    );
    setResetCodes((prev) => prev.filter((row) => row.email !== user.email.toLowerCase() || !!row.usedAt));
    setNotice(`Password updated for ${user.email}.`);
    setDirectPasswordUserId(null);
    setDirectPasswordDraft("");
    setDirectPasswordConfirmDraft("");
  };

  const completeLogin = (user: UserAccount) => {
    if (!user.isActive) {
      setError("This login is disabled. Please contact admin.");
      return false;
    }
    if (user.mustChangePassword) {
      setFpEmail(user.email);
      setView("forgot");
      setError("Password reset required by admin. Enter your email, reset code, and a new password.");
      return false;
    }
    const renewed = renewLicenseIfNeeded(user);
    if (renewed.licenseEndDate !== user.licenseEndDate) {
      setUsers((prev) => prev.map((row) => (row.id === user.id ? renewed : row)));
    }
    const workspace = tenants.find((tenant) => tenant.id === renewed.tenantId) ?? null;
    const renewedWorkspace = workspace ? renewTenantIfNeeded(workspace) : null;
    if (workspace && renewedWorkspace && renewedWorkspace.licenseEndDate !== workspace.licenseEndDate) {
      setTenants((prev) => prev.map((tenant) => (tenant.id === workspace.id ? renewedWorkspace : tenant)));
    }
    if (isWorkspaceBlocked(renewedWorkspace ?? workspace)) {
      const lifecycle = renewedWorkspace ?? workspace;
      if (lifecycle?.isTrial) {
        setError("Trial expired. Contact Yugam Consulting to upgrade to a paid plan.");
      } else {
        setError("Workspace license expired. Please contact Yugam Consulting.");
      }
      return false;
    }
    if (isExpired(renewed)) {
      setError("License expired for this login. Please contact admin.");
      return false;
    }
    const loginTime = new Date().toISOString();
    if ((renewedWorkspace ?? workspace)?.isTrial) {
      setTrialAccounts((prev) =>
        prev.map((entry) =>
          entry.tenantId === renewed.tenantId
            ? {
                ...entry,
                lastLoginAt: loginTime,
                status: entry.status === "converted" ? "converted" : "active",
              }
            : entry,
        ),
      );
    }
    setSessionUserId(renewed.id);
    let nextLoginCount = 1;
    setUserOnboarding((prev) => {
      const now = new Date().toISOString();
      const existing = prev[renewed.id];
      nextLoginCount = (existing?.loginCount ?? 0) + 1;
      return {
        ...prev,
        [renewed.id]: {
          loginCount: nextLoginCount,
          firstLoginAt: existing?.firstLoginAt ?? now,
          lastLoginAt: now,
          dismissedAt: existing?.dismissedAt ?? "",
        },
      };
    });
    if (nextLoginCount <= GUIDED_SESSIONS_LIMIT) {
      setModuleModes(BASIC_MODULE_MODES);
      setDailyMode(true);
      setFocusMode(false);
    }
    setAppView(getRoleDefaultViewForMode(renewed.role, (renewedWorkspace ?? workspace)?.productMode ?? "full"));
    setLoginPassword("");
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const email = loginEmail.trim().toLowerCase();
    const found = users.find((u) => u.email.toLowerCase() === email);
    if (!found) {
      setError("Invalid email or password.");
      return;
    }
    const passwordOk = await verifyPassword(found, loginPassword);
    if (!passwordOk) {
      setError("Invalid email or password.");
      return;
    }
    await maybeMigratePassword(found, loginPassword);
    completeLogin(found);
  };

  const startTrialSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const ownerName = trialName.trim();
    const workspaceName = trialWorkspace.trim();
    const email = trialEmail.trim().toLowerCase();
    if (!ownerName || !workspaceName || !email || !trialPassword.trim()) {
      setError("Name, workspace name, email, and password are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address for trial signup.");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      setError("This email is already registered. Please log in or reset password.");
      return;
    }
    const ownerUser = await createTrialWorkspace({
      ownerName,
      workspaceName,
      email,
      password: trialPassword,
      seedDemoData: trialSeedDemoData,
      signupSource: "trial-form",
    });
    setTrialName("");
    setTrialWorkspace("");
    setTrialEmail("");
    setTrialPassword("");
    setTrialSeedDemoData(true);
    setNotice(`Trial workspace created. ${DEFAULT_TRIAL_DAYS}-day access activated.`);
    completeLogin(ownerUser);
  };

  const handleGoogleSignIn = async (response: CredentialResponse) => {
    resetMessages();
    if (!response.credential) {
      setError("Google sign-in did not return a credential.");
      return;
    }
    let payload: GoogleJwtPayload;
    try {
      payload = jwtDecode<GoogleJwtPayload>(response.credential);
    } catch {
      setError("Unable to decode Google credential.");
      return;
    }
    const email = payload.email?.trim().toLowerCase() ?? "";
    const name = payload.name?.trim() || email.split("@")[0] || "Google User";
    if (!email) {
      setError("Google account email was not available.");
      return;
    }
    const existing = users.find((user) => user.email.toLowerCase() === email);
    if (existing) {
      const ok = completeLogin(existing);
      if (ok) setNotice("Signed in with Google.");
      return;
    }
    const ownerUser = await createTrialWorkspace({
      ownerName: name,
      workspaceName: `${name.split(" ")[0]} Workspace`,
      email,
      password: `google-${makeId()}-${Date.now()}`,
      seedDemoData: true,
      signupSource: "google",
    });
    setNotice(`New trial workspace created via Google. ${DEFAULT_TRIAL_DAYS}-day access activated.`);
    completeLogin(ownerUser);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const email = regEmail.trim().toLowerCase();
    if (!regName.trim() || !email || !regPassword.trim()) {
      setError("Name, email and password are required.");
      return;
    }
    const existsUser = users.some((u) => u.email.toLowerCase() === email);
    const existsRequest = requests.some((r) => r.email.toLowerCase() === email && r.status === "pending");
    if (existsUser || existsRequest) {
      setError("This email is already registered or pending approval.");
      return;
    }
    const passwordHash = await sha256(regPassword);
    setRequests((prev) => [
      {
        id: makeId(),
        tenantId: DEFAULT_TENANT_ID,
        name: regName.trim(),
        email,
        passwordHash,
        requestedAt: new Date().toISOString(),
        status: "pending",
      },
      ...prev,
    ]);
    setRegName("");
    setRegEmail("");
    setRegPassword("");
    setNotice("Registration submitted. Admin approval is required before login.");
    setView("login");
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const email = fpEmail.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === email && u.isActive);
    if (!user) {
      setError("No active account found for this email.");
      return;
    }
    await issueResetForUser(user);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const email = fpEmail.trim().toLowerCase();
    const record = resetCodes.find(
      (r) => r.email === email && r.code === fpCode.trim() && !r.usedAt && new Date(r.expiresAt).getTime() > Date.now(),
    );
    if (!record) {
      setError("Invalid or expired reset code.");
      return;
    }
    if (!fpPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }
    const newHash = await sha256(fpPassword);
    setUsers((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === email ? { ...u, passwordHash: newHash, password: undefined, mustChangePassword: false } : u,
      ),
    );
    setResetCodes((prev) => prev.map((r) => (r.id === record.id ? { ...r, usedAt: new Date().toISOString() } : r)));
    setFpCode("");
    setFpPassword("");
    setGeneratedCode("");
    setNotice("Password updated successfully. You can now log in.");
    setView("login");
  };

  const approveRequest = (request: RegistrationRequest) => {
    const start = new Date().toISOString();
    const workflowAccess = normalizeWorkflowAccess("sales", "sales", true, true);
    const newUser: UserAccount = {
      id: makeId(),
      tenantId: request.tenantId,
      name: request.name,
      email: request.email,
      passwordHash: request.passwordHash,
      role: "sales",
      staffProfile: "sales",
      canAccessPipeline: workflowAccess.canAccessPipeline,
      canAccessFollowups: workflowAccess.canAccessFollowups,
      accessScope: "assigned",
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: oneYearFrom(start),
      autoRenew: true,
      mustChangePassword: false,
      createdAt: start,
    };
    setUsers((prev) => [newUser, ...prev]);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: "approved" } : r)));
  };

  const logout = () => {
    setSessionUserId(null);
    setView("login");
    setGeneratedCode("");
  };

  const canViewLeads = !!currentUser && currentUser.accessScope !== "none";
  const canEditAll = !!currentUser && (currentUser.role === "owner" || currentUser.role === "admin" || currentUser.accessScope === "all");
  const tenantProductMode = (currentTenant?.productMode ?? "full") as ProductMode;
  const currentStaffProfile = resolveStaffProfile(currentUser);
  const allowedViews = currentUser
    ? (() => {
      const roleViews = getRoleViewsForMode(currentUser.role, tenantProductMode).filter((viewKey) => (canUseInvoicing ? true : viewKey !== "invoices"));
      if (currentUser.role !== "sales") return roleViews;
      const profileScopedViews = applySalesStaffProfileViews(roleViews, currentStaffProfile, tenantProductMode);
      return applyMemberWorkflowOverrides(profileScopedViews, {
        role: currentUser.role,
        canAccessPipeline: currentUser.canAccessPipeline,
        canAccessFollowups: currentUser.canAccessFollowups,
      });
    })()
    : [];
  const canCreateLeads = !!currentUser && (currentUser.role !== "sales" || ["sales", "operations"].includes(currentStaffProfile));
  const canCreateInvoices = !!currentUser
    && canUseInvoicing
    && (currentUser.role !== "sales" || ["sales"].includes(currentStaffProfile));
  const canAccessInvoicesView = allowedViews.includes("invoices");
  const requiresLeadAccessForView = ["mywork", "leads", "pipeline", "followups", "revenue", "sources"].includes(appView);
  const compactPrimaryViews: AppView[] = isLiteProduct
    ? ["mywork", "leads", "followups"]
    : ["mywork", "dashboard", "leads", "pipeline", "followups", "revenue"];
  const dailyPrimaryViews: AppView[] = isLiteProduct
    ? ["mywork", "followups", "leads"]
    : ["mywork", "followups", "leads", "pipeline"];
  const primaryNavViews = currentUser?.role === "sales" ? allowedViews : allowedViews.filter((viewKey) => compactPrimaryViews.includes(viewKey));
  const displayPrimaryNavViews = dailyMode
    ? (primaryNavViews.filter((viewKey) => dailyPrimaryViews.includes(viewKey)).length > 0
      ? primaryNavViews.filter((viewKey) => dailyPrimaryViews.includes(viewKey))
      : primaryNavViews)
    : primaryNavViews;
  const secondaryNavViews = currentUser?.role === "sales" ? [] : allowedViews.filter((viewKey) => !compactPrimaryViews.includes(viewKey));
  const activeModuleMode = moduleModes[appView] ?? "advanced";
  const isBasicMode = activeModuleMode === "basic";
  const isFocusView = focusMode && (appView === "dashboard" || appView === "revenue" || appView === "sources" || appView === "invoices");
  const googleClientConfigured = Boolean((((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID) ?? "").trim());
  const dashboardCompactMode = isBasicMode || isFocusView || dailyMode;
  const revenueCompactMode = isBasicMode || isFocusView || dailyMode;
  const sourcesCompactMode = isBasicMode || isFocusView || dailyMode;
  const invoicesCompactMode = isBasicMode || isFocusView || dailyMode;
  const canShowPipelineAdvanced = !isBasicMode && !dailyMode && pipelineShowAdvancedControls;
  const canShowFollowupAdvanced = !isBasicMode && !dailyMode && followupShowAdvancedControls;
  const leadOptionalColumnSet = new Set(leadOptionalColumns);
  const activeViewLabel = APP_VIEW_LABELS[appView];
  const toggleActiveModuleMode = () => {
    setModuleModes((prev) => ({
      ...prev,
      [appView]: prev[appView] === "basic" ? "advanced" : "basic",
    }));
  };
  const dismissGuidedExperience = () => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setUserOnboarding((prev) => ({
      ...prev,
      [currentUser.id]: {
        loginCount: prev[currentUser.id]?.loginCount ?? 1,
        firstLoginAt: prev[currentUser.id]?.firstLoginAt ?? now,
        lastLoginAt: prev[currentUser.id]?.lastLoginAt ?? now,
        dismissedAt: now,
      },
    }));
  };
  const runChecklistStep = (stepKey: string) => {
    if (stepKey === "assignee") {
      setAppView("users");
      setUsersTab("tenant-users");
      return;
    }
    if (stepKey === "lead") {
      setAppView("leads");
      openLeadIntakeModal();
      return;
    }
    if (stepKey === "followup") {
      setAppView("followups");
      setFollowupQueue("today");
      return;
    }
    if (stepKey === "won") {
      setAppView(isLiteProduct ? "followups" : "pipeline");
      return;
    }
    if (stepKey === "invoice") {
      if (canUseInvoicing) setAppView("invoices");
      return;
    }
    if (stepKey === "contacted") {
      setAppView("leads");
      return;
    }
    if (stepKey === "done") {
      setFollowupQueue("today");
      setAppView("followups");
    }
  };
  const getContextFilterSummary = () => {
    const usersTabLabelMap: Record<UsersTab, string> = {
      licensees: "Client Accounts",
      "tenant-users": "Team & Settings",
      "platform-controls": "System Settings",
    };
    if (!currentUser) return "-";
    if (isLiteProduct) {
      if (appView === "mywork") return "Today priorities";
      if (appView === "leads") return `Status:${filterStatus} | Assignee:${filterAssignee}`;
      if (appView === "followups") return `Queue:${followupQueue} | Assignee:${followupAssigneeFilter}`;
      if (appView === "users") return `Tab:${usersTabLabelMap[usersTab]} | Client:${usersContextTenant?.name ?? "-"}`;
      return "Follow-up Lite";
    }
    if (appView === "mywork") return "My queue for today";
    if (appView === "dashboard") return `Date: ${metrics.scopeLabel}`;
    if (appView === "leads") return `Q:${quickFilter} | Status:${filterStatus} | Source:${filterSource} | Assignee:${filterAssignee} | Temp:${filterTemp}`;
    if (appView === "pipeline") return `Assignee:${pipelineAssigneeFilter} | Temp:${pipelineTempFilter} | Sort:${pipelineSort}`;
    if (appView === "followups") return `Queue:${followupQueue} | Assignee:${followupAssigneeFilter} | Stage:${followupStageFilter}`;
    if (appView === "revenue") return `Range:${revenueAnalytics.scopeLabel} | Assignee:${revenueAssigneeFilter} | Source:${revenueSourceFilter} | Service:${revenueServiceFilter}`;
    if (appView === "sources") return `Range:${sourcesRangePreset === "custom" ? `${sourcesCustomStart || "-"} to ${sourcesCustomEnd || "-"}` : `${sourcesRangePreset}M`}`;
    if (appView === "invoices") return `Range:${invoiceScopeLabel} | Client:${invoiceClientFilter} | Lead:${invoiceLeadFilter} | Status:${invoiceStatusFilter}`;
    if (appView === "users") return `Tab:${usersTabLabelMap[usersTab]} | Client:${usersContextTenant?.name ?? "-"}`;
    return "-";
  };
  const getContextDateSummary = () => {
    if (appView === "mywork") return "Today";
    if (appView === "dashboard") return metrics.scopeLabel;
    if (appView === "revenue") return revenueAnalytics.scopeLabel;
    if (appView === "sources") {
      if (sourcesRangePreset === "custom") return `${sourcesCustomStart || "-"} to ${sourcesCustomEnd || "-"}`;
      return sourcesRangePreset === "1" ? "Last 1 month" : `Last ${sourcesRangePreset} months`;
    }
    return "Live";
  };

  const visibleLeads = useMemo(() => {
    if (!currentUser) return [] as Lead[];
    const tenantScoped = (currentUser.role === "owner" ? leads : leads.filter((lead) => lead.tenantId === currentUser.tenantId))
      .filter((lead) => !lead.deletedAt);
    if (currentUser.role === "owner" || currentUser.role === "admin" || currentUser.accessScope === "all") return tenantScoped;
    if (currentUser.accessScope === "assigned") return tenantScoped.filter((l) => l.assignedTo === currentUser.name);
    return [] as Lead[];
  }, [currentUser, leads]);

  const deletedVisibleLeads = useMemo(() => {
    if (!currentUser) return [] as Lead[];
    const tenantScoped = currentUser.role === "owner"
      ? leads.filter((lead) => !!lead.deletedAt)
      : leads.filter((lead) => lead.tenantId === currentUser.tenantId && !!lead.deletedAt);
    if (currentUser.role === "owner" || currentUser.role === "admin" || currentUser.accessScope === "all") return tenantScoped;
    if (currentUser.accessScope === "assigned") return tenantScoped.filter((lead) => lead.assignedTo === currentUser.name);
    return [] as Lead[];
  }, [currentUser, leads]);

  const recycleBinLeadsWithExpiry = useMemo(() => {
    return deletedVisibleLeads.map((lead) => {
      const daysDeleted = lead.deletedAt ? daysSince(lead.deletedAt) : 0;
      const daysLeft = Math.max(0, LEAD_RECYCLE_RETENTION_DAYS - daysDeleted);
      const isExpired = daysDeleted >= LEAD_RECYCLE_RETENTION_DAYS;
      return { lead, daysDeleted, daysLeft, isExpired };
    });
  }, [deletedVisibleLeads]);

  const [recycleBinFilter, setRecycleBinFilter] = useState<"all" | "expiring" | "expired">("all");

  const recycleBinRows = useMemo(() => {
    if (recycleBinFilter === "expiring") {
      return recycleBinLeadsWithExpiry.filter((row) => !row.isExpired && row.daysLeft <= 7);
    }
    if (recycleBinFilter === "expired") {
      return recycleBinLeadsWithExpiry.filter((row) => row.isExpired);
    }
    return recycleBinLeadsWithExpiry;
  }, [recycleBinFilter, recycleBinLeadsWithExpiry]);

  const expiredDeletedCount = useMemo(
    () => recycleBinLeadsWithExpiry.filter((row) => row.isExpired).length,
    [recycleBinLeadsWithExpiry],
  );

  const expiringDeletedCount = useMemo(
    () => recycleBinLeadsWithExpiry.filter((row) => !row.isExpired && row.daysLeft <= 7).length,
    [recycleBinLeadsWithExpiry],
  );

  const visibleLeadIdSet = useMemo(() => new Set(visibleLeads.map((lead) => lead.id)), [visibleLeads]);

  const visibleInvoices = useMemo(() => {
    if (!currentUser) return [] as Invoice[];
    const tenantScoped = currentUser.role === "owner" ? invoices : invoices.filter((invoice) => invoice.tenantId === currentUser.tenantId);
    if (currentUser.role === "sales" && resolveStaffProfile(currentUser) === "collections") {
      return tenantScoped;
    }
    return tenantScoped.filter((invoice) => visibleLeadIdSet.has(invoice.leadId));
  }, [currentUser, invoices, visibleLeadIdSet]);

  const tenantManagerById = useMemo(() => {
    const managerMap = new Map<string, string>();
    tenants.forEach((tenant) => {
      const owner = users.find((user) => user.tenantId === tenant.id && user.isActive && !user.isBreakGlass && user.role === "owner");
      const admin = users.find((user) => user.tenantId === tenant.id && user.isActive && !user.isBreakGlass && user.role === "admin");
      managerMap.set(tenant.id, owner?.name || admin?.name || "");
    });
    return managerMap;
  }, [tenants, users]);

  useEffect(() => {
    if (!currentUser) return;
    if (!settings.slaEscalationDays || settings.slaEscalationDays < 1) return;
    const escalated: Array<{ leadId: string; from: string; to: string }> = [];
    setLeads((prev) => {
      let changed = false;
      const next = prev.map((lead) => {
        if (lead.tenantId !== currentTenantId) return lead;
        if (!isOpenLeadStatus(lead.leadStatus)) return lead;
        const manager = tenantManagerById.get(lead.tenantId) || "";
        if (!manager || manager === lead.assignedTo) return lead;
        const ageDays = neglectDays(lead);
        if (ageDays < settings.slaEscalationDays) return lead;
        changed = true;
        escalated.push({ leadId: lead.id, from: lead.assignedTo || "Unassigned", to: manager });
        return { ...lead, assignedTo: manager };
      });
      return changed ? next : prev;
    });
    if (escalated.length > 0) {
      const now = new Date().toISOString();
      setActivities((prev) => [
        ...escalated.map((item) => ({
          id: makeId(),
          tenantId: currentTenantId,
          leadId: item.leadId,
          actor: "SLA Automation",
          action: "Lead escalated to manager",
          changes: [`Assigned To: ${item.from} -> ${item.to}`],
          createdAt: now,
        })),
        ...prev,
      ]);
      setNotice(`${escalated.length} neglected lead(s) escalated to manager.`);
    }
  }, [currentUser, currentTenantId, settings.slaEscalationDays, tenantManagerById, visibleLeads]);

  const dispatchReminderDigest = async (mode: "auto" | "manual") => {
    if (isSendingReminder) return;
    setIsSendingReminder(true);
    const webhook = (((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_REMINDER_WEBHOOK_URL) as string | undefined) ?? "";
    if (!webhook) {
      if (mode === "manual") {
        showWebhookRetryToast(
          "Reminder webhook is not configured.",
          "Set VITE_REMINDER_WEBHOOK_URL to dispatch reminders externally.",
          () => { void dispatchReminderDigest("manual"); },
        );
      }
      setIsSendingReminder(false);
      return;
    }
    const today = todayISODate();
    const bucket = visibleLeads.filter(
      (lead) => lead.followupStatus === "Pending" && (lead.nextFollowupDate === today || (lead.nextFollowupDate && lead.nextFollowupDate < today)),
    );
    if (bucket.length === 0) {
      if (mode === "manual") setNotice("No overdue or due-today follow-ups to dispatch.");
      setIsSendingReminder(false);
      return;
    }
    const startStamp = new Date().toISOString();
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenantId,
          date: today,
          mode,
          leads: bucket.map((lead) => ({
            leadId: lead.id,
            leadName: lead.leadName,
            companyName: lead.companyName,
            assignedTo: lead.assignedTo,
            nextFollowupDate: lead.nextFollowupDate,
            tag: dateTag(lead),
          })),
        }),
      });
      if (!response.ok) throw new Error("Webhook dispatch failed");
      const successAt = new Date().toISOString();
      setReminderDispatchByTenant((prev) => ({
        ...prev,
        [currentTenantId]: {
          tenantId: currentTenantId,
          status: "success",
          lastAttemptAt: successAt,
          lastSuccessAt: successAt,
          lastError: "",
          pendingCount: bucket.length,
          mode,
        },
      }));
      saveText(`sales-lead-tracker:v2:reminder-sync:${currentTenantId}:${today}`, "sent");
      if (mode === "manual") setNotice(`Reminder digest sent for ${bucket.length} follow-ups.`);
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Reminder dispatch failed";
      setReminderDispatchByTenant((prev) => ({
        ...prev,
        [currentTenantId]: {
          tenantId: currentTenantId,
          status: "failed",
          lastAttemptAt: startStamp,
          lastSuccessAt: prev[currentTenantId]?.lastSuccessAt ?? "",
          lastError: message,
          pendingCount: bucket.length,
          mode,
        },
      }));
      if (mode === "manual") {
        showWebhookRetryToast(
          message,
          "Check reminder webhook URL, authentication, and payload handling before retrying.",
          () => { void dispatchReminderDigest("manual"); },
        );
      }
    } finally {
      setIsSendingReminder(false);
    }
  };

  useEffect(() => {
    if (!settings.reminderWebhookEnabled) return;
    const today = todayISODate();
    const key = `sales-lead-tracker:v2:reminder-sync:${currentTenantId}:${today}`;
    if (loadText(key) === "sent") return;
    void dispatchReminderDigest("auto");
  }, [settings.reminderWebhookEnabled, currentTenantId, visibleLeads]);

  useEffect(() => {
    if (!settings.deliverySyncEnabled) return;
    const today = todayISODate();
    const key = `sales-lead-tracker:v2:collections-delivery-sync:${currentTenantId}:${today}`;
    if (loadText(key) === "sent") return;
    void syncCollectionsDeliveryStatus("auto").then(() => {
      saveText(key, "sent");
    });
  }, [settings.deliverySyncEnabled, currentTenantId, tenantCollectionsDispatch.length]);

  const invoiceEligibleLeads = useMemo(
    () => (canUseInvoicing ? visibleLeads.filter((lead) => INVOICE_ELIGIBLE_STATUSES.includes(lead.leadStatus)) : []),
    [visibleLeads, canUseInvoicing],
  );

  const invoiceDraftLead = useMemo(
    () => invoiceEligibleLeads.find((lead) => lead.id === invoiceDraft.leadId) ?? null,
    [invoiceEligibleLeads, invoiceDraft.leadId],
  );

  const invoiceDraftTenantId = invoiceDraftLead?.tenantId ?? currentTenantId;

  const customerProfilesForDraftTenant = useMemo(
    () => customerProfiles
      .filter((profile) => profile.tenantId === invoiceDraftTenantId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.profileName.localeCompare(b.profileName)),
    [customerProfiles, invoiceDraftTenantId],
  );

  useEffect(() => {
    if (currentUser?.role !== "owner") {
      setClientMasterTenantId(currentTenantId);
      return;
    }
    if (!tenants.some((tenant) => tenant.id === clientMasterTenantId)) {
      setClientMasterTenantId(currentTenantId);
    }
  }, [currentUser?.role, currentTenantId, clientMasterTenantId, tenants]);

  const clientMasterProfiles = useMemo(() => {
    const scoped = customerProfiles
      .filter((profile) => profile.tenantId === clientMasterTenantId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const query = debouncedClientMasterSearch.trim().toLowerCase();
    if (!query) return scoped;
    return scoped.filter((profile) => {
      const haystack = [
        profile.profileName,
        profile.companyName,
        profile.contactName,
        profile.email,
        profile.phone,
        profile.buyerGstin,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [customerProfiles, clientMasterTenantId, debouncedClientMasterSearch]);

  const clientMasterDuplicateGroups = useMemo(() => {
    const map = new Map<string, CustomerProfile[]>();
    customerProfiles
      .filter((profile) => profile.tenantId === clientMasterTenantId)
      .forEach((profile) => {
        const companyKey = profile.companyName.trim().toLowerCase();
        if (!companyKey) return;
        const emailKey = profile.email.trim().toLowerCase();
        const phoneKey = normalizedPhone(profile.phone);
        const key = emailKey ? `${companyKey}::email::${emailKey}` : phoneKey ? `${companyKey}::phone::${phoneKey}` : "";
        if (!key) return;
        const bucket = map.get(key) ?? [];
        bucket.push(profile);
        map.set(key, bucket);
      });
    return Array.from(map.values())
      .filter((group) => group.length > 1)
      .map((group) => group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, [customerProfiles, clientMasterTenantId]);

  const mergeCustomerProfileGroup = (profiles: CustomerProfile[]) => {
    if (profiles.length < 2) return;
    const [primary, ...others] = profiles;
    const merged = others.reduce(
      (acc, profile) => ({
        ...acc,
        profileName: acc.profileName || profile.profileName,
        companyName: acc.companyName || profile.companyName,
        contactName: acc.contactName || profile.contactName,
        email: acc.email || profile.email,
        phone: acc.phone || profile.phone,
        billingAddress: acc.billingAddress || profile.billingAddress,
        billingCity: acc.billingCity || profile.billingCity,
        billingState: acc.billingState || profile.billingState,
        billingPincode: acc.billingPincode || profile.billingPincode,
        shippingAddress: acc.shippingAddress || profile.shippingAddress,
        shippingCity: acc.shippingCity || profile.shippingCity,
        shippingState: acc.shippingState || profile.shippingState,
        shippingPincode: acc.shippingPincode || profile.shippingPincode,
        buyerGstin: acc.buyerGstin || profile.buyerGstin,
        paymentTermsDays: acc.paymentTermsDays || profile.paymentTermsDays,
        poNumber: acc.poNumber || profile.poNumber,
        bankBeneficiaryName: acc.bankBeneficiaryName || profile.bankBeneficiaryName,
        bankName: acc.bankName || profile.bankName,
        bankAccountNumber: acc.bankAccountNumber || profile.bankAccountNumber,
        bankIfsc: acc.bankIfsc || profile.bankIfsc,
        isDefault: acc.isDefault || profile.isDefault,
      }),
      { ...primary },
    );
    const deleteIdSet = new Set(others.map((profile) => profile.id));
    setCustomerProfiles((prev) =>
      prev
        .filter((profile) => !deleteIdSet.has(profile.id))
        .map((profile) =>
          profile.id === primary.id
            ? {
                ...profile,
                ...merged,
                updatedAt: new Date().toISOString(),
              }
            : profile,
        ),
    );
    setNotice(`Merged ${profiles.length} duplicate profiles for ${primary.companyName}.`);
  };

  const importCustomerProfilesCsv = () => {
    const rows = parseCsvRows(clientMasterImportCsv);
    if (rows.length < 2) {
      setError("Add CSV content with header row and at least one data row.");
      return;
    }
    const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = rows[0].map(normalizeHeader);
    const at = (row: string[], names: string[]) => {
      const index = headers.findIndex((header) => names.includes(header));
      return index >= 0 ? (row[index] ?? "").trim() : "";
    };
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    setCustomerProfiles((prev) => {
      const next = [...prev];
      rows.slice(1).forEach((row) => {
        const companyName = at(row, ["company", "companyname", "client", "clientname"]);
        if (!companyName) {
          skipped += 1;
          return;
        }
        const email = at(row, ["email", "emailid"]).toLowerCase();
        const phone = at(row, ["phone", "phonenumber", "mobile"]);
        const normalized = normalizedPhone(phone);
        const existingIndex = next.findIndex((profile) =>
          profile.tenantId === clientMasterTenantId
          && profile.companyName.trim().toLowerCase() === companyName.trim().toLowerCase()
          && ((email && profile.email.trim().toLowerCase() === email) || (normalized && normalizedPhone(profile.phone) === normalized)),
        );
        const payload: CustomerProfile = {
          id: makeId(),
          tenantId: clientMasterTenantId,
          profileName: at(row, ["profilename", "profile"]) || `${companyName} Billing`,
          companyName,
          contactName: at(row, ["contact", "contactname", "name"]),
          email,
          phone,
          billingAddress: at(row, ["billingaddress", "address"]),
          billingCity: at(row, ["billingcity", "city"]),
          billingState: at(row, ["billingstate", "state"]),
          billingPincode: at(row, ["billingpincode", "pincode", "zip"]),
          shippingAddress: at(row, ["shippingaddress"]) || at(row, ["billingaddress", "address"]),
          shippingCity: at(row, ["shippingcity"]) || at(row, ["billingcity", "city"]),
          shippingState: at(row, ["shippingstate"]) || at(row, ["billingstate", "state"]),
          shippingPincode: at(row, ["shippingpincode"]) || at(row, ["billingpincode", "pincode", "zip"]),
          buyerGstin: at(row, ["buyergstin", "gstin"]).toUpperCase(),
          paymentTermsDays: Math.max(1, Number(at(row, ["paymenttermsdays", "termsdays", "terms"])) || 15),
          poNumber: at(row, ["ponumber", "po"]),
          bankBeneficiaryName: at(row, ["bankbeneficiaryname", "beneficiary"]),
          bankName: at(row, ["bankname"]),
          bankAccountNumber: at(row, ["bankaccountnumber", "accountnumber"]),
          bankIfsc: at(row, ["bankifsc", "ifsc"]).toUpperCase(),
          isDefault: at(row, ["isdefault", "default"]).toLowerCase() === "true",
          createdAt: now,
          updatedAt: now,
        };
        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            ...payload,
            id: existing.id,
            createdAt: existing.createdAt,
            isDefault: existing.isDefault || payload.isDefault,
            updatedAt: now,
          };
          updated += 1;
        } else {
          next.push(payload);
          created += 1;
        }
      });
      return next;
    });
    setClientMasterImportCsv("");
    setNotice(`Customer profiles import complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}.`);
  };

  const applyCustomerProfileToDraft = (profile: CustomerProfile, lead?: Lead | null) => {
    setInvoiceDraft((prev) => {
      const leadScoped = lead ?? invoiceEligibleLeads.find((row) => row.id === prev.leadId) ?? null;
      const paymentTermsDays = Math.max(1, Number(profile.paymentTermsDays) || 15);
      const issueDate = prev.issueDate || todayISODate();
      return {
        ...prev,
        customerProfileId: profile.id,
        billedToName: profile.contactName || leadScoped?.leadName || prev.billedToName,
        billedToCompany: profile.companyName || leadScoped?.companyName || prev.billedToCompany,
        billedToEmail: profile.email || leadScoped?.emailId || prev.billedToEmail,
        billedToPhone: profile.phone || leadScoped?.phoneNumber || prev.billedToPhone,
        billedToAddress: profile.billingAddress,
        billedToCity: profile.billingCity,
        billedToState: profile.billingState,
        billedToPincode: profile.billingPincode,
        shippingAddress: profile.shippingAddress || profile.billingAddress,
        shippingCity: profile.shippingCity || profile.billingCity,
        shippingState: profile.shippingState || profile.billingState,
        shippingPincode: profile.shippingPincode || profile.billingPincode,
        useBillingAsShipping:
          (profile.shippingAddress || "") === (profile.billingAddress || "")
          && (profile.shippingCity || "") === (profile.billingCity || "")
          && (profile.shippingState || "") === (profile.billingState || "")
          && (profile.shippingPincode || "") === (profile.billingPincode || ""),
        buyerGstin: profile.buyerGstin,
        paymentTermsDays,
        dueDate: shiftISODate(issueDate, paymentTermsDays),
        poNumber: profile.poNumber,
        bankBeneficiaryName: profile.bankBeneficiaryName,
        bankName: profile.bankName,
        bankAccountNumber: profile.bankAccountNumber,
        bankIfsc: profile.bankIfsc,
      };
    });
    setCustomerProfileNameDraft(profile.profileName);
  };

  const saveDraftAsCustomerProfile = () => {
    const lead = invoiceEligibleLeads.find((row) => row.id === invoiceDraft.leadId);
    if (!lead) {
      setError("Select an eligible lead before saving customer profile.");
      return;
    }
    const profileName = customerProfileNameDraft.trim() || `${invoiceDraft.billedToCompany || lead.companyName} Billing`;
    if (!invoiceDraft.billedToCompany.trim() || !invoiceDraft.billedToName.trim()) {
      setError("Client company and contact name are required to save a customer profile.");
      return;
    }
    const now = new Date().toISOString();
    const payload = {
      tenantId: lead.tenantId,
      profileName,
      companyName: invoiceDraft.billedToCompany.trim(),
      contactName: invoiceDraft.billedToName.trim(),
      email: invoiceDraft.billedToEmail.trim().toLowerCase(),
      phone: invoiceDraft.billedToPhone.trim(),
      billingAddress: invoiceDraft.billedToAddress.trim(),
      billingCity: invoiceDraft.billedToCity.trim(),
      billingState: invoiceDraft.billedToState.trim(),
      billingPincode: invoiceDraft.billedToPincode.trim(),
      shippingAddress: invoiceDraft.shippingAddress.trim(),
      shippingCity: invoiceDraft.shippingCity.trim(),
      shippingState: invoiceDraft.shippingState.trim(),
      shippingPincode: invoiceDraft.shippingPincode.trim(),
      buyerGstin: invoiceDraft.buyerGstin.trim().toUpperCase(),
      paymentTermsDays: Math.max(1, Number(invoiceDraft.paymentTermsDays) || 15),
      poNumber: invoiceDraft.poNumber.trim(),
      bankBeneficiaryName: invoiceDraft.bankBeneficiaryName.trim(),
      bankName: invoiceDraft.bankName.trim(),
      bankAccountNumber: invoiceDraft.bankAccountNumber.trim(),
      bankIfsc: invoiceDraft.bankIfsc.trim().toUpperCase(),
      updatedAt: now,
    };
    const selectedProfileId = invoiceDraft.customerProfileId;
    const existing = selectedProfileId ? customerProfiles.find((profile) => profile.id === selectedProfileId) : null;
    if (existing) {
      setCustomerProfiles((prev) => prev.map((profile) => (profile.id === existing.id ? { ...profile, ...payload } : profile)));
      setNotice(`Customer profile updated: ${profileName}.`);
      return;
    }
    const created: CustomerProfile = {
      id: makeId(),
      createdAt: now,
      isDefault: !customerProfiles.some((profile) => profile.tenantId === lead.tenantId && profile.companyName.toLowerCase() === payload.companyName.toLowerCase()),
      ...payload,
    };
    setCustomerProfiles((prev) => [created, ...prev]);
    setInvoiceDraft((prev) => ({ ...prev, customerProfileId: created.id }));
    setNotice(`Customer profile saved: ${created.profileName}.`);
  };

  const setCustomerProfileDefault = (profile: CustomerProfile) => {
    setCustomerProfiles((prev) =>
      prev.map((row) => {
        if (row.tenantId !== profile.tenantId) return row;
        if (row.companyName.trim().toLowerCase() !== profile.companyName.trim().toLowerCase()) return row;
        return { ...row, isDefault: row.id === profile.id, updatedAt: new Date().toISOString() };
      }),
    );
  };

  const removeCustomerProfile = async (profile: CustomerProfile) => {
    const confirmed = await confirmToast(`Delete customer profile \"${profile.profileName}\"?`, "Delete");
    if (!confirmed) return;
    const deletedProfile = { ...profile };
    setCustomerProfiles((prev) => prev.filter((row) => row.id !== profile.id));
    setInvoiceDraft((prev) => (prev.customerProfileId === profile.id ? { ...prev, customerProfileId: "" } : prev));
    setNotice(`Customer profile removed: ${profile.profileName}.`);
    toastUndo(`Removed profile ${profile.profileName}.`, () => {
      setCustomerProfiles((prev) => [deletedProfile, ...prev]);
      setNotice(`Restored customer profile: ${deletedProfile.profileName}.`);
    });
  };

  useEffect(() => {
    if (invoices.length === 0) return;
    setLeads((prev) => {
      let changed = false;
      const grouped = new Map<string, Invoice[]>();
      invoices.forEach((invoice) => {
        if (invoice.status === "Cancelled") return;
        const key = `${invoice.tenantId}::${invoice.leadId}`;
        const bucket = grouped.get(key) ?? [];
        bucket.push(invoice);
        grouped.set(key, bucket);
      });
      const next = prev.map((lead) => {
        const key = `${lead.tenantId}::${lead.id}`;
        const entries = grouped.get(key);
        const sentEntries = entries?.filter((invoice) => isInvoiceSentStatus(invoice.status)) ?? [];
        const latestIssuedDate = sentEntries
          .map((invoice) => invoice.issueDate)
          .filter(Boolean)
          .sort()
          .slice(-1)[0] ?? "";
        const nextInvoiceFlowStatus: InvoiceFlowStatus = sentEntries.length > 0 ? "Sent" : "Not Sent";

        if (!entries || entries.length === 0) {
          if (lead.invoiceFlowStatus !== "Not Sent" || lead.invoiceSentDate || lead.leadStatus === "Invoice Sent") {
            changed = true;
            return {
              ...lead,
              leadStatus: lead.leadStatus === "Invoice Sent" ? "Confirmation" : lead.leadStatus,
              invoiceFlowStatus: "Not Sent" as InvoiceFlowStatus,
              invoiceSentDate: "",
            };
          }
          return lead;
        }

        if (lead.leadStatus !== "Won") {
          const shouldMoveToInvoiceSent = lead.leadStatus === "Confirmation" && nextInvoiceFlowStatus === "Sent";
          const shouldRevertToConfirmation = lead.leadStatus === "Invoice Sent" && nextInvoiceFlowStatus === "Not Sent";
          if (
            lead.invoiceFlowStatus !== nextInvoiceFlowStatus
            || lead.invoiceSentDate !== latestIssuedDate
            || shouldMoveToInvoiceSent
            || shouldRevertToConfirmation
          ) {
            changed = true;
            return {
              ...lead,
              leadStatus: shouldMoveToInvoiceSent ? "Invoice Sent" : shouldRevertToConfirmation ? "Confirmation" : lead.leadStatus,
              invoiceFlowStatus: nextInvoiceFlowStatus,
              invoiceSentDate: latestIssuedDate,
            };
          }
          return lead;
        }

        const invoicedTotal = entries.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount), 0);
        const paidTotal = entries.reduce((sum, invoice) => sum + Math.max(0, invoice.amountPaid), 0);
        const cappedCollected = Math.min(wonRevenueValue(lead), paidTotal);
        const latestPaidAt = entries
          .map((invoice) => invoice.paidAt)
          .filter(Boolean)
          .sort()
          .slice(-1)[0] ?? "";
        const nextPaymentStatus: PaymentStatus =
          invoicedTotal <= 0
            ? "Not Invoiced"
            : cappedCollected >= wonRevenueValue(lead)
              ? "Fully Collected"
              : cappedCollected > 0
                ? "Partially Collected"
                : "Invoiced";
        if (
          lead.collectedAmount !== cappedCollected
          || lead.collectedDate !== latestPaidAt
          || lead.paymentStatus !== nextPaymentStatus
          || lead.invoiceFlowStatus !== nextInvoiceFlowStatus
          || lead.invoiceSentDate !== latestIssuedDate
        ) {
          changed = true;
          return {
            ...lead,
            collectedAmount: cappedCollected,
            collectedDate: latestPaidAt,
            paymentStatus: nextPaymentStatus,
            invoiceFlowStatus: nextInvoiceFlowStatus,
            invoiceSentDate: latestIssuedDate,
          };
        }
        return lead;
      });
      return changed ? next : prev;
    });
  }, [invoices]);

  const filteredLeads = useMemo(() => {
    return visibleLeads.filter((lead) => {
      const hay = `${lead.leadName} ${lead.companyName} ${lead.phoneNumber} ${lead.emailId}`.toLowerCase();
      const searchOk = !debouncedLeadSearch.trim() || hay.includes(debouncedLeadSearch.trim().toLowerCase());
      const statusOk = filterStatus === "All" || lead.leadStatus === filterStatus;
      const sourceOk = filterSource === "All" || lead.leadSource === filterSource;
      const assigneeOk = filterAssignee === "All" || lead.assignedTo === filterAssignee;
      const tempOk = filterTemp === "All" || lead.leadTemperature === filterTemp;
      const quickOk =
        quickFilter === "all" ||
        (quickFilter === "hot" && lead.leadTemperature === "Hot") ||
        (quickFilter === "today-followups" && lead.followupStatus === "Pending" && lead.nextFollowupDate === todayISODate());
      return searchOk && statusOk && sourceOk && assigneeOk && tempOk && quickOk;
    });
  }, [visibleLeads, debouncedLeadSearch, filterStatus, filterSource, filterAssignee, filterTemp, quickFilter]);

  const pipelineLeads = useMemo(() => {
    const query = debouncedPipelineSearch.trim().toLowerCase();
    const focusName = currentUser?.name ?? "";
    const sorted = [...visibleLeads]
      .filter((lead) => {
        if (!pipelineShowClosed && (lead.leadStatus === "Won" || lead.leadStatus === "Lost")) return false;
        if (pipelineFocusMode === "mine" && focusName && lead.assignedTo !== focusName) return false;
        if (pipelineAssigneeFilter !== "All" && lead.assignedTo !== pipelineAssigneeFilter) return false;
        if (pipelineTempFilter !== "All" && lead.leadTemperature !== pipelineTempFilter) return false;
        if (!query) return true;
        const hay = `${lead.leadName} ${lead.companyName} ${lead.phoneNumber} ${lead.emailId}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => {
        if (pipelineSort === "value") {
          return safeDealValue(b.dealValue) - safeDealValue(a.dealValue);
        }
        if (pipelineSort === "expected") {
          const left = a.expectedClosingDate || "9999-12-31";
          const right = b.expectedClosingDate || "9999-12-31";
          return left.localeCompare(right);
        }
        if (pipelineSort === "followup") {
          const left = a.nextFollowupDate || "9999-12-31";
          const right = b.nextFollowupDate || "9999-12-31";
          return left.localeCompare(right);
        }
        if (pipelineSort === "age") {
          return daysSince(b.dateAdded) - daysSince(a.dateAdded);
        }
        return pipelinePriorityScore(b) - pipelinePriorityScore(a);
      });
    return sorted;
  }, [
    visibleLeads,
    debouncedPipelineSearch,
    pipelineAssigneeFilter,
    pipelineTempFilter,
    pipelineSort,
    pipelineShowClosed,
    pipelineFocusMode,
    currentUser,
  ]);

  const pipelineStatusEntryMap = useMemo(() => {
    const leadIds = new Set(pipelineLeads.map((lead) => lead.id));
    const latestByLeadAndStatus = new Map<string, number>();
    activities.forEach((entry) => {
      if (!leadIds.has(entry.leadId)) return;
      const stamp = new Date(entry.createdAt).getTime();
      if (Number.isNaN(stamp)) return;
      entry.changes.forEach((change) => {
        const status = extractStatusFromChange(change);
        if (!status) return;
        const key = `${entry.leadId}::${status}`;
        const existing = latestByLeadAndStatus.get(key) ?? 0;
        if (stamp > existing) latestByLeadAndStatus.set(key, stamp);
      });
    });
    return latestByLeadAndStatus;
  }, [activities, pipelineLeads]);

  const pipelineWipReferenceDate =
    pipelineWipScope === "today" ? todayISODate() : pipelineWipScope === "custom" ? pipelineWipDate : "";
  const pipelineWipReferenceLabel =
    pipelineWipScope === "today" ? "Today" : pipelineWipScope === "custom" ? pipelineWipDate || "Custom Day" : "All Dates";

  const pipelineColumns = useMemo(
    () =>
      PIPELINE_BOARD_STATUSES.filter((status) => pipelineShowClosed || (status !== "Won" && status !== "Lost")).map((status) => {
        const columnLeads = pipelineLeads.filter((lead) => lead.leadStatus === status);
        const totalValue = columnLeads.reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
        const overdue = columnLeads.filter((lead) => dateTag(lead) === "Overdue").length;
        const avgAgeDays = columnLeads.length
          ? columnLeads.reduce((sum, lead) => sum + daysSince(lead.dateAdded), 0) / columnLeads.length
          : 0;
        const wipLimit = pipelineWipLimits[status];
        const dailyCount = pipelineWipReferenceDate
          ? columnLeads.filter((lead) => {
              const key = `${lead.id}::${lead.leadStatus}`;
              const stageEnteredStamp = pipelineStatusEntryMap.get(key);
              if (stageEnteredStamp) return new Date(stageEnteredStamp).toISOString().slice(0, 10) === pipelineWipReferenceDate;
              const fallback =
                lead.leadStatus === "Won"
                  ? lead.wonDate || lead.lastContactedDate || lead.dateAdded
                  : lead.lastContactedDate || lead.dateAdded;
              return fallback === pipelineWipReferenceDate;
            }).length
          : columnLeads.length;
        return {
          status,
          leads: columnLeads,
          count: columnLeads.length,
          totalValue,
          overdue,
          avgAgeDays,
          dailyCount,
          wipLimit,
          overLimit: typeof wipLimit === "number" && dailyCount > wipLimit,
        };
      }),
    [pipelineLeads, pipelineShowClosed, pipelineStatusEntryMap, pipelineWipReferenceDate, pipelineWipLimits],
  );

  const duplicateLeadGroups = useMemo(() => {
    const byKey = new Map<string, Lead[]>();
    filteredLeads.forEach((lead) => {
      const phone = normalizedPhone(lead.phoneNumber);
      const email = lead.emailId.trim().toLowerCase();
      if (phone) {
        const key = `phone:${phone}`;
        byKey.set(key, [...(byKey.get(key) ?? []), lead]);
      }
      if (email) {
        const key = `email:${email}`;
        byKey.set(key, [...(byKey.get(key) ?? []), lead]);
      }
    });
    const groups = Array.from(byKey.values())
      .filter((group) => group.length > 1)
      .map((group) => [...group].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)));
    const deduped = new Map<string, Lead[]>();
    groups.forEach((group) => {
      const signature = group.map((lead) => lead.id).sort().join("|");
      if (!deduped.has(signature)) deduped.set(signature, group);
    });
    return Array.from(deduped.values()).sort((a, b) => b.length - a.length);
  }, [filteredLeads]);

  const duplicateLeadIdSet = useMemo(
    () => new Set(duplicateLeadGroups.flatMap((group) => group.map((lead) => lead.id))),
    [duplicateLeadGroups],
  );

  const newLeads = useMemo(
    () => visibleLeads.filter((lead) => lead.leadStatus === "New").sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)),
    [visibleLeads],
  );

  const newLeadRows = useMemo(
    () =>
      newLeads.map((lead) => {
        const ageDays = daysSince(lead.dateAdded);
        const overdueBoost = lead.followupStatus === "Pending" && lead.nextFollowupDate && lead.nextFollowupDate < todayISODate() ? 22 : 0;
        const todayBoost = lead.followupStatus === "Pending" && lead.nextFollowupDate === todayISODate() ? 12 : 0;
        const tempBoost = lead.leadTemperature === "Hot" ? 30 : lead.leadTemperature === "Warm" ? 18 : 8;
        const freshnessPenalty = Math.min(20, ageDays * 2);
        const score = Math.max(1, Math.min(100, tempBoost + sourcePriorityWeight(lead.leadSource) + overdueBoost + todayBoost + 18 - freshnessPenalty));
        return { lead, ageDays, score, contactability: contactabilityBadge(lead) };
      }),
    [newLeads],
  );

  const followupScopedLeads = useMemo(
    () => visibleLeads.filter((lead) => isOpenLeadStatus(lead.leadStatus) && lead.followupStatus === "Pending"),
    [visibleLeads],
  );

  const followupCounts = useMemo(
    () => ({
      overdue: followupScopedLeads.filter((lead) => followupQueueKey(lead) === "overdue").length,
      today: followupScopedLeads.filter((lead) => followupQueueKey(lead) === "today").length,
      upcoming: followupScopedLeads.filter((lead) => followupQueueKey(lead) === "upcoming").length,
      noDate: followupScopedLeads.filter((lead) => followupQueueKey(lead) === "no-date").length,
      total: followupScopedLeads.length,
    }),
    [followupScopedLeads],
  );

  const myWorkLeads = useMemo(() => {
    if (!currentUser) return [] as Lead[];
    const mine = visibleLeads.filter((lead) => lead.assignedTo === currentUser.name);
    return mine.length > 0 ? mine : visibleLeads;
  }, [currentUser, visibleLeads]);

  const myWorkSummary = useMemo(() => {
    const today = todayISODate();
    const pending = myWorkLeads.filter((lead) => isOpenLeadStatus(lead.leadStatus) && lead.followupStatus === "Pending");
    const overdue = pending.filter((lead) => lead.nextFollowupDate && lead.nextFollowupDate < today);
    const dueToday = pending.filter((lead) => lead.nextFollowupDate === today);
    const noDate = pending.filter((lead) => !lead.nextFollowupDate);
    const neglected = myWorkLeads.filter((lead) => isOpenLeadStatus(lead.leadStatus) && neglectDays(lead) >= 7);
    const invoiceActions = canUseInvoicing
      ? myWorkLeads.filter((lead) => INVOICE_ELIGIBLE_STATUSES.includes(lead.leadStatus) && lead.invoiceFlowStatus !== "Sent")
      : [];
    return {
      pendingCount: pending.length,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      noDateCount: noDate.length,
      neglectedCount: neglected.length,
      invoiceActionCount: invoiceActions.length,
      actionRows: [...pending]
        .sort((a, b) => {
          const aq = followupQueueKey(a);
          const bq = followupQueueKey(b);
          const rank: Record<string, number> = { overdue: 0, today: 1, upcoming: 2, "no-date": 3 };
          if ((rank[aq] ?? 4) !== (rank[bq] ?? 4)) return (rank[aq] ?? 4) - (rank[bq] ?? 4);
          return pipelinePriorityScore(b) - pipelinePriorityScore(a);
        })
        .slice(0, 8),
      invoiceRows: invoiceActions.slice(0, 5),
    };
  }, [myWorkLeads, canUseInvoicing]);

  const filteredFollowupLeads = useMemo(() => {
    const query = debouncedFollowupSearch.trim().toLowerCase();
    return followupScopedLeads
      .filter((lead) => {
        const stageMatch = followupStageFilter === "All" || lead.leadStatus === followupStageFilter;
        const assigneeMatch = followupAssigneeFilter === "All" || lead.assignedTo === followupAssigneeFilter;
        const tempMatch = followupTempFilter === "All" || lead.leadTemperature === followupTempFilter;
        if (!stageMatch || !assigneeMatch || !tempMatch) return false;
        const queueMatch = followupQueue === "all" ? true : followupQueueKey(lead) === followupQueue;
        if (!queueMatch) return false;
        if (!query) return true;
        const hay = `${lead.leadName} ${lead.companyName} ${lead.assignedTo} ${lead.notes}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => {
        const queueOrder = { overdue: 0, today: 1, upcoming: 2, "no-date": 3 } as const;
        const aQueue = queueOrder[followupQueueKey(a) as keyof typeof queueOrder] ?? 4;
        const bQueue = queueOrder[followupQueueKey(b) as keyof typeof queueOrder] ?? 4;
        if (aQueue !== bQueue) return aQueue - bQueue;
        const aDate = a.nextFollowupDate || "9999-12-31";
        const bDate = b.nextFollowupDate || "9999-12-31";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return pipelinePriorityScore(b) - pipelinePriorityScore(a);
      });
  }, [followupScopedLeads, debouncedFollowupSearch, followupStageFilter, followupAssigneeFilter, followupTempFilter, followupQueue]);

  const followupOwnerboard = useMemo(() => {
    const rows = assigneeOptions.map((assignee) => {
      const owned = followupScopedLeads.filter((lead) => lead.assignedTo === assignee);
      const overdue = owned.filter((lead) => followupQueueKey(lead) === "overdue").length;
      const dueToday = owned.filter((lead) => followupQueueKey(lead) === "today").length;
      const upcoming = owned.filter((lead) => followupQueueKey(lead) === "upcoming").length;
      return {
        assignee,
        total: owned.length,
        overdue,
        dueToday,
        upcoming,
        doneLast7d: visibleLeads.filter(
          (lead) =>
            lead.assignedTo === assignee &&
            lead.followupStatus === "Done" &&
            lead.lastContactedDate &&
            lead.lastContactedDate >= shiftISODate(todayISODate(), -6),
        ).length,
      };
    });
    return rows.sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [assigneeOptions, followupScopedLeads, visibleLeads]);

  useEffect(() => {
    setSelectedFollowupLeadIds((prev) => prev.filter((id) => filteredFollowupLeads.some((lead) => lead.id === id)));
  }, [filteredFollowupLeads]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => filteredLeads.some((lead) => lead.id === id)));
  }, [filteredLeads]);

  useEffect(() => {
    if (!leadIntakeModalOpen) return;
    window.setTimeout(() => leadNameInputRef.current?.focus(), 0);
  }, [leadIntakeModalOpen]);

  useEffect(() => {
    if (!dailyMode) return;
    setPipelineShowAdvancedControls(false);
    setFollowupShowAdvancedControls(false);
    if (followupQueue === "all") {
      setFollowupQueue("overdue");
    }
  }, [dailyMode, followupQueue]);

  useEffect(() => {
    if (!followupBulkAssignee && assigneeOptions.length > 0) {
      setFollowupBulkAssignee(assigneeOptions[0]);
    }
  }, [assigneeOptions, followupBulkAssignee]);

  useEffect(() => {
    if (!leadBulkAssignee && assigneeOptions.length > 0) {
      setLeadBulkAssignee(assigneeOptions[0]);
    }
  }, [assigneeOptions, leadBulkAssignee]);

  const metrics = useMemo(() => {
    const today = todayISODate();
    const dashboardRange = resolveDashboardDateRange(dashboardDateScope, dashboardCustomStart, dashboardCustomEnd);
    const dashboardScopedLeads = dashboardRange.start && dashboardRange.end
      ? visibleLeads.filter((lead) => lead.dateAdded && lead.dateAdded >= dashboardRange.start! && lead.dateAdded <= dashboardRange.end!)
      : visibleLeads;
    const total = dashboardScopedLeads.length;
    const won = dashboardScopedLeads.filter((l) => l.leadStatus === "Won").length;
    const lost = dashboardScopedLeads.filter((l) => l.leadStatus === "Lost").length;
    const pending = dashboardScopedLeads.filter((l) => l.followupStatus === "Pending").length;
    const pipelineValue = dashboardScopedLeads
      .filter((l) => PIPELINE_VALUE_STATUSES.includes(l.leadStatus))
      .reduce((sum, l) => sum + (Number.isFinite(l.dealValue) ? l.dealValue : 0), 0);
    const wonValue = dashboardScopedLeads.filter((l) => l.leadStatus === "Won").reduce((sum, l) => sum + wonRevenueValue(l), 0);
    const conversionRate = total ? (won / total) * 100 : 0;
    const lostRate = total ? (lost / total) * 100 : 0;
    const motivationScore = Math.round(Math.max(0, Math.min(100, 100 - lostRate + conversionRate / 2)));
    const currentMonth = today.slice(0, 7);
    const plusThirty = new Date();
    plusThirty.setDate(plusThirty.getDate() + 30);
    const thirtyDayLimit = plusThirty.toISOString().slice(0, 10);
    const nowMs = Date.now();

    const openLeads = dashboardScopedLeads.filter((lead) => lead.leadStatus !== "Won" && lead.leadStatus !== "Lost");
    const overdueFollowups = dashboardScopedLeads.filter((lead) => lead.followupStatus === "Pending" && lead.nextFollowupDate && lead.nextFollowupDate < today).length;
    const dueTodayFollowups = dashboardScopedLeads.filter((lead) => lead.followupStatus === "Pending" && lead.nextFollowupDate === today).length;
    const upcomingFollowups = dashboardScopedLeads.filter((lead) => lead.followupStatus === "Pending" && lead.nextFollowupDate && lead.nextFollowupDate > today).length;
    const doneFollowups = dashboardScopedLeads.filter((lead) => lead.followupStatus === "Done").length;
    const followupActionCount = doneFollowups + pending;
    const followupCompletionRate = followupActionCount ? (doneFollowups / followupActionCount) * 100 : 0;
    const overdueRate = pending ? (overdueFollowups / pending) * 100 : 0;

    const toDays = (dateValue: string) => {
      if (!dateValue) return 0;
      const stamp = new Date(dateValue).getTime();
      if (Number.isNaN(stamp)) return 0;
      return Math.max(0, (nowMs - stamp) / (1000 * 60 * 60 * 24));
    };

    const avgPipelineAgeDays = openLeads.length
      ? openLeads.reduce((sum, lead) => sum + toDays(lead.dateAdded), 0) / openLeads.length
      : 0;
    const staleLeads7d = openLeads.filter((lead) => {
      const reference = lead.lastContactedDate || lead.dateAdded;
      return reference ? toDays(reference) >= 7 : false;
    }).length;
    const stuckLeads10d = openLeads.filter((lead) => toDays(lead.dateAdded) >= 10).length;

    const expectedRevenue30d = visibleLeads
      .filter((lead) => lead.leadStatus !== "Lost" && lead.expectedClosingDate && lead.expectedClosingDate >= today && lead.expectedClosingDate <= thirtyDayLimit)
      .reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0);
    const expectedRevenueThisMonth = visibleLeads
      .filter((lead) => lead.leadStatus !== "Lost" && lead.expectedClosingDate && lead.expectedClosingDate.startsWith(currentMonth))
      .reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0);

    const monthWindow = Array.from({ length: 24 }).map((_, idx) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (23 - idx));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = formatMonthYear(d);
      return { key, label };
    });

    const monthlyRevenueRows = monthWindow.map((month) => {
      const monthLeads = visibleLeads.filter((lead) => {
        const primaryDate = lead.expectedClosingDate || lead.dateAdded;
        return monthKeyFromDate(primaryDate) === month.key;
      });
      const monthTotal = monthLeads.length;
      const monthWon = monthLeads.filter((lead) => lead.leadStatus === "Won").length;
      const monthLost = monthLeads.filter((lead) => lead.leadStatus === "Lost").length;
      const monthPipelineValue = monthLeads
        .filter((lead) => PIPELINE_VALUE_STATUSES.includes(lead.leadStatus))
        .reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0);
      const monthClosedValue = monthLeads
        .filter((lead) => lead.leadStatus === "Won")
        .reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
      return {
        monthKey: month.key,
        monthLabel: month.label,
        total: monthTotal,
        won: monthWon,
        lost: monthLost,
        pipelineValue: monthPipelineValue,
        closedValue: monthClosedValue,
        conversionRate: monthTotal ? (monthWon / monthTotal) * 100 : 0,
      };
    });

    const monthlySourceRows = monthWindow.map((month) => {
      const monthLeads = visibleLeads.filter((lead) => monthKeyFromDate(lead.dateAdded) === month.key);
      const bySource = Object.fromEntries(
        LEAD_SOURCES.map((source) => {
          const sourceLeads = monthLeads.filter((lead) => lead.leadSource === source);
          const sourceWon = sourceLeads.filter((lead) => lead.leadStatus === "Won").length;
          return [
            source,
            {
              count: sourceLeads.length,
              won: sourceWon,
              conversionRate: sourceLeads.length ? (sourceWon / sourceLeads.length) * 100 : 0,
            },
          ];
        }),
      ) as Record<LeadSource, { count: number; won: number; conversionRate: number }>;
      const total = monthLeads.length;
      const won = monthLeads.filter((lead) => lead.leadStatus === "Won").length;
      const topSource = LEAD_SOURCES.reduce(
        (best, source) => (bySource[source].count > best.count ? { source, count: bySource[source].count } : best),
        { source: "-" as string, count: 0 },
      );
      return {
        monthKey: month.key,
        monthLabel: month.label,
        total,
        won,
        topSource: topSource.count > 0 ? topSource.source : "-",
        bySource,
      };
    });

    const currentMonthSourceRow = monthlySourceRows.find((row) => row.monthKey === currentMonth) ?? monthlySourceRows[monthlySourceRows.length - 1];

    const forecastActualRows = monthWindow.map((month) => {
      const forecast = visibleLeads
        .filter((lead) => lead.leadStatus !== "Lost" && monthKeyFromDate(lead.expectedClosingDate) === month.key)
        .reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0);
      const actual = visibleLeads
        .filter((lead) => lead.leadStatus === "Won" && monthKeyFromDate(lead.wonDate) === month.key)
        .reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
      const accuracy = forecast > 0 ? (actual / forecast) * 100 : actual > 0 ? 100 : 0;
      return {
        monthKey: month.key,
        monthLabel: month.label,
        forecast,
        actual,
        gap: actual - forecast,
        accuracy,
      };
    });

    const firstResponseHours = dashboardScopedLeads.flatMap((lead) => {
      if (!lead.dateAdded || !lead.lastContactedDate) return [] as number[];
      const created = new Date(lead.dateAdded).getTime();
      const contacted = new Date(lead.lastContactedDate).getTime();
      if (Number.isNaN(created) || Number.isNaN(contacted) || contacted < created) return [] as number[];
      return [(contacted - created) / (1000 * 60 * 60)];
    });
    const firstResponseConfidence = dashboardScopedLeads.some((lead) => {
      if (!lead.dateAdded || !lead.lastContactedDate) return false;
      return lead.dateAdded.length <= 10 || lead.lastContactedDate.length <= 10;
    })
      ? "Directional"
      : "Exact";
    const avgFirstResponseHours = firstResponseHours.length
      ? firstResponseHours.reduce((sum, value) => sum + value, 0) / firstResponseHours.length
      : 0;
    const within24hCount = firstResponseHours.filter((value) => value <= 24).length;
    const responseWithin24hRate = firstResponseHours.length ? (within24hCount / firstResponseHours.length) * 100 : 0;

    const visibleLeadIds = new Set(dashboardScopedLeads.map((lead) => lead.id));
    const activity7d = activities.filter((entry) => {
      if (!visibleLeadIds.has(entry.leadId)) return false;
      const stamp = new Date(entry.createdAt).getTime();
      return !Number.isNaN(stamp) && nowMs - stamp <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const stageCounts = LEAD_STATUSES.map((status) => {
      const count = dashboardScopedLeads.filter((lead) => lead.leadStatus === status).length;
      return { status, count, share: total ? (count / total) * 100 : 0 };
    });
    const bottleneckStage = stageCounts
      .filter((stage) => !["Won", "Lost", "New"].includes(stage.status))
      .reduce((worst, current) => (current.count > worst.count ? current : worst), { status: "Contacted" as LeadStatus, count: 0, share: 0 });

    const sourcePerformance = LEAD_SOURCES.map((source) => {
      const sourceLeads = dashboardScopedLeads.filter((lead) => lead.leadSource === source);
      const sourceWon = sourceLeads.filter((lead) => lead.leadStatus === "Won").length;
      const sourceValue = sourceLeads.reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0);
      return {
        source,
        count: sourceLeads.length,
        won: sourceWon,
        conversionRate: sourceLeads.length ? (sourceWon / sourceLeads.length) * 100 : 0,
        value: sourceValue,
      };
    })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const serviceCounter = new Map<string, { count: number; won: number; value: number }>();
    dashboardScopedLeads.forEach((lead) => {
      const current = serviceCounter.get(lead.serviceInterested) ?? { count: 0, won: 0, value: 0 };
      current.count += 1;
      if (lead.leadStatus === "Won") current.won += 1;
      current.value += Number.isFinite(lead.dealValue) ? lead.dealValue : 0;
      serviceCounter.set(lead.serviceInterested, current);
    });
    const servicePerformance = Array.from(serviceCounter.entries())
      .map(([service, data]) => ({
        service,
        count: data.count,
        won: data.won,
        value: data.value,
        conversionRate: data.count ? (data.won / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const latestStatusChangeByLeadAndStatus = new Map<string, number>();
    activities.forEach((entry) => {
      if (!visibleLeadIds.has(entry.leadId)) return;
      const stamp = new Date(entry.createdAt).getTime();
      if (Number.isNaN(stamp)) return;
      entry.changes.forEach((change) => {
        const match = change.match(/^Lead Status:\s.+->\s(.+)$/);
        if (!match) return;
        const status = match[1].trim();
        const key = `${entry.leadId}::${status}`;
        const previous = latestStatusChangeByLeadAndStatus.get(key) ?? 0;
        if (stamp > previous) latestStatusChangeByLeadAndStatus.set(key, stamp);
      });
    });

    const stageAging = LEAD_STATUSES.map((status) => {
      const stageLeads = dashboardScopedLeads.filter((lead) => lead.leadStatus === status);
      const avgDays = stageLeads.length
        ? stageLeads.reduce((sum, lead) => {
            const key = `${lead.id}::${lead.leadStatus}`;
            const enteredAt = latestStatusChangeByLeadAndStatus.get(key);
            if (enteredAt) {
              return sum + Math.max(0, (nowMs - enteredAt) / (1000 * 60 * 60 * 24));
            }
            const fallbackDate = lead.leadStatus === "Won" ? lead.wonDate || lead.lastContactedDate || lead.dateAdded : lead.lastContactedDate || lead.dateAdded;
            return sum + toDays(fallbackDate);
          }, 0) / stageLeads.length
        : 0;
      return { status, avgDays, count: stageLeads.length };
    });
    const slowestStage = stageAging
      .filter((stage) => stage.count > 0 && !["Won", "Lost"].includes(stage.status))
      .reduce((slowest, current) => (current.avgDays > slowest.avgDays ? current : slowest), { status: "New" as LeadStatus, avgDays: 0, count: 0 });

    // Team performance blends conversion quality and follow-up discipline per assignee.
    const assigneeBuckets = new Map<string, Lead[]>();
    dashboardScopedLeads.forEach((lead) => {
      const owner = lead.assignedTo.trim();
      if (!owner) return;
      const bucket = assigneeBuckets.get(owner) ?? [];
      bucket.push(lead);
      assigneeBuckets.set(owner, bucket);
    });

    const memberScores = Array.from(assigneeBuckets.entries()).map(([name, memberLeads]) => {
      const memberTotal = memberLeads.length;
      const memberWon = memberLeads.filter((lead) => lead.leadStatus === "Won").length;
      const memberPending = memberLeads.filter((lead) => lead.followupStatus === "Pending").length;
      const memberDone = memberLeads.filter((lead) => lead.followupStatus === "Done").length;
      const memberOverdue = memberLeads.filter((lead) => followupQueueKey(lead) === "overdue").length;
      const memberUntouched7d = memberLeads.filter((lead) => {
        if (!isOpenLeadStatus(lead.leadStatus)) return false;
        const reference = lead.lastContactedDate || lead.dateAdded;
        return reference ? daysSince(reference) >= 7 : false;
      }).length;
      const memberStalled10d = memberLeads.filter((lead) => isOpenLeadStatus(lead.leadStatus) && daysSince(lead.dateAdded) >= 10).length;
      const memberConversion = memberTotal ? (memberWon / memberTotal) * 100 : 0;
      const memberFollowupCompletion = memberDone + memberPending ? (memberDone / (memberDone + memberPending)) * 100 : 0;
      const score = memberConversion * 0.6 + memberFollowupCompletion * 0.4;
      return {
        name,
        score,
        total: memberTotal,
        won: memberWon,
        pending: memberPending,
        overdue: memberOverdue,
        untouched7d: memberUntouched7d,
        stalled10d: memberStalled10d,
        closedRevenue: memberLeads.filter((lead) => lead.leadStatus === "Won").reduce((sum, lead) => sum + wonRevenueValue(lead), 0),
        openPipelineValue: memberLeads
          .filter((lead) => PIPELINE_VALUE_STATUSES.includes(lead.leadStatus))
          .reduce((sum, lead) => sum + (Number.isFinite(lead.dealValue) ? lead.dealValue : 0), 0),
      };
    });

    const teamPerformance = memberScores.length
      ? memberScores.reduce((sum, member) => sum + member.score, 0) / memberScores.length
      : 0;
    const topPerformer = memberScores.length
      ? memberScores.reduce((best, current) => (current.score > best.score ? current : best))
      : null;
    const teamLeaderboard = [...memberScores].sort((a, b) => b.score - a.score);
    const managerActionRows = [...memberScores]
      .sort((a, b) => (b.overdue - a.overdue) || (b.untouched7d - a.untouched7d) || (b.stalled10d - a.stalled10d))
      .slice(0, 8);

    return {
      scopeLabel: dashboardRange.label,
      total,
      won,
      lost,
      pending,
      openLeads: openLeads.length,
      pipelineValue,
      wonValue,
      conversionRate,
      lostRate,
      motivationScore,
      overdueFollowups,
      dueTodayFollowups,
      upcomingFollowups,
      doneFollowups,
      followupCompletionRate,
      overdueRate,
      avgPipelineAgeDays,
      staleLeads7d,
      stuckLeads10d,
      expectedRevenue30d,
      expectedRevenueThisMonth,
      avgFirstResponseHours,
      responseWithin24hRate,
      firstResponseSamples: firstResponseHours.length,
      firstResponseConfidence,
      activity7d,
      stageCounts,
      stageAging,
      stageAgingConfidence: "Directional",
      bottleneckStage,
      slowestStage,
      sourcePerformance,
      monthlyRevenueRows,
      forecastActualRows,
      monthlySourceRows,
      currentMonthSourceRow,
      servicePerformance,
      teamPerformance,
      teamLeaderboard,
      managerActionRows,
      activeMembers: memberScores.length,
      topPerformerName: topPerformer?.name ?? "-",
      topPerformerScore: topPerformer?.score ?? 0,
    };
  }, [visibleLeads, activities, dashboardDateScope, dashboardCustomStart, dashboardCustomEnd]);

  const revenueAnalytics = useMemo(() => {
    const bounds = resolveRangeBounds(revenueRangePreset, revenueCustomStart, revenueCustomEnd);
    const monthWindow = Array.from({ length: 24 }).map((_, idx) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (23 - idx));
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { monthKey, monthLabel: formatMonthYear(d) };
    });
    const scopedMonths = bounds
      ? monthWindow.filter((month) => month.monthKey >= bounds.start && month.monthKey <= bounds.end)
      : monthWindow;

    const filteredLeads = visibleLeads.filter((lead) => {
      if (revenueAssigneeFilter !== "All" && lead.assignedTo !== revenueAssigneeFilter) return false;
      if (revenueSourceFilter !== "All" && lead.leadSource !== revenueSourceFilter) return false;
      if (revenueServiceFilter !== "All" && lead.serviceInterested !== revenueServiceFilter) return false;
      return true;
    });

    const lostMonthByLeadId = new Map<string, string>();
    activities.forEach((entry) => {
      const stamp = entry.createdAt.slice(0, 10);
      const month = monthKeyFromDate(stamp);
      if (!month) return;
      const movedLost = entry.changes.some((change) => change.includes("Lead Status:") && change.includes("-> Lost"));
      if (!movedLost) return;
      const existing = lostMonthByLeadId.get(entry.leadId);
      if (!existing || month > existing) lostMonthByLeadId.set(entry.leadId, month);
    });

    const projectionRows = scopedMonths.map((month) => {
      const expectedMonthLeads = filteredLeads.filter((lead) => monthKeyFromDate(lead.expectedClosingDate) === month.monthKey);
      const openProjectionLeads = expectedMonthLeads.filter((lead) => lead.leadStatus !== "Lost");
      const projectedUnweighted = openProjectionLeads.reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
      const projectedWeighted = openProjectionLeads.reduce(
        (sum, lead) => sum + safeDealValue(lead.dealValue) * FORECAST_STAGE_WEIGHTS[lead.leadStatus],
        0,
      );
      const openPipeline = expectedMonthLeads
        .filter((lead) => PIPELINE_VALUE_STATUSES.includes(lead.leadStatus))
        .reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
      return {
        ...month,
        total: expectedMonthLeads.length,
        projectedUnweighted,
        projectedWeighted,
        openPipeline,
        quality: "Directional",
      };
    });

    const closedOutcomeRows = scopedMonths.map((month) => {
      const wonLeads = filteredLeads.filter((lead) => lead.leadStatus === "Won" && monthKeyFromDate(lead.wonDate) === month.monthKey);
      const lostLeads = filteredLeads.filter((lead) => lead.leadStatus === "Lost" && lostMonthByLeadId.get(lead.id) === month.monthKey);
      const booked = wonLeads.reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
      const collected = wonLeads
        .filter((lead) => monthKeyFromDate(lead.collectedDate) === month.monthKey)
        .reduce((sum, lead) => sum + Math.max(0, lead.collectedAmount ?? 0), 0);
      const outstanding = wonLeads.reduce((sum, lead) => sum + outstandingAmount(lead), 0);
      return {
        ...month,
        won: wonLeads.length,
        lost: lostLeads.length,
        booked,
        collected,
        outstanding,
        realizationRate: booked > 0 ? (collected / booked) * 100 : 0,
        quality: "Exact",
      };
    });

    const forecastRows = scopedMonths.map((month) => {
      const leadSet = filteredLeads.filter((lead) => lead.leadStatus !== "Lost" && monthKeyFromDate(lead.expectedClosingDate) === month.monthKey);
      const forecastUnweighted = leadSet.reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
      const forecastWeighted = leadSet.reduce(
        (sum, lead) => sum + safeDealValue(lead.dealValue) * FORECAST_STAGE_WEIGHTS[lead.leadStatus],
        0,
      );
      const forecast = revenueForecastMode === "weighted" ? forecastWeighted : forecastUnweighted;
      const actual = filteredLeads
        .filter((lead) => lead.leadStatus === "Won" && monthKeyFromDate(lead.wonDate) === month.monthKey)
        .reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
      return {
        ...month,
        forecast,
        actual,
        gap: actual - forecast,
        accuracy: forecast > 0 ? (actual / forecast) * 100 : actual > 0 ? 100 : 0,
        quality: "Directional",
      };
    });

    const projectionTotal = projectionRows.reduce(
      (sum, row) => sum + (revenueForecastMode === "weighted" ? row.projectedWeighted : row.projectedUnweighted),
      0,
    );
    const openPipelineTotal = projectionRows.reduce((sum, row) => sum + row.openPipeline, 0);
    const bookedTotal = closedOutcomeRows.reduce((sum, row) => sum + row.booked, 0);
    const collectedTotal = closedOutcomeRows.reduce((sum, row) => sum + row.collected, 0);
    const outstandingTotal = closedOutcomeRows.reduce((sum, row) => sum + row.outstanding, 0);
    const wonTotal = closedOutcomeRows.reduce((sum, row) => sum + row.won, 0);
    const lostTotal = closedOutcomeRows.reduce((sum, row) => sum + row.lost, 0);
    const leadCreatedInRange = bounds
      ? filteredLeads.filter((lead) => {
          const key = monthKeyFromDate(lead.dateAdded);
          return key >= bounds.start && key <= bounds.end;
        }).length
      : filteredLeads.length;

    const bookedAchievement = revenueBookedTarget > 0 ? (bookedTotal / revenueBookedTarget) * 100 : 0;
    const collectedAchievement = revenueCollectedTarget > 0 ? (collectedTotal / revenueCollectedTarget) * 100 : 0;
    const realizationRate = bookedTotal > 0 ? (collectedTotal / bookedTotal) * 100 : 0;
    const firstMonth = scopedMonths[0]?.monthKey;
    const lastMonth = scopedMonths[scopedMonths.length - 1]?.monthKey;

    const wonLeadsInScope = filteredLeads.filter(
      (lead) => lead.leadStatus === "Won" && (!firstMonth || (monthKeyFromDate(lead.wonDate) >= firstMonth && monthKeyFromDate(lead.wonDate) <= (lastMonth ?? monthKeyFromDate(lead.wonDate))))
    );
    const paymentStatusCounts: Record<PaymentStatus, number> = {
      "Not Invoiced": 0,
      Invoiced: 0,
      "Partially Collected": 0,
      "Fully Collected": 0,
    };
    wonLeadsInScope.forEach((lead) => {
      const status = lead.paymentStatus || inferPaymentStatus(lead);
      paymentStatusCounts[status] += 1;
    });

    const outstandingLeads = wonLeadsInScope
      .map((lead) => ({ lead, outstanding: outstandingAmount(lead) }))
      .filter((row) => row.outstanding > 0);

    const collectionAging = {
      bucket0to30: { count: 0, amount: 0 },
      bucket31to60: { count: 0, amount: 0 },
      bucket60Plus: { count: 0, amount: 0 },
    };
    outstandingLeads.forEach(({ lead, outstanding }) => {
      const ageDays = daysSince(lead.wonDate || lead.dateAdded);
      if (ageDays <= 30) {
        collectionAging.bucket0to30.count += 1;
        collectionAging.bucket0to30.amount += outstanding;
      } else if (ageDays <= 60) {
        collectionAging.bucket31to60.count += 1;
        collectionAging.bucket31to60.amount += outstanding;
      } else {
        collectionAging.bucket60Plus.count += 1;
        collectionAging.bucket60Plus.amount += outstanding;
      }
    });

    const ownerMap = new Map<string, { owner: string; won: number; booked: number; collected: number; outstanding: number }>();
    wonLeadsInScope.forEach((lead) => {
      const owner = lead.collectionsOwner || lead.assignedTo || "Unassigned";
      const row = ownerMap.get(owner) ?? { owner, won: 0, booked: 0, collected: 0, outstanding: 0 };
      row.won += 1;
      row.booked += wonRevenueValue(lead);
      row.collected += Math.max(0, lead.collectedAmount ?? 0);
      row.outstanding += outstandingAmount(lead);
      ownerMap.set(owner, row);
    });
    const collectionsByOwner = Array.from(ownerMap.values())
      .map((row) => ({ ...row, realizationRate: row.booked > 0 ? (row.collected / row.booked) * 100 : 0 }))
      .sort((a, b) => b.outstanding - a.outstanding);

    const openingPipelineValue = filteredLeads
      .filter((lead) => {
        if (!firstMonth) return false;
        const key = monthKeyFromDate(lead.dateAdded);
        return key < firstMonth && PIPELINE_VALUE_STATUSES.includes(lead.leadStatus);
      })
      .reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
    const addedPipelineValue = filteredLeads
      .filter((lead) => {
        if (!firstMonth || !lastMonth) return false;
        const key = monthKeyFromDate(lead.dateAdded);
        return key >= firstMonth && key <= lastMonth && PIPELINE_VALUE_STATUSES.includes(lead.leadStatus);
      })
      .reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);
    const wonInRangeValue = filteredLeads
      .filter((lead) => lead.leadStatus === "Won" && (!firstMonth || (monthKeyFromDate(lead.wonDate) >= firstMonth && monthKeyFromDate(lead.wonDate) <= (lastMonth ?? monthKeyFromDate(lead.wonDate)))))
      .reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
    const lostInRangeValue = filteredLeads
      .filter((lead) => lead.leadStatus === "Lost" && (!firstMonth || (monthKeyFromDate(lead.dateAdded) >= firstMonth && monthKeyFromDate(lead.dateAdded) <= (lastMonth ?? monthKeyFromDate(lead.dateAdded)))))
      .reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0);

    return {
      projectionRows,
      closedOutcomeRows,
      forecastRows,
      projectionTotal,
      openPipelineTotal,
      bookedTotal,
      collectedTotal,
      outstandingTotal,
      wonTotal,
      lostTotal,
      leadCreatedInRange,
      bookedAchievement,
      collectedAchievement,
      realizationRate,
      paymentStatusCounts,
      collectionAging,
      collectionsByOwner,
      waterfall: {
        openingPipelineValue,
        addedPipelineValue,
        wonInRangeValue,
        lostInRangeValue,
        closingPipelineValue: openPipelineTotal,
      },
      scopeLabel: bounds ? `${bounds.start} to ${bounds.end}` : "All months",
    };
  }, [
    visibleLeads,
    activities,
    revenueRangePreset,
    revenueCustomStart,
    revenueCustomEnd,
    revenueAssigneeFilter,
    revenueSourceFilter,
    revenueServiceFilter,
    revenueForecastMode,
    revenueBookedTarget,
    revenueCollectedTarget,
  ]);

  const revenueRowsForView = useMemo(() => {
    if (revenueShowEmptyMonths) return revenueAnalytics.projectionRows;
    return revenueAnalytics.projectionRows.filter(
      (row) => row.total > 0 || row.projectedUnweighted > 0 || row.projectedWeighted > 0 || row.openPipeline > 0,
    );
  }, [revenueAnalytics.projectionRows, revenueShowEmptyMonths]);

  const closedOutcomeRowsForView = useMemo(() => {
    if (revenueShowEmptyMonths) return revenueAnalytics.closedOutcomeRows;
    return revenueAnalytics.closedOutcomeRows.filter(
      (row) => row.won > 0 || row.lost > 0 || row.booked > 0 || row.collected > 0 || row.outstanding > 0,
    );
  }, [revenueAnalytics.closedOutcomeRows, revenueShowEmptyMonths]);

  const forecastActualRowsForView = useMemo(
    () => revenueAnalytics.forecastRows.filter((row) => row.forecast > 0 || row.actual > 0),
    [revenueAnalytics.forecastRows],
  );
  const hiddenForecastMonthsCount = Math.max(0, revenueAnalytics.forecastRows.length - forecastActualRowsForView.length);

  const revenueWaterfallChartData = useMemo(() => {
    const waterfall = revenueAnalytics.waterfall;
    const steps = [
      { key: "opening", label: "Opening", mode: "absolute" as const, value: waterfall.openingPipelineValue, tone: "neutral" as const },
      { key: "added", label: "Added", mode: "delta" as const, value: waterfall.addedPipelineValue, tone: "positive" as const },
      { key: "won", label: "Won", mode: "delta" as const, value: -waterfall.wonInRangeValue, tone: "won" as const },
      { key: "lost", label: "Lost", mode: "delta" as const, value: -waterfall.lostInRangeValue, tone: "negative" as const },
      { key: "closing", label: "Closing", mode: "closing" as const, value: waterfall.closingPipelineValue, tone: "neutral" as const },
    ];

    let cursor = 0;
    return steps.map((step) => {
      let from = 0;
      let to = 0;
      if (step.mode === "absolute") {
        from = 0;
        to = Math.max(0, step.value);
        cursor = to;
      } else if (step.mode === "delta") {
        from = cursor;
        to = cursor + step.value;
        cursor = to;
      } else {
        from = cursor;
        to = Math.max(0, step.value);
        cursor = to;
      }
      return {
        ...step,
        from,
        to,
        base: Math.min(from, to),
        span: Math.abs(to - from),
        impact: to - from,
      };
    });
  }, [revenueAnalytics.waterfall]);
  const sourceRowsForView = useMemo(
    () => filterRowsByMonthRange(metrics.monthlySourceRows, sourcesRangePreset, sourcesCustomStart, sourcesCustomEnd),
    [metrics.monthlySourceRows, sourcesRangePreset, sourcesCustomStart, sourcesCustomEnd],
  );

  useEffect(() => {
    if (sourcesRangePreset !== "1" && sourcesRangePreset !== "3") {
      setSourcesComparePrevious(false);
    }
  }, [sourcesRangePreset]);

  const sourceCompareSummary = useMemo(() => {
    if (!sourcesComparePrevious) return null;
    if (sourcesRangePreset !== "1" && sourcesRangePreset !== "3") return null;
    const span = Number(sourcesRangePreset);
    const currentEnd = currentMonthKey();
    const currentStart = shiftMonthKey(currentEnd, -(span - 1));
    const previousEnd = shiftMonthKey(currentStart, -1);
    const previousStart = shiftMonthKey(previousEnd, -(span - 1));
    const aggregateWindow = (start: string, end: string) => {
      const rows = metrics.monthlySourceRows.filter((row) => row.monthKey >= start && row.monthKey <= end);
      return {
        total: rows.reduce((sum, row) => sum + row.total, 0),
        won: rows.reduce((sum, row) => sum + row.won, 0),
      };
    };
    const current = aggregateWindow(currentStart, currentEnd);
    const previous = aggregateWindow(previousStart, previousEnd);
    return {
      currentLabel: `${currentStart} to ${currentEnd}`,
      previousLabel: `${previousStart} to ${previousEnd}`,
      leadTrend: getTrend(current.total, previous.total),
      wonTrend: getTrend(current.won, previous.won),
    };
  }, [sourcesComparePrevious, sourcesRangePreset, metrics.monthlySourceRows]);

  const sourceBasicTop3 = useMemo(() => {
    const totals = LEAD_SOURCES.map((source) => ({
      source,
      count: sourceRowsForView.reduce((sum, row) => sum + (row.bySource[source]?.count ?? 0), 0),
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return totals.map((entry) => entry.source);
  }, [sourceRowsForView]);

  const revenueMoM = useMemo(() => {
    const rows = [...revenueRowsForView].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const current = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    const currentValue = current ? (revenueForecastMode === "weighted" ? current.projectedWeighted : current.projectedUnweighted) : 0;
    const previousValue = previous ? (revenueForecastMode === "weighted" ? previous.projectedWeighted : previous.projectedUnweighted) : 0;
    return getTrend(currentValue, previousValue);
  }, [revenueRowsForView, revenueForecastMode]);

  const sourcesMoM = useMemo(() => {
    const rows = [...sourceRowsForView].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const current = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    return getTrend(current?.total ?? 0, previous?.total ?? 0);
  }, [sourceRowsForView]);

  const runCsvExport = (exporter: () => void) => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      exporter();
    } finally {
      window.setTimeout(() => setIsExportingCsv(false), 350);
    }
  };

  const exportRevenueCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `revenue-split-${todayISODate()}.csv`,
        ["Month", "Expected Closures", "Projected (Unweighted)", "Projected (Weighted)", "Open Pipeline"],
        revenueRowsForView.map((row) => [
          row.monthLabel,
          row.total,
          row.projectedUnweighted,
          row.projectedWeighted,
          row.openPipeline,
        ]),
      );
    });
  };

  const exportClosedOutcomesCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `closed-outcomes-${todayISODate()}.csv`,
        ["Month", "Won", "Lost", "Booked Revenue", "Collected Revenue", "Outstanding", "Realization %"],
        closedOutcomeRowsForView.map((row) => [row.monthLabel, row.won, row.lost, row.booked, row.collected, row.outstanding, row.realizationRate.toFixed(1)]),
      );
    });
  };

  const exportForecastCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `forecast-vs-actual-${todayISODate()}.csv`,
        ["Month", "Forecast", "Actual", "Gap", "Accuracy %"],
        forecastActualRowsForView.map((row) => [
          row.monthLabel,
          row.forecast,
          row.actual,
          row.gap,
          row.accuracy.toFixed(1),
        ]),
      );
    });
  };

  const exportSourceMonthlyCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `source-monthly-${todayISODate()}.csv`,
        ["Month", "Total Leads", "Won", "Top Source"],
        sourceRowsForView.map((row) => [row.monthLabel, row.total, row.won, row.topSource]),
      );
    });
  };

  const exportSourceAllTimeCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `source-all-time-${todayISODate()}.csv`,
        ["Source", "Leads", "Won", "Conversion %"],
        sourceRows.map((row) => [row.source, row.count, row.won, row.conversion.toFixed(1)]),
      );
    });
  };

  const leadActivities = useMemo(() => {
    if (!selectedLeadId) return [] as LeadActivity[];
    return activities
      .filter((a) => a.leadId === selectedLeadId && (isOwner || a.tenantId === currentTenantId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activities, selectedLeadId, isOwner, currentTenantId]);

  const latestStatusTransitionByLead = useMemo(() => {
    const transitions = new Map<string, LeadStatusTransition>();
    activities.forEach((activity) => {
      if (!isOwner && activity.tenantId !== currentTenantId) return;
      activity.changes.forEach((change) => {
        const parsed = parseLeadStatusTransition(change);
        if (!parsed) return;
        const from = parsed.from as LeadStatus;
        const to = parsed.to as LeadStatus;
        if (!LEAD_STATUSES.includes(from) || !LEAD_STATUSES.includes(to)) return;
        const existing = transitions.get(activity.leadId);
        if (!existing || new Date(activity.createdAt).getTime() > new Date(existing.at).getTime()) {
          transitions.set(activity.leadId, { from, to, at: activity.createdAt });
        }
      });
    });
    return transitions;
  }, [activities, currentTenantId, isOwner]);

  const selectedLead = useMemo(
    () => (selectedLeadId ? visibleLeads.find((lead) => lead.id === selectedLeadId) ?? null : null),
    [visibleLeads, selectedLeadId],
  );

  const selectedLeadInvoices = useMemo(() => {
    if (!selectedLead) return [] as Invoice[];
    return visibleInvoices.filter((invoice) => invoice.leadId === selectedLead.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [visibleInvoices, selectedLead]);

  const selectedLeadStatusTransition = useMemo(
    () => (selectedLead ? latestStatusTransitionByLead.get(selectedLead.id) ?? null : null),
    [selectedLead, latestStatusTransitionByLead],
  );

  const sourceDrilldownLeads = useMemo(() => {
    if (!sourceDrilldown) return [] as Lead[];
    return visibleLeads
      .filter((lead) => {
        if (sourceDrilldown.source && lead.leadSource !== sourceDrilldown.source) return false;
        if (!sourceDrilldown.monthKey) return true;
        return monthKeyFromDate(lead.dateAdded) === sourceDrilldown.monthKey;
      })
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  }, [sourceDrilldown, visibleLeads]);

  const revenueDrilldownLeads = useMemo(() => {
    if (!revenueDrilldown) return [] as Lead[];
    const inSegment = (lead: Lead) => {
      if (revenueAssigneeFilter !== "All" && lead.assignedTo !== revenueAssigneeFilter) return false;
      if (revenueSourceFilter !== "All" && lead.leadSource !== revenueSourceFilter) return false;
      if (revenueServiceFilter !== "All" && lead.serviceInterested !== revenueServiceFilter) return false;
      return true;
    };
    if (revenueDrilldown.type === "projection") {
      return visibleLeads
        .filter((lead) => inSegment(lead) && lead.leadStatus !== "Lost" && monthKeyFromDate(lead.expectedClosingDate) === revenueDrilldown.monthKey)
        .sort((a, b) => b.dealValue - a.dealValue);
    }
    if (revenueDrilldown.type === "won") {
      return visibleLeads
        .filter((lead) => inSegment(lead) && lead.leadStatus === "Won" && monthKeyFromDate(lead.wonDate) === revenueDrilldown.monthKey)
        .sort((a, b) => wonRevenueValue(b) - wonRevenueValue(a));
    }
    const lostLeadIds = new Set(
      activities
        .filter((entry) => {
          const key = monthKeyFromDate(entry.createdAt.slice(0, 10));
          return key === revenueDrilldown.monthKey && entry.changes.some((change) => change.includes("Lead Status:") && change.includes("-> Lost"));
        })
        .map((entry) => entry.leadId),
    );
    return visibleLeads
      .filter((lead) => inSegment(lead) && lead.leadStatus === "Lost" && lostLeadIds.has(lead.id))
      .sort((a, b) => b.dealValue - a.dealValue);
  }, [revenueDrilldown, visibleLeads, activities, revenueAssigneeFilter, revenueSourceFilter, revenueServiceFilter]);

  const invoiceDraftAmounts = useMemo(() => invoiceAmountsFromDraft(invoiceDraft), [invoiceDraft]);

  const invoiceAdjustmentsById = useMemo(() => {
    const map = new Map<string, InvoiceAdjustment[]>();
    invoiceAdjustments.forEach((entry) => {
      const bucket = map.get(entry.invoiceId) ?? [];
      bucket.push(entry);
      map.set(entry.invoiceId, bucket);
    });
    map.forEach((entries, key) => {
      map.set(
        key,
        [...entries].sort((a, b) => {
          if (a.noteDate === b.noteDate) return b.createdAt.localeCompare(a.createdAt);
          return b.noteDate.localeCompare(a.noteDate);
        }),
      );
    });
    return map;
  }, [invoiceAdjustments]);

  const invoicePromisesById = useMemo(() => {
    const map = new Map<string, InvoicePromise[]>();
    invoicePromises.forEach((entry) => {
      const bucket = map.get(entry.invoiceId) ?? [];
      bucket.push(entry);
      map.set(entry.invoiceId, bucket);
    });
    map.forEach((entries, key) => {
      map.set(
        key,
        [...entries].sort((a, b) => {
          if (a.promisedDate === b.promisedDate) return b.createdAt.localeCompare(a.createdAt);
          return b.promisedDate.localeCompare(a.promisedDate);
        }),
      );
    });
    return map;
  }, [invoicePromises]);

  const invoiceRangeBounds = useMemo(
    () => resolveRangeBounds(invoiceRangePreset, invoiceCustomStart, invoiceCustomEnd),
    [invoiceRangePreset, invoiceCustomStart, invoiceCustomEnd],
  );

  const invoiceScopeLabel = useMemo(() => {
    if (!invoiceRangeBounds) return "Custom range (set start and end month)";
    return `${invoiceRangeBounds.start} to ${invoiceRangeBounds.end}`;
  }, [invoiceRangeBounds]);

  const invoiceClientOptions = useMemo(() => {
    const options = Array.from(new Set(visibleInvoices.map((invoice) => invoice.billedToCompany || "Unknown")));
    return options.sort((a, b) => a.localeCompare(b));
  }, [visibleInvoices]);

  const filteredInvoices = useMemo(() => {
    return visibleInvoices
      .filter((invoice) => {
        if (invoiceLeadFilter !== "All" && invoice.leadId !== invoiceLeadFilter) return false;
        if (invoiceClientFilter !== "All" && (invoice.billedToCompany || "Unknown") !== invoiceClientFilter) return false;
        const issueMonth = monthKeyFromDate(invoice.issueDate || invoice.createdAt.slice(0, 10));
        if (invoiceRangeBounds && (issueMonth < invoiceRangeBounds.start || issueMonth > invoiceRangeBounds.end)) return false;
        const normalized = normalizeInvoiceStatus(invoice, invoiceEffectiveTotal(invoice, invoiceAdjustmentsById.get(invoice.id) ?? []));
        if (invoiceStatusFilter !== "All" && normalized !== invoiceStatusFilter) return false;
        return true;
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [visibleInvoices, invoiceLeadFilter, invoiceClientFilter, invoiceStatusFilter, invoiceRangeBounds, invoiceAdjustmentsById]);

  const invoiceMetrics = useMemo(() => {
    const total = filteredInvoices.length;
    const totalValue = filteredInvoices.reduce((sum, invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      return sum + invoiceEffectiveTotal(invoice, adjustments);
    }, 0);
    const paidValue = filteredInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
    const outstandingValue = filteredInvoices.reduce((sum, invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
      return sum + Math.max(0, effectiveTotal - invoice.amountPaid);
    }, 0);
    const overdueCount = filteredInvoices.filter((invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      return normalizeInvoiceStatus(invoice, invoiceEffectiveTotal(invoice, adjustments)) === "Overdue";
    }).length;
    const paidCount = filteredInvoices.filter((invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      return normalizeInvoiceStatus(invoice, invoiceEffectiveTotal(invoice, adjustments)) === "Paid";
    }).length;
    const sentCount = filteredInvoices.filter((invoice) => isInvoiceSentStatus(normalizeInvoiceStatus(invoice, invoiceEffectiveTotal(invoice, invoiceAdjustmentsById.get(invoice.id) ?? [])))).length;
    const pendingApprovalCount = filteredInvoices.filter((invoice) => invoice.approvalStatus === "Pending").length;
    const taxValue = filteredInvoices.reduce((sum, invoice) => sum + invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount, 0);
    return {
      total,
      totalValue,
      paidValue,
      outstandingValue,
      overdueCount,
      paidCount,
      sentCount,
      pendingApprovalCount,
      taxValue,
      realization: totalValue > 0 ? (paidValue / totalValue) * 100 : 0,
      openPromises: filteredInvoices.filter((invoice) => (invoicePromisesById.get(invoice.id) ?? []).some((entry) => entry.status === "Open")).length,
    };
  }, [filteredInvoices, invoiceAdjustmentsById, invoicePromisesById]);

  const latestCollectionsDispatchByInvoice = useMemo(() => {
    const map = new Map<string, CollectionsDispatchLog>();
    tenantCollectionsDispatch.forEach((entry) => {
      const existing = map.get(entry.invoiceId);
      if (!existing || entry.requestedAt > existing.requestedAt) {
        map.set(entry.invoiceId, entry);
      }
    });
    return map;
  }, [tenantCollectionsDispatch]);

  const collectionsDispatchSummary = useMemo(() => {
    const summary = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    tenantCollectionsDispatch.forEach((entry) => {
      summary[entry.status] += 1;
    });
    return summary;
  }, [tenantCollectionsDispatch]);

  const invoiceCollectionsQueue = useMemo(() => {
    return filteredInvoices
      .map((invoice) => {
        const lead = visibleLeads.find((row) => row.id === invoice.leadId);
        const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
        const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
        const status = normalizeInvoiceStatus(invoice, effectiveTotal);
        const overdueDays = invoiceOverdueDays(invoice, effectiveTotal);
        const outstanding = Math.max(0, effectiveTotal - invoice.amountPaid);
        const promises = invoicePromisesById.get(invoice.id) ?? [];
        const latestPromise = promises[0] ?? null;
        const promiseTag = latestPromise
          ? latestPromise.status === "Open"
            ? `PTP ${latestPromise.promisedDate}`
            : `${latestPromise.status} ${latestPromise.promisedDate}`
          : "No PTP";
        return {
          invoice,
          lead,
          status,
          overdueDays,
          stage: dunningStageFromDays(overdueDays),
          outstanding,
          owner: lead?.collectionsOwner || lead?.assignedTo || invoice.createdBy || "Unassigned",
          latestPromise,
          promiseTag,
          latestDispatch: latestCollectionsDispatchByInvoice.get(invoice.id) ?? null,
        };
      })
      .filter((row) => row.status === "Overdue" || row.outstanding > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays || b.outstanding - a.outstanding);
  }, [filteredInvoices, visibleLeads, invoiceAdjustmentsById, invoicePromisesById, latestCollectionsDispatchByInvoice]);

  const invoiceDunningSummary = useMemo(() => {
    const buckets = {
      "D1-D3": { count: 0, amount: 0 },
      "D4-D7": { count: 0, amount: 0 },
      "D8-D15": { count: 0, amount: 0 },
      "D15+": { count: 0, amount: 0 },
    };
    invoiceCollectionsQueue.forEach((row) => {
      if (row.stage === "On Track") return;
      const key = row.stage as "D1-D3" | "D4-D7" | "D8-D15" | "D15+";
      buckets[key].count += 1;
      buckets[key].amount += row.outstanding;
    });
    return buckets;
  }, [invoiceCollectionsQueue]);

  const collectionsOwnerRows = useMemo(() => {
    const map = new Map<string, { owner: string; invoices: number; outstanding: number; critical: number }>();
    invoiceCollectionsQueue.forEach((row) => {
      const key = row.owner || "Unassigned";
      const existing = map.get(key) ?? { owner: key, invoices: 0, outstanding: 0, critical: 0 };
      existing.invoices += 1;
      existing.outstanding += row.outstanding;
      if (row.stage === "D15+" || row.stage === "D8-D15") existing.critical += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding || b.critical - a.critical);
  }, [invoiceCollectionsQueue]);

  const collectionsOutstandingTotal = useMemo(
    () => invoiceCollectionsQueue.reduce((sum, row) => sum + row.outstanding, 0),
    [invoiceCollectionsQueue],
  );

  const collectionsDeliverySuccessRate = useMemo(() => {
    const delivered = collectionsDispatchSummary.delivered + collectionsDispatchSummary.read;
    const attempted =
      collectionsDispatchSummary.queued
      + collectionsDispatchSummary.sent
      + collectionsDispatchSummary.delivered
      + collectionsDispatchSummary.read
      + collectionsDispatchSummary.failed;
    return attempted > 0 ? (delivered / attempted) * 100 : 0;
  }, [collectionsDispatchSummary]);

  const invoiceClientLedgerRows = useMemo(() => {
    const map = new Map<string, {
      client: string;
      invoices: number;
      sent: number;
      sentRate: number;
      billed: number;
      collected: number;
      outstanding: number;
      overdue: number;
      lastIssueDate: string;
    }>();
    filteredInvoices.forEach((invoice) => {
      const key = invoice.billedToCompany || "Unknown";
      const existing = map.get(key) ?? {
        client: key,
        invoices: 0,
        sent: 0,
        sentRate: 0,
        billed: 0,
        collected: 0,
        outstanding: 0,
        overdue: 0,
        lastIssueDate: "",
      };
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
      const normalizedStatus = normalizeInvoiceStatus(invoice, effectiveTotal);
      existing.invoices += 1;
      if (isInvoiceSentStatus(normalizedStatus)) existing.sent += 1;
      existing.billed += effectiveTotal;
      existing.collected += Math.max(0, invoice.amountPaid);
      existing.outstanding += Math.max(0, effectiveTotal - invoice.amountPaid);
      if (normalizedStatus === "Overdue") existing.overdue += 1;
      if (!existing.lastIssueDate || invoice.issueDate > existing.lastIssueDate) existing.lastIssueDate = invoice.issueDate;
      existing.sentRate = existing.invoices > 0 ? (existing.sent / existing.invoices) * 100 : 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.billed - a.billed);
  }, [filteredInvoices, invoiceAdjustmentsById]);

  const invoiceMonthlyRows = useMemo(() => {
    if (!invoiceRangeBounds) return [] as Array<{
      monthKey: string;
      monthLabel: string;
      invoices: number;
      sent: number;
      billed: number;
      collected: number;
      outstanding: number;
      cumulativeSent: number;
      cumulativeBilled: number;
      cumulativeCollected: number;
      cumulativeOutstanding: number;
    }>;
    const months: Array<{ monthKey: string; monthLabel: string }> = [];
    let cursor = invoiceRangeBounds.start;
    while (cursor <= invoiceRangeBounds.end) {
      const [year, month] = cursor.split("-").map(Number);
      const label = formatMonthYear(new Date(year, (month || 1) - 1, 1));
      months.push({ monthKey: cursor, monthLabel: label });
      cursor = shiftMonthKey(cursor, 1);
    }
    let cumulativeBilled = 0;
    let cumulativeCollected = 0;
    let cumulativeSent = 0;
    return months.map((month) => {
      const monthInvoices = filteredInvoices.filter((invoice) => monthKeyFromDate(invoice.issueDate || invoice.createdAt.slice(0, 10)) === month.monthKey);
      const billed = monthInvoices.reduce((sum, invoice) => sum + invoiceEffectiveTotal(invoice, invoiceAdjustmentsById.get(invoice.id) ?? []), 0);
      const collected = monthInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amountPaid), 0);
      const sent = monthInvoices.filter((invoice) => isInvoiceSentStatus(normalizeInvoiceStatus(invoice, invoiceEffectiveTotal(invoice, invoiceAdjustmentsById.get(invoice.id) ?? [])))).length;
      const outstanding = Math.max(0, billed - collected);
      cumulativeSent += sent;
      cumulativeBilled += billed;
      cumulativeCollected += collected;
      return {
        monthKey: month.monthKey,
        monthLabel: month.monthLabel,
        invoices: monthInvoices.length,
        sent,
        billed,
        collected,
        outstanding,
        cumulativeSent,
        cumulativeBilled,
        cumulativeCollected,
        cumulativeOutstanding: Math.max(0, cumulativeBilled - cumulativeCollected),
      };
    });
  }, [invoiceRangeBounds, filteredInvoices, invoiceAdjustmentsById]);

  const financeReconciliation = useMemo(() => {
    const bounds = resolveRangeBounds(revenueRangePreset, revenueCustomStart, revenueCustomEnd);
    const inScope = (monthKey: string) => {
      if (!monthKey) return false;
      if (!bounds) return true;
      return monthKey >= bounds.start && monthKey <= bounds.end;
    };

    const scopedWonLeads = visibleLeads.filter((lead) => {
      if (lead.leadStatus !== "Won") return false;
      const assigneeMatch = revenueAssigneeFilter === "All" || lead.assignedTo === revenueAssigneeFilter;
      const sourceMatch = revenueSourceFilter === "All" || lead.leadSource === revenueSourceFilter;
      const serviceMatch = revenueServiceFilter === "All" || lead.serviceInterested === revenueServiceFilter;
      if (!assigneeMatch || !sourceMatch || !serviceMatch) return false;
      const monthKey = monthKeyFromDate(lead.wonDate || lead.dateAdded);
      return inScope(monthKey);
    });

    const scopedWonLeadMap = new Map(scopedWonLeads.map((lead) => [lead.id, lead]));
    const scopedInvoices = visibleInvoices.filter((invoice) => {
      if (invoice.status === "Cancelled") return false;
      const lead = scopedWonLeadMap.get(invoice.leadId);
      if (!lead) return false;
      const monthKey = monthKeyFromDate(invoice.issueDate || invoice.createdAt.slice(0, 10));
      return inScope(monthKey);
    });

    const invoicedByLeadId = new Map<string, number>();
    scopedInvoices.forEach((invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      const total = invoiceEffectiveTotal(invoice, adjustments);
      invoicedByLeadId.set(invoice.leadId, (invoicedByLeadId.get(invoice.leadId) ?? 0) + total);
    });

    const comparisonRows = scopedWonLeads.map((lead) => {
      const booked = wonRevenueValue(lead);
      const invoiced = invoicedByLeadId.get(lead.id) ?? 0;
      return {
        lead,
        booked,
        invoiced,
        delta: booked - invoiced,
      };
    });

    const largestMismatches = comparisonRows
      .filter((row) => Math.abs(row.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8);

    const bookedTotal = scopedWonLeads.reduce((sum, lead) => sum + wonRevenueValue(lead), 0);
    const invoicedTotal = scopedInvoices.reduce((sum, invoice) => {
      const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
      return sum + invoiceEffectiveTotal(invoice, adjustments);
    }, 0);

    return {
      bookedTotal,
      invoicedTotal,
      delta: bookedTotal - invoicedTotal,
      uninvoicedWonLeads: comparisonRows.filter((row) => row.invoiced === 0).length,
      underInvoicedLeads: comparisonRows.filter((row) => row.delta > 0).length,
      overInvoicedLeads: comparisonRows.filter((row) => row.delta < 0).length,
      largestMismatches,
      scopeLabel: bounds ? `${bounds.start} to ${bounds.end}` : "All months",
    };
  }, [
    visibleLeads,
    visibleInvoices,
    invoiceAdjustmentsById,
    revenueRangePreset,
    revenueCustomStart,
    revenueCustomEnd,
    revenueAssigneeFilter,
    revenueSourceFilter,
    revenueServiceFilter,
  ]);

  const collectionActionQueue = useMemo(() => {
    const bounds = resolveRangeBounds(revenueRangePreset, revenueCustomStart, revenueCustomEnd);
    const rows = visibleLeads
      .filter((lead) => {
        if (lead.leadStatus !== "Won") return false;
        const assigneeMatch = revenueAssigneeFilter === "All" || lead.assignedTo === revenueAssigneeFilter;
        const sourceMatch = revenueSourceFilter === "All" || lead.leadSource === revenueSourceFilter;
        const serviceMatch = revenueServiceFilter === "All" || lead.serviceInterested === revenueServiceFilter;
        if (!assigneeMatch || !sourceMatch || !serviceMatch) return false;
        if (!bounds) return true;
        const monthKey = monthKeyFromDate(lead.wonDate || lead.dateAdded);
        return monthKey >= bounds.start && monthKey <= bounds.end;
      })
      .map((lead) => {
        const outstanding = outstandingAmount(lead);
        const ageDays = daysSince(lead.wonDate || lead.dateAdded);
        const bucket = ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : "60+";
        return {
          lead,
          outstanding,
          ageDays,
          bucket,
          dueTag: dateTag(lead),
        };
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => b.ageDays - a.ageDays || b.outstanding - a.outstanding);
    return rows.slice(0, 20);
  }, [
    visibleLeads,
    revenueRangePreset,
    revenueCustomStart,
    revenueCustomEnd,
    revenueAssigneeFilter,
    revenueSourceFilter,
    revenueServiceFilter,
  ]);

  const onboardingChecklist = useMemo(() => {
    const steps = isLiteProduct
      ? [
          { key: "assignee", label: "Add at least one team assignee", done: assigneeOptions.length > 0 },
          { key: "lead", label: "Capture your first lead", done: visibleLeads.length > 0 },
          { key: "followup", label: "Schedule first follow-up", done: visibleLeads.some((lead) => !!lead.nextFollowupDate) },
          { key: "contacted", label: "Move one lead to Contacted", done: visibleLeads.some((lead) => lead.leadStatus !== "New") },
          { key: "done", label: "Complete one follow-up", done: visibleLeads.some((lead) => lead.followupStatus === "Done") },
        ]
      : [
          { key: "assignee", label: "Add at least one team assignee", done: assigneeOptions.length > 0 },
          { key: "lead", label: "Capture your first lead", done: visibleLeads.length > 0 },
          { key: "followup", label: "Schedule first follow-up", done: visibleLeads.some((lead) => !!lead.nextFollowupDate) },
          { key: "won", label: "Move one lead to Won", done: visibleLeads.some((lead) => lead.leadStatus === "Won") },
          ...(canUseInvoicing
            ? [{ key: "invoice", label: "Create your first invoice", done: visibleInvoices.length > 0 }]
            : []),
        ];
    const completed = steps.filter((step) => step.done).length;
    return {
      steps,
      completed,
      total: steps.length,
      progress: Math.round((completed / steps.length) * 100),
    };
  }, [assigneeOptions.length, canUseInvoicing, isLiteProduct, visibleLeads, visibleInvoices]);

  const quickFollowCandidates = useMemo(
    () => visibleLeads.filter((lead) => lead.followupStatus === "Pending").slice(0, 200),
    [visibleLeads],
  );

  useEffect(() => {
    if (quickFollowCandidates.length === 0) {
      setQuickFollowLeadId("");
      return;
    }
    if (!quickFollowLeadId || !quickFollowCandidates.some((lead) => lead.id === quickFollowLeadId)) {
      setQuickFollowLeadId(quickFollowCandidates[0].id);
    }
  }, [quickFollowCandidates, quickFollowLeadId]);

  const invoicePaymentsById = useMemo(() => {
    const map = new Map<string, InvoicePayment[]>();
    invoicePayments.forEach((payment) => {
      const bucket = map.get(payment.invoiceId) ?? [];
      bucket.push(payment);
      map.set(payment.invoiceId, bucket);
    });
    map.forEach((entries, key) => {
      map.set(
        key,
        [...entries].sort((a, b) => {
          if (a.paidAt === b.paidAt) return b.createdAt.localeCompare(a.createdAt);
          return b.paidAt.localeCompare(a.paidAt);
        }),
      );
    });
    return map;
  }, [invoicePayments]);

  const ledgerInvoice = useMemo(
    () => (ledgerInvoiceId ? filteredInvoices.find((invoice) => invoice.id === ledgerInvoiceId) ?? null : null),
    [ledgerInvoiceId, filteredInvoices],
  );

  const ledgerPayments = useMemo(() => {
    if (!ledgerInvoice) return [] as InvoicePayment[];
    return invoicePaymentsById.get(ledgerInvoice.id) ?? [];
  }, [ledgerInvoice, invoicePaymentsById]);

  const ledgerAdjustments = useMemo(() => {
    if (!ledgerInvoice) return [] as InvoiceAdjustment[];
    return invoiceAdjustmentsById.get(ledgerInvoice.id) ?? [];
  }, [ledgerInvoice, invoiceAdjustmentsById]);

  const paymentModalInvoice = useMemo(
    () => (paymentModalInvoiceId ? invoices.find((invoice) => invoice.id === paymentModalInvoiceId) ?? null : null),
    [paymentModalInvoiceId, invoices],
  );

  const promiseModalInvoice = useMemo(
    () => (promiseModalInvoiceId ? invoices.find((invoice) => invoice.id === promiseModalInvoiceId) ?? null : null),
    [promiseModalInvoiceId, invoices],
  );

  useEffect(() => {
    if (invoicePayments.length === 0 && invoiceAdjustments.length === 0) return;
    setInvoices((prev) => {
      let changed = false;
      const next = prev.map((invoice) => {
        const entries = invoicePaymentsById.get(invoice.id) ?? [];
        const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
        if (entries.length === 0 && adjustments.length === 0) return invoice;
        const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
        const amountPaid = Math.min(
          effectiveTotal,
          entries.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0),
        );
        const balanceAmount = Math.max(0, effectiveTotal - amountPaid);
        const paidAt = entries[0]?.paidAt ?? "";
        const updated = {
          ...invoice,
          amountPaid,
          balanceAmount,
          paidAt,
          updatedAt: new Date().toISOString(),
        };
        const normalizedStatus = invoice.status === "Cancelled" ? "Cancelled" : normalizeInvoiceStatus(updated, effectiveTotal);
        if (
          invoice.amountPaid !== updated.amountPaid
          || invoice.balanceAmount !== updated.balanceAmount
          || invoice.paidAt !== updated.paidAt
          || invoice.status !== normalizedStatus
        ) {
          changed = true;
          return { ...updated, status: normalizedStatus };
        }
        return invoice;
      });
      return changed ? next : prev;
    });
  }, [invoicePayments, invoiceAdjustments, invoicePaymentsById, invoiceAdjustmentsById]);

  useEffect(() => {
    setInvoicePromises((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        if (entry.status !== "Open") return entry;
        const invoice = invoices.find((row) => row.id === entry.invoiceId);
        if (!invoice) return entry;
        const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
        const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
        const status = normalizeInvoiceStatus(invoice, effectiveTotal);
        if (status === "Paid" || invoice.amountPaid >= entry.promisedAmount) {
          changed = true;
          return {
            ...entry,
            status: "Honored" as const,
            fulfilledAt: todayISODate(),
          };
        }
        if (entry.promisedDate && entry.promisedDate < todayISODate()) {
          changed = true;
          return {
            ...entry,
            status: "Missed" as const,
          };
        }
        return entry;
      });
      return changed ? next : prev;
    });
  }, [invoices, invoiceAdjustmentsById]);

  useEffect(() => {
    const today = todayISODate();
    setInvoices((prev) => {
      const generated: Invoice[] = [];
      const now = new Date().toISOString();
      const roots = prev.filter(
        (invoice) => invoice.recurrence !== "none" && invoice.recurrenceCount > 1 && invoice.recurrenceIndex === 1,
      );
      if (roots.length === 0) return prev;
      roots.forEach((root) => {
        const step = recurrenceMonthStep(root.recurrence);
        if (step <= 0) return;
        const parentKey = root.recurrenceParentId ?? root.id;
        const tenantSlug = tenants.find((tenant) => tenant.id === root.tenantId)?.slug ?? "INV";
        const dueGapDays = Math.max(
          0,
          Math.round(
            (new Date(`${root.dueDate}T00:00:00`).getTime() - new Date(`${root.issueDate}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
        const existingIndexes = new Set(
          prev
            .filter((entry) => (entry.recurrenceParentId ?? entry.id) === parentKey)
            .map((entry) => entry.recurrenceIndex),
        );
        for (let index = 2; index <= root.recurrenceCount; index += 1) {
          if (existingIndexes.has(index)) continue;
          const issueDate = shiftISOMonths(root.issueDate, step * (index - 1));
          if (issueDate > today) break;
          const dueDate = shiftISODate(issueDate, dueGapDays);
          const requiresApproval = root.approvalStatus !== "Not Required";
          const statusBase: InvoiceStatus = requiresApproval ? "Draft" : "Issued";
          const approvalBase: InvoiceApprovalStatus = requiresApproval ? "Pending" : "Not Required";
          const nextInvoice: Invoice = {
            ...root,
            id: makeId(),
            invoiceNumber: nextInvoiceNumber([...prev, ...generated], tenantSlug),
            issueDate,
            dueDate,
            status: statusBase,
            approvalStatus: approvalBase,
            approvalRequestedBy: root.createdBy,
            approvalRequestedAt: now,
            approvedBy: requiresApproval ? "" : root.approvedBy || root.createdBy,
            approvedAt: requiresApproval ? "" : now,
            approvalRemarks: "",
            amountPaid: 0,
            balanceAmount: root.totalAmount,
            paidAt: "",
            recurrenceParentId: parentKey,
            recurrenceIndex: index,
            createdAt: now,
            updatedAt: now,
          };
          generated.push({ ...nextInvoice, status: normalizeInvoiceStatus(nextInvoice) });
        }
      });
      if (generated.length === 0) return prev;
      return [...generated, ...prev];
    });
  }, [invoices, tenants]);

  const sendInvoiceEmail = async (invoice: Invoice) => {
    if (invoice.approvalStatus === "Pending" || invoice.approvalStatus === "Rejected" || invoice.status === "Draft") {
      setError("Approve and issue invoice before sending email.");
      return;
    }
    const recipient = invoice.billedToEmail?.trim();
    if (!recipient) {
      setError("Client email is missing on this invoice.");
      return;
    }
    const invoiceLabel = invoiceLabelForDoc(invoice);
    const subject = encodeURIComponent(`${invoiceLabel} ${invoice.invoiceNumber} | ${invoice.supplierName || "Yugam Consulting"}`);
    const body = encodeURIComponent(
      `Hello ${invoice.billedToName},\n\nPlease find your ${invoiceLabel} details below:\nInvoice: ${invoice.invoiceNumber}\nIssue Date: ${formatDateDisplay(invoice.issueDate)}\nDue Date: ${formatDateDisplay(invoice.dueDate)}\nPO Number: ${invoice.poNumber || "-"}\nPayment Terms: ${invoice.paymentTermsDays} days\nTotal: ${formatInr(invoice.totalAmount)}\nPaid: ${formatInr(invoice.amountPaid)}\nBalance: ${formatInr(invoice.balanceAmount)}\nBank: ${invoice.bankName || "-"} | A/C ${invoice.bankAccountNumber || "-"} | IFSC ${invoice.bankIfsc || "-"}\n\nRegards,\n${invoice.supplierName || "Yugam Consulting"}`,
    );
    const webhook = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_INVOICE_EMAIL_WEBHOOK_URL;
    if (webhook) {
      try {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: invoice.tenantId,
            to: recipient,
            subject: `${invoiceLabel} ${invoice.invoiceNumber} | ${invoice.supplierName || "Yugam Consulting"}`,
            text: decodeURIComponent(body),
            invoice,
          }),
        });
        if (response.ok) {
          setNotice(`Invoice email sent to ${recipient}.`);
          logActivity(invoice.leadId, "Invoice emailed", [`${invoice.invoiceNumber} sent to ${recipient}`]);
          return;
        }
        showWebhookRetryToast(
          `Unable to deliver invoice email for ${invoice.invoiceNumber}.`,
          "Verify VITE_INVOICE_EMAIL_WEBHOOK_URL, auth headers, and provider response mapping.",
          () => {
            void sendInvoiceEmail(invoice);
          },
        );
        return;
      } catch {
        showWebhookRetryToast(
          `Invoice email webhook failed for ${invoice.invoiceNumber}.`,
          "Check webhook connectivity and server logs, then retry.",
          () => {
            void sendInvoiceEmail(invoice);
          },
        );
        return;
      }
    }
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
    setNotice(`Mail app opened for ${recipient}. Configure webhook for automated delivery.`);
  };

  const downloadInvoicePdf = async (invoice: Invoice) => {
    const pdfModule = await import("jspdf");
    const JsPdfCtor = pdfModule.jsPDF;
    const doc = new JsPdfCtor({ unit: "pt", format: "a4" });
    const invoiceLabel = invoiceLabelForDoc(invoice);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 38;
    let y = 44;

    const drawLabelValue = (label: string, value: string, x: number, top: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label.toUpperCase(), x, top);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(value || "-", x, top + 14);
    };

    doc.setFillColor(246, 248, 255);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 72, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text(invoiceLabel, margin + 12, y + 28);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(invoice.invoiceNumber, margin + 12, y + 48);
    drawLabelValue("Issue date", formatDateDisplay(invoice.issueDate), pageWidth - 220, y + 22);
    drawLabelValue("Due date", formatDateDisplay(invoice.dueDate), pageWidth - 120, y + 22);

    y += 88;
    const half = (pageWidth - margin * 2 - 12) / 2;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, half, 126, 6, 6);
    doc.roundedRect(margin + half + 12, y, half, 126, 6, 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("FROM", margin + 10, y + 16);
    doc.text("BILLED TO", margin + half + 22, y + 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const supplierLines = [
      invoice.supplierName || "Yugam Consulting",
      [invoice.supplierAddress, invoice.supplierCity, invoice.supplierState, invoice.supplierPincode].filter(Boolean).join(", "),
      `${invoice.supplierEmail || "-"} | ${invoice.supplierPhone || "-"}`,
      invoiceLabel === "GST Invoice" ? `GSTIN ${invoice.supplierGstin || "-"} | POS ${invoice.placeOfSupplyStateCode || "-"}` : "Non-GST / Flexible",
    ];
    supplierLines.forEach((lineText, index) => {
      doc.text(lineText || "-", margin + 10, y + 34 + index * 16, { maxWidth: half - 20 });
    });

    const billedLines = [
      `${invoice.billedToCompany || "-"} (${invoice.billedToName || "-"})`,
      [invoice.billedToAddress, invoice.billedToCity, invoice.billedToState, invoice.billedToPincode].filter(Boolean).join(", "),
      `${invoice.billedToEmail || "-"} | ${invoice.billedToPhone || "-"}`,
      invoice.buyerGstin ? `GSTIN ${invoice.buyerGstin}` : "GSTIN -",
    ];
    billedLines.forEach((lineText, index) => {
      doc.text(lineText || "-", margin + half + 22, y + 34 + index * 16, { maxWidth: half - 20 });
    });

    y += 144;
    const tableX = margin;
    const tableW = pageWidth - margin * 2;
    const rowH = 22;
    const col = [
      { key: "service", width: tableW * 0.28 },
      { key: "desc", width: tableW * 0.28 },
      { key: "qty", width: tableW * 0.1 },
      { key: "price", width: tableW * 0.14 },
      { key: "gst", width: tableW * 0.08 },
      { key: "amount", width: tableW * 0.12 },
    ];

    doc.setFillColor(241, 245, 249);
    doc.rect(tableX, y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const headers = ["Service", "Description", "Qty", "Unit", "GST", "Amount"];
    let cursorX = tableX + 6;
    headers.forEach((head, idx) => {
      doc.text(head, cursorX, y + 14);
      cursorX += col[idx].width;
    });

    const items = invoice.lineItems.length > 0 ? invoice.lineItems : [
      {
        id: invoice.id,
        serviceName: invoice.serviceName,
        description: invoice.description,
        sacCode: invoice.sacCode,
        quantity: invoice.quantity,
        unitPrice: invoice.unitPrice,
        gstRate: invoice.gstRate,
      },
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    let rowY = y + rowH;
    items.forEach((item) => {
      doc.setDrawColor(226, 232, 240);
      doc.rect(tableX, rowY, tableW, rowH);
      const amount = item.quantity * item.unitPrice;
      const cells = [
        item.serviceName || "-",
        item.description || item.sacCode || "-",
        String(item.quantity || 1),
        formatInr(item.unitPrice || 0),
        `${item.gstRate || 0}%`,
        formatInr(amount),
      ];
      let valueX = tableX + 6;
      cells.forEach((cell, idx) => {
        doc.text(cell, valueX, rowY + 14, { maxWidth: col[idx].width - 8 });
        valueX += col[idx].width;
      });
      rowY += rowH;
    });

    const summaryX = pageWidth - margin - 210;
    const summaryY = rowY + 14;
    doc.roundedRect(summaryX, summaryY, 210, 110, 6, 6);
    drawLabelValue("Subtotal", formatInr(invoice.subtotal), summaryX + 10, summaryY + 16);
    drawLabelValue("Tax", formatInr(invoiceTaxTotal(invoice)), summaryX + 10, summaryY + 40);
    drawLabelValue("Paid", formatInr(invoice.amountPaid), summaryX + 10, summaryY + 64);
    drawLabelValue("Balance", formatInr(invoice.balanceAmount), summaryX + 10, summaryY + 88);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(`Total ${formatInr(invoice.totalAmount)}`, summaryX + 10, summaryY + 108);

    const footerY = doc.internal.pageSize.getHeight() - 64;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Payment Terms: ${invoice.paymentTermsDays} days | PO: ${invoice.poNumber || "-"}`, margin, footerY);
    doc.text(`Bank: ${invoice.bankName || "-"} | A/C ${invoice.bankAccountNumber || "-"} | IFSC ${invoice.bankIfsc || "-"}`, margin, footerY + 14);
    doc.text(`Generated ${formatDateTimeDisplay(new Date().toISOString())}`, margin, footerY + 28);
    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  const openInvoiceComposerForLead = (lead: Lead) => {
    if (!canCreateInvoices) {
      setError("Your department profile has collections-only access. Invoice creation is restricted.");
      return;
    }
    if (!canUseInvoicing) {
      setError("Invoicing is disabled for this subscription package.");
      return;
    }
    if (!INVOICE_ELIGIBLE_STATUSES.includes(lead.leadStatus)) {
      setError("Invoices can be created only for Confirmation, Invoice Sent, or Won leads.");
      return;
    }
    const baseAmount = lead.leadStatus === "Won" ? wonRevenueValue(lead) : safeDealValue(lead.dealValue);
    const tenantProfile = tenants.find((tenant) => tenant.id === lead.tenantId)?.invoiceProfile ?? DEFAULT_INVOICE_PROFILE;
    const matchedProfiles = customerProfiles.filter(
      (profile) => profile.tenantId === lead.tenantId && profile.companyName.trim().toLowerCase() === lead.companyName.trim().toLowerCase(),
    );
    const autoProfile = matchedProfiles.find((profile) => profile.isDefault) ?? matchedProfiles[0] ?? null;
    const paymentTermsDays = autoProfile?.paymentTermsDays ?? 15;
    setInvoiceDraft({
      leadId: lead.id,
      customerProfileId: autoProfile?.id ?? "",
      issueDate: todayISODate(),
      dueDate: shiftISODate(todayISODate(), paymentTermsDays),
      billedToName: autoProfile?.contactName || lead.leadName,
      billedToCompany: autoProfile?.companyName || lead.companyName,
      billedToEmail: autoProfile?.email || lead.emailId,
      billedToPhone: autoProfile?.phone || lead.phoneNumber,
      billedToAddress: autoProfile?.billingAddress || "",
      billedToCity: autoProfile?.billingCity || "",
      billedToState: autoProfile?.billingState || "",
      billedToPincode: autoProfile?.billingPincode || "",
      shippingAddress: autoProfile?.shippingAddress || autoProfile?.billingAddress || "",
      shippingCity: autoProfile?.shippingCity || autoProfile?.billingCity || "",
      shippingState: autoProfile?.shippingState || autoProfile?.billingState || "",
      shippingPincode: autoProfile?.shippingPincode || autoProfile?.billingPincode || "",
      useBillingAsShipping: autoProfile
        ? autoProfile.shippingAddress === autoProfile.billingAddress
          && autoProfile.shippingCity === autoProfile.billingCity
          && autoProfile.shippingState === autoProfile.billingState
          && autoProfile.shippingPincode === autoProfile.billingPincode
        : true,
      paymentTermsDays,
      poNumber: autoProfile?.poNumber || "",
      bankBeneficiaryName: autoProfile?.bankBeneficiaryName || "",
      bankName: autoProfile?.bankName || "",
      bankAccountNumber: autoProfile?.bankAccountNumber || "",
      bankIfsc: autoProfile?.bankIfsc || "",
      supplierName: tenantProfile.legalName,
      supplierAddress: tenantProfile.addressLine,
      supplierCity: tenantProfile.city,
      supplierState: tenantProfile.state,
      supplierPincode: tenantProfile.pincode,
      supplierPhone: tenantProfile.phone,
      supplierEmail: tenantProfile.email,
      supplierStateCode: tenantProfile.stateCode,
      supplierGstin: tenantProfile.gstin,
      buyerGstin: autoProfile?.buyerGstin || "",
      placeOfSupplyStateCode: tenantProfile.stateCode || "33",
      sacCode: "9983",
      reverseCharge: false,
      lineItems: [
        {
          id: makeId(),
          serviceName: lead.serviceInterested,
          description: `${lead.serviceInterested} services for ${lead.companyName}`,
          sacCode: "9983",
          quantity: 1,
          unitPrice: Math.max(0, baseAmount),
          gstRate: 18,
        },
      ],
      serviceName: lead.serviceInterested,
      description: `${lead.serviceInterested} services for ${lead.companyName}`,
      quantity: 1,
      unitPrice: Math.max(0, baseAmount),
      gstRate: 18,
      gstMode: "Intra",
      recurrence: "none",
      recurrenceCount: 1,
      notes: lead.notes || "",
    });
    setCustomerProfileNameDraft(autoProfile?.profileName || `${lead.companyName} Billing`);
    const issuerReady = Boolean(
      tenantProfile.legalName.trim()
      && tenantProfile.addressLine.trim()
      && tenantProfile.city.trim()
      && tenantProfile.state.trim()
      && tenantProfile.pincode.trim()
      && tenantProfile.phone.trim()
      && tenantProfile.email.trim()
      && (!requiresGstCompliance || tenantProfile.gstin.trim()),
    );
    setInvoiceIssuerConfirmed(issuerReady);
    setInvoiceIssuerEditMode(!issuerReady);
    setInvoiceComposerOpen(true);
    setAppView("invoices");
  };

  const setInvoiceLineItem = (itemId: string, updater: (item: InvoiceLineItem) => InvoiceLineItem) => {
    setInvoiceDraft((prev) => {
      const nextItems = prev.lineItems.map((item) => (item.id === itemId ? sanitizeInvoiceLineItem(updater(item)) : item));
      const primary = nextItems[0] ?? sanitizeInvoiceLineItem({});
      return {
        ...prev,
        lineItems: nextItems,
        serviceName: primary.serviceName,
        description: primary.description,
        quantity: primary.quantity,
        unitPrice: primary.unitPrice,
        gstRate: primary.gstRate,
        sacCode: primary.sacCode,
      };
    });
  };

  const addInvoiceLineItem = () => {
    setInvoiceDraft((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        sanitizeInvoiceLineItem({
          id: makeId(),
          serviceName: "",
          description: "",
          sacCode: prev.sacCode || "9983",
          quantity: 1,
          unitPrice: 0,
          gstRate: prev.gstRate || 18,
        }),
      ],
    }));
  };

  const removeInvoiceLineItem = (itemId: string) => {
    const removed = invoiceDraft.lineItems.find((item) => item.id === itemId);
    setInvoiceDraft((prev) => {
      if (prev.lineItems.length <= 1) return prev;
      const nextItems = prev.lineItems.filter((item) => item.id !== itemId);
      const primary = nextItems[0] ?? sanitizeInvoiceLineItem({});
      return {
        ...prev,
        lineItems: nextItems,
        serviceName: primary.serviceName,
        description: primary.description,
        quantity: primary.quantity,
        unitPrice: primary.unitPrice,
        gstRate: primary.gstRate,
        sacCode: primary.sacCode,
      };
    });
    if (removed) {
      toastUndo("Line item removed.", () => {
        setInvoiceDraft((prev) => {
          if (prev.lineItems.some((item) => item.id === removed.id)) return prev;
          const nextItems = [...prev.lineItems, removed];
          const primary = nextItems[0] ?? sanitizeInvoiceLineItem({});
          return {
            ...prev,
            lineItems: nextItems,
            serviceName: primary.serviceName,
            description: primary.description,
            quantity: primary.quantity,
            unitPrice: primary.unitPrice,
            gstRate: primary.gstRate,
            sacCode: primary.sacCode,
          };
        });
      });
    }
  };

  const hasActiveApprovalDelegation = useMemo(() => {
    if (!settings.delegatedApproverUserId || !settings.delegationEndsAt) return false;
    return settings.delegationEndsAt >= todayISODate();
  }, [settings.delegatedApproverUserId, settings.delegationEndsAt]);

  const delegatedApprover = useMemo(() => {
    if (!settings.delegatedApproverUserId) return null;
    return users.find((user) => user.id === settings.delegatedApproverUserId && user.isActive) ?? null;
  }, [settings.delegatedApproverUserId, users]);

  const canApproveInvoices = (invoice: Invoice) => {
    if (!currentUser) return false;
    if (currentUser.role === "owner" || currentUser.role === "admin") return true;
    if (!hasActiveApprovalDelegation || !delegatedApprover) return false;
    if (delegatedApprover.id !== currentUser.id) return false;
    if (delegatedApprover.tenantId !== invoice.tenantId) return false;
    return true;
  };

  const approveInvoice = (invoice: Invoice) => {
    if (!currentUser || !canApproveInvoices(invoice)) {
      setError("Only owner/admin or an active delegated approver can approve invoices.");
      return;
    }
    if (invoice.approvalStatus !== "Pending") {
      setError("Only pending invoices can be approved.");
      return;
    }
    if (invoice.createdBy === currentUser.name) {
      setError("Maker-checker rule: creator cannot approve their own invoice.");
      return;
    }
    const now = new Date().toISOString();
    setInvoices((prev) => prev.map((row) => {
      if (row.id !== invoice.id) return row;
      const updated = {
        ...row,
        approvalStatus: "Approved" as InvoiceApprovalStatus,
        approvedBy: currentUser.name,
        approvedAt: now,
        approvalRemarks: approvalRemarkDraft.trim(),
        status: "Issued" as InvoiceStatus,
        updatedAt: now,
      };
      return { ...updated, status: normalizeInvoiceStatus(updated) };
    }));
    setApprovalRemarkDraft("");
    logActivity(invoice.leadId, "Invoice approved", [`${invoice.invoiceNumber} approved by ${currentUser.name}`]);
    setNotice(`Invoice ${invoice.invoiceNumber} approved and issued.`);
  };

  const rejectInvoice = (invoice: Invoice) => {
    if (!currentUser || !canApproveInvoices(invoice)) {
      setError("Only owner/admin or an active delegated approver can reject invoices.");
      return;
    }
    if (invoice.approvalStatus !== "Pending") {
      setError("Only pending invoices can be rejected.");
      return;
    }
    if (!approvalRemarkDraft.trim()) {
      setError("Add a rejection remark before rejecting invoice.");
      return;
    }
    const now = new Date().toISOString();
    setInvoices((prev) => prev.map((row) => {
      if (row.id !== invoice.id) return row;
      return {
        ...row,
        approvalStatus: "Rejected" as InvoiceApprovalStatus,
        status: "Draft" as InvoiceStatus,
        approvedBy: currentUser.name,
        approvedAt: now,
        approvalRemarks: approvalRemarkDraft.trim(),
        updatedAt: now,
      };
    }));
    setApprovalRemarkDraft("");
    logActivity(invoice.leadId, "Invoice rejected", [`${invoice.invoiceNumber} rejected by ${currentUser.name}`]);
    setNotice(`Invoice ${invoice.invoiceNumber} marked as rejected.`);
  };

  const resubmitInvoiceForApproval = (invoice: Invoice) => {
    if (!currentUser) return;
    if (invoice.approvalStatus !== "Rejected") {
      setError("Only rejected invoices can be resubmitted.");
      return;
    }
    const now = new Date().toISOString();
    setInvoices((prev) => prev.map((row) => {
      if (row.id !== invoice.id) return row;
      return {
        ...row,
        approvalStatus: "Pending" as InvoiceApprovalStatus,
        approvalRequestedBy: currentUser.name,
        approvalRequestedAt: now,
        approvedBy: "",
        approvedAt: "",
        approvalRemarks: "",
        status: "Draft" as InvoiceStatus,
        updatedAt: now,
      };
    }));
    logActivity(invoice.leadId, "Invoice resubmitted", [`${invoice.invoiceNumber} resubmitted for approval`]);
    setNotice(`Invoice ${invoice.invoiceNumber} sent back for approval.`);
  };

  const openAdjustmentModal = (invoice: Invoice, kind: InvoiceAdjustmentType) => {
    setAdjustmentModalInvoiceId(invoice.id);
    setAdjustmentDraft({
      kind,
      amount: Math.max(0, invoice.balanceAmount),
      noteDate: todayISODate(),
      reason: "",
    });
  };

  const submitInvoiceAdjustment = () => {
    if (!adjustmentModalInvoiceId) return;
    const invoice = invoices.find((entry) => entry.id === adjustmentModalInvoiceId);
    if (!invoice) {
      setAdjustmentModalInvoiceId(null);
      return;
    }
    const amount = Math.max(0, Number(adjustmentDraft.amount) || 0);
    if (amount <= 0) {
      setError("Enter a valid adjustment amount.");
      return;
    }
    if (!adjustmentDraft.reason.trim()) {
      setError("Reason is required for credit/debit note.");
      return;
    }
    const entry: InvoiceAdjustment = {
      id: makeId(),
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      leadId: invoice.leadId,
      kind: adjustmentDraft.kind,
      amount,
      noteDate: adjustmentDraft.noteDate || todayISODate(),
      reason: adjustmentDraft.reason.trim(),
      createdBy: currentUser?.name ?? "System",
      createdAt: new Date().toISOString(),
    };
    setInvoiceAdjustments((prev) => [entry, ...prev]);
    setAdjustmentModalInvoiceId(null);
    logActivity(invoice.leadId, `${entry.kind} note added`, [`${invoice.invoiceNumber}: INR ${entry.amount.toLocaleString("en-IN")}`, entry.reason]);
    setNotice(`${entry.kind} note added for ${invoice.invoiceNumber}.`);
  };

  const createInvoice = async () => {
    resetMessages();
    if (isSavingInvoice) return;
    setIsSavingInvoice(true);
    try {
    const lead = visibleLeads.find((row) => row.id === invoiceDraft.leadId);
    if (!lead || !INVOICE_ELIGIBLE_STATUSES.includes(lead.leadStatus)) {
      setError("Select a Confirmation/Invoice Sent/Won lead to generate invoice.");
      return;
    }
    if (!invoiceDraft.lineItems.some((item) => item.serviceName.trim())) {
      setError("Add at least one line item with service name.");
      return;
    }
    if (!invoiceDraft.supplierName.trim() || !invoiceDraft.supplierAddress.trim() || !invoiceDraft.supplierCity.trim() || !invoiceDraft.supplierState.trim() || !invoiceDraft.supplierPincode.trim() || !invoiceDraft.supplierPhone.trim() || !invoiceDraft.supplierEmail.trim()) {
      setError("Supplier profile is required: name, address, city, state, pincode, phone, and email.");
      return;
    }
    if (!isValidEmail(invoiceDraft.supplierEmail)) {
      setError("Supplier email is invalid.");
      return;
    }
    if (!isValidPhone(invoiceDraft.supplierPhone)) {
      setError("Supplier phone number is invalid.");
      return;
    }
    if (!isValidPincode(invoiceDraft.supplierPincode)) {
      setError("Supplier pincode must be 6 digits.");
      return;
    }
    if (!/^\d{2}$/.test(invoiceDraft.supplierStateCode.trim())) {
      setError("Supplier state code should be a 2-digit value.");
      return;
    }
    if (!invoiceDraft.billedToName.trim() || !invoiceDraft.billedToCompany.trim() || !invoiceDraft.billedToEmail.trim() || !invoiceDraft.billedToPhone.trim() || !invoiceDraft.billedToAddress.trim() || !invoiceDraft.billedToCity.trim() || !invoiceDraft.billedToState.trim() || !invoiceDraft.billedToPincode.trim()) {
      setError("Client billing details are required: name, company, email, phone, address, city, state, and pincode.");
      return;
    }
    if (!invoiceDraft.shippingAddress.trim() || !invoiceDraft.shippingCity.trim() || !invoiceDraft.shippingState.trim() || !invoiceDraft.shippingPincode.trim()) {
      setError("Client shipping details are required: address, city, state, and pincode.");
      return;
    }
    if (!isValidEmail(invoiceDraft.billedToEmail)) {
      setError("Client email is invalid.");
      return;
    }
    if (!isValidPhone(invoiceDraft.billedToPhone)) {
      setError("Client phone number is invalid.");
      return;
    }
    if (!isValidPincode(invoiceDraft.billedToPincode)) {
      setError("Client pincode must be 6 digits.");
      return;
    }
    if (!isValidPincode(invoiceDraft.shippingPincode)) {
      setError("Shipping pincode must be 6 digits.");
      return;
    }
    if (!invoiceDraft.bankBeneficiaryName.trim() || !invoiceDraft.bankName.trim() || !invoiceDraft.bankAccountNumber.trim() || !invoiceDraft.bankIfsc.trim()) {
      setError("Bank details are required: beneficiary name, bank name, account number, and IFSC.");
      return;
    }
    if (!isValidIfsc(invoiceDraft.bankIfsc)) {
      setError("Bank IFSC format is invalid.");
      return;
    }
    if (!invoiceDraft.paymentTermsDays || Number(invoiceDraft.paymentTermsDays) < 1) {
      setError("Payment terms should be at least 1 day.");
      return;
    }
    const supplierGstin = invoiceDraft.supplierGstin.trim();
    const buyerGstin = invoiceDraft.buyerGstin.trim();
    const placeOfSupply = invoiceDraft.placeOfSupplyStateCode.trim();
    const sacCode = invoiceDraft.sacCode.trim();
    if (requiresGstCompliance) {
      if (!isValidGstin(supplierGstin)) {
        setError("Enter a valid supplier GSTIN before creating invoice.");
        return;
      }
      if (buyerGstin && !isValidGstin(buyerGstin)) {
        setError("Buyer GSTIN format is invalid.");
        return;
      }
      if (!/^\d{2}$/.test(placeOfSupply)) {
        setError("Place of supply state code should be a 2-digit code.");
        return;
      }
      if (!/^\d{4,8}$/.test(sacCode)) {
        setError("SAC/HSN code must be 4 to 8 digits.");
        return;
      }
      const supplierState = stateCodeFromGstin(supplierGstin);
      if (invoiceDraft.gstMode === "Intra" && supplierState !== placeOfSupply) {
        setError("Intra-state invoice requires place of supply state code to match supplier GSTIN state code.");
        return;
      }
      if (invoiceDraft.gstMode === "Inter" && supplierState === placeOfSupply) {
        setError("Inter-state invoice requires place of supply different from supplier GSTIN state code.");
        return;
      }
    } else {
      if (supplierGstin && !isValidGstin(supplierGstin)) {
        setError("Supplier GSTIN format is invalid.");
        return;
      }
      if (buyerGstin && !isValidGstin(buyerGstin)) {
        setError("Buyer GSTIN format is invalid.");
        return;
      }
      if (placeOfSupply && !/^\d{2}$/.test(placeOfSupply)) {
        setError("Place of supply should be a 2-digit state code when provided.");
        return;
      }
      if (sacCode && !/^\d{4,8}$/.test(sacCode)) {
        setError("SAC/HSN should be 4 to 8 digits when provided.");
        return;
      }
      if (supplierGstin && placeOfSupply) {
        const supplierState = stateCodeFromGstin(supplierGstin);
        if (invoiceDraft.gstMode === "Intra" && supplierState !== placeOfSupply) {
          setError("Intra-state mode needs place of supply to match supplier GSTIN state code.");
          return;
        }
        if (invoiceDraft.gstMode === "Inter" && supplierState === placeOfSupply) {
          setError("Inter-state mode needs place of supply different from supplier GSTIN state code.");
          return;
        }
      }
    }
    if (!invoiceDraft.issueDate || !invoiceDraft.dueDate) {
      setError("Issue date and due date are required.");
      return;
    }
    if (invoiceDraft.dueDate < invoiceDraft.issueDate) {
      setError("Due date cannot be earlier than issue date.");
      return;
    }
    const amounts = invoiceAmountsFromDraft(invoiceDraft);
    if (amounts.totalAmount <= 0) {
      setError("Invoice amount should be greater than zero.");
      return;
    }
    const invalidSac = amounts.lineItems.some((item) => {
      const lineSac = (item.sacCode || "").trim();
      if (!lineSac) return requiresGstCompliance;
      return !/^\d{4,8}$/.test(lineSac);
    });
    if (invalidSac) {
      setError(requiresGstCompliance ? "Every line item must have SAC/HSN code with 4 to 8 digits." : "Line item SAC/HSN should be 4 to 8 digits when provided.");
      return;
    }
    const createdAt = new Date().toISOString();
    const requireApproval = !!currentUser && currentUser.role !== "owner";
    const approvalStatus: InvoiceApprovalStatus = requireApproval ? "Pending" : "Not Required";
    const initialStatus: InvoiceStatus = requireApproval ? "Draft" : "Issued";
    const recurrenceStep = recurrenceMonthStep(invoiceDraft.recurrence);
    const cycles = recurrenceStep > 0 ? Math.max(1, Math.min(24, Number(invoiceDraft.recurrenceCount) || 1)) : 1;
    const tenantInvoices = invoices.filter((entry) => entry.tenantId === lead.tenantId);
    const parentId = makeId();
    const invoiceNumber = nextInvoiceNumber(tenantInvoices, (tenants.find((t) => t.id === lead.tenantId)?.slug ?? "INV"));
    const serviceName = amounts.lineItems[0]?.serviceName || invoiceDraft.serviceName;
    const description = amounts.lineItems.map((item) => item.description || item.serviceName).filter(Boolean).join(" | ");
    const invoice: Invoice = {
      id: parentId,
      tenantId: lead.tenantId,
      leadId: lead.id,
      customerProfileId: invoiceDraft.customerProfileId,
      invoiceNumber,
      issueDate: invoiceDraft.issueDate,
      dueDate: invoiceDraft.dueDate,
      billedToName: invoiceDraft.billedToName.trim(),
      billedToCompany: invoiceDraft.billedToCompany.trim(),
      billedToEmail: invoiceDraft.billedToEmail.trim(),
      billedToPhone: invoiceDraft.billedToPhone.trim(),
      billedToAddress: invoiceDraft.billedToAddress.trim(),
      billedToCity: invoiceDraft.billedToCity.trim(),
      billedToState: invoiceDraft.billedToState.trim(),
      billedToPincode: invoiceDraft.billedToPincode.trim(),
      shippingAddress: invoiceDraft.shippingAddress.trim(),
      shippingCity: invoiceDraft.shippingCity.trim(),
      shippingState: invoiceDraft.shippingState.trim(),
      shippingPincode: invoiceDraft.shippingPincode.trim(),
      paymentTermsDays: Math.max(1, Number(invoiceDraft.paymentTermsDays) || 1),
      poNumber: invoiceDraft.poNumber.trim(),
      bankBeneficiaryName: invoiceDraft.bankBeneficiaryName.trim(),
      bankName: invoiceDraft.bankName.trim(),
      bankAccountNumber: invoiceDraft.bankAccountNumber.trim(),
      bankIfsc: invoiceDraft.bankIfsc.trim().toUpperCase(),
      supplierName: invoiceDraft.supplierName.trim(),
      supplierAddress: invoiceDraft.supplierAddress.trim(),
      supplierCity: invoiceDraft.supplierCity.trim(),
      supplierState: invoiceDraft.supplierState.trim(),
      supplierPincode: invoiceDraft.supplierPincode.trim(),
      supplierPhone: invoiceDraft.supplierPhone.trim(),
      supplierEmail: invoiceDraft.supplierEmail.trim().toLowerCase(),
      supplierStateCode: invoiceDraft.supplierStateCode.trim(),
      supplierGstin: supplierGstin.toUpperCase(),
      buyerGstin: buyerGstin.toUpperCase(),
      placeOfSupplyStateCode: placeOfSupply,
      sacCode,
      reverseCharge: invoiceDraft.reverseCharge,
      lineItems: amounts.lineItems,
      serviceName,
      description,
      quantity: amounts.quantity,
      unitPrice: amounts.unitPrice,
      gstRate: amounts.gstRate,
      gstMode: invoiceDraft.gstMode,
      subtotal: amounts.subtotal,
      cgstAmount: amounts.cgstAmount,
      sgstAmount: amounts.sgstAmount,
      igstAmount: amounts.igstAmount,
      totalAmount: amounts.totalAmount,
      amountPaid: 0,
      balanceAmount: amounts.totalAmount,
      paidAt: "",
      status: initialStatus,
      approvalStatus,
      approvalRequestedBy: currentUser?.name ?? "System",
      approvalRequestedAt: createdAt,
      approvedBy: requireApproval ? "" : currentUser?.name ?? "System",
      approvedAt: requireApproval ? "" : createdAt,
      approvalRemarks: "",
      recurrence: invoiceDraft.recurrence,
      recurrenceCount: cycles,
      recurrenceParentId: cycles > 1 ? parentId : null,
      recurrenceIndex: 1,
      notes: invoiceDraft.notes,
      createdBy: currentUser?.name ?? "System",
      createdAt,
      updatedAt: createdAt,
    };

    const createdInvoice = { ...invoice, status: normalizeInvoiceStatus(invoice) };
    setInvoices((prev) => [createdInvoice, ...prev]);
    logActivity(
      lead.id,
      requireApproval ? "Invoice drafted and sent for approval" : "Invoice issued",
      [
        `${cycles > 1 ? `Recurring plan started (${cycles} cycles)` : "Invoice created"}`,
        `Base total INR ${createdInvoice.totalAmount.toLocaleString("en-IN")}`,
      ],
    );
    setNotice(
      requireApproval
        ? `Invoice draft created. Awaiting checker approval.${cycles > 1 ? ` Recurring schedule enabled for ${cycles} cycles.` : ""}`
        : `Invoice ${createdInvoice.invoiceNumber} created.${cycles > 1 ? ` Recurring schedule enabled for ${cycles} cycles.` : ""}`,
    );
    setInvoiceComposerOpen(false);
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const updateInvoiceStatus = (invoice: Invoice, nextStatus: InvoiceStatus) => {
    resetMessages();
    const previous = { ...invoice };
    setInvoices((prev) =>
      prev.map((row) => {
        if (row.id !== invoice.id) return row;
        const updatedBase = {
          ...row,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          paidAt: nextStatus === "Paid" && !row.paidAt ? todayISODate() : row.paidAt,
          amountPaid: nextStatus === "Paid" ? row.totalAmount : row.amountPaid,
          balanceAmount: nextStatus === "Paid" ? 0 : row.balanceAmount,
        };
        return { ...updatedBase, status: normalizeInvoiceStatus(updatedBase) };
      }),
    );
    logActivity(invoice.leadId, `Invoice status updated`, [`${invoice.invoiceNumber}: ${invoice.status} -> ${nextStatus}`]);
    toastUndo(`Invoice status changed to ${nextStatus}.`, () => {
      setInvoices((prev) => prev.map((row) => (row.id === previous.id ? previous : row)));
      logActivity(previous.leadId, "Invoice status change undone", [`${previous.invoiceNumber}: restored to ${previous.status}`]);
    });
  };

  const recordInvoicePayment = (invoice: Invoice) => {
    resetMessages();
    if (invoice.status === "Cancelled") {
      setError("Cannot record payment on a cancelled invoice.");
      return;
    }
    if (invoice.status === "Draft" || invoice.approvalStatus === "Pending" || invoice.approvalStatus === "Rejected") {
      setError("Invoice should be approved and issued before payment is recorded.");
      return;
    }
    setPaymentModalInvoiceId(invoice.id);
    setPaymentDraft({
      amount: invoice.balanceAmount,
      paidAt: todayISODate(),
      mode: "Bank Transfer",
      reference: "",
      notes: "",
    });
  };

  const submitInvoicePayment = () => {
    if (!paymentModalInvoiceId) return;
    const invoice = invoices.find((row) => row.id === paymentModalInvoiceId);
    if (!invoice) {
      setPaymentModalInvoiceId(null);
      return;
    }
    if (invoice.status === "Cancelled") {
      setError("Cannot record payment on a cancelled invoice.");
      return;
    }
    const amount = Math.max(0, Number(paymentDraft.amount) || 0);
    if (amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (!paymentDraft.paidAt) {
      setError("Payment date is required.");
      return;
    }
    const invoiceAdjustmentsForInvoice = invoiceAdjustments.filter((entry) => entry.invoiceId === invoice.id);
    const effectiveTotal = invoiceEffectiveTotal(invoice, invoiceAdjustmentsForInvoice);
    if (amount > Math.max(0, effectiveTotal - invoice.amountPaid)) {
      setError("Payment cannot exceed pending balance.");
      return;
    }
    const entry: InvoicePayment = {
      id: makeId(),
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      leadId: invoice.leadId,
      amount,
      paidAt: paymentDraft.paidAt,
      mode: paymentDraft.mode,
      reference: paymentDraft.reference.trim(),
      notes: paymentDraft.notes.trim(),
      createdBy: currentUser?.name ?? "System",
      createdAt: new Date().toISOString(),
    };
    setInvoicePayments((prev) => [entry, ...prev]);
    setPaymentModalInvoiceId(null);
    logActivity(invoice.leadId, "Invoice payment recorded", [`${invoice.invoiceNumber}: +INR ${amount.toLocaleString("en-IN")} via ${entry.mode}`]);
    setNotice(`Payment of INR ${amount.toLocaleString("en-IN")} recorded for ${invoice.invoiceNumber}.`);
  };

  const openPromiseModal = (invoice: Invoice) => {
    setPromiseModalInvoiceId(invoice.id);
    setPromiseDraft({
      promisedAmount: Math.max(0, invoice.balanceAmount),
      promisedDate: shiftISODate(todayISODate(), 3),
      notes: "",
    });
  };

  const submitInvoicePromise = () => {
    if (!promiseModalInvoice) return;
    const amount = Math.max(0, Number(promiseDraft.promisedAmount) || 0);
    if (amount <= 0) {
      setError("Promised amount should be greater than zero.");
      return;
    }
    if (!promiseDraft.promisedDate) {
      setError("Promise date is required.");
      return;
    }
    if (promiseDraft.promisedDate < todayISODate()) {
      setError("Promise date cannot be in the past.");
      return;
    }
    if (amount > promiseModalInvoice.balanceAmount) {
      setError("Promised amount cannot exceed current invoice balance.");
      return;
    }
    const now = new Date().toISOString();
    const nextEntry: InvoicePromise = {
      id: makeId(),
      tenantId: promiseModalInvoice.tenantId,
      invoiceId: promiseModalInvoice.id,
      leadId: promiseModalInvoice.leadId,
      promisedAmount: amount,
      promisedDate: promiseDraft.promisedDate,
      status: "Open",
      notes: promiseDraft.notes.trim(),
      createdBy: currentUser?.name ?? "System",
      createdAt: now,
      fulfilledAt: "",
    };
    setInvoicePromises((prev) => {
      const cancelled = prev.map((entry) => {
        if (entry.invoiceId !== promiseModalInvoice.id || entry.status !== "Open") return entry;
        return { ...entry, status: "Cancelled" as const, fulfilledAt: now };
      });
      return [nextEntry, ...cancelled];
    });
    setPromiseModalInvoiceId(null);
    logActivity(
      promiseModalInvoice.leadId,
      "Promise to pay captured",
      [`${promiseModalInvoice.invoiceNumber}: INR ${amount.toLocaleString("en-IN")} by ${promiseDraft.promisedDate}`],
    );
    setNotice(`Promise to pay recorded for ${promiseModalInvoice.invoiceNumber}.`);
  };

  const markInvoicePromiseStatus = (invoiceId: string, nextStatus: "Honored" | "Missed" | "Cancelled") => {
    const current = (invoicePromisesById.get(invoiceId) ?? []).find((entry) => entry.status === "Open");
    if (!current) {
      setError("No open promise found for this invoice.");
      return;
    }
    const stamp = nextStatus === "Honored" ? todayISODate() : "";
    setInvoicePromises((prev) =>
      prev.map((entry) => (entry.id === current.id ? { ...entry, status: nextStatus, fulfilledAt: stamp } : entry)),
    );
    logActivity(current.leadId, "Promise status updated", [`${nextStatus}: INR ${current.promisedAmount.toLocaleString("en-IN")} (${current.promisedDate})`]);
    setNotice(`Promise marked ${nextStatus.toLowerCase()}.`);
  };

  const sendCollectionsReminder = async (invoice: Invoice, opts?: { stage?: "D1" | "D7" | "D15"; silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent && isSendingReminder) return;
    if (!silent) setIsSendingReminder(true);
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const channel = settings.collectionsChannel;
    const provider = settings.whatsappProvider;
    const whatsappWebhook = env?.VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL || env?.VITE_COLLECTIONS_WEBHOOK_URL;
    const emailWebhook = env?.VITE_COLLECTIONS_WEBHOOK_URL;
    const webhook = channel === "email" ? emailWebhook : whatsappWebhook;
    const now = new Date().toISOString();
    const dispatchSeedId = makeId();
    const recipient = channel === "email" ? invoice.billedToEmail : invoice.billedToPhone;

    if (!webhook) {
      if (channel !== "email") {
        if (!silent) {
          showWebhookRetryToast(
            "WhatsApp dispatch webhook is not configured.",
            "Set VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL (or VITE_COLLECTIONS_WEBHOOK_URL fallback) and retry.",
            () => { void sendCollectionsReminder(invoice, opts); },
          );
        }
        if (!silent) setIsSendingReminder(false);
        return;
      }
      setCollectionsDispatchLogs((prev) => [
        {
          id: dispatchSeedId,
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          leadId: invoice.leadId,
          invoiceNumber: invoice.invoiceNumber,
          recipient,
          channel,
          provider,
          status: "sent",
          dispatchId: dispatchSeedId,
          messageId: "",
          requestedAt: now,
          lastEventAt: now,
          deliveredAt: now,
          readAt: "",
          error: "",
          triggeredBy: currentUser?.name ?? "System",
        },
        ...prev,
      ]);
      logActivity(invoice.leadId, "Collections reminder triggered", [`${invoice.invoiceNumber}: INR ${invoice.balanceAmount.toLocaleString("en-IN")}`]);
      if (!silent) {
        setNotice(`Reminder logged for ${invoice.invoiceNumber}. Configure VITE_COLLECTIONS_WEBHOOK_URL for external dispatch.`);
      }
      if (!silent) setIsSendingReminder(false);
      return;
    }

    const payload = {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      clientName: invoice.billedToName,
      clientCompany: invoice.billedToCompany,
      email: invoice.billedToEmail,
      phone: invoice.billedToPhone,
      amountDue: invoice.balanceAmount,
      channel,
      provider,
      templateName: settings.whatsappTemplateName,
      triggeredBy: currentUser?.name ?? "System",
      triggeredAt: now,
    };

    setCollectionsDispatchLogs((prev) => [
      {
        id: dispatchSeedId,
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        leadId: invoice.leadId,
        invoiceNumber: invoice.invoiceNumber,
        recipient,
        channel,
        provider,
        status: "queued",
        dispatchId: dispatchSeedId,
        messageId: "",
        requestedAt: now,
        lastEventAt: now,
        deliveredAt: "",
        readAt: "",
        error: "",
        triggeredBy: currentUser?.name ?? "System",
      },
      ...prev,
    ]);

    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Collections webhook call failed.");
      const body = (await response.json().catch(() => null)) as
        | { dispatchId?: string; messageId?: string; status?: string; error?: string }
        | null;
      const syncStamp = new Date().toISOString();
      const nextStatus = normalizeCollectionsDispatchStatus(body?.status ?? "sent");
      setCollectionsDispatchLogs((prev) =>
        prev.map((entry) =>
          entry.id === dispatchSeedId
            ? {
                ...entry,
                status: nextStatus,
                dispatchId: body?.dispatchId || entry.dispatchId,
                messageId: body?.messageId || entry.messageId,
                lastEventAt: syncStamp,
                deliveredAt: nextStatus === "delivered" || nextStatus === "read" ? syncStamp : entry.deliveredAt,
                readAt: nextStatus === "read" ? syncStamp : entry.readAt,
                error: body?.error ?? "",
              }
            : entry,
        ),
      );
      logActivity(invoice.leadId, "Collections reminder triggered", [`${invoice.invoiceNumber}: INR ${invoice.balanceAmount.toLocaleString("en-IN")}`]);
      if (!silent) {
        setNotice(`Collections ${channel === "email" ? "email" : "WhatsApp"} reminder sent for ${invoice.invoiceNumber}.`);
      }
    } catch {
      const failStamp = new Date().toISOString();
      setCollectionsDispatchLogs((prev) =>
        prev.map((entry) =>
          entry.id === dispatchSeedId
            ? {
                ...entry,
                status: "failed",
                lastEventAt: failStamp,
                error: "Webhook dispatch failed",
              }
            : entry,
        ),
      );
      if (!silent) {
        showWebhookRetryToast(
          "Collections webhook call failed.",
          "Check VITE_COLLECTIONS_WEBHOOK_URL/provider configuration and retry.",
          () => { void sendCollectionsReminder(invoice, opts); },
        );
      }
    } finally {
      if (!silent) setIsSendingReminder(false);
    }
  };

  useEffect(() => {
    if (!settings.dunningAutomationEnabled) return;
    if (!canUseInvoicing) return;
    if (invoiceCollectionsQueue.length === 0) return;

    const runAutomation = async () => {
      const actions: Array<{ invoice: Invoice; stage: "D1" | "D7" | "D15" }> = [];
      invoiceCollectionsQueue.forEach((row) => {
        const invoice = row.invoice;
        if (row.overdueDays >= 1) {
          const key = `${invoice.id}::D1::${invoice.dueDate}`;
          const done = dunningAutomationLogs.some((log) => log.invoiceId === invoice.id && log.stage === "D1" && log.action === key);
          if (!done) actions.push({ invoice, stage: "D1" });
        }
        if (row.overdueDays >= 7) {
          const key = `${invoice.id}::D7::${invoice.dueDate}`;
          const done = dunningAutomationLogs.some((log) => log.invoiceId === invoice.id && log.stage === "D7" && log.action === key);
          if (!done) actions.push({ invoice, stage: "D7" });
        }
        if (row.overdueDays >= 15) {
          const key = `${invoice.id}::D15::${invoice.dueDate}`;
          const done = dunningAutomationLogs.some((log) => log.invoiceId === invoice.id && log.stage === "D15" && log.action === key);
          if (!done) actions.push({ invoice, stage: "D15" });
        }
      });

      if (actions.length === 0) return;

      for (const action of actions) {
        await sendCollectionsReminder(action.invoice, { stage: action.stage, silent: true });
        if (action.stage === "D15") {
          const lead = leads.find((item) => item.id === action.invoice.leadId);
          const manager = tenantManagerById.get(action.invoice.tenantId) || "";
          if (lead && manager && manager !== lead.assignedTo) {
            upsertLead(
              lead.id,
              (row) => ({ ...row, assignedTo: manager, nextFollowupDate: todayISODate(), followupStatus: "Pending" }),
              "Collections escalation to manager (D15)",
            );
          }
        }
      }

      const stamp = new Date().toISOString();
      setDunningAutomationLogs((prev) => [
        ...actions.map((action) => ({
          id: makeId(),
          tenantId: action.invoice.tenantId,
          invoiceId: action.invoice.id,
          stage: action.stage,
          sentAt: stamp,
          action: `${action.invoice.id}::${action.stage}::${action.invoice.dueDate}`,
        })),
        ...prev,
      ]);
    };

    void runAutomation();
  }, [
    settings.dunningAutomationEnabled,
    canUseInvoicing,
    invoiceCollectionsQueue,
    dunningAutomationLogs,
    leads,
    tenantManagerById,
  ]);

  const syncCollectionsDeliveryStatus = async (mode: "manual" | "auto") => {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const webhook = env?.VITE_COLLECTIONS_STATUS_WEBHOOK_URL;
    if (!webhook) {
      if (mode === "manual") {
        setError("Delivery sync webhook missing. Set VITE_COLLECTIONS_STATUS_WEBHOOK_URL.");
      }
      return;
    }
    const pending = tenantCollectionsDispatch.filter(
      (entry) => (entry.channel === "whatsapp" || entry.channel === "both")
        && (entry.status === "queued" || entry.status === "sent"),
    );
    if (pending.length === 0) {
      if (mode === "manual") setNotice("No pending WhatsApp delivery statuses to sync.");
      return;
    }
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenantId,
          provider: settings.whatsappProvider,
          dispatches: pending.map((entry) => ({
            id: entry.id,
            dispatchId: entry.dispatchId,
            messageId: entry.messageId,
            invoiceNumber: entry.invoiceNumber,
            recipient: entry.recipient,
          })),
        }),
      });
      if (!response.ok) throw new Error("Delivery sync failed.");
      const body = (await response.json().catch(() => null)) as
        | { updates?: Array<{ id?: string; dispatchId?: string; messageId?: string; status?: string; deliveredAt?: string; readAt?: string; lastEventAt?: string; error?: string }> }
        | null;
      const updates = body?.updates ?? [];
      if (updates.length === 0) {
        if (mode === "manual") setNotice("No new delivery updates from provider.");
        return;
      }
      const now = new Date().toISOString();
      setCollectionsDispatchLogs((prev) =>
        prev.map((entry) => {
          const match = updates.find(
            (item) => (item.id && item.id === entry.id)
              || (item.dispatchId && item.dispatchId === entry.dispatchId)
              || (item.messageId && item.messageId === entry.messageId),
          );
          if (!match) return entry;
          const nextStatus = normalizeCollectionsDispatchStatus(match.status ?? entry.status);
          return {
            ...entry,
            status: nextStatus,
            lastEventAt: match.lastEventAt || now,
            deliveredAt: match.deliveredAt || (nextStatus === "delivered" || nextStatus === "read" ? now : entry.deliveredAt),
            readAt: match.readAt || (nextStatus === "read" ? now : entry.readAt),
            error: match.error ?? "",
          };
        }),
      );
      if (mode === "manual") setNotice(`Delivery sync completed for ${updates.length} reminder(s).`);
    } catch {
      if (mode === "manual") setError("Delivery sync failed.");
    }
  };

  const exportInvoicesCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `invoices-${todayISODate()}.csv`,
        ["Invoice", "Issue Date", "Due Date", "Lead", "Company", "Status", "Subtotal", "Tax", "Total", "Paid", "Balance"],
        filteredInvoices.map((invoice) => [
          invoice.invoiceNumber,
          invoice.issueDate,
          invoice.dueDate,
          invoice.billedToName,
          invoice.billedToCompany,
          normalizeInvoiceStatus(invoice),
          invoice.subtotal,
          invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount,
          invoice.totalAmount,
          invoice.amountPaid,
          invoice.balanceAmount,
        ]),
      );
    });
  };

  const exportInvoiceClientLedgerCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `invoice-client-ledger-${todayISODate()}.csv`,
        ["Client", "Invoices", "Invoices Sent", "Sent %", "Billed", "Collected", "Outstanding", "Overdue", "Last Invoice Date"],
        invoiceClientLedgerRows.map((row) => [
          row.client,
          row.invoices,
          row.sent,
          formatPercent(row.sentRate),
          row.billed,
          row.collected,
          row.outstanding,
          row.overdue,
          row.lastIssueDate || "-",
        ]),
      );
    });
  };

  const exportInvoiceMonthlyCsv = () => {
    runCsvExport(() => {
      downloadCsv(
        `invoice-monthly-summary-${todayISODate()}.csv`,
        ["Month", "Invoices", "Sent", "Billed", "Collected", "Outstanding", "Cumulative Sent", "Cumulative Billed", "Cumulative Collected", "Cumulative Outstanding"],
        invoiceMonthlyRows.map((row) => [
          row.monthLabel,
          row.invoices,
          row.sent,
          row.billed,
          row.collected,
          row.outstanding,
          row.cumulativeSent,
          row.cumulativeBilled,
          row.cumulativeCollected,
          row.cumulativeOutstanding,
        ]),
      );
    });
  };

  const logActivity = (leadId: string, action: string, changes: string[] = []) => {
    const actor = currentUser?.name ?? "System";
    const entry: LeadActivity = {
      id: makeId(),
      tenantId: currentTenantId,
      leadId,
      actor,
      action,
      changes,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [entry, ...prev]);
  };

  const logTenantAction = (tenantId: string, action: string, changes: string[] = []) => {
    const actor = currentUser?.name ?? "System";
    const entry: LeadActivity = {
      id: makeId(),
      tenantId,
      leadId: "system",
      actor,
      action,
      changes,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [entry, ...prev]);
  };

  const upsertLead = (leadId: string, updater: (lead: Lead) => Lead, action: string) => {
    setLeads((prev) => {
      const old = prev.find((l) => l.id === leadId);
      if (!old) return prev;
      const updated = updater(old);
      const diffs: string[] = [];
      if (old.leadStatus !== updated.leadStatus) diffs.push(`Lead Status: ${old.leadStatus} -> ${updated.leadStatus}`);
      if (old.assignedTo !== updated.assignedTo) diffs.push(`Assigned To: ${old.assignedTo} -> ${updated.assignedTo}`);
      if (old.followupStatus !== updated.followupStatus) diffs.push(`Follow-up Status: ${old.followupStatus} -> ${updated.followupStatus}`);
      if (old.nextFollowupDate !== updated.nextFollowupDate) diffs.push(`Next Follow-up Date: ${old.nextFollowupDate || "-"} -> ${updated.nextFollowupDate || "-"}`);
      if (old.expectedClosingDate !== updated.expectedClosingDate) diffs.push(`Expected Closing Date: ${old.expectedClosingDate || "-"} -> ${updated.expectedClosingDate || "-"}`);
      if (old.wonDate !== updated.wonDate) diffs.push(`Won Date: ${old.wonDate || "-"} -> ${updated.wonDate || "-"}`);
      if (old.wonDealValue !== updated.wonDealValue) diffs.push(`Won Snapshot Value: INR ${old.wonDealValue ?? 0} -> INR ${updated.wonDealValue ?? 0}`);
      if (old.paymentStatus !== updated.paymentStatus) diffs.push(`Payment Status: ${old.paymentStatus} -> ${updated.paymentStatus}`);
      if (old.collectionsOwner !== updated.collectionsOwner) diffs.push(`Collections Owner: ${old.collectionsOwner || "-"} -> ${updated.collectionsOwner || "-"}`);
      if (old.collectedDate !== updated.collectedDate) diffs.push(`Collected Date: ${old.collectedDate || "-"} -> ${updated.collectedDate || "-"}`);
      if (old.collectedAmount !== updated.collectedAmount) diffs.push(`Collected Amount: INR ${old.collectedAmount ?? 0} -> INR ${updated.collectedAmount ?? 0}`);
      if (old.lossReason !== updated.lossReason) diffs.push(`Loss Reason: ${old.lossReason || "-"} -> ${updated.lossReason || "-"}`);
      if (old.lastContactedDate !== updated.lastContactedDate) diffs.push(`Last Contacted Date: ${old.lastContactedDate || "-"} -> ${updated.lastContactedDate || "-"}`);
      if (old.notes !== updated.notes) diffs.push("Notes updated");
      if (diffs.length > 0) logActivity(leadId, action, diffs);
      return patchLeadById(prev, leadId, () => updated);
    });
  };

  const applyLeadUpdateWithUndo = (
    lead: Lead,
    updater: (lead: Lead) => Lead,
    action: string,
    undoMessage: string,
    undoAction = "Lead update reverted",
  ) => {
    const previousLead = { ...lead };
    upsertLead(lead.id, updater, action);
    toastUndo(undoMessage, () => {
      upsertLead(lead.id, () => previousLead, undoAction);
      setNotice("Change reverted.");
    });
  };

  const markFollowupDoneWithUndo = (lead: Lead, action: string) => {
    applyLeadUpdateWithUndo(
      lead,
      (row) => ({ ...row, followupStatus: "Done", lastContactedDate: todayISODate() }),
      action,
      "Follow-up marked done.",
      "Follow-up done action reverted",
    );
  };

  const openWhatsAppFollowup = (lead: Lead) => {
    const digits = normalizedPhone(lead.phoneNumber || "");
    if (!digits) {
      setError(`No phone number available for ${lead.leadName}.`);
      return;
    }
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const dueLabel = lead.nextFollowupDate ? formatDateDisplay(lead.nextFollowupDate) : "today";
    const message = encodeURIComponent(
      `Hi ${lead.leadName}, this is a follow-up from Yugam Consulting regarding ${lead.companyName}. We are checking in on the pending update due ${dueLabel}.`,
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const openPhoneCall = (lead: Lead) => {
    const digits = normalizedPhone(lead.phoneNumber || "");
    if (!digits) {
      setError(`No phone number available for ${lead.leadName}.`);
      return;
    }
    window.location.href = `tel:${digits}`;
  };

  const softDeleteLead = async (lead: Lead) => {
    const confirmed = await confirmToast(`Move ${lead.leadName} to Recycle Bin?`, "Move to Bin");
    if (!confirmed) return;
    const deletedAt = new Date().toISOString();
    upsertLead(
      lead.id,
      (row) => ({ ...row, deletedAt, deletedBy: currentUser?.name ?? "System" }),
      "Lead moved to recycle bin",
    );
    toastUndo(`Moved ${lead.leadName} to Recycle Bin.`, () => {
      upsertLead(lead.id, (row) => ({ ...row, deletedAt: "", deletedBy: "" }), "Lead restored from recycle bin (undo)");
    });
  };

  const restoreDeletedLead = (lead: Lead) => {
    upsertLead(lead.id, (row) => ({ ...row, deletedAt: "", deletedBy: "" }), "Lead restored from recycle bin");
    setNotice(`Restored ${lead.leadName}.`);
  };

  const purgeDeletedLead = async (lead: Lead) => {
    const confirmed = await confirmToast(`Delete ${lead.leadName} permanently? This cannot be undone.`, "Delete Permanently");
    if (!confirmed) return;
    const snapshot = { ...lead };
    setLeads((prev) => prev.filter((row) => row.id !== lead.id));
    toastUndo(`Deleted ${lead.leadName} permanently.`, () => {
      setLeads((prev) => [snapshot, ...prev]);
      setNotice(`Restored ${lead.leadName}.`);
    });
  };

  const purgeExpiredDeletedLeads = async () => {
    const expiredRows = recycleBinLeadsWithExpiry.filter((row) => row.isExpired);
    if (expiredRows.length === 0) {
      setNotice("No expired leads found in recycle bin.");
      return;
    }
    const confirmed = await confirmToast(
      `Delete ${expiredRows.length} expired lead(s) permanently? This cannot be undone.`,
      "Purge Expired",
    );
    if (!confirmed) return;
    const expiredIdSet = new Set(expiredRows.map((row) => row.lead.id));
    const snapshots = expiredRows.map((row) => ({ ...row.lead }));
    setLeads((prev) => prev.filter((lead) => !expiredIdSet.has(lead.id)));
    toastUndo(`Purged ${expiredRows.length} expired lead(s).`, () => {
      setLeads((prev) => [...snapshots, ...prev]);
      setNotice("Expired leads restored from undo.");
    });
  };

  const getLeadSlaMeta = (lead: Lead) => {
    const tier = leadSlaTier(lead);
    const days = neglectDays(lead);
    const manager = tenantManagerById.get(lead.tenantId) || "";
    const needsEscalation = (tier === "escalate" || tier === "critical") && !!manager && manager !== lead.assignedTo;
    if (tier === "critical") {
      return {
        tier,
        label: `Critical ${days}d`,
        className: "bg-rose-700 text-white ring-1 ring-rose-800/40",
        managerCue: needsEscalation ? `Escalate to ${manager}` : "Manager assigned",
      };
    }
    if (tier === "escalate") {
      return {
        tier,
        label: `Escalate ${days}d`,
        className: "bg-rose-600 text-white ring-1 ring-rose-700/40",
        managerCue: needsEscalation ? `Escalate to ${manager}` : "Escalation not required",
      };
    }
    if (tier === "watch") {
      return {
        tier,
        label: `Watch ${days}d`,
        className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
        managerCue: "Follow-up due",
      };
    }
    return {
      tier,
      label: "Within SLA",
      className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
      managerCue: "Healthy",
    };
  };

  const escalationCandidates = useMemo(() => {
    return visibleLeads
      .filter((lead) => {
        const tier = leadSlaTier(lead);
        if (!(tier === "escalate" || tier === "critical")) return false;
        const manager = tenantManagerById.get(lead.tenantId) || "";
        return !!manager && manager !== lead.assignedTo;
      })
      .sort((a, b) => neglectDays(b) - neglectDays(a));
  }, [visibleLeads, tenantManagerById]);

  const slaTierStats = useMemo(() => {
    const stats = { watch: 0, escalate: 0, critical: 0 };
    visibleLeads.forEach((lead) => {
      const tier = leadSlaTier(lead);
      if (tier === "watch") stats.watch += 1;
      if (tier === "escalate") stats.escalate += 1;
      if (tier === "critical") stats.critical += 1;
    });
    return stats;
  }, [visibleLeads]);

  const escalateLeadToManager = (lead: Lead) => {
    const manager = tenantManagerById.get(lead.tenantId) || "";
    if (!manager) {
      setError("No manager found for this client account.");
      return;
    }
    if (manager === lead.assignedTo) {
      setNotice(`${lead.leadName} is already assigned to manager.`);
      return;
    }
    applyLeadUpdateWithUndo(
      lead,
      (row) => ({ ...row, assignedTo: manager }),
      "Lead escalated to manager",
      `Escalated ${lead.leadName} to ${manager}.`,
      "Lead escalation reverted",
    );
  };

  const bulkEscalateLeads = (scope: "critical" | "escalate") => {
    const targets = escalationCandidates.filter((lead) => (scope === "critical" ? leadSlaTier(lead) === "critical" : true));
    if (targets.length === 0) {
      setNotice(scope === "critical" ? "No critical leads pending escalation." : "No 14d+ leads pending escalation.");
      return;
    }
    const previousById = new Map(targets.map((lead) => [lead.id, { ...lead }]));
    const managerByLeadId = new Map(targets.map((lead) => [lead.id, tenantManagerById.get(lead.tenantId) || lead.assignedTo]));
    setLeads((prev) => prev.map((lead) => {
      if (!previousById.has(lead.id)) return lead;
      return { ...lead, assignedTo: managerByLeadId.get(lead.id) || lead.assignedTo };
    }));
    const label = scope === "critical" ? "critical leads" : "14d+ leads";
    toastUndo(`Escalated ${targets.length} ${label} to manager.`, () => {
      setLeads((prev) => prev.map((lead) => previousById.get(lead.id) ?? lead));
      setNotice("Bulk escalation reverted.");
    });
    const now = new Date().toISOString();
    setActivities((prev) => [
      ...targets.map((lead) => ({
        id: makeId(),
        tenantId: lead.tenantId,
        leadId: lead.id,
        actor: currentUser?.name || "System",
        action: "Bulk escalated to manager",
        changes: [`Assigned To -> ${(managerByLeadId.get(lead.id) || lead.assignedTo)}`],
        createdAt: now,
      })),
      ...prev,
    ]);
  };

  const mergeDuplicateLeadGroup = async (group: Lead[]) => {
    if (group.length < 2) return;
    const [primary, ...duplicates] = group;
    const confirmed = await confirmToast(
      `Merge ${duplicates.length} duplicate lead(s) into ${primary.leadName}?`,
      "Merge Duplicates",
    );
    if (!confirmed) return;

    const mergedNotes = [primary.notes, ...duplicates.map((lead) => lead.notes)]
      .map((text) => text.trim())
      .filter(Boolean)
      .filter((text, idx, arr) => arr.indexOf(text) === idx)
      .join("\n\n");

    const mergedPrimary: Lead = {
      ...primary,
      phoneNumber: primary.phoneNumber || duplicates.find((lead) => lead.phoneNumber)?.phoneNumber || "",
      emailId: primary.emailId || duplicates.find((lead) => lead.emailId)?.emailId || "",
      notes: mergedNotes,
      isDuplicate: false,
    };

    const duplicateIds = new Set(duplicates.map((lead) => lead.id));
    const deletedAt = new Date().toISOString();
    setLeads((prev) => prev.map((lead) => {
      if (lead.id === primary.id) return mergedPrimary;
      if (!duplicateIds.has(lead.id)) return lead;
      return {
        ...lead,
        deletedAt,
        deletedBy: currentUser?.name ?? "System",
        isDuplicate: false,
      };
    }));

    logActivity(primary.id, "Duplicate leads merged", [
      `Merged leads: ${duplicates.map((lead) => lead.leadName).join(", ")}`,
      `Kept primary: ${primary.leadName}`,
    ]);
    duplicates.forEach((lead) => {
      logActivity(lead.id, "Duplicate merged into primary", [`Primary lead: ${primary.leadName}`]);
    });
    setSelectedLeadIds((prev) => prev.filter((id) => !duplicateIds.has(id)));
    setNotice(`Merged ${duplicates.length} duplicate lead(s) into ${primary.leadName}.`);
  };

  const handleLeadStatusChange = (lead: Lead, nextStatus: LeadStatus, action: string) => {
    if (lead.leadStatus === nextStatus) return;
    if (nextStatus === "Lost" && !lead.lossReason.trim()) {
      setLostReasonPrompt({ leadId: lead.id });
      setLostReasonDraft("");
      return;
    }
    const isMandatoryClosingStatus = nextStatus === "Proposal Sent" || nextStatus === "Negotiation" || nextStatus === "Confirmation";
    const needsOptionalClosingPrompt = settings.promptExpectedClosingOnQualified && nextStatus === "Qualified";
    const needsClosingDatePrompt = (isMandatoryClosingStatus || needsOptionalClosingPrompt) && !lead.expectedClosingDate;
    if (needsClosingDatePrompt) {
      setClosingDatePrompt({ leadId: lead.id, nextStatus, isMandatory: isMandatoryClosingStatus });
      setClosingDateDraft(todayISODate());
      return;
    }
    upsertLead(
      lead.id,
      (l) => ({
        ...l,
        ...(stageCadenceDays(nextStatus) > 0
          ? { nextFollowupDate: shiftISODate(todayISODate(), stageCadenceDays(nextStatus)), followupStatus: "Pending" as FollowupStatus }
          : {}),
        leadStatus: nextStatus,
        wonDate: nextStatus === "Won" ? l.wonDate || todayISODate() : l.leadStatus === "Won" ? "" : l.wonDate,
        wonDealValue:
          nextStatus === "Won"
            ? l.wonDealValue ?? safeDealValue(l.dealValue)
            : l.leadStatus === "Won"
              ? null
              : l.wonDealValue,
        paymentStatus: nextStatus === "Won" ? l.paymentStatus || "Not Invoiced" : l.leadStatus === "Won" ? "Not Invoiced" : l.paymentStatus,
        collectionsOwner: nextStatus === "Won" ? l.collectionsOwner || l.assignedTo : l.collectionsOwner,
        collectedDate: nextStatus === "Won" ? l.collectedDate : l.leadStatus === "Won" ? "" : l.collectedDate,
        collectedAmount: nextStatus === "Won" ? l.collectedAmount : l.leadStatus === "Won" ? null : l.collectedAmount,
      }),
      action,
    );
    const previousLead = { ...lead };
    toastUndo(`Status moved to ${nextStatus}.`, () => {
      upsertLead(lead.id, () => previousLead, `Status change undone (${nextStatus} -> ${previousLead.leadStatus})`);
      setNotice(`Reverted lead to ${previousLead.leadStatus}.`);
    });
  };

  const submitLostReason = () => {
    if (!lostReasonPrompt) return;
    const reason = lostReasonDraft.trim();
    if (!reason) {
      setError("Loss reason is required before moving lead to Lost.");
      return;
    }
    const previousLead = leads.find((lead) => lead.id === lostReasonPrompt.leadId) ?? null;
    upsertLead(
      lostReasonPrompt.leadId,
      (lead) => ({
        ...lead,
        leadStatus: "Lost",
        lossReason: reason,
        wonDate: lead.leadStatus === "Won" ? "" : lead.wonDate,
        wonDealValue: lead.leadStatus === "Won" ? null : lead.wonDealValue,
        paymentStatus: lead.leadStatus === "Won" ? "Not Invoiced" : lead.paymentStatus,
        collectedDate: lead.leadStatus === "Won" ? "" : lead.collectedDate,
        collectedAmount: lead.leadStatus === "Won" ? null : lead.collectedAmount,
      }),
      "Status updated to Lost",
    );
    if (previousLead) {
      toastUndo("Lead moved to Lost.", () => {
        upsertLead(previousLead.id, () => previousLead, "Lost status reverted");
        setNotice("Lost status reverted.");
      });
    }
    setLostReasonPrompt(null);
    setLostReasonDraft("");
  };

  const submitStatusWithClosingDate = (skipClosingDate: boolean) => {
    if (!closingDatePrompt) return;
    if (closingDatePrompt.isMandatory && skipClosingDate) {
      setError("Expected closing date is mandatory for Proposal Sent, Negotiation, and Confirmation.");
      return;
    }
    const nextDate = skipClosingDate ? "" : closingDateDraft;
    if (!skipClosingDate && !nextDate) {
      setError(closingDatePrompt.isMandatory ? "Please select expected closing date to continue." : "Please select expected closing date or use Skip.");
      return;
    }
    const leadId = closingDatePrompt.leadId;
    const nextStatus = closingDatePrompt.nextStatus;
    const previousLead = leads.find((lead) => lead.id === leadId) ?? null;
    upsertLead(
      leadId,
      (lead) => ({
        ...lead,
        ...(stageCadenceDays(nextStatus) > 0
          ? { nextFollowupDate: shiftISODate(todayISODate(), stageCadenceDays(nextStatus)), followupStatus: "Pending" as FollowupStatus }
          : {}),
        leadStatus: nextStatus,
        expectedClosingDate: lead.expectedClosingDate || nextDate,
        wonDate: nextStatus === "Won" ? lead.wonDate || todayISODate() : lead.leadStatus === "Won" ? "" : lead.wonDate,
        wonDealValue:
          nextStatus === "Won"
            ? lead.wonDealValue ?? safeDealValue(lead.dealValue)
            : lead.leadStatus === "Won"
              ? null
              : lead.wonDealValue,
        paymentStatus:
          nextStatus === "Won"
            ? lead.paymentStatus || "Not Invoiced"
            : lead.leadStatus === "Won"
              ? "Not Invoiced"
              : lead.paymentStatus,
        collectionsOwner: nextStatus === "Won" ? lead.collectionsOwner || lead.assignedTo : lead.collectionsOwner,
        collectedDate: nextStatus === "Won" ? lead.collectedDate : lead.leadStatus === "Won" ? "" : lead.collectedDate,
        collectedAmount: nextStatus === "Won" ? lead.collectedAmount : lead.leadStatus === "Won" ? null : lead.collectedAmount,
      }),
      `Status updated to ${nextStatus}`,
    );
    if (previousLead) {
      toastUndo(`Status moved to ${nextStatus}.`, () => {
        upsertLead(previousLead.id, () => previousLead, `Status change undone (${nextStatus} -> ${previousLead.leadStatus})`);
        setNotice(`Reverted lead to ${previousLead.leadStatus}.`);
      });
    }
    setClosingDatePrompt(null);
    setClosingDateDraft("");
  };

  const validateLeadDraft = (draft: Omit<Lead, "id" | "tenantId">) => {
    if (!draft.leadName.trim() || !draft.companyName.trim()) return "Lead name and company name are required.";
    if (!isValidPhone(draft.phoneNumber)) return "Enter a valid phone number (8 to 15 digits).";
    if (safeDealValue(draft.dealValue) < 0) return "Deal value cannot be negative.";
    if (draft.nextFollowupDate && draft.dateAdded && draft.nextFollowupDate < draft.dateAdded) {
      return "Next follow-up date cannot be earlier than Date Added.";
    }
    if (draft.lastContactedDate && draft.lastContactedDate > todayISODate()) {
      return "Last Contacted Date cannot be in the future.";
    }
    if (draft.collectedAmount !== null && draft.collectedAmount < 0) {
      return "Collected amount cannot be negative.";
    }
    if (draft.leadStatus === "Won" && draft.collectedAmount !== null && draft.collectedAmount > wonRevenueValue({ ...draft, id: "draft", tenantId: "draft" })) {
      return "Collected amount cannot exceed booked value for won leads.";
    }
    return "";
  };

  const applyCapturedLeadText = (rawText: string, sourceLabel: string) => {
    const evaluation = evaluateLeadCaptureText(rawText);
    const extracted = evaluation.extracted;
    const summary: CaptureSummaryItem[] = [];
    const pushCaptureSummary = (field: string, value: string, confidence: "High" | "Review") => {
      if (!value) return;
      summary.push({ field, value, confidence });
    };

    pushCaptureSummary("Name", extracted.leadName, extracted.leadName.trim().split(" ").length >= 2 ? "High" : "Review");
    pushCaptureSummary("Company", extracted.companyName, extracted.companyName.length >= 3 ? "High" : "Review");
    pushCaptureSummary("Phone", extracted.phoneNumber, isValidPhone(extracted.phoneNumber) ? "High" : "Review");
    pushCaptureSummary("Email", extracted.emailId, isValidEmail(extracted.emailId) ? "High" : "Review");
    pushCaptureSummary("Website", extracted.website, /\./.test(extracted.website) ? "High" : "Review");
    pushCaptureSummary("Address", extracted.address, "Review");

    const primaryFieldCount = [
      extracted.leadName,
      extracted.companyName,
      extracted.phoneNumber,
      extracted.emailId,
    ].filter((value) => value.trim().length > 0).length;

    if (primaryFieldCount === 0) {
      setCaptureSummary([]);
      setError("Could not detect lead details from this input. Try a clearer image or paste text manually.");
      return;
    }

    setCaptureSummary(summary);
    setIntake((prev) => {
      const noteParts = [prev.notes.trim()];
      if (extracted.website && !prev.notes.includes("Website:")) noteParts.push(`Website: ${extracted.website}`);
      if (extracted.address && !prev.notes.includes("Address:")) noteParts.push(`Address: ${extracted.address}`);
      return {
        ...prev,
        leadName: prev.leadName || extracted.leadName,
        companyName: prev.companyName || extracted.companyName,
        phoneNumber: prev.phoneNumber || extracted.phoneNumber,
        emailId: prev.emailId || extracted.emailId,
        notes: noteParts.filter(Boolean).join("\n"),
      };
    });
    setLeadIntakeStep(2);
    setShowOptionalIntake(true);
    setNotice(
      evaluation.score < 40
        ? `${sourceLabel} captured with low confidence. Please review all fields in Step 2.`
        : `${sourceLabel} captured. Review details in Step 2 before saving.`,
    );
  };

  const extractLeadFromPastedText = () => {
    const raw = captureText.trim();
    if (!raw) {
      setError("Paste some text first to extract lead details.");
      return;
    }
    resetMessages();
    applyCapturedLeadText(raw, "Text");
  };

  const applyCaptureLineToField = (
    rawLine: string,
    target: "leadName" | "companyName" | "phoneNumber" | "emailId" | "website" | "address" | "notes",
  ) => {
    const line = rawLine.trim();
    if (!line) return;
    const parsed = parseLeadCaptureText(line);
    setIntake((prev) => {
      if (target === "leadName") return { ...prev, leadName: line };
      if (target === "companyName") return { ...prev, companyName: line };
      if (target === "phoneNumber") {
        const phoneValue = parsed.phoneNumber || normalizedPhone(line);
        return { ...prev, phoneNumber: phoneValue || prev.phoneNumber };
      }
      if (target === "emailId") {
        const emailValue = parsed.emailId || line;
        return { ...prev, emailId: emailValue };
      }
      if (target === "website") {
        const websiteValue = parsed.website || line;
        const hasWebsite = /(^|\n)Website:/i.test(prev.notes);
        const nextNotes = hasWebsite ? prev.notes : [prev.notes.trim(), `Website: ${websiteValue}`].filter(Boolean).join("\n");
        return { ...prev, notes: nextNotes };
      }
      if (target === "address") {
        const addressValue = parsed.address || line;
        const hasAddress = /(^|\n)Address:/i.test(prev.notes);
        const nextNotes = hasAddress ? prev.notes : [prev.notes.trim(), `Address: ${addressValue}`].filter(Boolean).join("\n");
        return { ...prev, notes: nextNotes };
      }
      return { ...prev, notes: [prev.notes.trim(), line].filter(Boolean).join("\n") };
    });
    setShowOptionalIntake(true);
    setNotice(`Applied line to ${target}. Review in Step 2 before saving.`);
  };

  const loadImageElement = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });

  const imageToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to prepare OCR image."));
    }, "image/png", 1);
  });

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const detectCardBounds = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const rowCounts = new Uint32Array(height);
    const colCounts = new Uint32Array(width);
    let luminanceTotal = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      luminanceTotal += luminance;
    }
    const avgLuminance = luminanceTotal / (width * height);
    const threshold = clamp(avgLuminance + 18, 80, 190);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        const luminance = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        if (luminance >= threshold) {
          rowCounts[y] += 1;
          colCounts[x] += 1;
        }
      }
    }

    const rowMinHits = Math.max(8, Math.floor(width * 0.08));
    const colMinHits = Math.max(8, Math.floor(height * 0.08));
    let top = -1;
    let bottom = -1;
    let left = -1;
    let right = -1;

    for (let y = 0; y < height; y += 1) {
      if (rowCounts[y] >= rowMinHits) {
        top = y;
        break;
      }
    }
    for (let y = height - 1; y >= 0; y -= 1) {
      if (rowCounts[y] >= rowMinHits) {
        bottom = y;
        break;
      }
    }
    for (let x = 0; x < width; x += 1) {
      if (colCounts[x] >= colMinHits) {
        left = x;
        break;
      }
    }
    for (let x = width - 1; x >= 0; x -= 1) {
      if (colCounts[x] >= colMinHits) {
        right = x;
        break;
      }
    }

    if (top < 0 || left < 0 || bottom <= top || right <= left) return null;

    const paddingX = Math.floor(width * 0.02);
    const paddingY = Math.floor(height * 0.02);
    const x = clamp(left - paddingX, 0, width - 1);
    const y = clamp(top - paddingY, 0, height - 1);
    const w = clamp(right - left + 1 + paddingX * 2, 1, width - x);
    const h = clamp(bottom - top + 1 + paddingY * 2, 1, height - y);
    const areaRatio = (w * h) / (width * height);
    if (areaRatio < 0.12 || areaRatio > 0.96) return null;

    return { x, y, w, h };
  };

  const cropCanvasToBounds = (canvas: HTMLCanvasElement, bounds: { x: number; y: number; w: number; h: number }) => {
    const cropped = document.createElement("canvas");
    cropped.width = bounds.w;
    cropped.height = bounds.h;
    const ctx = cropped.getContext("2d");
    if (!ctx) return canvas;
    ctx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    return cropped;
  };

  const enhanceOcrCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = data.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
      const value = boosted > 170 ? 255 : boosted < 65 ? 0 : boosted;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
    }
    ctx.putImageData(data, 0, 0);

    // Upscale smaller crops to improve OCR confidence on business cards.
    const longest = Math.max(canvas.width, canvas.height);
    if (longest >= 1200) return canvas;
    const scale = 1200 / longest;
    const scaled = document.createElement("canvas");
    scaled.width = Math.round(canvas.width * scale);
    scaled.height = Math.round(canvas.height * scale);
    const scaledCtx = scaled.getContext("2d");
    if (!scaledCtx) return canvas;
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    return scaled;
  };

  const createOcrCandidateBlobs = async (file: File): Promise<Array<{ label: string; blob: Blob }>> => {
    const img = await loadImageElement(file);
    const rotations = [0, 90, 270, 180] as const;
    const candidates: Array<{ label: string; blob: Blob }> = [];

    for (const rotation of rotations) {
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const enhancedFull = enhanceOcrCanvas(canvas);
      const fullBlob = await imageToBlob(enhancedFull);
      candidates.push({ label: `rot-${rotation}-full`, blob: fullBlob });

      const bounds = detectCardBounds(canvas);
      if (bounds) {
        const cropped = cropCanvasToBounds(canvas, bounds);
        const enhancedCropped = enhanceOcrCanvas(cropped);
        const croppedBlob = await imageToBlob(enhancedCropped);
        candidates.push({ label: `rot-${rotation}-crop`, blob: croppedBlob });
      }
    }
    return candidates;
  };

  const extractLeadFromImage = async (file: File) => {
    resetMessages();
    setIsCaptureProcessing(true);
    try {
      const tesseractModule = await import("tesseract.js");
      const recognize = (tesseractModule as any).recognize ?? (tesseractModule as any).default?.recognize;
      if (typeof recognize !== "function") {
        throw new Error("OCR engine unavailable");
      }
      setNotice("Running OCR with auto-rotate, auto-crop, and enhancement...");
      const candidates = await createOcrCandidateBlobs(file);
      let bestText = "";
      let bestScore = -1;
      let bestLabel = "";

      for (const candidate of candidates) {
        const result = await recognize(candidate.blob, "eng", {
          tessedit_pageseg_mode: "6",
        } as any);
        const raw = String(result?.data?.text ?? "").trim();
        if (!raw) continue;
        const score = evaluateLeadCaptureText(raw).score;
        if (score > bestScore) {
          bestScore = score;
          bestText = raw;
          bestLabel = candidate.label;
        }
        if (score >= 70) break;
      }

      if (!bestText) {
        setError("No readable text found in image. Try a clearer image or paste text manually.");
        return;
      }
      setCaptureText(bestText);
      applyCapturedLeadText(bestText, "OCR");
      setNotice(`OCR captured using ${bestLabel}. Review details in Step 2.`);
    } catch {
      setError("OCR failed for this image. Try a sharper image or use paste text capture.");
    } finally {
      setIsCaptureProcessing(false);
    }
  };

  const openLeadIntakeModal = () => {
    if (!canCreateLeads) {
      setError("Your department profile does not allow adding new leads.");
      return;
    }
    setLeadIntakeStep(1);
    setShowOptionalIntake(false);
    setCaptureSummary([]);
    setCaptureText("");
    setLeadIntakeModalOpen(true);
  };

  const closeLeadIntakeModal = () => {
    setLeadIntakeModalOpen(false);
    setLeadIntakeStep(1);
    setCaptureSummary([]);
  };

  const createQuickLeadFromStepOne = async () => {
    resetMessages();
    if (isSavingLead) return;
    setIsSavingLead(true);
    try {
    if (!canViewLeads || !canCreateLeads) {
      setError("You do not have permission to create leads.");
      return;
    }
    if (!intake.leadName.trim()) {
      setError("Lead name is required to continue.");
      return;
    }
    if (!isValidPhone(intake.phoneNumber)) {
      setError("Enter a valid phone number (8 to 15 digits).");
      return;
    }
    const forcedAssignee = currentUser?.accessScope === "assigned" ? currentUser.name : intake.assignedTo || assigneeOptions[0] || "";
    if (!forcedAssignee) {
      setError("Please add at least one assignee before quick lead capture.");
      return;
    }
    const intakePhone = normalizedPhone(intake.phoneNumber);
    const tenantLeads = leads.filter((lead) => lead.tenantId === currentTenantId);
    const exactPhoneDuplicate = intakePhone && tenantLeads.some((lead) => normalizedPhone(lead.phoneNumber) === intakePhone);
    if (exactPhoneDuplicate) {
      setError("Duplicate blocked: exact phone number already exists for this client.");
      return;
    }
    const status: LeadStatus = settings.autoMoveNewToContacted ? "Contacted" : "New";
    const lead: Lead = {
      ...intake,
      id: makeId(),
      tenantId: currentTenantId,
      leadStatus: status,
      companyName: intake.companyName.trim() || "Direct Lead",
      assignedTo: forcedAssignee,
      followupStatus: "Pending",
      dateAdded: intake.dateAdded || todayISODate(),
      nextFollowupDate: intake.nextFollowupDate || todayISODate(),
      dealValue: Math.max(0, safeDealValue(intake.dealValue)),
      paymentStatus: "Not Invoiced",
      collectionsOwner: forcedAssignee,
      notes: intake.notes || "Quick captured from step 1",
      isDuplicate: false,
    };
    setLeads((prev) => prependLead(prev, lead));
    logActivity(lead.id, "Lead quick-created", [`Status: ${lead.leadStatus}`, `Assigned To: ${lead.assignedTo}`]);
    setNotice("Quick lead captured. Add optional details later from Lead Details.");
    setIntake((prev) => ({
      ...prev,
      leadName: "",
      companyName: "",
      phoneNumber: "",
      emailId: "",
      notes: "",
      dealValue: 0,
      expectedClosingDate: "",
      lastContactedDate: "",
      paymentStatus: "Not Invoiced",
      collectionsOwner: "",
      isDuplicate: false,
      lossReason: "",
    }));
    closeLeadIntakeModal();
    } finally {
      setIsSavingLead(false);
    }
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (isSavingLead) return;
    setIsSavingLead(true);
    try {
    if (!canViewLeads || !canCreateLeads) {
      setError("You do not have permission to create leads.");
      return;
    }
    const validationError = validateLeadDraft(intake);
    if (validationError) {
      setError(validationError);
      return;
    }

    const forcedAssignee = currentUser?.accessScope === "assigned" ? currentUser.name : intake.assignedTo;
    if (intake.emailId.trim() && !isValidEmail(intake.emailId)) {
      const proceedWithWarning = await confirmToast(
        "Email format looks invalid. Continue with this email?",
        "Save Anyway",
      );
      if (!proceedWithWarning) return;
    }

    if (!forcedAssignee) {
      setError("Please select an assignee.");
      return;
    }

    const intakePhone = normalizedPhone(intake.phoneNumber);
    const intakeEmail = intake.emailId.trim().toLowerCase();
    const tenantLeads = leads.filter((lead) => lead.tenantId === currentTenantId);
    const exactPhoneDuplicate = intakePhone && tenantLeads.some((lead) => normalizedPhone(lead.phoneNumber) === intakePhone);
    const exactEmailDuplicate = intakeEmail && tenantLeads.some((lead) => lead.emailId.trim().toLowerCase() === intakeEmail);
    if (exactPhoneDuplicate || exactEmailDuplicate) {
      setError("Duplicate blocked: exact phone number or email already exists for this client.");
      return;
    }

    const leadKey = intake.leadName.trim().toLowerCase();
    const companyKey = intake.companyName.trim().toLowerCase();
    const fuzzyMatch = tenantLeads.find(
      (lead) =>
        lead.companyName.trim().toLowerCase() === companyKey &&
        (lead.leadName.trim().toLowerCase() === leadKey || lead.leadName.trim().toLowerCase().includes(leadKey) || leadKey.includes(lead.leadName.trim().toLowerCase())),
    );
    if (fuzzyMatch) {
      const shouldContinue = await confirmToast(
        `Possible duplicate detected with ${fuzzyMatch.leadName} (${fuzzyMatch.companyName}). Click OK to create anyway or Cancel to review.`,
        "Create Anyway",
      );
      if (!shouldContinue) return;
    }

    const status: LeadStatus = settings.autoMoveNewToContacted ? "Contacted" : "New";
    const lead: Lead = {
      ...intake,
      id: makeId(),
      tenantId: currentTenantId,
      leadStatus: status,
      assignedTo: forcedAssignee,
      followupStatus: "Pending",
      dateAdded: intake.dateAdded || todayISODate(),
      dealValue: Math.max(0, safeDealValue(intake.dealValue)),
      paymentStatus: intake.paymentStatus || "Not Invoiced",
      collectionsOwner: intake.collectionsOwner || forcedAssignee,
      isDuplicate: false,
    };
    setLeads((prev) => prependLead(prev, lead));
    logActivity(lead.id, "Lead created", [
      `Status: ${lead.leadStatus}`,
      `Assigned To: ${lead.assignedTo}`,
      `Source: ${lead.leadSource}`,
      `Service: ${lead.serviceInterested}`,
    ]);
    setNotice("Lead added successfully.");
    setLeadIntakeModalOpen(false);
    setShowOptionalIntake(false);
    setIntake((prev) => ({
      ...prev,
      leadName: "",
      companyName: "",
      phoneNumber: "",
      emailId: "",
      notes: "",
      dealValue: 0,
      expectedClosingDate: "",
      lastContactedDate: "",
      paymentStatus: "Not Invoiced",
      collectionsOwner: "",
      isDuplicate: false,
      lossReason: "",
    }));
    if (keyboardEntryMode) {
      window.setTimeout(() => leadNameInputRef.current?.focus(), 0);
    }
    } finally {
      setIsSavingLead(false);
    }
  };

  const normalizeImportedDate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return "";
  };

  const matchOptionValue = (value: string, options: readonly string[], fallback: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    const found = options.find((option) => option.toLowerCase() === normalized);
    return found ?? fallback;
  };

  const importLeadsFromCsv = async (rows: ImportedLeadDraft[]) => {
    resetMessages();
    if (!canViewLeads || !canCreateLeads) {
      setError("You do not have permission to import leads.");
      return;
    }
    setIsImportingLeads(true);
    try {
      const today = todayISODate();
      const importedLeads: Lead[] = [];
      rows.forEach((row) => {
        const leadName = row.leadName.trim();
        const companyName = row.companyName.trim();
        if (!leadName || !companyName) return;
        const assignedTo = currentUser?.accessScope === "assigned"
          ? currentUser.name
          : (row.assignedTo.trim() && assigneeOptions.includes(row.assignedTo.trim())
            ? row.assignedTo.trim()
            : (intake.assignedTo || assigneeOptions[0] || currentUser?.name || ""));
        if (!assignedTo) return;
        const dateAdded = normalizeImportedDate(row.dateAdded) || today;
        const nextFollowupDate = normalizeImportedDate(row.nextFollowupDate) || dateAdded;
        const dealValue = Number(row.dealValue);
        importedLeads.push({
          id: makeId(),
          tenantId: currentTenantId,
          leadName,
          companyName,
          phoneNumber: row.phoneNumber.trim(),
          emailId: row.emailId.trim(),
          leadSource: matchOptionValue(row.leadSource, LEAD_SOURCES, intake.leadSource) as LeadSource,
          serviceInterested: matchOptionValue(row.serviceInterested, services, intake.serviceInterested) as ServiceType,
          leadStatus: settings.autoMoveNewToContacted ? "Contacted" : "New",
          leadTemperature: matchOptionValue(row.leadTemperature, LEAD_TEMPS, intake.leadTemperature) as LeadTemperature,
          dealValue: Number.isFinite(dealValue) ? Math.max(0, dealValue) : 0,
          expectedClosingDate: "",
          assignedTo,
          dateAdded,
          nextFollowupDate,
          followupStatus: "Pending",
          notes: row.notes.trim(),
          lastContactedDate: "",
          wonDate: "",
          wonDealValue: null,
          paymentStatus: "Not Invoiced",
          collectionsOwner: assignedTo,
          collectedDate: "",
          collectedAmount: null,
          invoiceFlowStatus: "Not Sent",
          invoiceSentDate: "",
          isDuplicate: false,
          lossReason: "",
        });
      });

      if (importedLeads.length === 0) {
        setError("No valid rows found. Ensure Lead Name and Company Name are mapped.");
        return;
      }

      setLeads((prev) => [...importedLeads, ...prev]);
      importedLeads.forEach((lead) => {
        logActivity(lead.id, "Lead imported via CSV", [
          `Status: ${lead.leadStatus}`,
          `Assigned To: ${lead.assignedTo}`,
          `Source: ${lead.leadSource}`,
        ]);
      });
      setNotice(`Imported ${importedLeads.length} lead(s) from CSV.`);
      setLeadImportModalOpen(false);
    } finally {
      setIsImportingLeads(false);
    }
  };

  const revertLeadToPreviousStatus = (lead: Lead) => {
    const transition = latestStatusTransitionByLead.get(lead.id);
    if (!transition || transition.to !== lead.leadStatus) {
      setError("No reversible status transition found for this lead.");
      return;
    }
    handleLeadStatusChange(lead, transition.from, `Status reverted (${transition.to} -> ${transition.from})`);
    setNotice(`Lead moved back to ${transition.from}.`);
  };

  const markAllOverdueFollowupsDone = () => {
    const overdueLeadIds = filteredFollowupLeads.filter((lead) => followupQueueKey(lead) === "overdue").map((lead) => lead.id);
    if (overdueLeadIds.length === 0) {
      setNotice("No overdue follow-ups to close.");
      return;
    }
    const previousById = new Map(leads.filter((lead) => overdueLeadIds.includes(lead.id)).map((lead) => [lead.id, { ...lead }]));
    const today = todayISODate();
    setLeads((prev) =>
      prev.map((lead) => (overdueLeadIds.includes(lead.id) ? { ...lead, followupStatus: "Done", lastContactedDate: today } : lead)),
    );
    overdueLeadIds.forEach((leadId) => {
      logActivity(leadId, "Suggested batch action", ["Follow-up Status -> Done", `Last Contacted Date -> ${today}`]);
    });
    setNotice(`Marked ${overdueLeadIds.length} overdue follow-up(s) as done.`);
    toastUndo(`Marked ${overdueLeadIds.length} overdue follow-up(s) as done.`, () => {
      setLeads((prev) => prev.map((lead) => previousById.get(lead.id) ?? lead));
      overdueLeadIds.forEach((leadId) => {
        logActivity(leadId, "Suggested batch action undone", ["Follow-up changes reverted"]);
      });
    });
  };

  const applyFollowupBulkActions = () => {
    resetMessages();
    if (selectedFollowupLeadIds.length === 0) {
      setError("Select at least one follow-up record.");
      return;
    }
    if (!followupBulkAction) {
      setError("Choose a bulk action to apply.");
      return;
    }
    if (followupBulkAction === "reassign" && !followupBulkAssignee) {
      setError("Select assignee for reassign action.");
      return;
    }
    if (followupBulkAction === "set-date" && !followupBulkDate) {
      setError("Select follow-up date for set-date action.");
      return;
    }

    const today = todayISODate();
    const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const previousById = new Map(
      leads.filter((lead) => selectedFollowupLeadIds.includes(lead.id)).map((lead) => [lead.id, { ...lead }]),
    );
    const affectedLeadIds = [...selectedFollowupLeadIds];

    setLeads((prev) =>
      prev.map((lead) => {
        if (!selectedFollowupLeadIds.includes(lead.id)) return lead;
        if (followupBulkAction === "mark-done") {
          return { ...lead, followupStatus: "Done", lastContactedDate: today };
        }
        if (followupBulkAction === "move-today") {
          return { ...lead, nextFollowupDate: today, followupStatus: "Pending" };
        }
        if (followupBulkAction === "snooze-2") {
          return { ...lead, nextFollowupDate: plusDays(2), followupStatus: "Pending" };
        }
        if (followupBulkAction === "snooze-7") {
          return { ...lead, nextFollowupDate: plusDays(7), followupStatus: "Pending" };
        }
        if (followupBulkAction === "reassign") {
          return { ...lead, assignedTo: followupBulkAssignee };
        }
        if (followupBulkAction === "set-date") {
          return { ...lead, nextFollowupDate: followupBulkDate, followupStatus: "Pending" };
        }
        return lead;
      }),
    );

    selectedFollowupLeadIds.forEach((leadId) => {
      const changes: string[] = [];
      if (followupBulkAction === "mark-done") changes.push("Follow-up Status -> Done", `Last Contacted Date -> ${today}`);
      if (followupBulkAction === "move-today") changes.push(`Next Follow-up Date -> ${today}`);
      if (followupBulkAction === "snooze-2") changes.push(`Next Follow-up Date -> ${plusDays(2)}`);
      if (followupBulkAction === "snooze-7") changes.push(`Next Follow-up Date -> ${plusDays(7)}`);
      if (followupBulkAction === "reassign") changes.push(`Assigned To -> ${followupBulkAssignee}`);
      if (followupBulkAction === "set-date") changes.push(`Next Follow-up Date -> ${followupBulkDate}`);
      if (changes.length > 0) logActivity(leadId, "Bulk follow-up command", changes);
    });

    setNotice("Follow-up bulk action applied.");
    toastUndo("Follow-up bulk action applied.", () => {
      setLeads((prev) => prev.map((lead) => previousById.get(lead.id) ?? lead));
      affectedLeadIds.forEach((leadId) => {
        logActivity(leadId, "Bulk follow-up command undone", ["Bulk changes reverted"]);
      });
    });
    setSelectedFollowupLeadIds([]);
  };

  const applyLeadBulkActions = () => {
    resetMessages();
    if (selectedLeadIds.length === 0) {
      setError("Select at least one lead.");
      return;
    }
    if (!leadBulkAction) {
      setError("Choose a lead bulk action.");
      return;
    }
    if (leadBulkAction === "reassign" && !leadBulkAssignee) {
      setError("Select assignee for reassign action.");
      return;
    }
    const today = todayISODate();
    const plus2 = shiftISODate(today, 2);
    const previousById = new Map(
      leads.filter((lead) => selectedLeadIds.includes(lead.id)).map((lead) => [lead.id, { ...lead }]),
    );
    const affectedLeadIds = [...selectedLeadIds];
    setLeads((prev) => prev.map((lead) => {
      if (!selectedLeadIds.includes(lead.id)) return lead;
      if (leadBulkAction === "mark-done") return { ...lead, followupStatus: "Done", lastContactedDate: today };
      if (leadBulkAction === "snooze-2") return { ...lead, nextFollowupDate: plus2, followupStatus: "Pending" };
      if (leadBulkAction === "move-contacted") return { ...lead, leadStatus: "Contacted", lastContactedDate: today };
      if (leadBulkAction === "reassign") return { ...lead, assignedTo: leadBulkAssignee };
      return lead;
    }));

    affectedLeadIds.forEach((leadId) => {
      const changes: string[] = [];
      if (leadBulkAction === "mark-done") changes.push("Follow-up Status -> Done", `Last Contacted Date -> ${today}`);
      if (leadBulkAction === "snooze-2") changes.push(`Next Follow-up Date -> ${plus2}`);
      if (leadBulkAction === "move-contacted") changes.push("Lead Status -> Contacted");
      if (leadBulkAction === "reassign") changes.push(`Assigned To -> ${leadBulkAssignee}`);
      if (changes.length > 0) logActivity(leadId, "Bulk lead command", changes);
    });

    setNotice("Lead bulk action applied.");
    toastUndo("Lead bulk action applied.", () => {
      setLeads((prev) => prev.map((lead) => previousById.get(lead.id) ?? lead));
      affectedLeadIds.forEach((leadId) => {
        logActivity(leadId, "Bulk lead command undone", ["Bulk changes reverted"]);
      });
    });

    setSelectedLeadIds([]);
    setLeadBulkAction("");
  };

  const handleIntakeKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (!keyboardEntryMode || e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    e.preventDefault();
    e.currentTarget.requestSubmit();
  };

  const runQuickFollowCommand = () => {
    resetMessages();
    if (!quickFollowLeadId) {
      setError("Select a lead for quick follow-up update.");
      return;
    }
    const today = todayISODate();
    const targetLead = leads.find((lead) => lead.id === quickFollowLeadId) ?? null;
    if (!targetLead) {
      setError("Selected lead is no longer available.");
      return;
    }
    if (quickFollowAction === "done") {
      markFollowupDoneWithUndo(targetLead, "Quick command: follow-up done");
    } else {
      applyLeadUpdateWithUndo(
        targetLead,
        (lead) => ({ ...lead, nextFollowupDate: today, followupStatus: "Pending" }),
        "Quick command: follow-up moved to today",
        "Follow-up moved to today.",
        "Follow-up move to today reverted",
      );
    }
    setQuickCommandOpen(false);
    setQuickFollowLeadId("");
    setNotice("Quick follow-up command completed.");
  };

  const commandActionItems = useMemo(
    () => [
      { id: "cmd-leads", label: "Go to Leads", hint: "Navigate", run: () => setAppView("leads" as AppView) },
      { id: "cmd-followups", label: "Go to Follow-ups", hint: "Navigate", run: () => setAppView("followups" as AppView) },
      { id: "cmd-pipeline", label: "Go to Pipeline", hint: "Navigate", run: () => setAppView("pipeline" as AppView) },
      { id: "cmd-add-lead", label: "Add New Lead", hint: "Action", run: () => { setAppView("leads" as AppView); openLeadIntakeModal(); } },
    ],
    [],
  );

  const commandLeadItems = useMemo(() => {
    const query = debouncedQuickCommandSearch.trim().toLowerCase();
    const source = visibleLeads
      .slice()
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    if (!query) return source.slice(0, 8);
    return source
      .filter((lead) => `${lead.leadName} ${lead.companyName} ${lead.phoneNumber} ${lead.emailId}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [visibleLeads, debouncedQuickCommandSearch]);

  const commandFilteredActions = useMemo(() => {
    const query = debouncedQuickCommandSearch.trim().toLowerCase();
    if (!query) return commandActionItems;
    return commandActionItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [commandActionItems, debouncedQuickCommandSearch]);

  const resetFilters = () => {
    setSearchText("");
    setFilterStatus("All");
    setFilterSource("All");
    setFilterAssignee("All");
    setFilterTemp("All");
    setQuickFilter("all");
    setSelectedLeadIds([]);
    setLeadBulkAction("");
  };

  const resetPipelineFilters = () => {
    setPipelineSearch("");
    setPipelineAssigneeFilter("All");
    setPipelineTempFilter("All");
    setPipelineSort("priority");
    setPipelineShowClosed(false);
    setPipelineFocusMode("all");
    setPipelineWipScope("today");
    setPipelineWipDate(todayISODate());
    setPipelineShowAdvancedControls(false);
  };

  const sourceRows = useMemo(() => {
    return LEAD_SOURCES.map((source) => {
      const rows = visibleLeads.filter((l) => l.leadSource === source);
      const won = rows.filter((l) => l.leadStatus === "Won").length;
      const conversion = rows.length ? (won / rows.length) * 100 : 0;
      return { source, count: rows.length, won, conversion };
    });
  }, [visibleLeads]);

  const usersTenantScopeId = isOwner ? selectedUsersTenantId : currentTenantId;
  const usersTenantScope = useMemo(
    () => tenants.find((tenant) => tenant.id === usersTenantScopeId) ?? null,
    [tenants, usersTenantScopeId],
  );
  const tenantScopedUsers = useMemo(() => users.filter((user) => user.tenantId === usersTenantScopeId), [users, usersTenantScopeId]);
  const tenantScopedOldUsers = useMemo(() => oldUsers.filter((user) => user.tenantId === usersTenantScopeId), [oldUsers, usersTenantScopeId]);
  const activeManageableUsers = useMemo(
    () => tenantScopedUsers.filter((user) => user.isActive && !isExpired(user)),
    [tenantScopedUsers],
  );
  const expiredManageableUsers = useMemo(
    () => tenantScopedUsers.filter((user) => isExpired(user)),
    [tenantScopedUsers],
  );
  const inactiveManageableUsers = useMemo(
    () => tenantScopedUsers.filter((user) => !user.isActive && !isExpired(user)),
    [tenantScopedUsers],
  );
  const loginRows = useMemo(() => {
    const baseRows = (() => {
      if (loginViewFilter === "expired") return expiredManageableUsers;
      if (loginViewFilter === "inactive") return inactiveManageableUsers;
      if (loginViewFilter === "old") return [];
      return activeManageableUsers;
    })();
    if (loginDepartmentFilter === "All") return baseRows;
    return baseRows.filter((user) => resolveStaffProfile(user) === loginDepartmentFilter);
  }, [
    loginViewFilter,
    loginDepartmentFilter,
    activeManageableUsers,
    expiredManageableUsers,
    inactiveManageableUsers,
  ]);
  const manageableEmployees = useMemo(
    () => employees.filter((employee) => employee.tenantId === usersTenantScopeId),
    [employees, usersTenantScopeId],
  );
  const manageableTenants = useMemo(
    () => (isOwner ? tenants : tenants.filter((tenant) => tenant.id === currentTenantId)),
    [tenants, isOwner, currentTenantId],
  );
  const scopedServices = useMemo(
    () => servicesByTenant[usersTenantScopeId] ?? DEFAULT_SERVICES,
    [servicesByTenant, usersTenantScopeId],
  );
  const scopedSettings = useMemo(
    () => settingsByTenant[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS,
    [settingsByTenant, usersTenantScopeId],
  );
  const scopedPipelineWipLimits = useMemo(
    () => normalizePipelineWipLimits(pipelineWipLimitsByTenant[usersTenantScopeId]),
    [pipelineWipLimitsByTenant, usersTenantScopeId],
  );
  const scopedPendingRequests = useMemo(
    () => pendingRequests.filter((request) => request.tenantId === usersTenantScopeId),
    [pendingRequests, usersTenantScopeId],
  );
  const staffProfilesForTenant = useMemo(() => {
    const mode = (usersTenantScope?.productMode ?? "full") as ProductMode;
    const invoicingEnabled = usersTenantScope?.featureInvoicing ?? false;
    const base: StaffProfile[] = ["sales", "followup", "operations"];
    if (mode === "full" && invoicingEnabled) base.push("collections");
    return base;
  }, [usersTenantScope?.productMode, usersTenantScope?.featureInvoicing]);
  const selectedCreateProfile = newUserRole === "sales" ? newUserProfile : "operations";
  const createProfileHint = staffProfileAccessHint(
    selectedCreateProfile,
    (usersTenantScope?.productMode ?? "full") as ProductMode,
    usersTenantScope?.featureInvoicing ?? false,
  );
  useEffect(() => {
    if (!staffProfilesForTenant.includes(newUserProfile)) {
      setNewUserProfile("sales");
      if (newUserScope === "none") setNewUserScope("assigned");
    }
  }, [staffProfilesForTenant, newUserProfile, newUserScope]);
  useEffect(() => {
    const enforced = normalizeWorkflowAccess(newUserRole, selectedCreateProfile, newUserCanAccessPipeline, newUserCanAccessFollowups);
    if (enforced.canAccessPipeline !== newUserCanAccessPipeline) {
      setNewUserCanAccessPipeline(enforced.canAccessPipeline);
    }
    if (enforced.canAccessFollowups !== newUserCanAccessFollowups) {
      setNewUserCanAccessFollowups(enforced.canAccessFollowups);
    }
  }, [newUserRole, selectedCreateProfile, newUserCanAccessPipeline, newUserCanAccessFollowups]);
  const tenantUsageById = useMemo(() => {
    return Object.fromEntries(
      tenants.map((tenant) => [
        tenant.id,
        {
          users: users.filter((user) => user.tenantId === tenant.id && !user.isBreakGlass).length,
          leads: leads.filter((lead) => lead.tenantId === tenant.id).length,
          activeUsers: users.filter((user) => user.tenantId === tenant.id && user.isActive && !isExpired(user) && !user.isBreakGlass).length,
        },
      ]),
    );
  }, [tenants, users, leads]);
  const tenantControlRows = useMemo(() => {
    const currentMonth = currentMonthKey();
    return manageableTenants.map((tenant) => {
      const usage = tenantUsageById[tenant.id] ?? { users: 0, leads: 0, activeUsers: 0 };
      const tenantLeads = leads.filter((lead) => lead.tenantId === tenant.id);
      const leadsThisMonth = tenantLeads.filter((lead) => monthKeyFromDate(lead.dateAdded) === currentMonth).length;
      const wonCount = tenantLeads.filter((lead) => lead.leadStatus === "Won").length;
      const pendingCount = tenantLeads.filter((lead) => lead.followupStatus === "Pending").length;
      const followupDoneCount = tenantLeads.filter((lead) => lead.followupStatus === "Done").length;
      const conversionRate = tenantLeads.length ? (wonCount / tenantLeads.length) * 100 : 0;
      const followupRate = pendingCount + followupDoneCount > 0 ? (followupDoneCount / (pendingCount + followupDoneCount)) * 100 : 0;
      const activity7d = activities.filter(
        (activity) => activity.tenantId === tenant.id && Date.now() - new Date(activity.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000,
      ).length;
      const seatUtilization = tenant.maxUsers > 0 ? Math.min(100, (usage.activeUsers / tenant.maxUsers) * 100) : 100;
      const leadUtilization = tenant.maxLeadsPerMonth > 0 ? Math.min(100, (leadsThisMonth / tenant.maxLeadsPerMonth) * 100) : 100;
      const healthScore = Math.round(
        conversionRate * 0.35 +
          followupRate * 0.25 +
          Math.max(0, 100 - seatUtilization) * 0.2 +
          Math.max(0, 100 - leadUtilization) * 0.15 +
          Math.min(100, activity7d * 5) * 0.05,
      );
      const lifecycle = tenantLifecycle(tenant);
      const healthBand = healthScore >= 75 ? "green" : healthScore >= 45 ? "yellow" : "red";
      return {
        tenant,
        usage,
        leadsThisMonth,
        conversionRate,
        followupRate,
        seatUtilization,
        leadUtilization,
        healthScore,
        healthBand,
        lifecycle,
      };
    });
  }, [manageableTenants, tenantUsageById, leads, activities]);
  const renewalPipeline = useMemo(() => {
    const upcoming = tenantControlRows.filter((row) => row.lifecycle.daysToExpiry >= 0 && row.lifecycle.daysToExpiry <= 30);
    const inGrace = tenantControlRows.filter((row) => row.lifecycle.status === "Grace");
    const suspended = tenantControlRows.filter((row) => row.lifecycle.status === "Suspended");
    return { upcoming, inGrace, suspended };
  }, [tenantControlRows]);
  const trialDashboardRows = useMemo(() => {
    const nowMs = Date.now();
    return trialAccounts
      .map((entry) => {
        const tenant = tenants.find((row) => row.id === entry.tenantId) ?? null;
        const endMs = new Date(entry.trialEndAt).getTime();
        const daysLeft = Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000));
        const derivedStatus: TrialAccount["status"] =
          entry.status === "converted"
            ? "converted"
            : daysLeft < 0
              ? "expired"
              : "active";
        return {
          ...entry,
          tenant,
          daysLeft,
          derivedStatus,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [trialAccounts, tenants]);
  const trialSummary = useMemo(() => {
    const active = trialDashboardRows.filter((row) => row.derivedStatus === "active").length;
    const expiringSoon = trialDashboardRows.filter((row) => row.derivedStatus === "active" && row.daysLeft >= 0 && row.daysLeft <= 3).length;
    const expired = trialDashboardRows.filter((row) => row.derivedStatus === "expired").length;
    const converted = trialDashboardRows.filter((row) => row.derivedStatus === "converted").length;
    return {
      total: trialDashboardRows.length,
      active,
      expiringSoon,
      expired,
      converted,
    };
  }, [trialDashboardRows]);
  const selectedTenantControl = useMemo(
    () => tenantControlRows.find((row) => row.tenant.id === selectedUsersTenantId) ?? tenantControlRows[0],
    [tenantControlRows, selectedUsersTenantId],
  );
  const selectedSubscription = useMemo(
    () => subscriptions.find((entry) => entry.tenantId === selectedUsersTenantId) ?? null,
    [subscriptions, selectedUsersTenantId],
  );
  const billingHistoryRows = useMemo(
    () => billingRecords
      .filter((row) => row.tenantId === selectedUsersTenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [billingRecords, selectedUsersTenantId],
  );
  const billingSummary = useMemo(() => {
    const pending = billingRecords.filter((row) => row.status === "pending").length;
    const failed = billingRecords.filter((row) => row.status === "failed").length;
    const paidThisMonth = billingRecords
      .filter((row) => row.status === "paid" && monthKeyFromDate(row.paidAt || row.createdAt) === currentMonthKey())
      .reduce((sum, row) => sum + row.amount, 0);
    const retryQueue = subscriptions.filter((entry) => entry.nextRetryAt && entry.nextRetryAt <= todayISODate() && entry.status !== "suspended").length;
    const scheduledDowngrades = subscriptions.filter((entry) => !!entry.scheduledDowngradePlanTemplateId).length;
    return { pending, failed, paidThisMonth, retryQueue, scheduledDowngrades };
  }, [billingRecords, subscriptions]);
  void selectedSubscription;
  void billingHistoryRows;
  void billingSummary;
  const usersContextTenant = useMemo(() => {
    if (usersTab === "licensees") return selectedTenantControl?.tenant ?? usersTenantScope;
    if (usersTab === "tenant-users") return usersTenantScope;
    return null;
  }, [usersTab, selectedTenantControl, usersTenantScope]);
  const breakGlassSecretByTenant = useMemo(
    () => Object.fromEntries(breakGlassSecrets.map((secret) => [secret.tenantId, secret])),
    [breakGlassSecrets],
  );
  const planTemplateById = useMemo(() => Object.fromEntries(planTemplates.map((template) => [template.id, template])), [planTemplates]);
  const tenantNameById = useMemo(() => Object.fromEntries(tenants.map((tenant) => [tenant.id, tenant.name])), [tenants]);
  const platformSummary = useMemo(() => {
    const nowMs = Date.now();
    const inThirtyDays = nowMs + 30 * 24 * 60 * 60 * 1000;
    const activeTenants = tenants.filter((tenant) => tenant.isActive && new Date(tenant.licenseEndDate).getTime() >= nowMs).length;
    const expiringTenants = tenants.filter((tenant) => {
      const end = new Date(tenant.licenseEndDate).getTime();
      return end >= nowMs && end <= inThirtyDays;
    }).length;
    const activeUsers = users.filter((user) => user.isActive && !isExpired(user) && !user.isBreakGlass).length;
    return {
      tenantCount: tenants.length,
      activeTenants,
      suspendedTenants: tenants.filter((tenant) => !tenant.isActive).length,
      expiringTenants,
      userCount: users.filter((user) => !user.isBreakGlass).length,
      activeUsers,
      leadCount: leads.length,
      pendingRegistrations: requests.filter((request) => request.status === "pending").length,
      activity7d: activities.filter((entry) => Date.now() - new Date(entry.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length,
    };
  }, [tenants, users, leads, requests, activities]);
  const platformAuditRows = useMemo(() => {
    const requestRows = requests.map((request) => ({
      id: `request-${request.id}`,
      tenantId: request.tenantId,
      createdAt: request.requestedAt,
      actor: request.name,
      action: `Registration ${request.status}`,
      details: request.email,
      eventType: "registration" as const,
    }));
    const resetRows = resetCodes.map((code) => {
      const issuedAtMs = new Date(code.expiresAt).getTime() - 10 * 60 * 1000;
      const createdAt = Number.isNaN(issuedAtMs) ? code.expiresAt : new Date(issuedAtMs).toISOString();
      return {
        id: `reset-${code.id}`,
        tenantId: code.tenantId,
        createdAt: code.usedAt ?? createdAt,
        actor: code.email,
        action: code.usedAt ? "Password reset completed" : "Password reset requested",
        details: code.usedAt ? "Code consumed" : `Code valid till ${formatDateTimeDisplay(code.expiresAt)}`,
        eventType: "password" as const,
      };
    });
    const leadRows = activities.map((entry) => ({
      id: `lead-${entry.id}`,
      tenantId: entry.tenantId,
      createdAt: entry.createdAt,
      actor: entry.actor,
      action: entry.action,
      details: entry.changes.join(" | ") || "-",
      eventType: "lead" as const,
    }));

    const trialRows = trialAccounts.map((trial) => ({
      id: `trial-${trial.id}`,
      tenantId: trial.tenantId,
      createdAt: trial.convertedAt || trial.lastLoginAt || trial.createdAt,
      actor: trial.ownerName,
      action:
        trial.status === "converted"
          ? "Trial converted"
          : trial.status === "expired"
            ? "Trial expired"
            : "Trial active",
      details: `${trial.workspaceName} (${trial.signupSource})`,
      eventType: "trial" as const,
    }));

    return [...leadRows, ...requestRows, ...resetRows, ...trialRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 120);
  }, [activities, requests, resetCodes, trialAccounts]);

  const filteredPlatformAuditRows = useMemo(() => {
    const now = Date.now();
    return platformAuditRows.filter((row) => {
      if (auditEventFilter !== "all" && row.eventType !== auditEventFilter) {
        return false;
      }
      const rowTime = new Date(row.createdAt).getTime();
      if (Number.isNaN(rowTime)) {
        return false;
      }
      if (auditDateRangeFilter === "custom") {
        if (!auditStartDate && !auditEndDate) return true;
        const startMs = auditStartDate ? new Date(`${auditStartDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
        const endMs = auditEndDate ? new Date(`${auditEndDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
        return rowTime >= startMs && rowTime <= endMs;
      }
      const windowDays = auditDateRangeFilter === "7d" ? 7 : auditDateRangeFilter === "30d" ? 30 : 90;
      return rowTime >= now - windowDays * 24 * 60 * 60 * 1000;
    });
  }, [platformAuditRows, auditEventFilter, auditDateRangeFilter, auditStartDate, auditEndDate]);

  const activeAdminCount = (candidateUsers: UserAccount[], tenantId: string) =>
    candidateUsers.filter((user) => user.tenantId === tenantId && user.isActive && (user.role === "owner" || user.role === "admin")).length;

  const hasMinimumActiveAdmins = (candidateUsers: UserAccount[], tenantId: string) => activeAdminCount(candidateUsers, tenantId) >= 2;

  const rotateBreakGlassCredentials = (tenant: Tenant) => {
    const password = generateRecoveryPassword();
    const generatedAt = new Date().toISOString();
    setUsers((prev) =>
      prev.map((user) =>
        user.tenantId === tenant.id && user.isBreakGlass
          ? { ...user, password, passwordHash: undefined, role: "owner", accessScope: "all", isActive: true }
          : user,
      ),
    );
    setBreakGlassSecrets((prev) => [
      {
        id: makeId(),
        tenantId: tenant.id,
        email: `recovery.${tenant.slug}@oruyugam.com`,
        password,
        generatedAt,
        acknowledged: false,
      },
      ...prev.filter((secret) => secret.tenantId !== tenant.id),
    ]);
    setBreakGlassRevealAckByTenant((prev) => ({ ...prev, [tenant.id]: false }));
    if (revealedBreakGlassTenantId === tenant.id) {
      setRevealedBreakGlassTenantId(null);
    }
    setNotice(`Recovery credentials regenerated for ${tenant.name}. Store them offline immediately.`);
  };

  const extendTrialWorkspace = (tenantId: string, days = DEFAULT_TRIAL_DAYS) => {
    const nowIso = new Date().toISOString();
    let tenantName = "Workspace";
    setTenants((prev) =>
      prev.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;
        tenantName = tenant.name;
        const anchor = new Date(Math.max(Date.now(), new Date(tenant.licenseEndDate).getTime())).toISOString();
        return {
          ...tenant,
          isActive: true,
          isTrial: true,
          trialDays: DEFAULT_TRIAL_DAYS,
          autoRenew: false,
          licenseEndDate: addDaysFrom(anchor, days),
        };
      }),
    );
    setTrialAccounts((prev) =>
      prev.map((entry) =>
        entry.tenantId === tenantId
          ? {
              ...entry,
              status: "active",
              trialEndAt: addDaysFrom(entry.trialEndAt < nowIso ? nowIso : entry.trialEndAt, days),
            }
          : entry,
      ),
    );
    logTenantAction(tenantId, "Trial extended", [`Extended by ${days} days`]);
    setNotice(`${tenantName} trial extended by ${days} days.`);
  };

  const convertTrialToPaid = (tenantId: string) => {
    const now = new Date().toISOString();
    const nextEnd = oneYearFrom(now);
    let tenantName = "Workspace";
    setTenants((prev) =>
      prev.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;
        tenantName = tenant.name;
        return {
          ...tenant,
          isActive: true,
          isTrial: false,
          trialDays: 0,
          autoRenew: true,
          graceDays: tenant.graceDays || DEFAULT_GRACE_DAYS,
          licenseStartDate: now,
          licenseEndDate: nextEnd,
          planName: tenant.planName.includes("Trial") ? "Growth" : tenant.planName,
        };
      }),
    );
    setUsers((prev) =>
      prev.map((user) =>
        user.tenantId === tenantId
          ? {
              ...user,
              isActive: true,
              autoRenew: true,
              licenseStartDate: now,
              licenseEndDate: nextEnd,
            }
          : user,
      ),
    );
    setTrialAccounts((prev) =>
      prev.map((entry) =>
        entry.tenantId === tenantId
          ? {
              ...entry,
              status: "converted",
              convertedAt: now,
            }
          : entry,
      ),
    );
    logTenantAction(tenantId, "Trial converted to paid", [`License activated till ${formatDateDisplay(nextEnd)}`]);
    setNotice(`${tenantName} converted to paid license.`);
  };

  const applyPlanTemplateToTenant = (tenantId: string, templateId: string | null) => {
    const template = planTemplates.find((row) => row.id === templateId) ?? null;
    if (!template) return;
    setTenants((prev) =>
      prev.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;
        return {
          ...tenant,
          planTemplateId: template.id,
          planName: template.name,
          maxUsers: template.maxUsers,
          maxLeadsPerMonth: template.maxLeadsPerMonth,
          graceDays: template.graceDays,
          featureExports: template.featureExports,
          featureAdvancedForecast: template.featureAdvancedForecast,
          featureInvoicing: template.featureInvoicing,
          requireGstCompliance: template.requireGstCompliance,
          productMode: inferProductModeFromTenantFlags(template.featureInvoicing, template.featureAdvancedForecast, template.featureExports),
          auditRetentionDays: template.auditRetentionDays,
        };
      }),
    );
  };

  const applyBillingSuccess = (recordId: string, gatewayRef = "") => {
    const record = billingRecords.find((row) => row.id === recordId) ?? null;
    if (!record) return;
    setBillingRecords((prev) =>
      prev.map((row) => {
        if (row.id !== recordId) return row;
        return {
          ...row,
          status: "paid",
          paidAt: new Date().toISOString(),
          failedAt: "",
          failureReason: "",
          gatewayRef: gatewayRef || row.gatewayRef,
        };
      }),
    );
    const now = new Date().toISOString();
    const sub = subscriptions.find((entry) => entry.id === record.subscriptionId) ?? null;
    if (!sub) return;
    if (record.type === "renewal") {
      const anchor = new Date(Math.max(Date.now(), new Date(sub.renewalDate).getTime())).toISOString();
      const nextRenewal = addMonthsIso(anchor, cycleMonths(sub.billingCycle));
      const graceEndsAt = addDaysFrom(nextRenewal, Math.max(0, (tenants.find((t) => t.id === sub.tenantId)?.graceDays ?? DEFAULT_GRACE_DAYS)));
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === sub.tenantId
            ? { ...tenant, isActive: true, autoRenew: sub.autoRenew, licenseStartDate: anchor, licenseEndDate: nextRenewal }
            : tenant,
        ),
      );
      setUsers((prev) =>
        prev.map((user) =>
          user.tenantId === sub.tenantId
            ? { ...user, isActive: true, autoRenew: sub.autoRenew, licenseStartDate: anchor, licenseEndDate: nextRenewal }
            : user,
        ),
      );
      setSubscriptions((prev) =>
        prev.map((entry) =>
          entry.id === sub.id
            ? { ...entry, status: "active", retryCount: 0, nextRetryAt: "", renewalDate: nextRenewal, graceEndsAt, updatedAt: now }
            : entry,
        ),
      );
      logTenantAction(sub.tenantId, "License renewal paid", [`Next renewal: ${formatDateDisplay(nextRenewal)}`]);
      return;
    }
    if (record.type === "upgrade") {
      if (record.planTemplateToId) {
        applyPlanTemplateToTenant(sub.tenantId, record.planTemplateToId);
      }
      setSubscriptions((prev) =>
        prev.map((entry) =>
          entry.id === sub.id
            ? {
                ...entry,
                status: "active",
                retryCount: 0,
                nextRetryAt: "",
                planName: record.planTo,
                planTemplateId: record.planTemplateToId,
                updatedAt: now,
              }
            : entry,
        ),
      );
      logTenantAction(sub.tenantId, "Plan upgraded", [`${record.planFrom} -> ${record.planTo}`]);
      return;
    }
    if (record.type === "downgrade") {
      if (record.planTemplateToId) {
        applyPlanTemplateToTenant(sub.tenantId, record.planTemplateToId);
      }
      setSubscriptions((prev) =>
        prev.map((entry) =>
          entry.id === sub.id
            ? {
                ...entry,
                status: "active",
                retryCount: 0,
                nextRetryAt: "",
                planName: record.planTo,
                planTemplateId: record.planTemplateToId,
                scheduledDowngradeAt: "",
                scheduledDowngradePlanTemplateId: null,
                updatedAt: now,
              }
            : entry,
        ),
      );
      logTenantAction(sub.tenantId, "Scheduled downgrade executed", [`Now on ${record.planTo}`]);
    }
  };

  const applyBillingFailure = (recordId: string, reason: string) => {
    let nextAttempt = 1;
    let tenantId = "";
    let subscriptionId = "";
    setBillingRecords((prev) =>
      prev.map((row) => {
        if (row.id !== recordId) return row;
        nextAttempt = row.attemptCount + 1;
        tenantId = row.tenantId;
        subscriptionId = row.subscriptionId;
        return {
          ...row,
          status: "failed",
          attemptCount: nextAttempt,
          failedAt: new Date().toISOString(),
          failureReason: reason,
        };
      }),
    );
    const retryGap = RETRY_DAY_GAPS[Math.min(nextAttempt - 1, RETRY_DAY_GAPS.length - 1)] ?? 8;
    const retryAt = addDaysFrom(new Date().toISOString(), retryGap);
    setSubscriptions((prev) =>
      prev.map((entry) =>
        entry.id === subscriptionId
          ? {
              ...entry,
              status: "renewal_due",
              retryCount: nextAttempt,
              nextRetryAt: retryAt,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
    if (tenantId) {
      logTenantAction(tenantId, "Renewal payment failed", [`Attempt ${nextAttempt}`, reason]);
    }
  };

  const dispatchBillingWebhook = async (record: LicenseBillingRecord) => {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const billingApiBase = (env?.VITE_BILLING_API_BASE_URL || "").replace(/\/$/, "");
    const webhook = env?.VITE_LICENSE_BILLING_WEBHOOK_URL;
    if (billingApiBase) {
      try {
        const response = await fetch(`${billingApiBase}/webhooks/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "payment.success",
            billingRecordId: record.id,
            paymentId: `manual-${Date.now()}`,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          applyBillingFailure(record.id, payload?.error || `HTTP ${response.status}`);
          return;
        }
        applyBillingSuccess(record.id, payload?.paymentId || payload?.id || "backend-paid");
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Backend billing API dispatch failed.";
        applyBillingFailure(record.id, message);
        return;
      }
    }
    if (!webhook) {
      applyBillingSuccess(record.id, "demo-manual");
      setNotice("Billing webhook not configured. Marked paid in demo mode.");
      return;
    }
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status === "failed") {
        applyBillingFailure(record.id, payload?.message || `HTTP ${response.status}`);
        return;
      }
      applyBillingSuccess(record.id, payload?.paymentId || payload?.id || "gateway-paid");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Billing webhook dispatch failed.";
      applyBillingFailure(record.id, message);
    }
  };

  const startBillingCheckout = async (tenantId: string, type: BillingRecordType, targetTemplateId?: string | null) => {
    const sub = subscriptions.find((entry) => entry.tenantId === tenantId) ?? null;
    const tenant = tenants.find((entry) => entry.id === tenantId) ?? null;
    if (!sub || !tenant) {
      setError("Subscription record not found for this licensee.");
      return;
    }
    const fromPlan = sub.planName || tenant.planName;
    const toTemplate = targetTemplateId ? planTemplates.find((row) => row.id === targetTemplateId) ?? null : null;
    const toPlan = toTemplate?.name ?? fromPlan;
    const amount =
      type === "upgrade"
        ? computeUpgradeProration(fromPlan, toPlan, sub.billingCycle, sub.renewalDate)
        : planAmountForCycle(type === "downgrade" ? toPlan : fromPlan, sub.billingCycle);
    const now = new Date().toISOString();
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const billingApiBase = (env?.VITE_BILLING_API_BASE_URL || "").replace(/\/$/, "");
    if (billingApiBase) {
      try {
        const response = await fetch(`${billingApiBase}/billing/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            subscriptionId: sub.id,
            type,
            billingCycle: sub.billingCycle,
            fromPlan,
            toPlan,
            amount: Math.max(0, amount),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(payload?.error || `Billing checkout failed (HTTP ${response.status}).`);
          return;
        }
        const remoteRecord: LicenseBillingRecord = {
          id: payload?.billingRecord?.id || makeId(),
          tenantId,
          subscriptionId: sub.id,
          type,
          status: "pending",
          planFrom: fromPlan,
          planTo: toPlan,
          planTemplateFromId: sub.planTemplateId,
          planTemplateToId: toTemplate?.id ?? sub.planTemplateId,
          amount: Math.max(0, amount),
          currency: "INR",
          gateway: "manual",
          attemptCount: 1,
          dueDate: todayISODate(),
          createdAt: now,
          paidAt: "",
          failedAt: "",
          failureReason: "",
          gatewayRef: "",
        };
        setBillingRecords((prev) => [remoteRecord, ...prev]);
        await dispatchBillingWebhook(remoteRecord);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Billing checkout failed.");
        return;
      }
    }

    const record: LicenseBillingRecord = {
      id: makeId(),
      tenantId,
      subscriptionId: sub.id,
      type,
      status: "pending",
      planFrom: fromPlan,
      planTo: toPlan,
      planTemplateFromId: sub.planTemplateId,
      planTemplateToId: toTemplate?.id ?? sub.planTemplateId,
      amount: Math.max(0, amount),
      currency: "INR",
      gateway: "manual",
      attemptCount: 1,
      dueDate: todayISODate(),
      createdAt: now,
      paidAt: "",
      failedAt: "",
      failureReason: "",
      gatewayRef: "",
    };
    setBillingRecords((prev) => [record, ...prev]);
    if (type === "upgrade") {
      setSubscriptions((prev) =>
        prev.map((entry) =>
          entry.id === sub.id
            ? { ...entry, status: "renewal_due", updatedAt: now }
            : entry,
        ),
      );
    }
    await dispatchBillingWebhook(record);
  };
  void startBillingCheckout;

  const scheduleDowngrade = (tenantId: string, templateId: string, effectiveAt: string) => {
    const target = planTemplates.find((row) => row.id === templateId);
    if (!target) {
      setError("Select a valid plan template for scheduled downgrade.");
      return;
    }
    setSubscriptions((prev) =>
      prev.map((entry) =>
        entry.tenantId === tenantId
          ? {
              ...entry,
              scheduledDowngradePlanTemplateId: templateId,
              scheduledDowngradeAt: effectiveAt,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
    logTenantAction(tenantId, "Downgrade scheduled", [`Plan: ${target.name}`, `Effective: ${formatDateDisplay(effectiveAt)}`]);
    setNotice(`Downgrade to ${target.name} scheduled for ${formatDateDisplay(effectiveAt)}.`);
  };
  void scheduleDowngrade;

  useEffect(() => {
    const today = todayISODate();
    const key = `sales-lead-tracker:v2:billing-auto-renew:${today}`;
    if (loadText(key) === "done") return;
    const dueSubs = subscriptions.filter(
      (entry) =>
        entry.autoRenew
        && entry.status !== "suspended"
        && entry.renewalDate <= today
        && !billingRecords.some((row) => row.subscriptionId === entry.id && row.type === "renewal" && row.status === "pending"),
    );
    if (dueSubs.length === 0) {
      saveText(key, "done");
      return;
    }
    const now = new Date().toISOString();
    const records: LicenseBillingRecord[] = dueSubs.map((entry) => ({
      id: makeId(),
      tenantId: entry.tenantId,
      subscriptionId: entry.id,
      type: "renewal",
      status: "pending",
      planFrom: entry.planName,
      planTo: entry.planName,
      planTemplateFromId: entry.planTemplateId,
      planTemplateToId: entry.planTemplateId,
      amount: planAmountForCycle(entry.planName, entry.billingCycle),
      currency: "INR",
      gateway: "manual",
      attemptCount: 1,
      dueDate: today,
      createdAt: now,
      paidAt: "",
      failedAt: "",
      failureReason: "",
      gatewayRef: "",
    }));
    setBillingRecords((prev) => [...records, ...prev]);
    setSubscriptions((prev) =>
      prev.map((entry) =>
        dueSubs.some((due) => due.id === entry.id)
          ? { ...entry, status: "renewal_due", updatedAt: now }
          : entry,
      ),
    );
    records.forEach((record) => {
      void dispatchBillingWebhook(record);
    });
    saveText(key, "done");
  }, [subscriptions, billingRecords]);

  useEffect(() => {
    const today = todayISODate();
    const key = `sales-lead-tracker:v2:billing-retry:${today}`;
    if (loadText(key) === "done") return;
    const retryCandidates = subscriptions.filter((entry) => entry.nextRetryAt && entry.nextRetryAt <= today && entry.status !== "suspended");
    retryCandidates.forEach((entry) => {
      const failedRecord = billingRecords.find((row) => row.subscriptionId === entry.id && row.status === "failed");
      if (!failedRecord) return;
      const retryRecord: LicenseBillingRecord = {
        ...failedRecord,
        id: makeId(),
        status: "pending",
        createdAt: new Date().toISOString(),
        dueDate: today,
        attemptCount: failedRecord.attemptCount + 1,
        failedAt: "",
        failureReason: "",
        gatewayRef: "",
      };
      setBillingRecords((prev) => [retryRecord, ...prev]);
      void dispatchBillingWebhook(retryRecord);
    });

    const overdueGrace = subscriptions.filter((entry) => entry.graceEndsAt && entry.graceEndsAt < today && entry.status !== "suspended");
    if (overdueGrace.length > 0) {
      const tenantIds = new Set(overdueGrace.map((entry) => entry.tenantId));
      setTenants((prev) => prev.map((tenant) => (tenantIds.has(tenant.id) ? { ...tenant, isActive: false } : tenant)));
      setSubscriptions((prev) => prev.map((entry) => (tenantIds.has(entry.tenantId) ? { ...entry, status: "suspended", updatedAt: new Date().toISOString() } : entry)));
      overdueGrace.forEach((entry) => {
        logTenantAction(entry.tenantId, "License auto-suspended", ["Grace period exceeded without renewal payment"]);
      });
    }

    saveText(key, "done");
  }, [subscriptions, billingRecords]);

  useEffect(() => {
    const today = todayISODate();
    const dueDowngrades = subscriptions.filter(
      (entry) => entry.scheduledDowngradePlanTemplateId && entry.scheduledDowngradeAt && entry.scheduledDowngradeAt <= today,
    );
    if (dueDowngrades.length === 0) return;
    dueDowngrades.forEach((entry) => {
      const template = planTemplates.find((row) => row.id === entry.scheduledDowngradePlanTemplateId) ?? null;
      if (!template) return;
      const record: LicenseBillingRecord = {
        id: makeId(),
        tenantId: entry.tenantId,
        subscriptionId: entry.id,
        type: "downgrade",
        status: "paid",
        planFrom: entry.planName,
        planTo: template.name,
        planTemplateFromId: entry.planTemplateId,
        planTemplateToId: template.id,
        amount: 0,
        currency: "INR",
        gateway: "manual",
        attemptCount: 1,
        dueDate: today,
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        failedAt: "",
        failureReason: "",
        gatewayRef: "scheduled-downgrade",
      };
      setBillingRecords((prev) => [record, ...prev]);
      applyBillingSuccess(record.id, "scheduled-downgrade");
    });
  }, [subscriptions, planTemplates]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("Name, email and password are required.");
      return;
    }
    const email = newUserEmail.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      setError("Email already exists.");
      return;
    }
    const start = new Date().toISOString();
    const passwordHash = await sha256(newUserPassword);
    const targetTenantId = isOwner ? newUserTenantId : currentTenantId;
    const targetTenant = tenants.find((tenant) => tenant.id === targetTenantId) ?? null;
    const resolvedProfile = newUserRole === "sales" ? newUserProfile : "operations";
    if (resolvedProfile === "collections" && !targetTenant?.featureInvoicing) {
      setError("Accounts / Collections profile requires a Full Suite license with invoicing enabled.");
      return;
    }
    const resolvedScope: AccessScope =
      newUserRole === "owner" || newUserRole === "admin"
        ? "all"
        : resolvedProfile === "collections"
          ? "none"
          : newUserScope;
    const workflowAccess = normalizeWorkflowAccess(
      newUserRole,
      resolvedProfile,
      newUserCanAccessPipeline,
      newUserCanAccessFollowups,
    );
    const user: UserAccount = {
      id: makeId(),
      tenantId: targetTenantId,
      name: newUserName.trim(),
      email,
      passwordHash,
      role: newUserRole,
      staffProfile: resolvedProfile,
      canAccessPipeline: workflowAccess.canAccessPipeline,
      canAccessFollowups: workflowAccess.canAccessFollowups,
      accessScope: resolvedScope,
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: oneYearFrom(start),
      autoRenew: true,
      mustChangePassword: false,
      createdAt: start,
    };
    setUsers((prev) => [user, ...prev]);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("sales");
    setNewUserProfile("sales");
    setNewUserCanAccessPipeline(true);
    setNewUserCanAccessFollowups(true);
    setNewUserScope("assigned");
    setNewUserTenantId(targetTenantId);
    setNotice("Login created with 1-year auto-renew license.");
  };

  const applyCreatePackagePreset = (packageType: ProductMode) => {
    setNewWorkspaceProductMode(packageType);
    const preferredTemplate = activePlanTemplates.find((template) =>
      template.name.toLowerCase() === (packageType === "full" ? "growth" : "starter"),
    );
    if (preferredTemplate) {
      setNewWorkspacePlanChoice(preferredTemplate.id);
    }
    if (packageType === "lite") {
      setNewWorkspaceFeatureInvoicing(false);
      setNewWorkspaceFeatureExports(false);
      setNewWorkspaceFeatureForecast(false);
      setNewWorkspaceRequireGstCompliance(false);
      if (newWorkspacePlanChoice === CUSTOM_PLAN_ID) {
        setNewWorkspacePlanName("Follow-up Lite");
      }
    } else if (packageType === "pro") {
      setNewWorkspaceFeatureInvoicing(false);
      setNewWorkspaceFeatureExports(true);
      setNewWorkspaceFeatureForecast(true);
      setNewWorkspaceRequireGstCompliance(false);
      if (newWorkspacePlanChoice === CUSTOM_PLAN_ID) {
        setNewWorkspacePlanName("Lead Tracker Pro");
      }
    } else {
      setNewWorkspaceFeatureInvoicing(true);
      setNewWorkspaceFeatureExports(true);
      setNewWorkspaceFeatureForecast(true);
    }
  };

  const validateCreateLicenseeStep = (step: 1 | 2 | 3) => {
    if (step === 1) {
      const name = newWorkspaceName.trim();
      const slug = (newWorkspaceSlug.trim() || slugifyWorkspace(name)).toLowerCase();
      if (!name) {
        setError("Business name is required.");
        return false;
      }
      if (!slug) {
        setError("Workspace URL name could not be generated. Please enter a business name.");
        return false;
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        setError("Workspace URL name can use lowercase letters, numbers, and hyphens only.");
        return false;
      }
      if (isWorkspaceUrlNameManual && tenants.some((tenant) => tenant.slug === slug)) {
        setError("Workspace URL name already exists. Try a different one.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!newWorkspacePlanName.trim()) {
        setError("Plan name is required.");
        return false;
      }
      if (newWorkspaceMaxUsers < 1 || newWorkspaceMaxLeads < 1 || newWorkspaceGraceDays < 0 || newWorkspaceAuditRetention < 30) {
        setError("Invalid entitlement values. Check users, leads, grace, and retention.");
        return false;
      }
      return true;
    }
    if (!workspaceAdminName.trim() || !workspaceAdminEmail.trim() || !workspaceAdminPassword.trim()) {
      setError("Tenant admin name, email, and password are required.");
      return false;
    }
    return true;
  };

  const createLicenseeChecklist = useMemo(() => {
    const name = newWorkspaceName.trim();
    const slug = (newWorkspaceSlug.trim() || slugifyWorkspace(name)).toLowerCase();
    const resolvedFeatureInvoicing = newWorkspaceProductMode === "full" && newWorkspaceFeatureInvoicing;
    const adminEmail = workspaceAdminEmail.trim().toLowerCase();
    const duplicateSlug = !!slug && tenants.some((tenant) => tenant.slug === slug);
    const duplicateAdminEmail = !!adminEmail && users.some((user) => user.email.toLowerCase() === adminEmail);

    const items: Array<{ id: string; label: string; done: boolean; required: boolean }> = [
      {
        id: "client-name",
        label: "Business name entered",
        done: !!name,
        required: true,
      },
      {
        id: "workspace-url",
        label: "Workspace URL name is valid and available",
        done: !!slug && /^[a-z0-9-]+$/.test(slug) && !duplicateSlug,
        required: true,
      },
      {
        id: "plan-name",
        label: "Plan name is configured",
        done: !!newWorkspacePlanName.trim(),
        required: true,
      },
      {
        id: "entitlements",
        label: "Plan limits are valid",
        done: newWorkspaceMaxUsers >= 1 && newWorkspaceMaxLeads >= 1 && newWorkspaceGraceDays >= 0 && newWorkspaceAuditRetention >= 30,
        required: true,
      },
      {
        id: "admin-name",
        label: "Tenant admin name entered",
        done: !!workspaceAdminName.trim(),
        required: true,
      },
      {
        id: "admin-email",
        label: "Tenant admin email is valid and available",
        done: !!adminEmail && isValidEmail(adminEmail) && !duplicateAdminEmail,
        required: true,
      },
      {
        id: "admin-password",
        label: "Tenant admin password set",
        done: workspaceAdminPassword.trim().length >= 8,
        required: true,
      },
      {
        id: "invoice-issuer",
        label: "Invoice issuer profile ready (Full Suite only)",
        done: !resolvedFeatureInvoicing || (!!newWorkspaceInvoiceLegalName.trim() && !!newWorkspaceInvoiceEmail.trim() && isValidEmail(newWorkspaceInvoiceEmail)),
        required: resolvedFeatureInvoicing,
      },
    ];

    const requiredTotal = items.filter((item) => item.required).length;
    const requiredDone = items.filter((item) => item.required && item.done).length;

    return {
      items,
      requiredTotal,
      requiredDone,
      canSubmit: requiredTotal > 0 && requiredDone === requiredTotal,
      resolvedFeatureInvoicing,
    };
  }, [
    newWorkspaceName,
    newWorkspaceSlug,
    newWorkspaceProductMode,
    newWorkspaceFeatureInvoicing,
    newWorkspacePlanName,
    newWorkspaceMaxUsers,
    newWorkspaceMaxLeads,
    newWorkspaceGraceDays,
    newWorkspaceAuditRetention,
    workspaceAdminName,
    workspaceAdminEmail,
    workspaceAdminPassword,
    newWorkspaceInvoiceLegalName,
    newWorkspaceInvoiceEmail,
    tenants,
    users,
  ]);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!isOwner) {
      setError("Only owner accounts can create workspaces.");
      return;
    }
    const name = newWorkspaceName.trim();
    const rawSlug = (newWorkspaceSlug.trim() || slugifyWorkspace(name)).toLowerCase();
    const slug = isWorkspaceUrlNameManual ? rawSlug : generateWorkspaceSlug(name);
    const adminEmail = workspaceAdminEmail.trim().toLowerCase();
    const resolvedFeatureInvoicing = newWorkspaceProductMode === "full" && newWorkspaceFeatureInvoicing;
    const resolvedRequireGstCompliance = resolvedFeatureInvoicing ? newWorkspaceRequireGstCompliance : false;
    if (!name || !rawSlug || !workspaceAdminName.trim() || !adminEmail || !workspaceAdminPassword.trim()) {
      setError("Business name, workspace URL name, and admin credentials are required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(rawSlug)) {
      setError("Workspace URL name can use lowercase letters, numbers, and hyphens only.");
      return;
    }
    if (isWorkspaceUrlNameManual && tenants.some((tenant) => tenant.slug === slug)) {
      setError("Workspace URL name already exists. Try a different one.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === adminEmail)) {
      setError("Admin email already exists.");
      return;
    }
    if (!newWorkspacePlanName.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (newWorkspaceMaxUsers < 1 || newWorkspaceMaxLeads < 1 || newWorkspaceGraceDays < 0 || newWorkspaceAuditRetention < 30) {
      setError("Invalid entitlement values. Check users, leads, grace, and retention.");
      return;
    }
    if (resolvedFeatureInvoicing) {
      if (!newWorkspaceInvoiceLegalName.trim() || !newWorkspaceInvoiceEmail.trim()) {
        setError("Invoice issuer legal name and email are required for Full Suite workspaces.");
        return;
      }
      if (!isValidEmail(newWorkspaceInvoiceEmail)) {
        setError("Enter a valid invoice issuer email.");
        return;
      }
      if (newWorkspaceInvoicePhone.trim() && !isValidPhone(newWorkspaceInvoicePhone)) {
        setError("Enter a valid invoice issuer phone number.");
        return;
      }
      if (newWorkspaceInvoicePincode.trim() && !/^\d{6}$/.test(newWorkspaceInvoicePincode.trim())) {
        setError("Invoice issuer pincode must be a 6-digit value.");
        return;
      }
    }

    const start = new Date().toISOString();
    const workspaceLicenseEnd =
      newWorkspaceLicenseTerm === "trial15" ? addDaysFrom(start, DEFAULT_TRIAL_DAYS) : oneYearFrom(start);
    const workspaceAutoRenew = newWorkspaceLicenseTerm !== "trial15";
    const tenantId = `tenant-${makeId()}`;
    const passwordHash = await sha256(workspaceAdminPassword);

    const tenant: Tenant = {
      id: tenantId,
      name,
      slug,
      productMode: newWorkspaceProductMode,
      planTemplateId: newWorkspacePlanChoice === CUSTOM_PLAN_ID ? null : newWorkspacePlanChoice,
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: workspaceLicenseEnd,
      autoRenew: workspaceAutoRenew,
      isTrial: newWorkspaceLicenseTerm === "trial15",
      trialDays: newWorkspaceLicenseTerm === "trial15" ? DEFAULT_TRIAL_DAYS : 0,
      graceDays: newWorkspaceGraceDays,
      planName: newWorkspacePlanName.trim(),
      maxUsers: newWorkspaceMaxUsers,
      maxLeadsPerMonth: newWorkspaceMaxLeads,
      featureExports: newWorkspaceFeatureExports,
      featureAdvancedForecast: newWorkspaceFeatureForecast,
      featureInvoicing: resolvedFeatureInvoicing,
      requireGstCompliance: resolvedRequireGstCompliance,
      invoiceProfile: {
        legalName: newWorkspaceInvoiceLegalName.trim() || name,
        addressLine: newWorkspaceInvoiceAddress.trim(),
        city: newWorkspaceInvoiceCity.trim() || DEFAULT_INVOICE_PROFILE.city,
        state: newWorkspaceInvoiceState.trim() || DEFAULT_INVOICE_PROFILE.state,
        pincode: newWorkspaceInvoicePincode.trim(),
        phone: newWorkspaceInvoicePhone.trim(),
        email: (newWorkspaceInvoiceEmail.trim().toLowerCase() || adminEmail),
        gstin: newWorkspaceInvoiceGstin.trim().toUpperCase(),
        stateCode: newWorkspaceInvoiceStateCode.trim() || DEFAULT_INVOICE_PROFILE.stateCode,
      },
      auditRetentionDays: newWorkspaceAuditRetention,
      createdAt: start,
    };
    const adminUser: UserAccount = {
      id: makeId(),
      tenantId,
      name: workspaceAdminName.trim(),
      email: adminEmail,
      passwordHash,
      role: "admin",
      staffProfile: "operations",
      canAccessPipeline: true,
      canAccessFollowups: true,
      accessScope: "all",
      isActive: true,
      licenseStartDate: start,
      licenseEndDate: workspaceLicenseEnd,
      autoRenew: workspaceAutoRenew,
      mustChangePassword: false,
      createdAt: start,
    };

    setTenants((prev) => [tenant, ...prev]);
    setUsers((prev) => [adminUser, ...prev]);
    setServicesByTenant((prev) => ({ ...prev, [tenantId]: [...DEFAULT_SERVICES] }));
    setSettingsByTenant((prev) => ({
      ...prev,
      [tenantId]: DEFAULT_APP_SETTINGS,
    }));
    setPipelineWipLimitsByTenant((prev) => ({
      ...prev,
      [tenantId]: normalizePipelineWipLimits(PIPELINE_WIP_LIMITS),
    }));
    if (newWorkspaceLicenseTerm === "trial15") {
      setTrialAccounts((prev) => [
        {
          id: makeId(),
          tenantId,
          ownerName: adminUser.name,
          ownerEmail: adminUser.email,
          workspaceName: tenant.name,
          signupSource: "owner-created",
          trialStartAt: start,
          trialEndAt: workspaceLicenseEnd,
          status: "active",
          convertedAt: "",
          lastLoginAt: "",
          createdAt: start,
        },
        ...prev.filter((entry) => entry.tenantId !== tenantId),
      ]);
    }
    setSelectedUsersTenantId(tenantId);
    setTenantDrafts((prev) => ({ ...prev, [tenantId]: toTenantDraft(tenant) }));
    setNewWorkspaceName("");
    setNewWorkspaceSlug("");
    setIsWorkspaceUrlNameManual(false);
    setShowWorkspaceUrlNameEditor(false);
    setWorkspaceAdminName("");
    setWorkspaceAdminEmail("");
    setWorkspaceAdminPassword("");
    setNewWorkspaceLicenseTerm("annual");
    setNewWorkspacePlanChoice(DEFAULT_PLAN_TEMPLATE_ID);
    setNewWorkspaceFeatureInvoicing(DEFAULT_TENANT_ENTITLEMENTS.featureInvoicing);
    setNewWorkspaceRequireGstCompliance(DEFAULT_TENANT_ENTITLEMENTS.requireGstCompliance);
    setNewWorkspaceInvoiceLegalName(DEFAULT_INVOICE_PROFILE.legalName);
    setNewWorkspaceInvoiceAddress(DEFAULT_INVOICE_PROFILE.addressLine);
    setNewWorkspaceInvoiceCity(DEFAULT_INVOICE_PROFILE.city);
    setNewWorkspaceInvoiceState(DEFAULT_INVOICE_PROFILE.state);
    setNewWorkspaceInvoicePincode(DEFAULT_INVOICE_PROFILE.pincode);
    setNewWorkspaceInvoicePhone(DEFAULT_INVOICE_PROFILE.phone);
    setNewWorkspaceInvoiceEmail(DEFAULT_INVOICE_PROFILE.email);
    setNewWorkspaceInvoiceGstin(DEFAULT_INVOICE_PROFILE.gstin);
    setNewWorkspaceInvoiceStateCode(DEFAULT_INVOICE_PROFILE.stateCode);
    setCreateLicenseeStep(1);
    setCustomizeCreateEntitlements(false);
    setShowCreateAdvancedSettings(false);
    setNotice(
      newWorkspaceLicenseTerm === "trial15"
        ? `Workspace created with a ${DEFAULT_TRIAL_DAYS}-day trial and tenant admin account.`
        : "Workspace created with a 1-year license and tenant admin account.",
    );
    logTenantAction(tenantId, "Licensee created", [
      `Plan: ${tenant.planName}`,
      `Package: ${PRODUCT_MODE_LABELS[tenant.productMode]}`,
      `License term: ${newWorkspaceLicenseTerm === "trial15" ? `${DEFAULT_TRIAL_DAYS}-day trial` : "1 year"}`,
      `Users: ${tenant.maxUsers}`,
      `Leads/month: ${tenant.maxLeadsPerMonth}`,
    ]);
  };

  const updateUser = (userId: string, patch: Partial<UserAccount>) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  };

  const upsertTenantDraft = (tenant: Tenant, patch: Partial<TenantEntitlementDraft>) => {
    setTenantDrafts((prev) => {
      const base = prev[tenant.id] ?? toTenantDraft(tenant);
      return {
        ...prev,
        [tenant.id]: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const saveTenantDraft = async (tenant: Tenant) => {
    resetMessages();
    const draft = tenantDrafts[tenant.id] ?? toTenantDraft(tenant);
    const nextPlanLabel = draft.planName.trim() || tenant.planName;
    if (draft.maxUsers < 1 || draft.maxLeadsPerMonth < 1 || draft.graceDays < 0 || draft.auditRetentionDays < 30) {
      setError("Entitlement values are invalid. Check user limit, lead limit, grace days, and audit retention.");
      return;
    }
    const activeSeatUsage = users.filter((user) => user.tenantId === tenant.id && user.isActive && !isExpired(user) && !user.isBreakGlass).length;
    const currentMonthUsage = leads.filter((lead) => lead.tenantId === tenant.id && monthKeyFromDate(lead.dateAdded) === currentMonthKey()).length;
    if (draft.maxUsers < activeSeatUsage) {
      const proceed = await confirmToast(
        `Seat limit ${draft.maxUsers} is below active users ${activeSeatUsage}. Save anyway?`,
        "Save Anyway",
      );
      if (!proceed) return;
    }
    if (draft.maxLeadsPerMonth < currentMonthUsage) {
      const proceed = await confirmToast(
        `Lead limit ${draft.maxLeadsPerMonth} is below this month's leads ${currentMonthUsage}. Save anyway?`,
        "Save Anyway",
      );
      if (!proceed) return;
    }
    const matchedTemplate = activePlanTemplates.find((template) => template.name.toLowerCase() === nextPlanLabel.toLowerCase()) ?? null;
    const nextPlanTemplateId = matchedTemplate?.id ?? null;
    const previousPlanLabel = tenant.planName;
    setTenants((prev) =>
      prev.map((row) =>
        row.id === tenant.id
          ? {
              ...row,
              planTemplateId: nextPlanTemplateId,
              planName: nextPlanLabel,
              maxUsers: draft.maxUsers,
              maxLeadsPerMonth: draft.maxLeadsPerMonth,
              graceDays: draft.graceDays,
              featureExports: draft.featureExports,
              featureAdvancedForecast: draft.featureAdvancedForecast,
              featureInvoicing: draft.featureInvoicing,
              requireGstCompliance: draft.requireGstCompliance,
              invoiceProfile: draft.invoiceProfile,
              auditRetentionDays: draft.auditRetentionDays,
            }
          : row,
      ),
    );
    const syncedTenant: Tenant = {
      ...tenant,
      planTemplateId: nextPlanTemplateId,
      planName: nextPlanLabel,
      maxUsers: draft.maxUsers,
      maxLeadsPerMonth: draft.maxLeadsPerMonth,
      graceDays: draft.graceDays,
      featureExports: draft.featureExports,
      featureAdvancedForecast: draft.featureAdvancedForecast,
      featureInvoicing: draft.featureInvoicing,
      requireGstCompliance: draft.requireGstCompliance,
      invoiceProfile: draft.invoiceProfile,
      auditRetentionDays: draft.auditRetentionDays,
    };
    setTenantDrafts((prev) => ({ ...prev, [tenant.id]: toTenantDraft(syncedTenant) }));
    setNotice("Selected client entitlements updated.");
    logTenantAction(tenant.id, "Licensee entitlements updated", [
      `Plan: ${previousPlanLabel} -> ${nextPlanLabel}`,
      `Package: ${PRODUCT_MODE_LABELS[tenant.productMode]} -> ${PRODUCT_MODE_LABELS[draft.productMode]}`,
      `Users: ${tenant.maxUsers} -> ${draft.maxUsers}`,
      `Leads/month: ${tenant.maxLeadsPerMonth} -> ${draft.maxLeadsPerMonth}`,
    ]);
  };

  const applyPlanPreset = (tenant: Tenant, presetKey: PlanPresetKey) => {
    const templateId = SYSTEM_PLAN_TEMPLATE_IDS[presetKey];
    const template = activePlanTemplates.find((entry) => entry.id === templateId);
    if (!template) {
      setError("Preset template is unavailable.");
      return;
    }
    upsertTenantDraft(tenant, {
      planName: template.name,
      maxUsers: template.maxUsers,
      maxLeadsPerMonth: template.maxLeadsPerMonth,
      graceDays: template.graceDays,
      featureExports: template.featureExports,
      featureAdvancedForecast: template.featureAdvancedForecast,
      featureInvoicing: template.featureInvoicing,
      requireGstCompliance: template.requireGstCompliance,
      auditRetentionDays: template.auditRetentionDays,
    });
    setNotice(`${template.name} preset applied. Save entitlements to confirm.`);
    setError("");
  };

  const applyTemplateToTenantDraft = (tenant: Tenant, templateId: string) => {
    const template = planTemplates.find((entry) => entry.id === templateId);
    if (!template) {
      setError("Selected template not found.");
      return;
    }
    upsertTenantDraft(tenant, templateToTenantPatch(template));
    setNotice(`${template.name} template applied to draft. Save entitlements to confirm.`);
    setError("");
  };

  const createPlanTemplate = () => {
    resetMessages();
    if (!isOwner) {
      setError("Only owner can create plan templates.");
      return;
    }
    if (!templateName.trim()) {
      setError("Template name is required.");
      return;
    }
    if (planTemplates.some((template) => template.name.toLowerCase() === templateName.trim().toLowerCase())) {
      setError("Template name already exists.");
      return;
    }
    const createdAt = new Date().toISOString();
    const nextTemplate: PlanTemplate = {
      id: `tpl-${makeId()}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      monthlyPriceInr: Math.max(0, Number(templateMonthlyPrice) || 0),
      offerLabel: templateOfferLabel.trim(),
      maxUsers: Math.max(1, templateMaxUsers),
      maxLeadsPerMonth: Math.max(1, templateMaxLeads),
      graceDays: Math.max(0, templateGraceDays),
      auditRetentionDays: Math.max(30, templateAuditRetention),
      featureExports: templateFeatureExports,
      featureAdvancedForecast: templateFeatureForecast,
      featureInvoicing: templateFeatureInvoicing,
      requireGstCompliance: templateRequireGstCompliance,
      isSystemPreset: false,
      isActive: true,
      updatedAt: createdAt,
    };
    setPlanTemplates((prev) => [...prev, nextTemplate]);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateMonthlyPrice(5999);
    setTemplateOfferLabel("");
    setTemplateMaxUsers(10);
    setTemplateMaxLeads(500);
    setTemplateGraceDays(DEFAULT_GRACE_DAYS);
    setTemplateAuditRetention(365);
    setTemplateFeatureExports(true);
    setTemplateFeatureForecast(true);
    setTemplateFeatureInvoicing(true);
    setTemplateRequireGstCompliance(true);
    logTenantAction(currentTenantId, "Plan template created", [`Template: ${nextTemplate.name}`]);
    setNotice("Plan template created.");
  };

  const updatePlanTemplate = (templateId: string, patch: Partial<PlanTemplate>) => {
    resetMessages();
    setPlanTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? {
              ...template,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    );
  };

  const duplicatePlanTemplate = (template: PlanTemplate) => {
    const copy: PlanTemplate = {
      ...template,
      id: `tpl-${makeId()}`,
      name: `${template.name} Copy`,
      isSystemPreset: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    setPlanTemplates((prev) => [...prev, copy]);
    logTenantAction(currentTenantId, "Plan template duplicated", [`From: ${template.name}`, `To: ${copy.name}`]);
    setNotice(`Template duplicated as ${copy.name}.`);
  };

  const saveTenantDraftAsTemplate = (tenant: Tenant) => {
    resetMessages();
    const draft = tenantDrafts[tenant.id] ?? toTenantDraft(tenant);
    if (!draft.planName.trim()) {
      setError("Plan name is required to save as template.");
      return;
    }
    if (planTemplates.some((template) => template.name.toLowerCase() === draft.planName.trim().toLowerCase())) {
      setError("Template with this name already exists.");
      return;
    }
    const createdAt = new Date().toISOString();
    const nextTemplate: PlanTemplate = {
      id: `tpl-${makeId()}`,
      name: draft.planName.trim(),
      description: `Saved from ${tenant.name}`,
      monthlyPriceInr: planAmountForCycle(draft.planName.trim(), "monthly"),
      offerLabel: `Configured for ${tenant.name}`,
      maxUsers: draft.maxUsers,
      maxLeadsPerMonth: draft.maxLeadsPerMonth,
      graceDays: draft.graceDays,
      auditRetentionDays: draft.auditRetentionDays,
      featureExports: draft.featureExports,
      featureAdvancedForecast: draft.featureAdvancedForecast,
      featureInvoicing: draft.featureInvoicing,
      requireGstCompliance: draft.requireGstCompliance,
      isSystemPreset: false,
      isActive: true,
      updatedAt: createdAt,
    };
    setPlanTemplates((prev) => [...prev, nextTemplate]);
    logTenantAction(tenant.id, "Plan template saved from tenant", [`Template: ${nextTemplate.name}`]);
    setNotice(`Template ${nextTemplate.name} created from tenant draft.`);
  };

  const archiveUser = (user: UserAccount) => {
    resetMessages();
    if (user.isBreakGlass) {
      setError("Break-glass owner cannot be moved to old users.");
      return;
    }
    if (user.id === currentUser?.id) {
      setError("You cannot move your own login to old users.");
      return;
    }
    const nextUsers = users.filter((row) => row.id !== user.id);
    if (!hasMinimumActiveAdmins(nextUsers, user.tenantId)) {
      setError("Each workspace must retain at least 2 active Admin/Owner logins.");
      return;
    }
    const reason: ArchivedUser["archiveReason"] = isExpired(user) ? "expired" : user.isActive ? "removed" : "inactive";
    setUsers(nextUsers);
    setOldUsers((prev) => [
      {
        ...user,
        archivedAt: new Date().toISOString(),
        archivedBy: currentUser?.name ?? "Admin",
        archiveReason: reason,
      },
      ...prev,
    ]);
    setNotice(`${user.name} moved to Old Users.`);
  };

  const restoreOldUser = (user: ArchivedUser) => {
    resetMessages();
    if (users.some((row) => row.email.toLowerCase() === user.email.toLowerCase())) {
      setError("Cannot restore: another active login already uses this email.");
      return;
    }
    const { archivedAt: _archivedAt, archivedBy: _archivedBy, archiveReason: _archiveReason, ...restored } = user;
    setUsers((prev) => [restored, ...prev]);
    setOldUsers((prev) => prev.filter((row) => row.id !== user.id));
    setNotice(`${user.name} restored to Manage Logins.`);
  };

  const deleteOldUserPermanently = (user: ArchivedUser) => {
    const deleted = { ...user };
    setOldUsers((prev) => prev.filter((row) => row.id !== user.id));
    setNotice(`${user.name} deleted from archive.`);
    toastUndo(`Deleted ${user.name} from Old Users.`, () => {
      setOldUsers((prev) => [deleted, ...prev]);
      setNotice(`${user.name} restored to Old Users.`);
    });
  };

  useEffect(() => {
    const handleModalHotkeys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTypingTarget = !!target && (target.tagName === "TEXTAREA" || target.isContentEditable);
      const isSelect = target?.tagName === "SELECT";

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        if (!currentUser) return;
        if (isTypingTarget || isSelect) return;
        event.preventDefault();
        setQuickCommandOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        if (directPasswordUserId) {
          setDirectPasswordUserId(null);
          setDirectPasswordDraft("");
          setDirectPasswordConfirmDraft("");
          return;
        }
        if (closingDatePrompt) {
          setClosingDatePrompt(null);
          setClosingDateDraft("");
          return;
        }
        if (lostReasonPrompt) {
          setLostReasonPrompt(null);
          setLostReasonDraft("");
          return;
        }
        if (paymentModalInvoiceId) {
          setPaymentModalInvoiceId(null);
          return;
        }
        if (adjustmentModalInvoiceId) {
          setAdjustmentModalInvoiceId(null);
          return;
        }
        if (promiseModalInvoiceId) {
          setPromiseModalInvoiceId(null);
          return;
        }
        if (ledgerInvoiceId) {
          setLedgerInvoiceId(null);
          return;
        }
        if (leadDrawerOpen) {
          setLeadDrawerOpen(false);
          return;
        }
        if (leadIntakeModalOpen) {
          closeLeadIntakeModal();
          return;
        }
        if (quickCommandOpen) {
          setQuickCommandOpen(false);
        }
        return;
      }

      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget || isSelect) return;

      if (directPasswordUserId) {
        event.preventDefault();
        void submitDirectPasswordChange();
        return;
      }

      if (paymentModalInvoiceId) {
        event.preventDefault();
        submitInvoicePayment();
        return;
      }
      if (adjustmentModalInvoiceId) {
        event.preventDefault();
        submitInvoiceAdjustment();
        return;
      }
      if (promiseModalInvoiceId) {
        event.preventDefault();
        submitInvoicePromise();
        return;
      }
      if (leadIntakeModalOpen) {
        event.preventDefault();
        if (leadIntakeStep === 1) {
          void createQuickLeadFromStepOne();
        } else {
          void createLead({ preventDefault: () => {} } as React.FormEvent);
        }
        return;
      }
      if (invoiceComposerOpen && appView === "invoices") {
        event.preventDefault();
        void createInvoice();
      }
    };

    window.addEventListener("keydown", handleModalHotkeys);
    return () => window.removeEventListener("keydown", handleModalHotkeys);
  }, [
    appView,
    directPasswordUserId,
    closingDatePrompt,
    lostReasonPrompt,
    paymentModalInvoiceId,
    adjustmentModalInvoiceId,
    promiseModalInvoiceId,
    ledgerInvoiceId,
    leadDrawerOpen,
    leadIntakeModalOpen,
    leadIntakeStep,
    invoiceComposerOpen,
    quickCommandOpen,
    submitInvoicePayment,
    submitInvoiceAdjustment,
    submitInvoicePromise,
    createQuickLeadFromStepOne,
    createLead,
    createInvoice,
    submitDirectPasswordChange,
    currentUser,
  ]);

  useEffect(() => {
    const root = document.querySelector(".yugam-neo-ui");
    if (!root) return;

    const applyAriaLabels = () => {
      root.querySelectorAll("button").forEach((button) => {
        if (button.getAttribute("aria-label")) return;
        const text = (button.textContent || "").replace(/\s+/g, " ").trim();
        const titled = button.getAttribute("title") || button.getAttribute("data-label") || "";
        if (!text) {
          button.setAttribute("aria-label", titled || "Action button");
          return;
        }
        if (/^[+\-x×✕✖•…]+$/.test(text)) {
          button.setAttribute("aria-label", titled || "Action button");
        }
      });
    };

    applyAriaLabels();
    const observer = new MutationObserver(() => applyAriaLabels());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [sessionUserId, appView]);

  const renameAssigneeEverywhere = (tenantId: string, oldName: string, newName: string) => {
    if (!oldName || !newName || oldName === newName) return;
    setLeads((prev) => prev.map((l) => (l.tenantId === tenantId && l.assignedTo === oldName ? { ...l, assignedTo: newName } : l)));
    setActivities((prev) => [
      {
        id: makeId(),
        tenantId,
        leadId: "system",
        actor: currentUser?.name ?? "Admin",
        action: "Assignee renamed",
        changes: [`${oldName} -> ${newName}`],
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const authViewMeta: Record<AuthView, { title: string; subtitle: string }> = {
    login: {
      title: "Sign In",
      subtitle: "Access your workspace and continue your daily sales flow.",
    },
    trial: {
      title: "Start Free Trial",
      subtitle: `${DEFAULT_TRIAL_DAYS}-day trial workspace with full features for evaluation.`,
    },
    register: {
      title: "Request Access",
      subtitle: "Submit a request and get approved by your workspace admin.",
    },
    forgot: {
      title: "Reset Password",
      subtitle: "Get a reset code and securely create a new password.",
    },
  };

  const authInputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40";
  const authLabelClass = "block space-y-1 text-sm font-medium text-slate-700";
  const authHelperClass = "text-[11px] font-normal text-slate-500";

  useEffect(() => {
    if (currentUser || typeof window === "undefined") return;
    const nextPath = PUBLIC_VIEW_PATHS[publicView] ?? "/";
    if (window.location.pathname !== nextPath) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [currentUser, publicView]);

  useEffect(() => {
    if (currentUser || typeof window === "undefined") return;
    const handlePopState = () => setPublicView(pathToPublicView(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser]);

  const publicPricingPlans = useMemo(() => {
    return [...activePlanTemplates]
      .filter((template) => template.isActive || template.isSystemPreset)
      .sort((a, b) => a.monthlyPriceInr - b.monthlyPriceInr)
      .map((template) => ({
        id: template.id,
        name: template.name,
        modeLabel: PRODUCT_MODE_LABELS[inferProductModeFromTenantFlags(template.featureInvoicing, template.featureAdvancedForecast, template.featureExports)],
        offerLabel: template.offerLabel || template.description,
        monthlyPriceInr: template.monthlyPriceInr,
        highlights: [
          `${template.maxUsers} team members`,
          `${template.maxLeadsPerMonth.toLocaleString("en-IN")} leads / month`,
          template.featureInvoicing ? "GST invoicing included" : "Lead-only workflows",
        ],
      }));
  }, [activePlanTemplates]);

  const productProof = marketingContent.proof;
  const publicChangelog = marketingContent.changelog;
  const publicRoadmap = marketingContent.roadmap;

  const applyMarketingJsonDraft = () => {
    try {
      const parsed = JSON.parse(marketingJsonDraft) as Partial<MarketingContent>;
      setMarketingContent(normalizeMarketingContent(parsed));
      setMarketingJsonError("");
      setNotice("Website content JSON updated.");
    } catch {
      setMarketingJsonError("Invalid JSON format. Fix syntax and try again.");
    }
  };

  const resetMarketingJsonDraft = () => {
    setMarketingContent(DEFAULT_MARKETING_CONTENT);
    setMarketingJsonError("");
    setNotice("Website content reset to defaults.");
  };

  const loadMarketingJsonFromPublicFile = async () => {
    try {
      const response = await fetch("/marketing-content.json", { cache: "no-store" });
      if (!response.ok) {
        setMarketingJsonError("Could not read /marketing-content.json. Upload the file under public/ and try again.");
        return;
      }
      const parsed = (await response.json()) as Partial<MarketingContent>;
      const normalized = normalizeMarketingContent(parsed);
      setMarketingContent(normalized);
      setMarketingJsonDraft(JSON.stringify(normalized, null, 2));
      setMarketingJsonError("");
      setNotice("Website content loaded from /marketing-content.json.");
    } catch {
      setMarketingJsonError("Failed to load marketing-content.json. Check JSON format and file path.");
    }
  };

  const exportMarketingJson = () => {
    try {
      const parsed = JSON.parse(marketingJsonDraft) as Partial<MarketingContent>;
      const normalized = normalizeMarketingContent(parsed);
      downloadJson(`website-content-${todayISODate()}.json`, normalized);
      setMarketingJsonError("");
      setNotice("Website content JSON exported.");
    } catch {
      setMarketingJsonError("Cannot export invalid JSON. Fix syntax first.");
    }
  };

  const navigatePublic = (next: PublicView) => {
    setPublicView(next);
    if (next === "auth") {
      setView("login");
      resetMessages();
    }
  };

  const renderPublicFooter = () => (
    <footer className="rounded-3xl border border-[#d8ddff] bg-white p-6">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <BrandLogo className="h-10 w-auto" />
          <p className="mt-2 text-sm text-slate-600">Yugam Consulting: sales, follow-up, and billing operations in one streamlined system.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Contact</p>
          <p className="mt-2 text-sm text-slate-600">Mogappair West, Chennai</p>
          <a href="tel:+919092507004" className="mt-1 block text-sm text-[#5f56d3] hover:underline">+91 90925 07004</a>
          <a href="mailto:info@oruyugam.com" className="block text-sm text-[#5f56d3] hover:underline">info@oruyugam.com</a>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Quick Links</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => navigatePublic("features")} className="rounded-full bg-[#f0f2ff] px-3 py-1 text-slate-700 hover:bg-[#e4e8ff]">Features</button>
            <button type="button" onClick={() => navigatePublic("pricing")} className="rounded-full bg-[#f0f2ff] px-3 py-1 text-slate-700 hover:bg-[#e4e8ff]">Pricing</button>
            <button type="button" onClick={() => navigatePublic("contact")} className="rounded-full bg-[#f0f2ff] px-3 py-1 text-slate-700 hover:bg-[#e4e8ff]">Contact</button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>Built through iterative product engineering: {productProof.revisions} revisions, {productProof.hours} improvement hours.</p>
        <p>Last updated: {productProof.updatedOn}</p>
      </div>
    </footer>
  );

  const renderPublicPage = () => {
    const marketingThemeClass = marketingTheme === "futuristic" ? "marketing-theme-futuristic" : "marketing-theme-elegant";
    const nav = (
      <div className="flex justify-end">
        <nav aria-label="Public navigation" className="flex flex-wrap items-center gap-2 rounded-full border border-[#d6dcff] bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur">
          <button type="button" onClick={() => navigatePublic("landing")} className="rounded-full px-2.5 py-1 transition hover:bg-[#eef1ff]">Home</button>
          <button type="button" onClick={() => navigatePublic("features")} className="rounded-full px-2.5 py-1 transition hover:bg-[#eef1ff]">Features</button>
          <button type="button" onClick={() => navigatePublic("pricing")} className="rounded-full px-2.5 py-1 transition hover:bg-[#eef1ff]">Pricing</button>
          <button type="button" onClick={() => navigatePublic("comparison")} className="rounded-full px-2.5 py-1 transition hover:bg-[#eef1ff]">Comparison</button>
          <button type="button" onClick={() => navigatePublic("contact")} className="rounded-full px-2.5 py-1 transition hover:bg-[#eef1ff]">Contact</button>
          <div className="ml-1 flex items-center gap-1 rounded-full border border-[#d6dcff] bg-white px-1 py-1 text-[11px]">
            <button
              type="button"
              onClick={() => setMarketingTheme("elegant")}
              className={`rounded-full px-2 py-1 ${marketingTheme === "elegant" ? "bg-[#eef1ff] text-[#4757b7]" : "text-slate-600 hover:bg-[#f6f8ff]"}`}
              aria-label="Use Elegant Corporate style"
            >
              Elegant
            </button>
            <button
              type="button"
              onClick={() => setMarketingTheme("futuristic")}
              className={`rounded-full px-2 py-1 ${marketingTheme === "futuristic" ? "bg-[#eef7ff] text-[#3f65c1]" : "text-slate-600 hover:bg-[#f6f8ff]"}`}
              aria-label="Use Futuristic Tech style"
            >
              Futuristic
            </button>
          </div>
          <button type="button" onClick={() => navigatePublic("auth")} className="rounded-full bg-[#788023] px-3 py-1 text-white transition hover:bg-[#646b1d]">Login</button>
        </nav>
      </div>
    );

    if (publicView === "features") {
      return (
        <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
          {nav}
          <section className="rounded-3xl border border-[#d9def8] bg-white p-8">
              <h1 className="text-3xl font-semibold text-slate-900">Core Features</h1>
              <p className="mt-2 text-sm text-slate-600">Every module is designed for daily execution speed, not feature clutter.</p>
            <div className="mt-4 rounded-2xl border border-[#d8ddff] bg-[#f6f8ff] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5f56d3]">Most Valued By Teams</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>- GST-ready invoicing with maker-checker approvals and tax-rule checks for Indian operations.</li>
                <li>- Dunning Board for collections with promises, aging buckets, and reminder delivery tracking.</li>
                <li>- Finance reconciliation that compares won revenue vs invoiced totals to highlight leakage early.</li>
                <li>- Multi-client control model with plan templates, lifecycle states, and emergency recovery controls.</li>
                <li>- Honest analytics quality badges so teams know what is forecast vs what is exact.</li>
              </ul>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Lead Capture", "Manual entry, OCR business-card capture, duplicate detection, and quick add."],
                  ["Follow-up Command Center", "Today and overdue queues, bulk actions, SLA escalation, and role-specific visibility."],
                ["Pipeline Execution", "Drag-drop stages, smart urgency indicators, and stage-wise throughput control."],
                ["Billing and Collections", "GST/non-GST invoices, maker-checker approvals, payment ledger, and dunning workflows."],
                ["Licensee Control", "Lite/Pro/Full split, plan templates, renewal controls, and trial pipeline."],
                ["Operational Audit", "Lead and billing activity trails with clear exact vs directional data confidence."],
              ].map(([title, desc]) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{desc}</p>
                </article>
              ))}
            </div>
          </section>
          {renderPublicFooter()}
        </div>
      );
    }

    if (publicView === "pricing") {
      return (
        <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
          {nav}
          <section className="rounded-3xl border border-[#d9def8] bg-white p-8">
            <h1 className="text-3xl font-semibold text-slate-900">Pricing Plans</h1>
              <p className="mt-2 text-sm text-slate-600">Choose the plan that matches your stage: Follow-up Lite, Lead Tracker Pro, or Full Suite.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {publicPricingPlans.slice(0, 3).map((plan) => (
                <article key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5f56d3]">{plan.modeLabel}</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">₹ {plan.monthlyPriceInr.toLocaleString("en-IN")}<span className="text-sm font-medium text-slate-500"> / month</span></p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {plan.highlights.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">{plan.offerLabel}</p>
                </article>
              ))}
            </div>
          </section>
          {renderPublicFooter()}
        </div>
      );
    }

    if (publicView === "comparison") {
      return (
        <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
          {nav}
          <section className="rounded-3xl border border-[#d9def8] bg-white p-8">
            <h1 className="text-3xl font-semibold text-slate-900">How Yugam Is Different</h1>
            <p className="mt-2 text-sm text-slate-600">
              Most tools offer broad modules. Yugam is designed to help teams close daily work faster with fewer clicks.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Built for Daily Action</p>
                <p className="mt-1 text-xs text-slate-600">Overdue queue, quick follow-up actions, and one-screen execution for sales reps.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Simple Product Tiers</p>
                <p className="mt-1 text-xs text-slate-600">Choose Lite, Pro, or Full based on team needs. Upgrade anytime without migration stress.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">One Continuous Flow</p>
                <p className="mt-1 text-xs text-slate-600">Lead capture, follow-up, pipeline, invoicing, and collections connected in one workspace.</p>
              </article>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">What matters</th>
                    <th className="px-4 py-3">Yugam</th>
                    <th className="px-4 py-3">Many all-in-one tools</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Setup time</td><td className="px-4 py-3">Usually same-day onboarding</td><td className="px-4 py-3">Often longer setup with more configuration</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Daily follow-up work</td><td className="px-4 py-3">Queue-first, action-oriented screens</td><td className="px-4 py-3">Powerful, but more navigation steps</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Plan flexibility</td><td className="px-4 py-3">Lite / Pro / Full with clear role control</td><td className="px-4 py-3">Broader bundles with extra modules</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Lead to billing continuity</td><td className="px-4 py-3">Single connected flow in one product</td><td className="px-4 py-3">Commonly split across multiple screens/apps</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Indian tax workflow</td><td className="px-4 py-3">GST-aware invoice checks, approval gating, and structured tax fields</td><td className="px-4 py-3">Often available only in larger finance bundles</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Collections execution</td><td className="px-4 py-3">Dedicated dunning board with promise tracking and aging actions</td><td className="px-4 py-3">Usually basic reminders or external AR tooling</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Finance control visibility</td><td className="px-4 py-3">Booked vs invoiced reconciliation inside the same workspace</td><td className="px-4 py-3">Often requires custom reporting or separate finance tool</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Team adoption</td><td className="px-4 py-3">Designed for low-training adoption</td><td className="px-4 py-3">Can require process training before rollout</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Collections visibility</td><td className="px-4 py-3">Built-in dunning board and follow-up actions</td><td className="px-4 py-3">Usually available in advanced billing workflows</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-4 py-3">Analytics trust</td><td className="px-4 py-3">Exact vs Directional quality labels to avoid false confidence</td><td className="px-4 py-3">Commonly mixed without confidence labeling</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Note: this comparison reflects common buying and usage patterns seen in broad all-in-one platforms.
            </p>
          </section>
          {renderPublicFooter()}
        </div>
      );
    }

    if (publicView === "contact") {
      return (
        <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
          {nav}
          <section className="rounded-3xl border border-[#d9def8] bg-white p-8">
            <h1 className="text-3xl font-semibold text-slate-900">Contact Yugam Consulting</h1>
            <p className="mt-2 text-sm text-slate-600">For demos, implementation support, or partner inquiries.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Head Office</p>
                <p className="mt-2 text-sm text-slate-600">Mogappair West, Chennai, Tamil Nadu</p>
                <a href="tel:+919092507004" className="mt-2 block text-sm text-[#5f56d3] hover:underline">+91 90925 07004</a>
                <a href="mailto:info@oruyugam.com" className="block text-sm text-[#5f56d3] hover:underline">info@oruyugam.com</a>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Quick Actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigatePublic("auth")} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d]">Book a Demo</button>
                  <a href="mailto:info@oruyugam.com?subject=Product%20Inquiry" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Email Inquiry</a>
                </div>
              </article>
            </div>
          </section>
          {renderPublicFooter()}
        </div>
      );
    }

    if (publicView.startsWith("product-")) {
      const productMeta: Record<
        "product-lite" | "product-pro" | "product-full",
        {
          title: string;
          subtitle: string;
          description: string;
          usps: Array<{ title: string; detail: string }>;
          differentiators: Array<{ title: string; detail: string }>;
        }
      > = {
        "product-lite": {
          title: "Follow-up Lite",
          subtitle: "For teams that need speed in daily follow-up without heavy CRM overhead.",
          description:
            "A focused daily execution workspace for founders and field reps. Capture leads quickly, prioritize overdue work, and finish follow-ups without getting lost in heavy CRM complexity.",
          usps: [
            {
              title: "My Work Dashboard",
              detail: "Single-screen daily queue with overdue, due today, and instant actions.",
            },
            {
              title: "SLA-Led Follow-ups",
              detail: "Automatic neglect visibility and action-first queue to prevent lead drop-offs.",
            },
            {
              title: "Fast Lead Logging",
              detail: "Quick capture with OCR and minimal fields so reps can log leads in seconds.",
            },
            {
              title: "Role-Light Team Access",
              detail: "Simple member-specific permissions without enterprise admin complexity.",
            },
          ],
          differentiators: [
            {
              title: "Action-First Daily Queue",
              detail: "Overdue and due-today items are prioritized so reps know what to do first every morning.",
            },
            {
              title: "Data Capture Intelligence",
              detail: "OCR quick-capture and duplicate checks reduce manual typing and bad entries.",
            },
            {
              title: "Follow-up Discipline",
              detail: "SLA tiers, neglected lead alerts, and one-click done/snooze actions keep follow-ups consistent.",
            },
            {
              title: "Team-Friendly Permissions",
              detail: "Member-specific access keeps workflows simple for founders, reps, and support users.",
            },
            {
              title: "Transparent Metrics",
              detail: "Exact vs directional labels clarify whether a number is factual or trend-oriented.",
            },
          ],
        },
        "product-pro": {
          title: "Lead Tracker Pro",
          subtitle: "Full lead and pipeline execution without billing complexity.",
          description:
            "Designed for growing teams that need structured pipeline control, follow-up discipline, and performance visibility, while keeping operations lighter than a full billing suite.",
          usps: [
            {
              title: "Pipeline Control",
              detail: "Configurable stages, drag-and-drop flow, and actionable daily WIP tracking.",
            },
            {
              title: "Source Intelligence",
              detail: "See which channels generate quality leads and improve conversion focus.",
            },
            {
              title: "Revenue Forecasting",
              detail: "Expected-close based forecasting with clarity on conversion movement.",
            },
            {
              title: "Team Productivity",
              detail: "Role-aware workflows, ownerboards, and follow-up command center controls.",
            },
          ],
          differentiators: [
            {
              title: "Pipeline Execution Control",
              detail: "Stage WIP, drag-drop movement, and manager-level workload cues improve deal flow quality.",
            },
            {
              title: "Lead-to-Action Continuity",
              detail: "Leads, follow-ups, and stage updates are connected so reps avoid context switching.",
            },
            {
              title: "Source-Level Intelligence",
              detail: "Source comparisons and drill-downs highlight where conversion quality actually comes from.",
            },
            {
              title: "Manager Visibility",
              detail: "Leaderboards plus overdue/untouched/stalled insights help managers coach weekly performance.",
            },
            {
              title: "Trustworthy Reporting",
              detail: "Forecast and snapshot metrics are clearly labeled to avoid overconfidence in assumptions.",
            },
          ],
        },
        "product-full": {
          title: "Full CRM + Invoice Suite",
          subtitle: "End-to-end from lead capture to GST invoicing and collections.",
          description:
            "A complete operating system from first lead to payment realization. Ideal for agencies and consulting teams that want CRM execution and collections accountability in one place.",
          usps: [
            {
              title: "GST and Flexible Billing",
              detail: "Professional invoices with GST/non-GST support and client profile auto-fill.",
            },
            {
              title: "Payment Ledger",
              detail: "Track partial/full payments, outstanding balances, and payment history clearly.",
            },
            {
              title: "Dunning Board",
              detail: "Collections workflow with stage-wise nudges, promises, and escalation visibility.",
            },
            {
              title: "Reconciliation Analytics",
              detail: "Compare booked vs invoiced vs collected revenue to reduce leakage.",
            },
          ],
          differentiators: [
            {
              title: "GST-Ready Billing Layer",
              detail: "Supports intra/inter-state tax logic, compliance fields, and approval workflows.",
            },
            {
              title: "Collections Execution",
              detail: "Dunning board with aging, promises, and reminder delivery status in one workspace.",
            },
            {
              title: "Finance Reconciliation",
              detail: "Links won leads, invoices, and collections to expose revenue leakage early.",
            },
            {
              title: "Multi-Client Operability",
              detail: "Client account templates, lifecycle controls, and recovery safeguards support scale.",
            },
            {
              title: "Fact vs Forecast Clarity",
              detail: "Quality badges clearly indicate directional estimates versus exact, locked values.",
            },
          ],
        },
      };
      const meta = productMeta[publicView as "product-lite" | "product-pro" | "product-full"];
      return (
        <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
          {nav}
          <section className="rounded-3xl border border-[#d9def8] bg-white p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Home / Product Verticals / {meta.title}</p>
              <button
                type="button"
                onClick={() => navigatePublic("landing")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Home
              </button>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900">{meta.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{meta.subtitle}</p>
            <p className="mt-3 max-w-3xl text-sm text-slate-700">{meta.description}</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {meta.usps.map((item) => (
                <li key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-2xl border border-[#d9def8] bg-gradient-to-r from-[#eef1ff] to-[#edf9f4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this vertical stands out</p>
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {meta.differentiators.map((item) => (
                  <li key={item.title} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-700">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigatePublic("auth")} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d]">Start {DEFAULT_TRIAL_DAYS}-Day Trial</button>
              <button type="button" onClick={() => navigatePublic("pricing")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">See Pricing</button>
            </div>
          </section>
          {renderPublicFooter()}
        </div>
      );
    }

    return (
      <div className={`marketing-site ${marketingThemeClass} space-y-6`}>
        {nav}
        <section className="rounded-3xl border border-[#d9def8] bg-gradient-to-br from-[#eef1ff] via-white to-[#edf9f4] p-8">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-[#d3dafd] bg-[#f4f6ff] px-3 py-1 text-xs font-semibold tracking-wide text-[#5662b5]">Yugam Sales OS</p>
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">A sales execution platform built for speed and daily accountability.</h1>
              <p className="max-w-2xl text-sm text-slate-600">Start simple as a founder, then scale into pipeline, billing, and collections as your team grows.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigatePublic("auth")} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d]">Start {DEFAULT_TRIAL_DAYS}-Day Trial</button>
                <button type="button" onClick={() => navigatePublic("features")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Explore Features</button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product Verticals</p>
              <div className="mt-3 space-y-3 text-sm">
                {[
                  {
                    key: "product-lite" as const,
                    title: "Follow-up Lite",
                    summary: "Built for founders and field reps who only need daily follow-up execution.",
                    usps: ["My Work daily queue", "Overdue + Due Today focus", "Quick lead capture", "Role-light setup"],
                  },
                  {
                    key: "product-pro" as const,
                    title: "Lead Tracker Pro",
                    summary: "Structured pipeline and team operations without invoicing complexity.",
                    usps: ["Pipeline stage control", "Source analytics", "Team scorecards", "Forecast visibility"],
                  },
                  {
                    key: "product-full" as const,
                    title: "Full CRM + Invoice Suite",
                    summary: "End-to-end lead, billing, collections, and dunning in one operating system.",
                    usps: ["GST + non-GST invoices", "Payment ledger", "Dunning board", "Revenue reconciliation"],
                  },
                ].map((vertical) => (
                  <article key={vertical.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => navigatePublic(vertical.key)}
                      className="w-full text-left text-sm font-semibold text-slate-900 hover:text-[#5f56d3]"
                    >
                      {vertical.title}
                    </button>
                    <p className="mt-1 text-xs text-slate-600">{vertical.summary}</p>
                    <button
                      type="button"
                      onClick={() => navigatePublic(vertical.key)}
                      className="mt-2 text-xs font-semibold text-[#5f56d3] hover:underline"
                    >
                      View details
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Why Teams Move To Yugam</h2>
          <p className="mt-1 text-sm text-slate-600">These capabilities are usually split across multiple tools, but here they run in one connected workflow.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              {
                title: "GST-Ready Billing",
                detail: "Intra/inter-state logic, GST checks, approval flow, and tax-aware invoice structure.",
              },
              {
                title: "Dunning Board",
                detail: "Promises, aging queues, and reminder status tracking for collections discipline.",
              },
              {
                title: "Finance Reconciliation",
                detail: "Booked revenue vs invoiced values shown together to catch leakage quickly.",
              },
              {
                title: "Multi-Client Architecture",
                detail: "Client account lifecycle, plan templates, and controlled admin recovery workflow.",
              },
              {
                title: "Honest Analytics",
                detail: "Exact vs directional labels make it clear when data is fact vs forecast.",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Who Uses Yugam</h2>
          <p className="mt-1 text-sm text-slate-600">Built for teams that need daily pipeline discipline, faster follow-ups, and better cash collection without juggling multiple disconnected tools.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Marketing Agencies",
                scenario: "Managing inbound, referral, and ad leads across multiple team members.",
                points: ["Track lead source ROI", "Assign by service line", "Follow-up queue by owner"],
              },
              {
                title: "Consultants",
                scenario: "Handling discovery calls, proposals, and negotiations as a lean team.",
                points: ["Simple daily worklist", "Stage-wise deal visibility", "No missed callbacks"],
              },
              {
                title: "B2B Sales Teams",
                scenario: "Running high-volume prospecting with strict follow-up SLAs.",
                points: ["Overdue escalation tiers", "Bulk action workflows", "Performance by rep"],
              },
              {
                title: "Service Businesses",
                scenario: "Needing lead-to-invoice continuity and collection follow-through.",
                points: ["Invoice and payment ledger", "Dunning board actions", "Revenue reconciliation"],
              },
            ].map((segment) => (
              <article key={segment.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{segment.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{segment.scenario}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {segment.points.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">What Teams Say</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "Daily follow-up discipline improved in week one.",
              "Pipeline to invoice handoff is much smoother now.",
              "Lite mode is simple enough for non-technical teams.",
            ].map((quote) => (
              <blockquote key={quote} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">"{quote}"</blockquote>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Built Through Real Revisions</h2>
              <p className="mt-1 text-sm text-slate-600">Not a template CRM. Refined continuously through real-world operating feedback from sales teams.</p>
            </div>
            <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#5f56d3]">Release cadence: {productProof.releaseCadence}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Meaningful revisions</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{productProof.revisions}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Product improvement hours</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{productProof.hours}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current update cycle</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{productProof.releaseCadence}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Recent Improvements</h2>
          <p className="mt-1 text-sm text-slate-600">A transparent changelog snapshot showing how the product keeps improving.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {publicChangelog.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Public Roadmap</h2>
          <p className="mt-1 text-sm text-slate-600">Quarterly roadmap view for this year: Q2, Q3, and Q4.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Q2</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {publicRoadmap.inProgress.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Q3</p>
              <ul className="mt-2 space-y-1 text-sm text-sky-900">
                {publicRoadmap.next.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Q4</p>
              <ul className="mt-2 space-y-1 text-sm text-violet-900">
                {publicRoadmap.planned.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {renderPublicFooter()}
      </div>
    );
  };

  return (
    <div className="yugam-neo-ui flex min-h-screen flex-col bg-[#f7f8ef] text-slate-900">
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <header className="border-b border-[#dce0bd] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <BrandLogo className="h-11 w-auto" />
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickCommandOpen(true)}
                className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]"
              >
                Quick Command
              </button>
              <span className="rounded-full bg-[#e9edcf] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#59601a]">
                {currentUser.role}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{currentUser.name}</span>
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 md:inline">{currentTenant?.name ?? "Workspace"}</span>
              <button type="button" onClick={logout} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Logout
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-[#e9edcf] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#59601a]">Secure Portal</span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 py-8">
        {!currentUser ? (
          <section className="mx-auto w-full max-w-6xl">
            {publicView !== "auth" ? (
              renderPublicPage()
            ) : (
              <div className="grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 md:grid-cols-[1.1fr_1fr]">
                <aside className="hidden border-r border-[#e6e9cd] bg-[#f4f7e7] p-8 md:flex md:flex-col md:justify-between">
                  <div>
                    <BrandLogo className="h-12 w-auto" />
                    <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900">Secure Login Portal</h1>
                    <p className="mt-3 text-sm text-slate-600">Sign in, start a trial, request access, or reset your password from one secure portal.</p>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <p className="rounded-xl border border-[#d8ddba] bg-white px-3 py-2">15-day trial is available for new workspaces.</p>
                    <p className="rounded-xl border border-[#d8ddba] bg-white px-3 py-2">Google sign-in can auto-create trial workspace for new emails.</p>
                    <button
                      type="button"
                      onClick={() => setPublicView("landing")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Back to Website
                    </button>
                  </div>
                </aside>

                <div className="p-6 md:p-8">
                <div className="mb-6 space-y-4">
                  <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
                    {[
                      ["login", "Login"],
                      ["trial", "Start Trial"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setView(key as AuthView);
                          resetMessages();
                        }}
                        className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setView("register");
                        resetMessages();
                      }}
                      className={`rounded-full px-3 py-1.5 font-medium ${view === "register" ? "bg-[#e7ebcd] text-[#59601a]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      Request Access
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setView("forgot");
                        resetMessages();
                      }}
                      className={`rounded-full px-3 py-1.5 font-medium ${view === "forgot" ? "bg-[#e7ebcd] text-[#59601a]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>

                <div className="mb-5 space-y-1.5">
                  <h2 className="text-xl font-semibold text-slate-900">{authViewMeta[view].title}</h2>
                  <p className="text-sm text-slate-600">{authViewMeta[view].subtitle}</p>
                </div>

                {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                {notice && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

                {googleClientConfigured && (view === "login" || view === "trial") && (
                  <div className="mb-5 space-y-2.5">
                    <GoogleLogin
                      onSuccess={(credentialResponse) => {
                        void handleGoogleSignIn(credentialResponse);
                      }}
                      onError={() => setError("Google sign-in failed. Try again.")}
                      width="100%"
                      useOneTap
                      text="continue_with"
                      shape="pill"
                    />
                    <p className="text-center text-[11px] text-slate-500">Use Google for one-click access.</p>
                    <div className="flex items-center gap-2 py-1 text-[11px] text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span>or continue with email</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  </div>
                )}

              {view === "login" && (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <label className={authLabelClass}>
                    Email
                    <input className={authInputClass} type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@company.com" />
                    <p className={authHelperClass}>Use your registered workspace email.</p>
                  </label>
                  <label className={authLabelClass}>
                    Password
                    <PasswordField
                      value={loginPassword}
                      onChange={setLoginPassword}
                      placeholder="Enter password"
                      className={`${authInputClass} pr-16`}
                      containerClassName="relative mt-1.5"
                    />
                    <p className={authHelperClass}>Passwords are case-sensitive.</p>
                  </label>
                  <button type="submit" className="w-full rounded-xl bg-[#788023] px-4 py-3 text-sm font-semibold text-white hover:bg-[#646b1d]">
                    Sign In
                  </button>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setView("forgot");
                        resetMessages();
                      }}
                      className="text-xs font-medium text-[#5f56d3] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              )}

              {view === "trial" && (
                <form className="space-y-4" onSubmit={startTrialSignup}>
                  <p className="rounded-lg border border-[#d9deb5] bg-[#f5f7e8] px-3 py-2 text-xs text-[#5e6520]">
                    Launch a full-feature trial workspace for {DEFAULT_TRIAL_DAYS} days. No admin approval required.
                  </p>
                  <label className={authLabelClass}>
                    Your Name
                    <input
                      className={authInputClass}
                      value={trialName}
                      onChange={(e) => setTrialName(e.target.value)}
                      placeholder="Founder or owner name"
                    />
                    <p className={authHelperClass}>This becomes the owner profile name.</p>
                  </label>
                  <label className={authLabelClass}>
                    Workspace / Company Name
                    <input
                      className={authInputClass}
                      value={trialWorkspace}
                      onChange={(e) => setTrialWorkspace(e.target.value)}
                      placeholder="Example: Acme Growth"
                    />
                    <p className={authHelperClass}>This will be used as your workspace branding name.</p>
                  </label>
                  <label className={authLabelClass}>
                    Work Email
                    <input
                      className={authInputClass}
                      type="email"
                      value={trialEmail}
                      onChange={(e) => setTrialEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                    <p className={authHelperClass}>Used for login and trial communication.</p>
                  </label>
                  <label className={authLabelClass}>
                    Create Password
                    <PasswordField
                      value={trialPassword}
                      onChange={setTrialPassword}
                      placeholder="Minimum 8 characters"
                      className={`${authInputClass} pr-16`}
                      containerClassName="relative mt-1.5"
                    />
                    <p className={authHelperClass}>Use at least 8 characters for better security.</p>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={trialSeedDemoData}
                      onChange={(e) => setTrialSeedDemoData(e.target.checked)}
                    />
                    Load sample demo leads for walkthrough
                  </label>
                  <button type="submit" className="w-full rounded-xl bg-[#788023] px-4 py-3 text-sm font-semibold text-white hover:bg-[#646b1d]">
                    Start Free Trial
                  </button>
                </form>
              )}

              {view === "register" && (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <label className={authLabelClass}>
                    Full Name
                    <input className={authInputClass} value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Employee name" />
                    <p className={authHelperClass}>Use the display name you want on leads and activities.</p>
                  </label>
                  <label className={authLabelClass}>
                    Email
                    <input className={authInputClass} type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="employee@company.com" />
                    <p className={authHelperClass}>Your admin will review this request before activation.</p>
                  </label>
                  <label className={authLabelClass}>
                    Create Password
                    <PasswordField
                      value={regPassword}
                      onChange={setRegPassword}
                      placeholder="Minimum 8 characters"
                      className={`${authInputClass} pr-16`}
                      containerClassName="relative mt-1.5"
                    />
                    <p className={authHelperClass}>Create a strong password for your account.</p>
                  </label>
                  <button type="submit" className="w-full rounded-xl bg-[#1c7f7b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#176864]">
                    Submit Registration
                  </button>
                </form>
              )}

              {view === "forgot" && (
                <div className="space-y-5">
                  <form className="space-y-4" onSubmit={handleSendCode}>
                    <label className={authLabelClass}>
                      Registered Email
                      <input className={authInputClass} type="email" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="you@company.com" />
                      <p className={authHelperClass}>A one-time code will be sent to this address.</p>
                    </label>
                    <button type="submit" className="w-full rounded-xl bg-[#5f56d3] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4f47b9]">
                      Send Reset Code
                    </button>
                  </form>

                  <form className="space-y-4 border-t border-slate-200 pt-4" onSubmit={handleResetPassword}>
                    <label className={authLabelClass}>
                      Reset Code
                      <input className={authInputClass} value={fpCode} onChange={(e) => setFpCode(e.target.value)} placeholder="6-digit code" />
                      <p className={authHelperClass}>Enter the exact 6-digit code.</p>
                    </label>
                    <label className={authLabelClass}>
                      New Password
                      <PasswordField
                        value={fpPassword}
                        onChange={setFpPassword}
                        placeholder="Enter new password"
                        className={`${authInputClass} pr-16`}
                        containerClassName="relative mt-1.5"
                      />
                      <p className={authHelperClass}>Choose a new password with at least 8 characters.</p>
                    </label>
                    <button type="submit" className="w-full rounded-xl bg-[#788023] px-4 py-3 text-sm font-semibold text-white hover:bg-[#646b1d]">
                      Reset Password
                    </button>
                  </form>

                  {generatedCode && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Demo mode: reset code is <span className="font-semibold">{generatedCode}</span>
                    </p>
                  )}
                </div>
              )}

              </div>
            </div>
            )}
          </section>
        ) : (
          <section className="w-full">
            <div className="mb-4 md:hidden">
              <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {displayPrimaryNavViews.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={APP_VIEW_LABELS[key]}
                        onClick={() => setAppView(key)}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${appView === key ? "bg-[#788023] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        <ViewIcon view={key} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Open all views"
                    onClick={() => setMobileNavOpen(true)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                  >
                    Views
                  </button>
                </div>
              </div>
            </div>

            {mobileNavOpen && (
              <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
                <button type="button" aria-label="Close view selector" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-slate-900/35" />
                <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Navigate Views</p>
                    <button type="button" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Close</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[...displayPrimaryNavViews, ...secondaryNavViews].map((key) => (
                      <button
                        key={`mobile-nav-${key}`}
                        type="button"
                        onClick={() => setAppView(key)}
                        className={`rounded-xl border px-3 py-3 text-left ${appView === key ? "border-[#788023] bg-[#eef0de] text-[#59601a]" : "border-slate-200 bg-white text-slate-700"}`}
                      >
                        <span className="mb-1 inline-flex items-center justify-center rounded-md bg-slate-100 p-1.5">
                          <ViewIcon view={key} className="h-4 w-4" />
                        </span>
                        <span className="block text-xs font-semibold">
                          {APP_VIEW_LABELS[key]}
                          {key === "followups" && followupCounts.overdue > 0 ? ` (${followupCounts.overdue})` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="hidden md:block">
                <div className="sticky top-4 space-y-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                  <div>
                    <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary</p>
                    <div className="space-y-1">
                      {displayPrimaryNavViews.map((key) => (
                        <button
                          key={`primary-${key}`}
                          type="button"
                          onClick={() => setAppView(key)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium ${appView === key ? "bg-[#788023] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                        >
                          <ViewIcon view={key} className="h-4 w-4" />
                          <span>{APP_VIEW_LABELS[key]}</span>
                          {key === "followups" && followupCounts.overdue > 0 && (
                            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${appView === key ? "bg-white/20 text-white" : "bg-rose-600 text-white"}`}>
                              {followupCounts.overdue}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {secondaryNavViews.length > 0 && (
                    <div>
                      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">More Views</p>
                      <div className="space-y-1">
                        {secondaryNavViews.map((key) => (
                          <button
                            key={`secondary-${key}`}
                            type="button"
                            onClick={() => setAppView(key)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium ${appView === key ? "bg-[#788023] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                          >
                            <ViewIcon view={key} className="h-4 w-4" />
                            <span>{APP_VIEW_LABELS[key]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              <div className="space-y-5">
                {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
                {showPwaInstallPrompt && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-sky-900">Install Yugam as an app</p>
                        <p className="text-xs text-sky-800">Get home-screen access and a faster field-sales workflow on mobile.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleInstallPwa();
                          }}
                          className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                        >
                          Install App
                        </button>
                        <button
                          type="button"
                          onClick={() => setPwaInstallDismissed(true)}
                          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                        >
                          Not Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {guidedExperienceActive && (
                  <div className="rounded-2xl border border-[#d6daac] bg-[#f7f8eb] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Guided Start</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">Keep it simple for your first few sessions</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Basic mode and Daily mode are enabled while you finish onboarding ({onboardingChecklist.completed}/{onboardingChecklist.total}).
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => runChecklistStep("lead")}
                          className="rounded-lg bg-[#788023] px-3 py-2 text-xs font-semibold text-white hover:bg-[#646b1d]"
                        >
                          Add First Lead
                        </button>
                        <button
                          type="button"
                          onClick={dismissGuidedExperience}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Dismiss Guide
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#d6daac] bg-[#f7f8eb] px-3 py-2 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-slate-900">{activeViewLabel}</span>
                      {" | "}Client: {currentTenant?.name ?? "-"}
                      {" | "}Date: {getContextDateSummary()}
                      {" | "}Filters: {getContextFilterSummary()}
                    </p>
                    <div className="flex items-center gap-2">
                      {!isLiteProduct && (
                        <>
                          <button
                            type="button"
                            onClick={toggleActiveModuleMode}
                            className="rounded-lg border border-[#c7ce93] bg-white px-2 py-1 font-semibold text-[#5f651f] hover:bg-[#f2f4de]"
                          >
                            {isBasicMode ? "Basic" : "Advanced"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFocusMode((prev) => !prev)}
                            className={`rounded-lg border px-2 py-1 font-semibold ${focusMode ? "border-[#788023] bg-[#788023] text-white" : "border-[#c7ce93] bg-white text-[#5f651f] hover:bg-[#f2f4de]"}`}
                          >
                            Focus {focusMode ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDailyMode((prev) => !prev)}
                            className={`rounded-lg border px-2 py-1 font-semibold ${dailyMode ? "border-[#5f56d3] bg-[#5f56d3] text-white" : "border-[#c7ce93] bg-white text-[#5f651f] hover:bg-[#f2f4de]"}`}
                          >
                            Daily {dailyMode ? "On" : "Off"}
                          </button>
                        </>
                      )}
                      {isLiteProduct && (
                        <span className="rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                          Follow-up Lite
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <SectionErrorBoundary
              key={`${appView}-${sectionRecoveryNonce}`}
              sectionLabel={activeViewLabel}
              onRetry={() => setSectionRecoveryNonce((prev) => prev + 1)}
              onGoHome={() => setAppView(canViewLeads ? "mywork" : "dashboard")}
              onSignOut={logout}
            >
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Loading workspace...
                  </div>
                }
              >

            {canViewLeads && appView === "mywork" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Daily Workspace</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">My Work Today</h2>
                      <p className="mt-1 text-xs text-slate-600">A focused queue of only the actions that need to move today.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canCreateLeads && (
                        <button
                          type="button"
                          onClick={() => {
                            setAppView("leads");
                            openLeadIntakeModal();
                          }}
                          className="rounded-lg bg-[#788023] px-3 py-2 text-xs font-semibold text-white hover:bg-[#646b1d]"
                        >
                          Add Lead
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFollowupQueue("overdue");
                          setAppView("followups");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Open Follow-ups
                      </button>
                    </div>
                  </div>
                </div>

                {onboardingChecklist.progress < 100 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Setup Progress</p>
                        <p className="mt-1 text-sm font-semibold text-amber-900">Complete these steps to unlock full value</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                        {onboardingChecklist.progress}% complete
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      {onboardingChecklist.steps.map((step) => (
                        <div key={step.key} className={`rounded-lg border px-3 py-2 text-xs ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-white text-amber-900"}`}>
                          <p>{step.done ? "Done" : "Pending"}: {step.label}</p>
                          {!step.done && (
                            <button
                              type="button"
                              onClick={() => runChecklistStep(step.key)}
                              className="mt-2 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
                            >
                              Complete Step
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Setup Completed</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">Your workspace is fully configured for daily operations.</p>
                    <p className="mt-1 text-xs text-emerald-700">Next best action: keep follow-ups clean every day and review dashboard once per week.</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Pending</p><p className="mt-1 text-2xl font-bold text-slate-900">{myWorkSummary.pendingCount}</p></div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Overdue</p><p className="mt-1 text-2xl font-bold text-rose-600">{myWorkSummary.overdueCount}</p></div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Due Today</p><p className="mt-1 text-2xl font-bold text-amber-600">{myWorkSummary.dueTodayCount}</p></div>
                  {!dailyMode && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Neglected</p><p className="mt-1 text-2xl font-bold text-violet-600">{myWorkSummary.neglectedCount}</p></div>}
                  {!dailyMode && canUseInvoicing && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Invoice Actions</p><p className="mt-1 text-2xl font-bold text-sky-600">{myWorkSummary.invoiceActionCount}</p></div>}
                </div>

                <div className={`grid gap-4 ${canUseInvoicing ? "xl:grid-cols-2" : ""}`}>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Top Follow-up Actions</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setFollowupQueue("all");
                          setAppView("followups");
                        }}
                        className="text-xs font-medium text-[#5f56d3] hover:underline"
                      >
                        View Full Queue
                      </button>
                    </div>
                    <div className="space-y-2">
                      {myWorkSummary.actionRows.map((lead) => (
                        <div key={lead.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{lead.companyName}</p>
                              <p className="text-xs text-slate-500">{lead.leadName} | {lead.assignedTo || "Unassigned"}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${followupTagClass(dateTag(lead))}`}>{urgencyLabel(lead)}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => markFollowupDoneWithUndo(lead, "Follow-up marked done from My Work")}
                              className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                            >
                              Mark Done
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setLeadDrawerOpen(true);
                              }}
                              className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}
                      {myWorkSummary.actionRows.length === 0 && (
                        <EmptyState
                          title="No Pending Follow-ups"
                          description="Your queue is clear for now."
                          actionLabel="Open Follow-ups"
                          onAction={() => setAppView("followups")}
                        />
                      )}
                    </div>
                  </div>

                  {canUseInvoicing && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Invoice Send Actions</h3>
                      <button type="button" onClick={() => setAppView("invoices")} className="text-xs font-medium text-[#5f56d3] hover:underline">Go to Invoices</button>
                    </div>
                    <div className="space-y-2">
                      {myWorkSummary.invoiceRows.map((lead) => (
                        <div key={lead.id} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900">{lead.companyName}</p>
                          <p className="text-xs text-slate-500">{lead.leadName} | {lead.leadStatus}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openInvoiceComposerForLead(lead)}
                              className="rounded bg-[#5f56d3] px-2 py-1 text-[11px] text-white hover:bg-[#4f47b9]"
                            >
                              Create / Send Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setLeadDrawerOpen(true);
                              }}
                              className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                            >
                              Lead Details
                            </button>
                          </div>
                        </div>
                      ))}
                      {myWorkSummary.invoiceRows.length === 0 && (
                        <EmptyState
                          title="No Invoice Actions"
                          description="No confirmation or won leads need invoice dispatch right now."
                          actionLabel="Create Invoice"
                          onAction={() => setAppView("invoices")}
                        />
                      )}
                    </div>
                  </div>}
                </div>
              </div>
            )}

            {appView === "dashboard" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#d6daac] bg-[#f7f8eb] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Today Focus</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">Primary execution panel for daily action</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFollowupQueue("overdue");
                        setAppView(allowedViews.includes("followups") ? "followups" : "leads");
                      }}
                      className="rounded-lg bg-[#788023] px-3 py-2 text-xs font-semibold text-white hover:bg-[#646b1d]"
                    >
                      Open Today Queue
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Overdue Follow-ups</p>
                      <p className="mt-1 text-xl font-bold text-rose-600">{metrics.overdueFollowups}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Due Today</p>
                      <p className="mt-1 text-xl font-bold text-amber-600">{metrics.dueTodayFollowups}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Open Pipeline Value</p>
                      <p className="mt-1 text-xl font-bold text-[#788023]">{formatInr(metrics.pipelineValue)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Upcoming Follow-ups</p>
                      <p className="mt-1 text-xl font-bold text-sky-600">{metrics.upcomingFollowups}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 sm:grid-cols-3">
                    <p>Pending queue: <span className="font-semibold text-slate-900">{metrics.pending}</span></p>
                    <p>Recent activity (7d): <span className="font-semibold text-slate-900">{metrics.activity7d}</span></p>
                    <p>Active assignees: <span className="font-semibold text-slate-900">{metrics.activeMembers}</span></p>
                  </div>
                </div>

                <div className="neo-module-head rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Dashboard Module</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">Executive Performance View</h2>
                      <p className="mt-1 text-xs text-slate-600">Single-screen command layout for momentum, revenue confidence, and execution quality.</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 text-xs">
                      <label className="text-xs font-medium text-slate-600">
                        Date Range
                        <select
                          className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-xs"
                          value={dashboardDateScope}
                          onChange={(e) => setDashboardDateScope(e.target.value as DashboardDateScope)}
                        >
                          {DASHBOARD_SCOPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {dashboardDateScope === "custom" && (
                        <>
                          <label className="text-xs font-medium text-slate-600">
                            Start
                            <input
                              type="date"
                              className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-xs"
                              value={dashboardCustomStart}
                              onChange={(e) => setDashboardCustomStart(e.target.value)}
                            />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            End
                            <input
                              type="date"
                              className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-xs"
                              value={dashboardCustomEnd}
                              onChange={(e) => setDashboardCustomEnd(e.target.value)}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Scope basis: Date Added for {metrics.scopeLabel}.</p>
                </div>

                {visibleLeads.length === 0 && (
                  <div className="rounded-2xl border border-[#d6daac] bg-white p-5 ring-1 ring-[#edf0d2]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Start Here</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">Add your first lead</h3>
                    <p className="mt-1 text-sm text-slate-600">Your dashboard unlocks after the first lead is added. Start with a quick lead capture, assign follow-up, and move to Contacted.</p>
                    <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">1. Add lead details</p>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">2. Set next follow-up date</p>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">3. Move lead to Contacted</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={openLeadIntakeModal}
                        className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f7820]"
                      >
                        Add your first lead
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppView("leads")}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open Leads View
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">Tip: You can also use Quick Command (Ctrl/Cmd + K) to add a lead instantly.</p>
                  </div>
                )}

                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm font-semibold text-slate-800">Performance Infographic</p>
                    <div className="mt-4 grid items-center gap-4 sm:grid-cols-[260px,1fr]">
                      <div className="relative mx-auto h-56 w-56 rounded-full bg-slate-50 p-2 ring-1 ring-slate-200">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Converted", value: Number(metrics.conversionRate.toFixed(1)) },
                                { name: "Lost", value: Number(metrics.lostRate.toFixed(1)) },
                                { name: "Open", value: Math.max(0, Number((100 - metrics.conversionRate - metrics.lostRate).toFixed(1))) },
                              ]}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={82}
                              stroke="none"
                            >
                              <Cell fill="#16a34a" />
                              <Cell fill="#e11d48" />
                              <Cell fill="#94a3b8" />
                            </Pie>
                            <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-white px-3 py-2 text-center ring-1 ring-slate-200">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500" title="Team Health = 50% conversion rate + 30% follow-up completion + 20% queue health. 70%+ is healthy.">Team Health</p>
                            <p className="text-2xl font-bold text-violet-600">{metrics.motivationScore}%</p>
                            <p className="text-[10px] text-slate-500">70%+ healthy benchmark</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Pending Activities</p>
                          <p className="mt-1 text-2xl font-bold text-[#788023]">{metrics.pending}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Converted Leads</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-600">{metrics.won}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Lost Leads</p>
                          <p className="mt-1 text-2xl font-bold text-rose-600">{metrics.lost}</p>
                          <p className="text-[11px] text-slate-500">{metrics.lostRate.toFixed(1)}% of scoped leads</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-500" title="Team Performance Score = average of member score where member score = 60% conversion + 40% follow-up completion.">Team Performance Score</p>
                          <p className="mt-1 text-2xl font-bold text-sky-600">{metrics.teamPerformance.toFixed(1)}%</p>
                          <p className="text-[11px] text-slate-500">Top: {metrics.topPerformerName} | 65%+ strong</p>
                        </div>
                      </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Pipeline Value <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Exact</span></p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatInr(metrics.pipelineValue)}</p>
                    <p className="text-xs text-slate-500">Open stages only</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Closed Revenue <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Exact</span></p>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{formatInr(metrics.wonValue)}</p>
                    <p className="text-xs text-slate-500">Won snapshot values</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Expected This Month <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Directional</span></p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatInr(metrics.expectedRevenueThisMonth)}</p>
                    <p className="text-xs text-slate-500">By expected closing date</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Follow-up Completion</p>
                    <p className="mt-2 text-2xl font-bold text-[#5f56d3]">{metrics.followupCompletionRate.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">Done / (Done + Pending)</p>
                  </div>
                </div>

                {!dashboardCompactMode && (
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">First-Run Checklist</p>
                        <p className="text-xs text-slate-500">Setup completion for this client: {onboardingChecklist.completed}/{onboardingChecklist.total}</p>
                      </div>
                      <span className="rounded-full bg-[#edf0d2] px-3 py-1 text-xs font-semibold text-[#5f651f]">{onboardingChecklist.progress}% complete</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      {onboardingChecklist.steps.map((step) => (
                        <div key={step.key} className={`rounded-lg border px-3 py-2 text-xs ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                          <p>{step.done ? "Done" : "Pending"}: {step.label}</p>
                          {!step.done && (
                            <button
                              type="button"
                              onClick={() => runChecklistStep(step.key)}
                              className="mt-2 rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                            >
                              Open workflow
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dashboardCompactMode ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {focusMode
                      ? "Focus mode is on. Deep analytics are hidden to keep the dashboard actionable."
                      : "Basic mode is on for Dashboard. Switch to Advanced mode to see deep analytics blocks."}
                  </div>
                ) : (
                  <>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Performance Snapshot</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#788023]" />Conversion Rate</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#5f56d3]" />Follow-up Completion</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-600" />Response within 24h</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Conversion Rate</span><span>{metrics.conversionRate.toFixed(1)}%</span></div>
                        <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-[#788023]" style={{ width: `${Math.min(metrics.conversionRate, 100)}%` }} /></div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Follow-up Completion</span><span>{metrics.followupCompletionRate.toFixed(1)}%</span></div>
                        <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-[#5f56d3]" style={{ width: `${Math.min(metrics.followupCompletionRate, 100)}%` }} /></div>
                        <p className="mt-1 text-[11px] text-slate-500" title="Done / (Done + Pending)">Formula: done over tracked follow-ups</p>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Response within 24h</span><span>{metrics.responseWithin24hRate.toFixed(1)}%</span></div>
                        <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-teal-600" style={{ width: `${Math.min(metrics.responseWithin24hRate, 100)}%` }} /></div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-slate-600">
                      <p>Average first response: <span className="font-medium text-slate-900">{metrics.avgFirstResponseHours.toFixed(1)} hours</span> <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${metrics.firstResponseConfidence === "Exact" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{metrics.firstResponseConfidence}</span></p>
                      <p>Overdue follow-up risk: <span className="font-medium text-slate-900">{metrics.overdueRate.toFixed(1)}%</span></p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Aging and Discipline</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <p>Average open lead age: <span className="font-semibold text-slate-900">{metrics.avgPipelineAgeDays.toFixed(1)} days</span></p>
                      <p>Stale (no contact in 7+ days): <span className="font-semibold text-rose-600">{metrics.staleLeads7d}</span></p>
                      <p>Stuck for 10+ days: <span className="font-semibold text-amber-600">{metrics.stuckLeads10d}</span></p>
                      <p>Bottleneck stage: <span className="font-semibold text-slate-900">{metrics.bottleneckStage.status}</span></p>
                      <p>Avg lead age by current stage: <span className="font-semibold text-slate-900">{metrics.slowestStage.status} ({metrics.slowestStage.avgDays.toFixed(1)}d)</span> <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{metrics.stageAgingConfidence}</span></p>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">Directional metrics are estimation-based (activity timestamps + stage movement), useful for trend direction, not exact SLA audits.</p>
                  </div>

                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Forecast and Coverage</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <p>Expected this month: <span className="font-semibold text-slate-900">{formatInr(metrics.expectedRevenueThisMonth)}</span></p>
                      <p>Expected next 30 days: <span className="font-semibold text-slate-900">{formatInr(metrics.expectedRevenue30d)}</span></p>
                      <p>Open pipeline to closed ratio: <span className="font-semibold text-slate-900">{metrics.wonValue > 0 ? (metrics.pipelineValue / metrics.wonValue).toFixed(2) : "-"}</span></p>
                      <p>First response sample size: <span className="font-semibold text-slate-900">{metrics.firstResponseSamples} leads</span></p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Pipeline Stage Distribution</p>
                    <div className="mt-4 space-y-3">
                      {metrics.stageCounts.map((stage) => (
                        <div key={stage.status}>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>{stage.status}</span>
                            <span>{stage.count} leads ({stage.share.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 rounded bg-slate-100">
                            <div className="h-2 rounded bg-[#788023]" style={{ width: `${Math.min(stage.share, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Team Leaderboard</p>
                    <p className="mt-1 text-[11px] text-slate-500">Score = 60% conversion + 40% follow-up completion. Monday review view now includes who is overdue-heavy, untouched this week, and stalled.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2">
                        <p className="text-rose-700">Highest Overdue</p>
                        <p className="mt-0.5 font-semibold text-rose-900">{metrics.managerActionRows[0] ? `${metrics.managerActionRows[0].name} (${metrics.managerActionRows[0].overdue})` : "-"}</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <p className="text-amber-700">Untouched 7d</p>
                        <p className="mt-0.5 font-semibold text-amber-900">{metrics.managerActionRows[0] ? `${metrics.managerActionRows[0].untouched7d} lead(s)` : "-"}</p>
                      </div>
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2">
                        <p className="text-indigo-700">Stalled 10d+</p>
                        <p className="mt-0.5 font-semibold text-indigo-900">{metrics.managerActionRows[0] ? `${metrics.managerActionRows[0].stalled10d} lead(s)` : "-"}</p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Member</th>
                            <th className="px-2 py-2" title="Score = 60% conversion rate + 40% follow-up completion rate.">Score</th>
                            <th className="px-2 py-2">Won/Total</th>
                            <th className="px-2 py-2">Pending</th>
                            <th className="px-2 py-2">Overdue</th>
                            <th className="px-2 py-2">Untouched 7d</th>
                            <th className="px-2 py-2">Stalled 10d+</th>
                            <th className="px-2 py-2">Closed Revenue</th>
                            <th className="px-2 py-2">Open Pipeline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.teamLeaderboard.slice(0, 8).map((member) => (
                            <tr key={member.name} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-700">{member.name}</td>
                              <td className="px-2 py-2 text-sky-700">{member.score.toFixed(1)}%</td>
                              <td className="px-2 py-2">{member.won}/{member.total}</td>
                              <td className="px-2 py-2">{member.pending}</td>
                              <td className="px-2 py-2 text-rose-700">{member.overdue}</td>
                              <td className="px-2 py-2 text-amber-700">{member.untouched7d}</td>
                              <td className="px-2 py-2 text-indigo-700">{member.stalled10d}</td>
                              <td className="px-2 py-2">{formatInr(member.closedRevenue)}</td>
                              <td className="px-2 py-2">{formatInr(member.openPipelineValue)}</td>
                            </tr>
                          ))}
                          {metrics.teamLeaderboard.length === 0 && (
                            <tr>
                              <td className="px-2 py-2 text-slate-500" colSpan={9}>No assigned team data yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Top Sources</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Source</th>
                            <th className="px-2 py-2">Leads</th>
                            <th className="px-2 py-2">Won</th>
                            <th className="px-2 py-2">Conv %</th>
                            <th className="px-2 py-2">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.sourcePerformance.slice(0, 6).map((row) => (
                            <tr key={row.source} className="border-b border-slate-100">
                              <td className="px-2 py-2">{row.source}</td>
                              <td className="px-2 py-2">{row.count}</td>
                              <td className="px-2 py-2">{row.won}</td>
                              <td className="px-2 py-2">{row.conversionRate.toFixed(1)}%</td>
                              <td className="px-2 py-2">{formatInr(row.value)}</td>
                            </tr>
                          ))}
                          {metrics.sourcePerformance.length === 0 && (
                            <tr>
                              <td className="px-2 py-2 text-slate-500" colSpan={5}>No source data available yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">Top Services</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Service</th>
                            <th className="px-2 py-2">Leads</th>
                            <th className="px-2 py-2">Won</th>
                            <th className="px-2 py-2">Conv %</th>
                            <th className="px-2 py-2">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.servicePerformance.slice(0, 6).map((row) => (
                            <tr key={row.service} className="border-b border-slate-100">
                              <td className="px-2 py-2">{row.service}</td>
                              <td className="px-2 py-2">{row.count}</td>
                              <td className="px-2 py-2">{row.won}</td>
                              <td className="px-2 py-2">{row.conversionRate.toFixed(1)}%</td>
                              <td className="px-2 py-2">{formatInr(row.value)}</td>
                            </tr>
                          ))}
                          {metrics.servicePerformance.length === 0 && (
                            <tr>
                              <td className="px-2 py-2 text-slate-500" colSpan={5}>No service data available yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {appView !== "users" && requiresLeadAccessForView && !canViewLeads && (
              <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
                <h3 className="text-lg font-semibold">Lead Access Restricted</h3>
                <p className="mt-2 text-sm text-slate-600">Your account currently has no lead visibility. Please ask admin to grant access.</p>
              </div>
            )}

            {canViewLeads && appView === "leads" && (
              <LeadsPage totalLeads={visibleLeads.length}>
                <LeadsWorkspaceHeader
                  newLeadCount={newLeadRows.length}
                  onOpenNewQueue={() => {
                    setFilterStatus("New");
                    setQuickFilter("all");
                  }}
                  onImportCsv={() => setLeadImportModalOpen(true)}
                  onAddLead={openLeadIntakeModal}
                  showInvoiceHint={canUseInvoicing}
                />

                {visibleLeads.length === 0 && (
                  <EmptyState
                    title="Start with your first lead"
                    description="No leads yet. Add the first lead, schedule a follow-up, then move to Contacted."
                    actionLabel="Add First Lead"
                    onAction={openLeadIntakeModal}
                  />
                )}

                <LeadsFilters
                  isBasicMode={isBasicMode || isLiteProduct}
                  searchText={searchText}
                  setSearchText={setSearchText}
                  quickFilter={quickFilter}
                  setQuickFilter={setQuickFilter}
                  filterStatus={filterStatus}
                  setFilterStatus={(value) => setFilterStatus(value as LeadStatus | "All")}
                  filterSource={filterSource}
                  setFilterSource={(value) => setFilterSource(value as LeadSource | "All")}
                  filterAssignee={filterAssignee}
                  setFilterAssignee={setFilterAssignee}
                  filterTemp={filterTemp}
                  setFilterTemp={(value) => setFilterTemp(value as LeadTemperature | "All")}
                  statusOptions={LEAD_STATUSES}
                  sourceOptions={LEAD_SOURCES}
                  tempOptions={LEAD_TEMPS}
                  assigneeOptions={assigneeOptions}
                  showLeadColumnPicker={showLeadColumnPicker}
                  setShowLeadColumnPicker={setShowLeadColumnPicker}
                  optionalColumns={LEAD_OPTIONAL_COLUMNS}
                  optionalColumnSet={leadOptionalColumnSet}
                  onToggleOptionalColumn={(columnKey, checked) => {
                    setLeadOptionalColumns((prev) => (
                      checked
                        ? [...new Set([...prev, columnKey as LeadOptionalColumn])]
                        : prev.filter((key) => key !== columnKey)
                    ));
                  }}
                  onReset={resetFilters}
                />

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      SLA Tiers: <span className="font-semibold">Watch {slaTierStats.watch}</span> | <span className="font-semibold">Escalate {slaTierStats.escalate}</span> | <span className="font-semibold">Critical {slaTierStats.critical}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => bulkEscalateLeads("escalate")}
                        className="rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Escalate 14d+ ({escalationCandidates.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => bulkEscalateLeads("critical")}
                        className="rounded bg-rose-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-900"
                      >
                        Escalate Critical ({slaTierStats.critical})
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLeadRecycleBin((prev) => !prev)}
                        className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        {showLeadRecycleBin ? "Hide" : "Show"} Recycle Bin ({deletedVisibleLeads.length})
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-amber-800">
                    Tier logic: 7-13d Watch, 14-20d Escalate, 21d+ Critical. {isBasicMode ? "Basic mode keeps this compact for daily follow-up." : "Use manager escalation actions for delayed ownership transfer."}
                  </p>
                </div>

                {escalationCandidates.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Manager Escalation Queue</p>
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">{escalationCandidates.length} lead(s)</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      {escalationCandidates.slice(0, 5).map((lead) => {
                        const manager = tenantManagerById.get(lead.tenantId) || "Manager";
                        return (
                          <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5">
                            <p className="text-slate-700">
                              <span className="font-medium text-slate-900">{lead.leadName}</span> - {lead.companyName} ({neglectDays(lead)}d)
                            </p>
                            <button
                              type="button"
                              onClick={() => escalateLeadToManager(lead)}
                              className="rounded bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200"
                            >
                              Escalate to {manager}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canEditAll && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Duplicate Merge Center</p>
                        <p className="text-xs text-slate-500">Exact phone/email duplicates detected from current leads scope.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Groups: {duplicateLeadGroups.length}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {duplicateLeadGroups.slice(0, 5).map((group) => (
                        <div key={group.map((lead) => lead.id).join("|")} className="rounded border border-slate-200 p-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-800">
                              {group[0].companyName || "Unknown Company"} ({group.length} records)
                            </p>
                            <button
                              type="button"
                              onClick={() => { void mergeDuplicateLeadGroup(group); }}
                              className="rounded bg-violet-100 px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-200"
                            >
                              Merge Group
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{group.map((lead) => lead.leadName).join(", ")}</p>
                        </div>
                      ))}
                      {duplicateLeadGroups.length === 0 && (
                        <p className="text-xs text-slate-500">No duplicate lead groups found.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Selected: {selectedLeadIds.length}</span>
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      value={leadBulkAction}
                      onChange={(event) => setLeadBulkAction(event.target.value as LeadBulkAction)}
                    >
                      <option value="">Bulk action</option>
                      <option value="mark-done">Mark Follow-up Done</option>
                      <option value="snooze-2">Snooze +2 days</option>
                      <option value="move-contacted">Move to Contacted</option>
                      <option value="reassign">Reassign</option>
                    </select>
                    {leadBulkAction === "reassign" && (
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        value={leadBulkAssignee}
                        onChange={(event) => setLeadBulkAssignee(event.target.value)}
                      >
                        <option value="">Select assignee</option>
                        {assigneeOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={applyLeadBulkActions}
                      className="rounded bg-[#788023] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#646b1d]"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <LeadsTable
                  filteredLeads={filteredLeads}
                  selectedLeadIds={selectedLeadIds}
                  selectedAll={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                  onToggleSelectAll={(checked) => setSelectedLeadIds(checked ? filteredLeads.map((lead) => lead.id) : [])}
                  onToggleLead={(leadId, checked) => setSelectedLeadIds((prev) => checked ? [...new Set([...prev, leadId])] : prev.filter((id) => id !== leadId))}
                  activities={activities}
                  leadOptionalColumnSet={leadOptionalColumnSet}
                  leadOptionalColumnCount={leadOptionalColumns.length}
                  canEditAll={canEditAll}
                  assigneeOptions={assigneeOptions}
                  invoiceEligibleStatuses={INVOICE_ELIGIBLE_STATUSES}
                  canUseInvoicing={canUseInvoicing}
                  onStatusChange={(lead, status) => handleLeadStatusChange(lead, status as LeadStatus, "Status updated")}
                  onReassign={(leadId, assignee) => upsertLead(leadId, (lead) => ({ ...lead, assignedTo: assignee }), "Lead reassigned")}
                  onExpectedChange={(leadId, expectedClosingDate) => upsertLead(leadId, (lead) => ({ ...lead, expectedClosingDate }), "Expected closing date updated")}
                  onCreateInvoice={(lead) => openInvoiceComposerForLead(lead)}
                  onCallLead={openPhoneCall}
                  onOpenWhatsApp={openWhatsAppFollowup}
                  onMarkDone={(lead) => markFollowupDoneWithUndo(lead, "Follow-up marked done from leads table")}
                  onSnooze2d={(lead) => applyLeadUpdateWithUndo(
                    lead,
                    (row) => ({ ...row, nextFollowupDate: shiftISODate(todayISODate(), 2), followupStatus: "Pending" }),
                    "Follow-up snoozed +2 days from leads table",
                    "Follow-up snoozed +2 days.",
                    "Follow-up snooze reverted",
                  )}
                  onOpenDetails={(leadId) => { setSelectedLeadId(leadId); setLeadDrawerOpen(true); }}
                  onSoftDelete={(lead) => { void softDeleteLead(lead); }}
                  onEscalateLead={escalateLeadToManager}
                  canSoftDelete={canEditAll}
                  onResetFilters={resetFilters}
                  dateTag={dateTag}
                  contactabilityBadge={contactabilityBadge}
                  leadHealthScore={leadHealthScore}
                  getLeadSlaMeta={getLeadSlaMeta}
                  duplicateLeadIdSet={duplicateLeadIdSet}
                  formatInr={formatInr}
                  formatDateDisplay={formatDateDisplay}
                  formatDateTimeDisplay={formatDateTimeDisplay}
                />

                {showLeadRecycleBin && (
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Lead Recycle Bin</h3>
                        <p className="text-xs text-slate-500">Soft-deleted leads can be restored within {LEAD_RECYCLE_RETENTION_DAYS} days. Expired leads can be purged.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{deletedVisibleLeads.length} item(s)</span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Expiring 7d: {expiringDeletedCount}</span>
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">Expired: {expiredDeletedCount}</span>
                        <select
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          value={recycleBinFilter}
                          onChange={(event) => setRecycleBinFilter(event.target.value as "all" | "expiring" | "expired")}
                        >
                          <option value="all">All</option>
                          <option value="expiring">Expiring in 7d</option>
                          <option value="expired">Expired</option>
                        </select>
                        <button type="button" onClick={() => { void purgeExpiredDeletedLeads(); }} className="rounded bg-rose-700 px-2 py-1 text-xs font-medium text-white hover:bg-rose-800">Purge Expired</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Lead</th>
                            <th className="px-2 py-2">Company</th>
                            <th className="px-2 py-2">Deleted On</th>
                            <th className="px-2 py-2">Restore Window</th>
                            <th className="px-2 py-2">Deleted By</th>
                            <th className="px-2 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recycleBinRows.map((row) => (
                            <tr key={row.lead.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">{row.lead.leadName}</td>
                              <td className="px-2 py-2">{row.lead.companyName}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">{formatDateTimeDisplay(row.lead.deletedAt || "")}</td>
                              <td className="px-2 py-2 text-xs">
                                {row.isExpired ? (
                                  <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Expired</span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{row.daysLeft}d left</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-600">{row.lead.deletedBy || "System"}</td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  <button type="button" onClick={() => restoreDeletedLead(row.lead)} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200">Restore</button>
                                  <button type="button" onClick={() => { void purgeDeletedLead(row.lead); }} className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200">Delete Permanently</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {recycleBinRows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-2 py-3 text-slate-500">No leads in this recycle bin view.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <LeadIntakeModal
                  open={leadIntakeModalOpen}
                  autoMoveNewToContacted={settings.autoMoveNewToContacted}
                  step={leadIntakeStep}
                  onStepChange={(step) => setLeadIntakeStep(step)}
                  onClose={closeLeadIntakeModal}
                  leadNameInputRef={leadNameInputRef}
                  intake={intake}
                  setIntake={setIntake}
                  inlineErrors={leadInlineErrors}
                  assigneeOptions={assigneeOptions}
                  leadSources={LEAD_SOURCES}
                  leadTemps={LEAD_TEMPS}
                  services={services}
                  isAssignedScope={currentUser.accessScope === "assigned"}
                  currentUserName={currentUser.name}
                  isSavingLead={isSavingLead}
                  showOptional={showOptionalIntake}
                  setShowOptional={setShowOptionalIntake}
                  keyboardEntryMode={keyboardEntryMode}
                  setKeyboardEntryMode={setKeyboardEntryMode}
                  onQuickSave={() => void createQuickLeadFromStepOne()}
                  onSubmit={createLead}
                  onFormKeyDown={handleIntakeKeyDown}
                  loadingNode={isSavingLead ? <LoadingSpinner /> : null}
                  captureText={captureText}
                  setCaptureText={setCaptureText}
                  isCaptureProcessing={isCaptureProcessing}
                  onExtractFromText={extractLeadFromPastedText}
                  onExtractFromImage={(file) => { void extractLeadFromImage(file); }}
                  captureSummary={captureSummary}
                  onApplyCaptureLine={applyCaptureLineToField}
                />

                <LeadImportCsvModal
                  open={leadImportModalOpen}
                  isImporting={isImportingLeads}
                  onClose={() => setLeadImportModalOpen(false)}
                  onImport={(rows) => {
                    void importLeadsFromCsv(rows);
                  }}
                />
              </LeadsPage>
            )}

            {canViewLeads && appView === "pipeline" && (
              <PipelinePage totalLeads={pipelineLeads.length}>
                <PipelineToolbar
                  pipelineSearch={pipelineSearch}
                  onPipelineSearchChange={setPipelineSearch}
                  pipelineAssigneeFilter={pipelineAssigneeFilter}
                  onPipelineAssigneeChange={setPipelineAssigneeFilter}
                  assigneeOptions={assigneeOptions}
                  isBasicMode={isBasicMode}
                  dailyMode={dailyMode}
                  pipelineShowAdvancedControls={pipelineShowAdvancedControls}
                  onToggleAdvanced={() => setPipelineShowAdvancedControls((prev) => !prev)}
                  canShowPipelineAdvanced={canShowPipelineAdvanced}
                  pipelineTempFilter={pipelineTempFilter}
                  onPipelineTempChange={(value) => setPipelineTempFilter(value as LeadTemperature | "All")}
                  tempOptions={LEAD_TEMPS}
                  pipelineSort={pipelineSort}
                  onPipelineSortChange={(value) => setPipelineSort(value as PipelineSort)}
                  pipelineFocusMode={pipelineFocusMode}
                  onPipelineFocusChange={setPipelineFocusMode}
                  pipelineWipScope={pipelineWipScope}
                  onPipelineWipScopeChange={(value) => setPipelineWipScope(value as PipelineWipScope)}
                  pipelineWipDate={pipelineWipDate}
                  onPipelineWipDateChange={setPipelineWipDate}
                  pipelineShowClosed={pipelineShowClosed}
                  onToggleShowClosed={() => setPipelineShowClosed((prev) => !prev)}
                  onReset={resetPipelineFilters}
                  visibleCount={pipelineLeads.length}
                  openValueLabel={formatInr(pipelineLeads.filter((lead) => PIPELINE_VALUE_STATUSES.includes(lead.leadStatus)).reduce((sum, lead) => sum + safeDealValue(lead.dealValue), 0))}
                  overdueCount={pipelineLeads.filter((lead) => dateTag(lead) === "Overdue").length}
                  wipReferenceLabel={pipelineWipReferenceLabel}
                />

                {pipelineLeads.length === 0 ? (
                  <EmptyState
                    title="No pipeline leads in this view"
                    description="Your current filters are hiding all pipeline items. Reset filters or add a lead to start pipeline execution."
                    actionLabel="Reset Pipeline Filters"
                    onAction={resetPipelineFilters}
                  />
                ) : (
                  <PipelineBoard
                    columns={pipelineColumns}
                    dragOverStatus={pipelineDragOverStatus}
                    draggingLeadId={draggingLeadId}
                    canShowAdvanced={canShowPipelineAdvanced}
                    requiresGstCompliance={requiresGstCompliance}
                    invoiceEligibleStatuses={INVOICE_ELIGIBLE_STATUSES}
                    pipelineStatuses={PIPELINE_BOARD_STATUSES}
                    onDragOverStatus={setPipelineDragOverStatus}
                    onDropLead={(leadId, status) => {
                      const lead = visibleLeads.find((row) => row.id === leadId);
                      if (!lead) return;
                      handleLeadStatusChange(lead, status as LeadStatus, "Pipeline stage moved");
                    }}
                    onDragStart={setDraggingLeadId}
                    onDragEnd={() => {
                      setDraggingLeadId(null);
                      setPipelineDragOverStatus(null);
                    }}
                    onFollowupToday={(leadId) => upsertLead(leadId, (lead) => ({ ...lead, nextFollowupDate: todayISODate() }), "Follow-up moved to today from pipeline")}
                    onMarkDone={(lead) => markFollowupDoneWithUndo(lead, "Follow-up marked done from pipeline")}
                    onCreateInvoice={(lead) => openInvoiceComposerForLead(lead)}
                    onStatusChange={(lead, status) => handleLeadStatusChange(lead, status as LeadStatus, "Pipeline stage changed from card")}
                    onOpenDetails={(leadId) => { setSelectedLeadId(leadId); setLeadDrawerOpen(true); }}
                    onExpectedChange={(leadId, date) => upsertLead(leadId, (lead) => ({ ...lead, expectedClosingDate: date }), "Expected closing date updated from pipeline")}
                    dateTag={dateTag}
                    followupTagClass={followupTagClass}
                    urgencyLabel={urgencyLabel}
                    neglectRisk={neglectRisk}
                    neglectRiskClass={neglectRiskClass}
                    daysUntil={daysUntil}
                    formatInr={formatInr}
                    formatDateDisplay={formatDateDisplay}
                    priorityScore={pipelinePriorityScore}
                  />
                )}
              </PipelinePage>
            )}

            {canViewLeads && appView === "followups" && (
              <FollowupsPage totalLeads={visibleLeads.length}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Pending Queue</p><p className="mt-1 text-2xl font-bold text-slate-900">{followupCounts.total}</p></div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Overdue</p><p className="mt-1 text-2xl font-bold text-rose-600">{followupCounts.overdue}</p></div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Due Today</p><p className="mt-1 text-2xl font-bold text-amber-600">{followupCounts.today}</p></div>
                  {!dailyMode && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Upcoming</p><p className="mt-1 text-2xl font-bold text-sky-600">{followupCounts.upcoming}</p></div>}
                  {!dailyMode && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs text-slate-500">No Date Assigned</p><p className="mt-1 text-2xl font-bold text-slate-700">{followupCounts.noDate}</p></div>}
                </div>

                {followupCounts.overdue > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-rose-800">Suggested batch: close all overdue follow-ups in one click.</p>
                      <button type="button" onClick={markAllOverdueFollowupsDone} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Mark All Overdue Done ({followupCounts.overdue})</button>
                    </div>
                  </div>
                )}

                {!isOnline && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-amber-900">Offline mode active. Queue actions will work locally and sync when you reconnect.</p>
                      <button
                        type="button"
                        onClick={() => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine)}
                        className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                )}

                {!isBasicMode && !dailyMode && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFollowupShowAdvancedControls((prev) => !prev)}
                      className={`rounded-lg px-3 py-2 text-sm ${followupShowAdvancedControls ? "bg-[#788023] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                    >
                      {followupShowAdvancedControls ? "Hide Advanced Controls" : "Show Advanced Controls"}
                    </button>
                  </div>
                )}

                {canShowFollowupAdvanced && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Reminder Dispatch</h3>
                      <p className="text-xs text-slate-500">Webhook reminders for overdue and due-today follow-ups.</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSendingReminder || !isOnline}
                      onClick={() => void dispatchReminderDigest("manual")}
                      className="inline-flex items-center gap-2 rounded bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSendingReminder && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-white/80 border-t-transparent" />}
                      {isOnline ? "Send Reminder Now" : "Offline"}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                    <p>Status: <span className={`font-semibold ${reminderDispatch?.status === "success" ? "text-emerald-700" : reminderDispatch?.status === "failed" ? "text-rose-700" : "text-slate-700"}`}>{reminderDispatch?.status ?? "idle"}</span></p>
                    <p>Last Attempt: <span className="font-semibold text-slate-700">{formatDateTimeDisplay(reminderDispatch?.lastAttemptAt ?? "")}</span></p>
                    <p>Last Success: <span className="font-semibold text-slate-700">{formatDateTimeDisplay(reminderDispatch?.lastSuccessAt ?? "")}</span></p>
                    <p>Pending in payload: <span className="font-semibold text-slate-700">{reminderDispatch?.pendingCount ?? 0}</span></p>
                  </div>
                  {reminderDispatch?.lastError && <p className="mt-2 text-xs text-rose-700">Last error: {reminderDispatch.lastError}</p>}
                </div>}

                {canShowFollowupAdvanced && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">Ownerboard</h3>
                    <p className="text-xs text-slate-500">Workload by assignee in pending follow-ups</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {followupOwnerboard.map((row) => (
                      <button key={row.assignee} type="button" onClick={() => setFollowupAssigneeFilter(row.assignee)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-[#788023]">
                        <p className="text-sm font-semibold text-slate-900">{row.assignee}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                          <span>Queue {row.total}</span>
                          <span className="text-rose-600">Overdue {row.overdue}</span>
                          <span className="text-amber-600">Today {row.dueToday}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-emerald-700">Done last 7d: {row.doneLast7d}</p>
                      </button>
                    ))}
                    {followupOwnerboard.length === 0 && <p className="text-xs text-slate-500">No assignee-level follow-up data available.</p>}
                  </div>
                </div>}

                <FollowupToolbar
                  isBasicMode={isBasicMode}
                  canShowFollowupAdvanced={canShowFollowupAdvanced}
                  followupSearch={followupSearch}
                  onFollowupSearchChange={setFollowupSearch}
                  followupAssigneeFilter={followupAssigneeFilter}
                  onFollowupAssigneeChange={setFollowupAssigneeFilter}
                  assigneeOptions={assigneeOptions}
                  followupStageFilter={followupStageFilter}
                  onFollowupStageChange={(value) => setFollowupStageFilter(value as LeadStatus | "All")}
                  stageOptions={LEAD_STATUSES.filter((status) => status !== "Won" && status !== "Lost")}
                  followupTempFilter={followupTempFilter}
                  onFollowupTempChange={(value) => setFollowupTempFilter(value as LeadTemperature | "All")}
                  tempOptions={LEAD_TEMPS}
                  onReset={() => {
                    setFollowupSearch("");
                    setFollowupAssigneeFilter("All");
                    setFollowupStageFilter("All");
                    setFollowupTempFilter("All");
                    setFollowupQueue("overdue");
                    setFollowupShowAdvancedControls(false);
                  }}
                  followupQueue={followupQueue}
                  onFollowupQueueChange={(value) => setFollowupQueue(value as FollowupQueue)}
                  queueOptions={[
                    { key: "overdue", label: `Overdue (${followupCounts.overdue})` },
                    { key: "today", label: `Due Today (${followupCounts.today})` },
                    { key: "upcoming", label: `Upcoming (${followupCounts.upcoming})` },
                    { key: "no-date", label: `No Date (${followupCounts.noDate})` },
                    { key: "all", label: `All Pending (${followupCounts.total})` },
                  ]}
                  selectedAll={filteredFollowupLeads.length > 0 && selectedFollowupLeadIds.length === filteredFollowupLeads.length}
                  onToggleSelectAll={(checked) => setSelectedFollowupLeadIds(checked ? filteredFollowupLeads.map((lead) => lead.id) : [])}
                  followupBulkAction={followupBulkAction}
                  onFollowupBulkActionChange={(value) => setFollowupBulkAction(value as FollowupBulkAction)}
                  followupBulkAssignee={followupBulkAssignee}
                  onFollowupBulkAssigneeChange={setFollowupBulkAssignee}
                  onOpenReassignPicker={() => setFollowupReassignPickerOpen(true)}
                  followupBulkDate={followupBulkDate}
                  onFollowupBulkDateChange={setFollowupBulkDate}
                  onApplyBulk={applyFollowupBulkActions}
                />

                <FollowupTable
                  leads={filteredFollowupLeads}
                  isOffline={!isOnline}
                  selectedLeadIds={selectedFollowupLeadIds}
                  onToggleLead={(leadId, checked) => setSelectedFollowupLeadIds((prev) => checked ? [...new Set([...prev, leadId])] : prev.filter((id) => id !== leadId))}
                  onUpdateDate={(leadId, nextFollowupDate) => upsertLead(leadId, (lead) => ({ ...lead, nextFollowupDate, followupStatus: "Pending" }), "Follow-up date updated from command center")}
                  onMoveToday={(leadId) => upsertLead(leadId, (lead) => ({ ...lead, nextFollowupDate: todayISODate(), followupStatus: "Pending" }), "Follow-up moved to today from command center")}
                  onSnooze2d={(leadId) => upsertLead(leadId, (lead) => ({ ...lead, nextFollowupDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), followupStatus: "Pending" }), "Follow-up snoozed +2 days from command center")}
                  onDone={(lead) => markFollowupDoneWithUndo(lead, "Follow-up marked done from command center")}
                  onOpenWhatsApp={openWhatsAppFollowup}
                  onOpenDetails={(leadId) => { setSelectedLeadId(leadId); setLeadDrawerOpen(true); }}
                  followupQueueKey={followupQueueKey}
                  followupDaysDelta={followupDaysDelta}
                />
              </FollowupsPage>
            )}

            {canViewLeads && appView === "revenue" && (
              <RevenuePage>
                <RevenueWorkspaceHeader compactMode={revenueCompactMode} revenueTab={revenueTab} onRevenueTabChange={setRevenueTab} />

                <RevenueKpiStrip
                  compactMode={revenueCompactMode}
                  openPipelineTotal={formatInr(revenueAnalytics.openPipelineTotal)}
                  bookedTotal={formatInr(revenueAnalytics.bookedTotal)}
                  collectedTotal={formatInr(revenueAnalytics.collectedTotal)}
                  outstandingTotal={formatInr(revenueAnalytics.outstandingTotal)}
                  forecastMoMClassName={revenueMoM.className}
                  forecastMoMLabel={`${revenueMoM.arrow} ${revenueMoM.value}`}
                />

                <RevenueScopePanel
                  rangePreset={revenueRangePreset}
                  onRangePresetChange={(preset) => setRevenueRangePreset(preset)}
                  customStart={revenueCustomStart}
                  customEnd={revenueCustomEnd}
                  onCustomStartChange={setRevenueCustomStart}
                  onCustomEndChange={setRevenueCustomEnd}
                  forecastMode={revenueForecastMode}
                  onForecastModeChange={(mode) => setRevenueForecastMode(mode)}
                  showFilters={revenueShowFilters}
                  onToggleFilters={() => setRevenueShowFilters((prev) => !prev)}
                  onReset={() => {
                    setRevenueAssigneeFilter("All");
                    setRevenueSourceFilter("All");
                    setRevenueServiceFilter("All");
                    setRevenueBookedTarget(0);
                    setRevenueCollectedTarget(0);
                    setRevenueShowEmptyMonths(false);
                  }}
                  scopeLabel={revenueAnalytics.scopeLabel}
                  leadsInScope={revenueAnalytics.leadCreatedInRange}
                  realizationRate={revenueAnalytics.realizationRate}
                  filtersSlot={(
                    <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Segmentation Filters</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={revenueAssigneeFilter} onChange={(e) => setRevenueAssigneeFilter(e.target.value)}><option value="All">All Assignees</option>{assigneeOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>
                        <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={revenueSourceFilter} onChange={(e) => setRevenueSourceFilter(e.target.value as LeadSource | "All")}><option value="All">All Sources</option>{LEAD_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}</select>
                        <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={revenueServiceFilter} onChange={(e) => setRevenueServiceFilter(e.target.value)}><option value="All">All Services</option>{services.map((service) => <option key={service} value={service}>{service}</option>)}</select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Targets (INR)</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-600">
                          <span>Booked Revenue Target</span>
                          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={0} value={revenueBookedTarget} onChange={(e) => setRevenueBookedTarget(Math.max(0, Number(e.target.value) || 0))} />
                        </label>
                        <label className="text-[11px] text-slate-600">
                          <span>Collected Revenue Target</span>
                          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={0} value={revenueCollectedTarget} onChange={(e) => setRevenueCollectedTarget(Math.max(0, Number(e.target.value) || 0))} />
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">View Controls</p>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={revenueShowEmptyMonths} onChange={(e) => setRevenueShowEmptyMonths(e.target.checked)} />
                        Show months without data
                      </label>
                      <p className="text-xs text-slate-500">When off, monthly tables expand only as real data gets added. Forecast vs Actual always hides empty months for readability.</p>
                    </div>
                  </div>
                  )}
                />

                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  {revenueCompactMode
                    ? "What you're seeing now: essential KPI strip, scope controls, waterfall, and compact revenue summaries. Switch to Advanced mode to include deep forecast, collections, and reconciliation blocks inline."
                    : "What you're seeing now: full revenue workspace with forecasting, collections, reconciliation, and export-ready reporting."}
                </div>

                {(revenueTab === "forecast" || (!revenueCompactMode && revenueTab === "overview" && revenueShowAdvanced)) && (
                <>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pipeline Projection by Expected Close Month</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-slate-500">Date basis: Expected Closing Date | Quality: Directional</p>
                    <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportRevenueCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-2">Month</th>
                          <th className="px-2 py-2">Expected Closures</th>
                          <th className="px-2 py-2">Projected (Unweighted)</th>
                          <th className="px-2 py-2">Projected (Weighted)</th>
                          <th className="px-2 py-2">Open Pipeline</th>
                          <th className="px-2 py-2">MoM</th>
                          <th className="px-2 py-2">Quality</th>
                          <th className="px-2 py-2">Drill-down</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueRowsForView.map((row, index) => {
                          const currentValue = revenueForecastMode === "weighted" ? row.projectedWeighted : row.projectedUnweighted;
                          const prev = revenueRowsForView[index - 1];
                          const previousValue = prev ? (revenueForecastMode === "weighted" ? prev.projectedWeighted : prev.projectedUnweighted) : 0;
                          const trend = getTrend(currentValue, previousValue);
                          return (
                            <tr key={row.monthKey} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-800">{row.monthLabel}</td>
                              <td className="px-2 py-2">{row.total}</td>
                              <td className="px-2 py-2">{formatInr(row.projectedUnweighted)}</td>
                              <td className="px-2 py-2">{formatInr(row.projectedWeighted)}</td>
                              <td className="px-2 py-2">{formatInr(row.openPipeline)}</td>
                              <td className={`px-2 py-2 ${trend.className}`}>{trend.arrow} {trend.value}</td>
                              <td className="px-2 py-2"><span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{row.quality}</span></td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => setRevenueDrilldown({ monthKey: row.monthKey, type: "projection" })} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">View Leads</button>
                              </td>
                            </tr>
                          );
                        })}
                        {revenueRowsForView.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-2 py-4">
                              <EmptyState
                                title="No projection data in this range"
                                description="Expand range or include empty months to review month slots."
                                actionLabel="Show Empty Months"
                                onAction={() => setRevenueShowEmptyMonths(true)}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Closed Outcomes by Won/Lost Month</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-slate-500">Date basis: Won Date and inferred Lost Date | Quality: Exact for booked/collected</p>
                      <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportClosedOutcomesCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Month</th><th className="px-2 py-2">Won</th><th className="px-2 py-2">Lost</th><th className="px-2 py-2">Booked</th><th className="px-2 py-2">Collected</th><th className="px-2 py-2">Outstanding</th><th className="px-2 py-2">Realization</th><th className="px-2 py-2">Quality</th><th className="px-2 py-2">Drill-down</th></tr></thead>
                      <tbody>
                        {closedOutcomeRowsForView.map((row) => (
                          <tr key={row.monthKey} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-medium text-slate-800">{row.monthLabel}</td>
                            <td className="px-2 py-2 text-emerald-700">{row.won}</td>
                            <td className="px-2 py-2 text-rose-700">{row.lost}</td>
                            <td className="px-2 py-2">{formatInr(row.booked)}</td>
                            <td className="px-2 py-2">{formatInr(row.collected)}</td>
                            <td className="px-2 py-2">{formatInr(row.outstanding)}</td>
                            <td className="px-2 py-2">{row.realizationRate.toFixed(1)}%</td>
                            <td className="px-2 py-2"><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{row.quality}</span></td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button type="button" onClick={() => setRevenueDrilldown({ monthKey: row.monthKey, type: "won" })} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200">Won</button>
                                <button type="button" onClick={() => setRevenueDrilldown({ monthKey: row.monthKey, type: "lost" })} className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700 hover:bg-rose-200">Lost</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {closedOutcomeRowsForView.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-2 py-4">
                              <EmptyState
                                title="No closed outcomes in selected range"
                                description="Try a wider date scope to inspect won and lost outcomes."
                                actionLabel="Reset Revenue Scope"
                                onAction={() => setRevenueRangePreset("3")}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                    <p>Booked target achievement: <span className="font-semibold text-slate-900">{revenueAnalytics.bookedAchievement.toFixed(1)}%</span></p>
                    <p>Collected target achievement: <span className="font-semibold text-slate-900">{revenueAnalytics.collectedAchievement.toFixed(1)}%</span></p>
                  </div>
                </div>

                {revenueDrilldown && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Revenue Drill-down</p>
                        <p className="text-xs text-slate-500">
                          {revenueDrilldown.type === "projection" ? "Projection leads" : revenueDrilldown.type === "won" ? "Won leads" : "Lost leads"}
                          {" | Month: "}
                          {revenueDrilldown.monthKey}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRevenueDrilldown(null)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Lead</th>
                            <th className="px-2 py-2">Company</th>
                            <th className="px-2 py-2">Source</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Value</th>
                            <th className="px-2 py-2">Owner</th>
                            <th className="px-2 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueDrilldownLeads.slice(0, 100).map((lead) => (
                            <tr key={`revenue-drill-${lead.id}`} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-800">{lead.leadName}</td>
                              <td className="px-2 py-2">{lead.companyName}</td>
                              <td className="px-2 py-2">{lead.leadSource}</td>
                              <td className="px-2 py-2">{lead.leadStatus}</td>
                              <td className="px-2 py-2">{formatInr(revenueDrilldown.type === "won" ? wonRevenueValue(lead) : safeDealValue(lead.dealValue))}</td>
                              <td className="px-2 py-2">{lead.assignedTo || "Unassigned"}</td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLeadId(lead.id);
                                    setLeadDrawerOpen(true);
                                  }}
                                  className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                                >
                                  Open Lead
                                </button>
                              </td>
                            </tr>
                          ))}
                          {revenueDrilldownLeads.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-2 py-4 text-slate-500">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>No leads found for this drill-down. Try a broader scope.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevenueDrilldown(null);
                                      setRevenueRangePreset("3");
                                      setRevenueCustomStart("");
                                      setRevenueCustomEnd("");
                                    }}
                                    className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                  >
                                    Reset Revenue Scope
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                </>
                )}

                {(revenueTab === "collections" || (!revenueCompactMode && revenueTab === "overview" && revenueShowAdvanced)) && (
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Payment Status Mix</h3>
                    <p className="text-xs text-slate-500">Date basis: Won Date | Quality: Exact</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {PAYMENT_STATUSES.map((status) => (
                        <div key={status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <span className="text-slate-700">{status}</span>
                          <span className="font-semibold text-slate-900">{revenueAnalytics.paymentStatusCounts[status]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Collections Aging</h3>
                    <p className="text-xs text-slate-500">Outstanding by days since Won Date | Quality: Exact</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-slate-700">0 - 30 days</p>
                        <p className="font-semibold text-slate-900">{revenueAnalytics.collectionAging.bucket0to30.count} leads | {formatInr(revenueAnalytics.collectionAging.bucket0to30.amount)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-slate-700">31 - 60 days</p>
                        <p className="font-semibold text-slate-900">{revenueAnalytics.collectionAging.bucket31to60.count} leads | {formatInr(revenueAnalytics.collectionAging.bucket31to60.amount)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-slate-700">60+ days</p>
                        <p className="font-semibold text-rose-700">{revenueAnalytics.collectionAging.bucket60Plus.count} leads | {formatInr(revenueAnalytics.collectionAging.bucket60Plus.amount)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Collections Accountability</h3>
                    <p className="text-xs text-slate-500">Grouped by Collections Owner | Quality: Exact</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Won</th><th className="px-2 py-2">Booked</th><th className="px-2 py-2">Collected</th><th className="px-2 py-2">Outstanding</th></tr></thead>
                        <tbody>
                          {revenueAnalytics.collectionsByOwner.slice(0, 8).map((row) => (
                            <tr key={row.owner} className="border-b border-slate-100">
                              <td className="px-2 py-2">{row.owner}</td>
                              <td className="px-2 py-2">{row.won}</td>
                              <td className="px-2 py-2">{formatInr(row.booked)}</td>
                              <td className="px-2 py-2">{formatInr(row.collected)}</td>
                              <td className="px-2 py-2 text-rose-700">{formatInr(row.outstanding)}</td>
                            </tr>
                          ))}
                          {revenueAnalytics.collectionsByOwner.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-slate-500">No won leads in current scope.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}

                {(revenueTab === "reconciliation" || (!revenueCompactMode && revenueTab === "overview" && revenueShowAdvanced)) && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Finance Reconciliation</h3>
                    <p className="text-xs text-slate-500">Date basis: Won Date vs Invoice Issue Date | Scope: {financeReconciliation.scopeLabel}</p>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <p>Booked from Won Leads: <span className="font-semibold text-slate-900">{formatInr(financeReconciliation.bookedTotal)}</span></p>
                      <p>Invoiced Total: <span className="font-semibold text-slate-900">{formatInr(financeReconciliation.invoicedTotal)}</span></p>
                      <p>Gap (Booked - Invoiced): <span className={`font-semibold ${financeReconciliation.delta >= 0 ? "text-amber-700" : "text-rose-700"}`}>{formatInrSigned(financeReconciliation.delta)}</span></p>
                      <p>Uninvoiced Won Leads: <span className="font-semibold text-slate-900">{financeReconciliation.uninvoicedWonLeads}</span></p>
                      <p>Under-invoiced Leads: <span className="font-semibold text-amber-700">{financeReconciliation.underInvoicedLeads}</span></p>
                      <p>Over-invoiced Leads: <span className="font-semibold text-rose-700">{financeReconciliation.overInvoicedLeads}</span></p>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Lead</th><th className="px-2 py-2">Booked</th><th className="px-2 py-2">Invoiced</th><th className="px-2 py-2">Gap</th></tr></thead>
                        <tbody>
                          {financeReconciliation.largestMismatches.map((row) => (
                            <tr key={row.lead.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">{row.lead.companyName}</td>
                              <td className="px-2 py-2">{formatInr(row.booked)}</td>
                              <td className="px-2 py-2">{formatInr(row.invoiced)}</td>
                              <td className={`px-2 py-2 ${row.delta >= 0 ? "text-amber-700" : "text-rose-700"}`}>{formatInrSigned(row.delta)}</td>
                            </tr>
                          ))}
                          {financeReconciliation.largestMismatches.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-slate-500">Booked and invoiced values are aligned in this scope.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Collection Aging Action Queue</h3>
                    <p className="text-xs text-slate-500">Focus list for outstanding won leads with one-click follow-up actions.</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Lead</th><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Aging</th><th className="px-2 py-2">Outstanding</th><th className="px-2 py-2">Actions</th></tr></thead>
                        <tbody>
                          {collectionActionQueue.map((row) => (
                            <tr key={row.lead.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">
                                <p className="font-medium text-slate-800">{row.lead.companyName}</p>
                                <p className="text-[11px] text-slate-500">{row.lead.leadName} | SLA: {row.dueTag}</p>
                              </td>
                              <td className="px-2 py-2">{row.lead.collectionsOwner || row.lead.assignedTo || "Unassigned"}</td>
                              <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 ${row.bucket === "60+" ? "bg-rose-100 text-rose-700" : row.bucket === "31-60" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{row.bucket} ({row.ageDays}d)</span></td>
                              <td className="px-2 py-2 text-rose-700">{formatInr(row.outstanding)}</td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  <button type="button" onClick={() => upsertLead(row.lead.id, (lead) => ({ ...lead, nextFollowupDate: todayISODate(), followupStatus: "Pending" }), "Collections follow-up moved to today")} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">Follow-up Today</button>
                                  <button type="button" onClick={() => { setSelectedLeadId(row.lead.id); setLeadDrawerOpen(true); }} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">Lead</button>
                                  <button type="button" onClick={() => { setAppView("invoices"); setInvoiceLeadFilter(row.lead.id); }} className="rounded bg-[#5f56d3] px-2 py-1 text-[11px] text-white hover:bg-[#4f47b9]">Invoices</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {collectionActionQueue.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-slate-500">No outstanding collection actions in current lead set.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}

                {(revenueTab === "forecast" || (!revenueCompactMode && revenueTab === "overview" && revenueShowAdvanced)) && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Forecast vs Actual</h3>
                      <p className="text-xs text-slate-500">Date basis: Forecast from Expected Closing Date ({revenueForecastMode}), Actual from Won Date + Won Snapshot Value. Quality: Directional vs Exact.</p>
                      {hiddenForecastMonthsCount > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500">{hiddenForecastMonthsCount} empty month{hiddenForecastMonthsCount === 1 ? "" : "s"} hidden to reduce visual noise.</p>
                      )}
                    </div>
                    <button type="button" disabled={!canUseExports || !canUseAdvancedForecast || isExportingCsv} onClick={exportForecastCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                  </div>
                  {canUseAdvancedForecast ? (
                    <div className="space-y-3">
                      {(() => {
                        const maxValue = Math.max(1, ...forecastActualRowsForView.map((row) => Math.max(row.forecast, row.actual)));
                        return forecastActualRowsForView.map((row, index) => {
                          const trend = getTrend(row.actual, index > 0 ? forecastActualRowsForView[index - 1].actual : 0);
                          return (
                            <div key={row.monthKey} className="rounded-lg border border-slate-200 p-3">
                              <div className="mb-2 flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-700">{row.monthLabel}</span>
                                <span className={trend.className}>{trend.arrow} {trend.value} actual MoM</span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Forecast</span><span>{formatInr(row.forecast)}</span></div>
                                  <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-amber-400" style={{ width: `${Math.min(100, (row.forecast / maxValue) * 100)}%` }} /></div>
                                </div>
                                <div>
                                  <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Actual</span><span>{formatInr(row.actual)}</span></div>
                                  <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, (row.actual / maxValue) * 100)}%` }} /></div>
                                </div>
                              </div>
                              <p className="mt-2 text-[11px] text-slate-600">Gap: {formatInrSigned(row.gap)} | Accuracy: {row.accuracy.toFixed(1)}% | <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{row.quality}</span></p>
                            </div>
                          );
                        });
                      })()}
                      {forecastActualRowsForView.length === 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>No forecast vs actual data in selected range. Add expected close dates or widen the range.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRevenueRangePreset("3");
                                setRevenueCustomStart("");
                                setRevenueCustomEnd("");
                              }}
                              className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                            >
                              Reset Revenue Scope
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Advanced forecast is disabled for this plan.</p>
                  )}
                </div>
                )}

                {(revenueTab === "reconciliation" || revenueTab === "overview") && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <h3 className="text-lg font-semibold">Revenue Waterfall</h3>
                  <p className="text-xs text-slate-500">{"Opening pipeline -> Added -> Won -> Lost -> Closing pipeline (scope aligned)"}</p>
                  <div className="mt-4 h-72 w-full rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueWaterfallChartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                        <YAxis tickFormatter={(value) => formatInr(Number(value))} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <RechartsTooltip
                          formatter={(value, name, payload) => {
                            const current = typeof value === "number" ? value : Number(value ?? 0);
                            const impact = Number((payload as { payload?: { impact?: number } })?.payload?.impact ?? current);
                            if (name === "Change") {
                              return [formatInrSigned(impact), "Change"];
                            }
                            return [formatInr(current), String(name)];
                          }}
                          labelFormatter={(_, data) => {
                            const row = data?.[0]?.payload as { label?: string; to?: number } | undefined;
                            if (!row) return "";
                            return `${row.label} | Result: ${formatInr(row.to ?? 0)}`;
                          }}
                        />
                        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                        <Bar dataKey="span" stackId="wf" name="Change" radius={[4, 4, 0, 0]}>
                          {revenueWaterfallChartData.map((row) => {
                            let fill = "#94a3b8";
                            if (row.tone === "positive") fill = "#38bdf8";
                            if (row.tone === "won") fill = "#22c55e";
                            if (row.tone === "negative") fill = "#f43f5e";
                            if (row.tone === "neutral") fill = "#64748b";
                            return <Cell key={`wf-${row.key}`} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-5 text-sm">
                    <div><p className="text-slate-500">Opening</p><p className="font-semibold">{formatInr(revenueAnalytics.waterfall.openingPipelineValue)}</p></div>
                    <div><p className="text-slate-500">Added</p><p className="font-semibold">{formatInr(revenueAnalytics.waterfall.addedPipelineValue)}</p></div>
                    <div><p className="text-slate-500">Won</p><p className="font-semibold text-emerald-700">{formatInr(revenueAnalytics.waterfall.wonInRangeValue)}</p></div>
                    <div><p className="text-slate-500">Lost</p><p className="font-semibold text-rose-700">{formatInr(revenueAnalytics.waterfall.lostInRangeValue)}</p></div>
                    <div><p className="text-slate-500">Closing</p><p className="font-semibold">{formatInr(revenueAnalytics.waterfall.closingPipelineValue)}</p></div>
                  </div>
                </div>
                )}

                {revenueTab === "overview" && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700">Overview Layout</p>
                      <button
                        type="button"
                        onClick={() => setRevenueShowAdvanced((prev) => !prev)}
                        className="rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-300"
                      >
                        {revenueShowAdvanced ? "Hide" : "Show"} Advanced Insights
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {revenueCompactMode
                        ? "Compact mode keeps overview focused. Open specific tabs for deeper analysis."
                        : "Use Advanced Insights to include collections, reconciliation, and deeper outcome blocks inside overview."}
                    </p>
                  </div>
                )}

                {revenueTab === "exports" && (
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <h3 className="text-lg font-semibold">Revenue Exports and Definitions</h3>
                    <p className="text-xs text-slate-500">Export only the dataset you need for reviews. Exact = snapshot-backed. Directional = projection-based.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                        value={revenueExportType}
                        onChange={(e) => setRevenueExportType(e.target.value as "projection" | "closed" | "forecast")}
                      >
                        <option value="projection">Pipeline Projection CSV</option>
                        <option value="closed">Closed Outcomes CSV</option>
                        <option value="forecast">Forecast vs Actual CSV</option>
                      </select>
                      <button
                        type="button"
                        disabled={!canUseExports || (revenueExportType === "forecast" && !canUseAdvancedForecast)}
                        onClick={() => {
                          if (revenueExportType === "projection") {
                            exportRevenueCsv();
                            return;
                          }
                          if (revenueExportType === "closed") {
                            exportClosedOutcomesCsv();
                            return;
                          }
                          exportForecastCsv();
                        }}
                        className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </RevenuePage>
            )}

            {canAccessInvoicesView && appView === "invoices" && (
              <InvoicesPage>
                <InvoicesWorkspaceHeader
                  compactMode={invoicesCompactMode}
                  workspaceTab={invoiceWorkspaceTab}
                  onWorkspaceTabChange={setInvoiceWorkspaceTab}
                />

                {invoiceWorkspaceTab === "workspace" ? (
                  <>

                <InvoicesKpiStrip
                  compactMode={invoicesCompactMode}
                  totalInvoices={invoiceMetrics.total}
                  billedValue={formatInr(invoiceMetrics.totalValue)}
                  collectedValue={formatInr(invoiceMetrics.paidValue)}
                  pendingValue={formatInr(invoiceMetrics.outstandingValue)}
                  overdueCount={invoiceMetrics.overdueCount}
                  gstCollectedValue={formatInr(invoiceMetrics.taxValue)}
                  realizationLabel={`${invoiceMetrics.realization.toFixed(1)}%`}
                  pendingApprovalCount={invoiceMetrics.pendingApprovalCount}
                />

                <InvoicesScopePanel
                  rangePreset={invoiceRangePreset}
                  onRangePresetChange={(preset) => setInvoiceRangePreset(preset)}
                  customStart={invoiceCustomStart}
                  customEnd={invoiceCustomEnd}
                  onCustomStartChange={setInvoiceCustomStart}
                  onCustomEndChange={setInvoiceCustomEnd}
                  scopeLabel={invoiceScopeLabel}
                  controlsSlot={<div className="mt-3 flex flex-wrap items-center gap-2">
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={invoiceLeadFilter} onChange={(e) => setInvoiceLeadFilter(e.target.value)}>
                      <option value="All">All Eligible Leads</option>
                      {invoiceEligibleLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>{lead.companyName} - {lead.leadName}</option>
                      ))}
                    </select>
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={invoiceClientFilter} onChange={(e) => setInvoiceClientFilter(e.target.value)}>
                      <option value="All">All Clients</option>
                      {invoiceClientOptions.map((client) => (
                        <option key={client} value={client}>{client}</option>
                      ))}
                    </select>
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value as InvoiceStatus | "All")}>
                      <option value="All">All Statuses</option>
                      {INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceLeadFilter("All");
                        setInvoiceClientFilter("All");
                        setInvoiceStatusFilter("All");
                        setInvoiceRangePreset("3");
                        setInvoiceCustomStart("");
                        setInvoiceCustomEnd("");
                      }}
                      className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-300"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceIssuerConfirmed(invoiceIssuerProfileReady);
                        setInvoiceIssuerEditMode(!invoiceIssuerProfileReady);
                        setInvoiceComposerOpen(true);
                      }}
                      className="rounded bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]"
                    >
                      {invoiceComposerOpen ? "Composer Open" : "Create Invoice"}
                    </button>
                    <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportInvoicesCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    {!invoicesCompactMode && <p className="text-xs text-slate-500">GST suite: multi-line invoices, maker-checker approval, recurring schedules with auto-cycle generation, payment ledger, credit/debit notes, PDF and email dispatch.</p>}
                  </div>}
                  noteSlot={!invoicesCompactMode ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Customer profiles are now managed in the dedicated Client Master tab for cleaner invoicing workspace.
                    </div>
                  ) : undefined}
                >
                  {(currentUser.role === "owner" || currentUser.role === "admin") && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <label className="text-slate-600">Approval Remark</label>
                      <input
                        className="min-w-[260px] rounded border border-slate-300 px-2 py-1.5 text-xs"
                        value={approvalRemarkDraft}
                        onChange={(e) => setApprovalRemarkDraft(e.target.value)}
                        placeholder="Used for approve/reject actions"
                      />
                    </div>
                  )}


                  {invoiceComposerOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end bg-black/35" role="dialog" aria-modal="true" aria-label="Invoice composer">
                      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">{requiresGstCompliance ? "Create GST Invoice" : "Create Invoice"}</h3>
                          <p className="mt-1 text-[11px] text-slate-500">{requiresGstCompliance ? "GST compliance mode: GST details required before save." : "Flexible mode: GST details are optional for this client."}</p>
                        </div>
                        <button type="button" onClick={() => setInvoiceComposerOpen(false)} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Close</button>
                      </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="text-xs text-slate-600">Eligible Lead
                          <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.leadId} onChange={(e) => {
                            const lead = invoiceEligibleLeads.find((row) => row.id === e.target.value);
                            if (lead) {
                              openInvoiceComposerForLead(lead);
                              return;
                            }
                            setInvoiceDraft((prev) => ({ ...prev, leadId: "", customerProfileId: "" }));
                          }}>
                            <option value="">Select lead</option>
                            {invoiceEligibleLeads.map((lead) => (
                              <option key={lead.id} value={lead.id}>{lead.companyName} - {lead.leadName}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Issue Date
                          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="date" value={invoiceDraft.issueDate} onChange={(e) => {
                            const issueDate = e.target.value;
                            setInvoiceDraft((prev) => ({ ...prev, issueDate, dueDate: shiftISODate(issueDate || todayISODate(), Math.max(1, Number(prev.paymentTermsDays) || 1)) }));
                          }} />
                        </label>
                        <label className="text-xs text-slate-600">Due Date
                          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="date" value={invoiceDraft.dueDate} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />
                        </label>
                        <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-semibold text-slate-700">Customer Master</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            <label className="text-xs text-slate-600 md:col-span-2">Billing Profile
                              <select
                                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                value={invoiceDraft.customerProfileId}
                                onChange={(e) => {
                                  const nextId = e.target.value;
                                  if (!nextId) {
                                    setInvoiceDraft((prev) => ({ ...prev, customerProfileId: "" }));
                                    return;
                                  }
                                  const profile = customerProfilesForDraftTenant.find((row) => row.id === nextId);
                                  if (profile) applyCustomerProfileToDraft(profile, invoiceDraftLead);
                                }}
                              >
                                <option value="">No profile selected</option>
                                {customerProfilesForDraftTenant.map((profile) => (
                                  <option key={profile.id} value={profile.id}>{profile.profileName}{profile.isDefault ? " (default)" : ""}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs text-slate-600">Profile Name
                              <input
                                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                value={customerProfileNameDraft}
                                onChange={(e) => setCustomerProfileNameDraft(e.target.value)}
                                placeholder="Acme HQ Billing"
                              />
                            </label>
                            <div className="flex items-end gap-2">
                              <button type="button" onClick={saveDraftAsCustomerProfile} className="rounded bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">Save Profile</button>
                              {invoiceDraft.customerProfileId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const selected = customerProfilesForDraftTenant.find((row) => row.id === invoiceDraft.customerProfileId);
                                    if (selected) setCustomerProfileDefault(selected);
                                  }}
                                  className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-300"
                                >
                                  Set Default
                                </button>
                              )}
                            </div>
                            {invoiceDraft.customerProfileId && (
                              <div className="md:col-span-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const selected = customerProfilesForDraftTenant.find((row) => row.id === invoiceDraft.customerProfileId);
                                    if (selected) removeCustomerProfile(selected);
                                  }}
                                  className="rounded bg-rose-100 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-200"
                                >
                                  Remove Selected Profile
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-700">Invoice Issuer Profile</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {invoiceIssuerProfileReady
                                  ? "Profile looks good. Confirm and continue, or edit if needed."
                                  : `Missing details: ${invoiceIssuerMissingFields.join(", ")}`}
                              </p>
                              {invoiceIssuerConfirmed && (
                                <p className="mt-1 text-[11px] font-medium text-emerald-700">Issuer profile confirmed for this invoice.</p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceIssuerConfirmed(true);
                                  setInvoiceIssuerEditMode(false);
                                }}
                                className="rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200"
                              >
                                Profile looks good, continue
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceIssuerEditMode((prev) => !prev);
                                  setInvoiceIssuerConfirmed(false);
                                }}
                                className="rounded bg-slate-200 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-300"
                              >
                                {invoiceIssuerEditMode ? "Hide issuer fields" : "Edit issuer profile"}
                              </button>
                            </div>
                          </div>

                          {!invoiceIssuerEditMode && (
                            <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 md:grid-cols-4">
                              <p><span className="font-medium text-slate-700">Legal:</span> {invoiceDraft.supplierName || "-"}</p>
                              <p><span className="font-medium text-slate-700">Phone:</span> {invoiceDraft.supplierPhone || "-"}</p>
                              <p><span className="font-medium text-slate-700">Email:</span> {invoiceDraft.supplierEmail || "-"}</p>
                              <p><span className="font-medium text-slate-700">GSTIN:</span> {invoiceDraft.supplierGstin || "-"}</p>
                            </div>
                          )}

                          {invoiceIssuerEditMode && (
                            <div className="mt-2 grid gap-2 md:grid-cols-4">
                              <label className="text-xs text-slate-600 md:col-span-2">Legal Name
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierName} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierName: e.target.value }))} />
                              </label>
                              <label className="text-xs text-slate-600">Phone
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierPhone} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierPhone: e.target.value }))} />
                                {invoiceInlineErrors.supplierPhone && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.supplierPhone}</span>}
                              </label>
                              <label className="text-xs text-slate-600">Email
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="email" value={invoiceDraft.supplierEmail} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierEmail: e.target.value }))} />
                                {invoiceInlineErrors.supplierEmail && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.supplierEmail}</span>}
                              </label>
                              <label className="text-xs text-slate-600 md:col-span-2">Address
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierAddress} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierAddress: e.target.value }))} />
                              </label>
                              <label className="text-xs text-slate-600">City
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierCity} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierCity: e.target.value }))} />
                              </label>
                              <label className="text-xs text-slate-600">State
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierState} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierState: e.target.value }))} />
                              </label>
                              <label className="text-xs text-slate-600">Pincode
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierPincode} maxLength={6} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierPincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                                {invoiceInlineErrors.supplierPincode && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.supplierPincode}</span>}
                              </label>
                              <label className="text-xs text-slate-600">State Code
                                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierStateCode} maxLength={2} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierStateCode: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
                              </label>
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-semibold text-slate-700">Client Billing Details (Mandatory)</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            <label className="text-xs text-slate-600">Client Name
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToName} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToName: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Company
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToCompany} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToCompany: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Phone
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToPhone} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToPhone: e.target.value }))} />
                              {invoiceInlineErrors.billedToPhone && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.billedToPhone}</span>}
                            </label>
                            <label className="text-xs text-slate-600">Email
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="email" value={invoiceDraft.billedToEmail} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToEmail: e.target.value }))} />
                              {invoiceInlineErrors.billedToEmail && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.billedToEmail}</span>}
                            </label>
                            <label className="text-xs text-slate-600 md:col-span-2">Address
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToAddress} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToAddress: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">City
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToCity} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToCity: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">State
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToState} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToState: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Pincode
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.billedToPincode} maxLength={6} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, billedToPincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                              {invoiceInlineErrors.billedToPincode && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.billedToPincode}</span>}
                            </label>
                          </div>
                        </div>
                        <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-semibold text-slate-700">Shipping, Terms, and Banking</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            <label className="md:col-span-4 inline-flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={invoiceDraft.useBillingAsShipping}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setInvoiceDraft((prev) => ({
                                    ...prev,
                                    useBillingAsShipping: checked,
                                    shippingAddress: checked ? prev.billedToAddress : prev.shippingAddress,
                                    shippingCity: checked ? prev.billedToCity : prev.shippingCity,
                                    shippingState: checked ? prev.billedToState : prev.shippingState,
                                    shippingPincode: checked ? prev.billedToPincode : prev.shippingPincode,
                                  }));
                                }}
                              />
                              Shipping same as billing
                            </label>
                            <label className="text-xs text-slate-600 md:col-span-2">Shipping Address
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.shippingAddress} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, shippingAddress: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Shipping City
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.shippingCity} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, shippingCity: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Shipping State
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.shippingState} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, shippingState: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Shipping Pincode
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" maxLength={6} value={invoiceDraft.shippingPincode} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, shippingPincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                              {invoiceInlineErrors.shippingPincode && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.shippingPincode}</span>}
                            </label>
                            <label className="text-xs text-slate-600">Payment Terms (days)
                              <input
                                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                type="number"
                                min={1}
                                value={invoiceDraft.paymentTermsDays}
                                onChange={(e) => {
                                  const paymentTermsDays = Math.max(1, Number(e.target.value) || 1);
                                  setInvoiceDraft((prev) => ({ ...prev, paymentTermsDays, dueDate: shiftISODate(prev.issueDate || todayISODate(), paymentTermsDays) }));
                                }}
                              />
                            </label>
                            <label className="text-xs text-slate-600">PO Number
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.poNumber} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, poNumber: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Beneficiary Name
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.bankBeneficiaryName} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, bankBeneficiaryName: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Bank Name
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.bankName} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, bankName: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">Account Number
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.bankAccountNumber} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, bankAccountNumber: e.target.value }))} />
                            </label>
                            <label className="text-xs text-slate-600">IFSC
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm uppercase" value={invoiceDraft.bankIfsc} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, bankIfsc: e.target.value.toUpperCase() }))} />
                              {invoiceInlineErrors.bankIfsc && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.bankIfsc}</span>}
                            </label>
                          </div>
                        </div>
                        {!invoicesCompactMode && (
                          <>
                            <label className="text-xs text-slate-600">Supplier GSTIN
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.supplierGstin} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, supplierGstin: e.target.value.toUpperCase() }))} placeholder="27ABCDE1234F1Z5" />
                              {invoiceInlineErrors.supplierGstin && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.supplierGstin}</span>}
                            </label>
                            <label className="text-xs text-slate-600">Buyer GSTIN (optional)
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.buyerGstin} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, buyerGstin: e.target.value.toUpperCase() }))} placeholder="29ABCDE1234F1Z5" />
                              {invoiceInlineErrors.buyerGstin && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.buyerGstin}</span>}
                            </label>
                            <label className="text-xs text-slate-600">Place of Supply (State Code)
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.placeOfSupplyStateCode} maxLength={2} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, placeOfSupplyStateCode: e.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="33" />
                              {invoiceInlineErrors.placeOfSupplyStateCode && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.placeOfSupplyStateCode}</span>}
                            </label>
                            <label className="text-xs text-slate-600">SAC / HSN Code
                              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.sacCode} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, sacCode: e.target.value.replace(/\D/g, "") }))} placeholder="9983" />
                              {invoiceInlineErrors.sacCode && <span className="mt-1 block text-[11px] text-rose-700">{invoiceInlineErrors.sacCode}</span>}
                            </label>
                            <label className="mt-5 inline-flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" checked={invoiceDraft.reverseCharge} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, reverseCharge: e.target.checked }))} />
                              Reverse Charge Applicable
                            </label>
                          </>
                        )}
                        <label className="text-xs text-slate-600">GST Mode
                          <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.gstMode} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, gstMode: e.target.value as GstMode }))}>
                            <option value="Intra">Intra-State (CGST + SGST)</option>
                            <option value="Inter">Inter-State (IGST)</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">Recurrence
                          <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={invoiceDraft.recurrence} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, recurrence: e.target.value as InvoiceRecurrence }))}>
                            {INVOICE_RECURRENCES.map((entry) => <option key={entry} value={entry}>{entry === "none" ? "One-time" : entry[0].toUpperCase() + entry.slice(1)}</option>)}
                          </select>
                        </label>
                        {invoiceDraft.recurrence !== "none" && (
                          <label className="text-xs text-slate-600">Cycle Count
                            <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" type="number" min={1} max={24} value={invoiceDraft.recurrenceCount} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, recurrenceCount: Math.max(1, Math.min(24, Number(e.target.value) || 1)) }))} />
                            <span className="mt-1 block text-[11px] text-slate-500">Future cycles are auto-generated on their due issue dates.</span>
                          </label>
                        )}
                        <label className="text-xs text-slate-600 md:col-span-3">Invoice Notes
                          <textarea className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" rows={2} value={invoiceDraft.notes} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                        </label>
                        <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">Line Items</p>
                            <button type="button" onClick={addInvoiceLineItem} className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-300">Add Line</button>
                          </div>
                          <div className="space-y-2">
                            {invoiceDraft.lineItems.map((item, index) => (
                              <div key={item.id} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-12">
                                <input className="md:col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="Service" value={item.serviceName} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, serviceName: e.target.value }))} />
                                <input className="md:col-span-3 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="Description" value={item.description} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, description: e.target.value }))} />
                                <input className="md:col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="SAC" value={item.sacCode} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, sacCode: e.target.value.replace(/\D/g, "").slice(0, 8) }))} />
                                <input className="md:col-span-1 rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={1} value={item.quantity} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))} />
                                <input className="md:col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={0} placeholder="Unit Price" value={item.unitPrice} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, unitPrice: Math.max(0, Number(e.target.value) || 0) }))} />
                                <input className="md:col-span-1 rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={0} placeholder="GST%" value={item.gstRate} onChange={(e) => setInvoiceLineItem(item.id, (prev) => ({ ...prev, gstRate: Math.max(0, Number(e.target.value) || 0) }))} />
                                <button type="button" disabled={invoiceDraft.lineItems.length <= 1} onClick={() => removeInvoiceLineItem(item.id)} className="md:col-span-1 rounded bg-rose-100 px-2 py-1 text-[11px] text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{index === 0 ? "Base" : "Remove"}</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
                        <p>Subtotal {formatInr(invoiceDraftAmounts.subtotal)} | Tax {formatInr(invoiceDraftAmounts.cgstAmount + invoiceDraftAmounts.sgstAmount + invoiceDraftAmounts.igstAmount)} | Total {formatInr(invoiceDraftAmounts.totalAmount)} | POS {invoiceDraft.placeOfSupplyStateCode || "-"}</p>
                        <button type="button" disabled={isSavingInvoice} onClick={() => void createInvoice()} className="inline-flex items-center gap-2 rounded bg-[#5f56d3] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4f47b9] disabled:cursor-not-allowed disabled:opacity-70">{isSavingInvoice && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-white/80 border-t-transparent" />}Save Invoice</button>
                      </div>
                    </div>
                    </div>
                    </div>
                  )}
                </InvoicesScopePanel>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-2">Invoice</th>
                          <th className="px-2 py-2">Client</th>
                          <th className="px-2 py-2">Issue / Due</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Total</th>
                          <th className="px-2 py-2">Paid</th>
                          <th className="px-2 py-2">Balance</th>
                          <th className="px-2 py-2">Promise</th>
                          <th className="px-2 py-2">Delivery</th>
                          <th className="px-2 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((invoice) => {
                          const adjustments = invoiceAdjustmentsById.get(invoice.id) ?? [];
                          const adjustmentSummary = invoiceAdjustmentSummary(adjustments);
                          const effectiveTotal = invoiceEffectiveTotal(invoice, adjustments);
                          const liveStatus = normalizeInvoiceStatus(invoice, effectiveTotal);
                          const canCheckerAction = !!currentUser && (currentUser.role === "owner" || currentUser.role === "admin") && invoice.createdBy !== currentUser.name;
                          const latestPromise = (invoicePromisesById.get(invoice.id) ?? [])[0] ?? null;
                          const latestDispatch = latestCollectionsDispatchByInvoice.get(invoice.id) ?? null;
                          const statusClass = liveStatus === "Paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : liveStatus === "Overdue"
                              ? "bg-rose-100 text-rose-700"
                              : liveStatus === "Cancelled"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-amber-100 text-amber-700";
                          return (
                            <tr key={invoice.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">
                                <p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
                                <p className="text-xs text-slate-500">{invoice.serviceName}</p>
                              </td>
                              <td className="px-2 py-2">
                                <p>{invoice.billedToCompany}</p>
                                <p className="text-xs text-slate-500">{invoice.billedToName}</p>
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-600">
                                <p>Issue: {formatDateDisplay(invoice.issueDate)}</p>
                                <p>Due: {formatDateDisplay(invoice.dueDate)}</p>
                                {invoice.recurrence !== "none" && (
                                  <p>Cycle: {invoice.recurrence} ({invoice.recurrenceIndex}/{invoice.recurrenceCount})</p>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>{liveStatus}</span>
                                <p className="mt-1 text-[11px] text-slate-500">Approval: {invoice.approvalStatus}</p>
                              </td>
                              <td className="px-2 py-2">
                                <p>{formatInr(effectiveTotal)}</p>
                                {(adjustmentSummary.credit > 0 || adjustmentSummary.debit > 0) && (
                                  <p className="text-[11px] text-slate-500">Adj C:{formatInr(adjustmentSummary.credit)} D:{formatInr(adjustmentSummary.debit)}</p>
                                )}
                              </td>
                              <td className="px-2 py-2 text-sky-700">{formatInr(invoice.amountPaid)}</td>
                              <td className="px-2 py-2 text-rose-700">{formatInr(invoice.balanceAmount)}</td>
                              <td className="px-2 py-2 text-xs">
                                {latestPromise ? (
                                  <div className="space-y-1">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 ${latestPromise.status === "Open" ? "bg-amber-100 text-amber-700" : latestPromise.status === "Honored" ? "bg-emerald-100 text-emerald-700" : latestPromise.status === "Missed" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"}`}>{latestPromise.status}</span>
                                    <p className="text-slate-500">{formatInr(latestPromise.promisedAmount)} by {formatDateDisplay(latestPromise.promisedDate)}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">No PTP</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs">
                                {latestDispatch ? (
                                  <div className="space-y-1">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 ${latestDispatch.status === "read" ? "bg-emerald-100 text-emerald-700" : latestDispatch.status === "delivered" ? "bg-sky-100 text-sky-700" : latestDispatch.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{latestDispatch.status}</span>
                                    <p className="text-slate-500">{latestDispatch.channel === "email" ? "Email" : "WhatsApp"} | {latestDispatch.lastEventAt ? formatDateTimeDisplay(latestDispatch.lastEventAt) : "-"}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Not sent</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <div className="relative flex flex-wrap items-center gap-1">
                                  <button type="button" onClick={() => recordInvoicePayment(invoice)} className="rounded bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-700">Record Payment</button>
                                  <button type="button" onClick={() => sendInvoiceEmail(invoice)} className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700">Email</button>
                                  <button
                                    type="button"
                                    onClick={() => downloadInvoicePdf(invoice)}
                                    className="rounded bg-[#5f56d3] px-2 py-1 text-[11px] text-white hover:bg-[#4f47b9]"
                                  >
                                    PDF
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`More actions for invoice ${invoice.invoiceNumber}`}
                                    onClick={() => setInvoiceActionMenuId((prev) => (prev === invoice.id ? null : invoice.id))}
                                    className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                                  >
                                    ...
                                  </button>

                                  {invoiceActionMenuId === invoice.id && (
                                    <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                      <button type="button" onClick={() => { setLedgerInvoiceId(invoice.id); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Ledger</button>
                                      <button type="button" onClick={() => { openPromiseModal(invoice); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Promise</button>
                                      <button
                                        type="button"
                                        disabled={isSendingReminder}
                                        onClick={() => { void sendCollectionsReminder(invoice); setInvoiceActionMenuId(null); }}
                                        className="inline-flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {isSendingReminder && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}
                                        Nudge
                                      </button>
                                      <button type="button" onClick={() => { openAdjustmentModal(invoice, "Credit"); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Credit Note</button>
                                      <button type="button" onClick={() => { openAdjustmentModal(invoice, "Debit"); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Debit Note</button>
                                      {latestPromise?.status === "Open" && (
                                        <>
                                          <button type="button" onClick={() => { markInvoicePromiseStatus(invoice.id, "Honored"); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">PTP Honored</button>
                                          <button type="button" onClick={() => { markInvoicePromiseStatus(invoice.id, "Missed"); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">PTP Missed</button>
                                        </>
                                      )}
                                      <button type="button" onClick={() => { updateInvoiceStatus(invoice, invoice.status === "Cancelled" ? "Issued" : "Cancelled"); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">{invoice.status === "Cancelled" ? "Restore" : "Cancel"}</button>
                                      {invoice.approvalStatus === "Pending" && canCheckerAction && (
                                        <>
                                          <button type="button" onClick={() => { approveInvoice(invoice); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Approve</button>
                                          <button type="button" onClick={() => { rejectInvoice(invoice); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Reject</button>
                                        </>
                                      )}
                                      {invoice.approvalStatus === "Rejected" && invoice.createdBy === (currentUser?.name ?? "") && (
                                        <button type="button" onClick={() => { resubmitInvoiceForApproval(invoice); setInvoiceActionMenuId(null); }} className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100">Resubmit</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {invoice.approvalStatus === "Pending" && !canCheckerAction && (currentUser?.role === "owner" || currentUser?.role === "admin") && (
                                  <p className="mt-1 text-[11px] text-slate-500">Maker-checker: creator cannot approve own draft.</p>
                                )}
                                {(invoice.approvalStatus === "Rejected" || invoice.approvalStatus === "Approved") && invoice.approvalRemarks && (
                                  <p className="mt-1 text-[11px] text-slate-500">Remark: {invoice.approvalRemarks}</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredInvoices.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-2 py-4">
                              <EmptyState
                                title="No invoices in current scope"
                                description="Clear filters or create an invoice from eligible leads."
                                actionLabel="Create Invoice"
                                onAction={() => {
                                  if (invoiceEligibleLeads.length > 0) openInvoiceComposerForLead(invoiceEligibleLeads[0]);
                                  else setError("No Confirmation/Invoice Sent/Won lead available to create invoice.");
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!invoicesCompactMode && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">Collections inbox is now a standalone workspace</p>
                        <p className="text-xs text-indigo-700">Use the Collections Inbox tab to run dunning stages, PTP commitments, delivery tracking, and owner action queues without invoice table noise.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvoiceWorkspaceTab("collections-inbox")}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Open Collections Inbox
                      </button>
                    </div>
                  </div>
                )}

                {!invoicesCompactMode ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Client Invoice Ledger</h3>
                      <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportInvoiceClientLedgerCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Client</th>
                            <th className="px-2 py-2">Invoices</th>
                            <th className="px-2 py-2">Sent</th>
                            <th className="px-2 py-2">Sent %</th>
                            <th className="px-2 py-2">Billed</th>
                            <th className="px-2 py-2">Collected</th>
                            <th className="px-2 py-2">Outstanding</th>
                            <th className="px-2 py-2">Last Sent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceClientLedgerRows.map((row) => (
                            <tr key={row.client} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-800">{row.client}</td>
                              <td className="px-2 py-2">{row.invoices}</td>
                              <td className="px-2 py-2">{row.sent}</td>
                              <td className="px-2 py-2">{formatPercent(row.sentRate)}</td>
                              <td className="px-2 py-2">{formatInr(row.billed)}</td>
                              <td className="px-2 py-2 text-sky-700">{formatInr(row.collected)}</td>
                              <td className="px-2 py-2 text-rose-700">{formatInr(row.outstanding)}</td>
                              <td className="px-2 py-2 text-xs text-slate-500">{formatDateDisplay(row.lastIssueDate)}</td>
                            </tr>
                          ))}
                          {invoiceClientLedgerRows.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-2 py-4 text-slate-500">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>No client ledger data in this scope. Try a wider range or all clients.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInvoiceLeadFilter("All");
                                      setInvoiceClientFilter("All");
                                      setInvoiceStatusFilter("All");
                                      setInvoiceRangePreset("3");
                                      setInvoiceCustomStart("");
                                      setInvoiceCustomEnd("");
                                    }}
                                    className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                  >
                                    Reset Invoice Scope
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Monthly Cumulative Invoice Summary</h3>
                      <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportInvoiceMonthlyCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Month</th>
                            <th className="px-2 py-2">Invoices</th>
                            <th className="px-2 py-2">Sent</th>
                            <th className="px-2 py-2">Billed</th>
                            <th className="px-2 py-2">Collected</th>
                            <th className="px-2 py-2">Cum. Sent</th>
                            <th className="px-2 py-2">Cum. Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceMonthlyRows.map((row) => (
                            <tr key={row.monthKey} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-800">{row.monthLabel}</td>
                              <td className="px-2 py-2">{row.invoices}</td>
                              <td className="px-2 py-2">{row.sent}</td>
                              <td className="px-2 py-2">{formatInr(row.billed)}</td>
                              <td className="px-2 py-2 text-sky-700">{formatInr(row.collected)}</td>
                              <td className="px-2 py-2">{row.cumulativeSent}</td>
                              <td className="px-2 py-2 text-rose-700">{formatInr(row.cumulativeOutstanding)}</td>
                            </tr>
                          ))}
                          {invoiceMonthlyRows.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-2 py-4 text-slate-500">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>No monthly invoice data for selected range.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInvoiceRangePreset("3");
                                      setInvoiceCustomStart("");
                                      setInvoiceCustomEnd("");
                                    }}
                                    className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                  >
                                    Reset Invoice Scope
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Simple mode hides client ledger and monthly cumulative tables. Switch this module to Advanced mode to review detailed invoice intelligence.
                  </div>
                )}
                  </>
                ) : invoiceWorkspaceTab === "collections-inbox" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Standalone Collections Workflow</p>
                          <h3 className="mt-1 text-xl font-semibold text-slate-900">Dunning Board</h3>
                          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                            Dunning helps your team recover outstanding payments using stage-based follow-ups. Move accounts from gentle reminder to escalation without losing promise-to-pay or delivery visibility.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void syncCollectionsDeliveryStatus("manual")}
                          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Sync Delivery Status
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                        {[
                          { label: "D1-D3", tip: "Friendly reminder" },
                          { label: "D4-D7", tip: "Follow-up commitment" },
                          { label: "D8-D15", tip: "Escalation tone" },
                          { label: "D15+", tip: "Manager intervention" },
                        ].map((step) => (
                          <div key={step.label} className="rounded-lg border border-indigo-100 bg-white px-3 py-2">
                            <p className="font-semibold text-slate-800">{step.label}</p>
                            <p className="mt-1 text-slate-500">{step.tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-xs text-slate-500">Outstanding</p>
                        <p className="mt-1 text-2xl font-bold text-rose-700">{formatInr(collectionsOutstandingTotal)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-xs text-slate-500">Overdue invoices</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{invoiceCollectionsQueue.length}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-xs text-slate-500">Open promises</p>
                        <p className="mt-1 text-2xl font-bold text-amber-700">{invoiceMetrics.openPromises}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-xs text-slate-500">Delivery success</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">{formatPercent(collectionsDeliverySuccessRate)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-xs text-slate-500">Failed sends</p>
                        <p className="mt-1 text-2xl font-bold text-rose-600">{collectionsDispatchSummary.failed}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="xl:col-span-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">Collections Action Queue</h4>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">Top overdue first</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="px-2 py-2">Invoice</th>
                                <th className="px-2 py-2">Lead</th>
                                <th className="px-2 py-2">Owner</th>
                                <th className="px-2 py-2">Invoice status</th>
                                <th className="px-2 py-2">Stage</th>
                                <th className="px-2 py-2">Outstanding</th>
                                <th className="px-2 py-2">Last contact</th>
                                <th className="px-2 py-2">Next follow-up</th>
                                <th className="px-2 py-2">Next action</th>
                                <th className="px-2 py-2">Promise</th>
                                <th className="px-2 py-2">Delivery</th>
                                <th className="px-2 py-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoiceCollectionsQueue.slice(0, 30).map((row) => (
                                <tr key={row.invoice.id} className="border-b border-slate-100">
                                  <td className="px-2 py-2">
                                    <p className="font-medium text-slate-800">{row.invoice.invoiceNumber}</p>
                                    <p className="text-slate-500">{row.invoice.billedToCompany}</p>
                                  </td>
                                  <td className="px-2 py-2 text-slate-700">
                                    {row.lead ? (
                                      <>
                                        <p className="font-medium text-slate-800">{row.lead.leadName}</p>
                                        <p className="text-slate-500">{row.lead.leadStatus}</p>
                                      </>
                                    ) : (
                                      <span className="text-slate-400">Lead missing</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-slate-700">{row.owner}</td>
                                  <td className="px-2 py-2 text-slate-700">{row.status}</td>
                                  <td className="px-2 py-2">
                                    <span className={`rounded px-2 py-0.5 ${row.stage === "D15+" ? "bg-rose-100 text-rose-700" : row.stage === "D8-D15" ? "bg-amber-100 text-amber-700" : row.stage === "D4-D7" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                                      {row.stage} ({row.overdueDays}d)
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-rose-700">{formatInr(row.outstanding)}</td>
                                  <td className="px-2 py-2 text-slate-600">{formatDateDisplay(row.lead?.lastContactedDate || "")}</td>
                                  <td className="px-2 py-2 text-slate-600">{formatDateDisplay(row.lead?.nextFollowupDate || "")}</td>
                                  <td className="px-2 py-2 text-slate-600">{dunningPlaybookForStage(row.stage)}</td>
                                  <td className="px-2 py-2 text-slate-600">{row.promiseTag}</td>
                                  <td className="px-2 py-2 text-slate-600">
                                    {row.latestDispatch ? (
                                      <span className={`rounded px-2 py-0.5 ${row.latestDispatch.status === "read" ? "bg-emerald-100 text-emerald-700" : row.latestDispatch.status === "delivered" ? "bg-sky-100 text-sky-700" : row.latestDispatch.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{row.latestDispatch.status}</span>
                                    ) : (
                                      <span className="text-slate-400">Not sent</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      <button type="button" onClick={() => openPromiseModal(row.invoice)} className="rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-200">Set PTP</button>
                                      <button
                                        type="button"
                                        disabled={isSendingReminder}
                                        onClick={() => void sendCollectionsReminder(row.invoice)}
                                        className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {isSendingReminder && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-indigo-500/80 border-t-transparent" />}
                                        Nudge
                                      </button>
                                      {row.lead && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const leadId = row.lead?.id;
                                            if (!leadId) return;
                                            upsertLead(leadId, (lead) => ({ ...lead, nextFollowupDate: todayISODate(), followupStatus: "Pending" }), "Collections follow-up moved to today");
                                          }}
                                          className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                                        >
                                          Follow-up Today
                                        </button>
                                      )}
                                      {row.lead && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const leadId = row.lead?.id;
                                            if (!leadId) return;
                                            setSelectedLeadId(leadId);
                                            setLeadDrawerOpen(true);
                                          }}
                                          className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                                        >
                                          Lead
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {invoiceCollectionsQueue.length === 0 && (
                                <tr>
                                  <td colSpan={12} className="px-2 py-4 text-slate-500">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span>No outstanding invoice dunning actions in this scope.</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInvoiceRangePreset("3");
                                          setInvoiceCustomStart("");
                                          setInvoiceCustomEnd("");
                                          setInvoiceStatusFilter("All");
                                        }}
                                        className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                      >
                                        Reset Dunning Scope
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                          <h4 className="text-sm font-semibold text-slate-900">Stage Exposure</h4>
                          <div className="mt-3 space-y-2 text-xs">
                            {([
                              ["D1-D3", invoiceDunningSummary["D1-D3"]],
                              ["D4-D7", invoiceDunningSummary["D4-D7"]],
                              ["D8-D15", invoiceDunningSummary["D8-D15"]],
                              ["D15+", invoiceDunningSummary["D15+"]],
                            ] as const).map(([label, bucket]) => (
                              <div key={label} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="font-semibold text-slate-700">{label}</p>
                                <p className="mt-0.5 text-slate-500">{bucket.count} invoices</p>
                                <p className="text-rose-700">{formatInr(bucket.amount)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                          <h4 className="text-sm font-semibold text-slate-900">Owner Accountability</h4>
                          <div className="mt-3 space-y-2 text-xs">
                            {collectionsOwnerRows.slice(0, 6).map((row) => (
                              <div key={row.owner} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="font-semibold text-slate-700">{row.owner}</p>
                                <p className="text-slate-500">{row.invoices} invoices | {row.critical} critical</p>
                                <p className="text-rose-700">Outstanding {formatInr(row.outstanding)}</p>
                              </div>
                            ))}
                            {collectionsOwnerRows.length === 0 && <p className="text-slate-500">No owner exposure in current scope.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">Client Master</span>
                        {currentUser.role === "owner" && (
                          <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={clientMasterTenantId} onChange={(e) => setClientMasterTenantId(e.target.value)}>
                            {tenants.map((tenant) => (
                              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                            ))}
                          </select>
                        )}
                        <input
                          className="min-w-[220px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs"
                          placeholder="Search profile, company, contact, email, phone, GSTIN"
                          value={clientMasterSearch}
                          onChange={(e) => setClientMasterSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Import Profiles (CSV)</p>
                          <p className="text-xs text-slate-500">Headers supported: companyName, profileName, contactName, email, phone, billingAddress, billingCity, billingState, billingPincode, shippingAddress, shippingCity, shippingState, shippingPincode, buyerGstin, paymentTermsDays, poNumber, bankBeneficiaryName, bankName, bankAccountNumber, bankIfsc, isDefault.</p>
                        </div>
                        <button type="button" onClick={importCustomerProfilesCsv} className="rounded bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">Import CSV</button>
                      </div>
                      <textarea
                        className="mt-3 h-28 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                        placeholder="Paste CSV data here..."
                        value={clientMasterImportCsv}
                        onChange={(e) => setClientMasterImportCsv(e.target.value)}
                      />
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Duplicate Merge Center</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">Groups: {clientMasterDuplicateGroups.length}</span>
                      </div>
                      <div className="space-y-2">
                        {clientMasterDuplicateGroups.map((group) => (
                          <div key={`${group[0].tenantId}-${group[0].companyName}-${group[0].id}`} className="rounded border border-slate-200 p-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-slate-800">{group[0].companyName} ({group.length} duplicates)</p>
                              <button type="button" onClick={() => mergeCustomerProfileGroup(group)} className="rounded bg-violet-100 px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-200">Merge Group</button>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">Primary retained: {group[0].profileName} (latest update). Others will merge into primary and be removed.</p>
                          </div>
                        ))}
                        {clientMasterDuplicateGroups.length === 0 && <p className="text-xs text-slate-500">No duplicate groups detected for this tenant.</p>}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Profiles ({clientMasterProfiles.length})</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2">Profile</th>
                              <th className="px-2 py-2">Company</th>
                              <th className="px-2 py-2">Contact</th>
                              <th className="px-2 py-2">Terms</th>
                              <th className="px-2 py-2">GSTIN</th>
                              <th className="px-2 py-2">Default</th>
                              <th className="px-2 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientMasterProfiles.map((profile) => (
                              <tr key={profile.id} className="border-b border-slate-100">
                                <td className="px-2 py-2 font-medium text-slate-800">{profile.profileName}</td>
                                <td className="px-2 py-2">{profile.companyName}</td>
                                <td className="px-2 py-2">{profile.contactName || "-"}<br /><span className="text-[11px] text-slate-500">{profile.email || profile.phone || "-"}</span></td>
                                <td className="px-2 py-2">{profile.paymentTermsDays}d</td>
                                <td className="px-2 py-2">{profile.buyerGstin || "-"}</td>
                                <td className="px-2 py-2">{profile.isDefault ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">Yes</span> : "-"}</td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    <button type="button" onClick={() => setCustomerProfileDefault(profile)} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200">Default</button>
                                    <button type="button" onClick={() => removeCustomerProfile(profile)} className="rounded bg-rose-100 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-200">Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {clientMasterProfiles.length === 0 && (
                              <tr>
                                <td className="px-2 py-3 text-slate-500" colSpan={7}>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>No customer profiles for this tenant/filter.</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setClientMasterSearch("");
                                        if (currentTenantId) setClientMasterTenantId(currentTenantId);
                                      }}
                                      className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                    >
                                      Reset Client Master Filters
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </InvoicesPage>
            )}

            {canViewLeads && appView === "sources" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5f651f]">Sources Module</p>
                    <p className="text-xs text-slate-600">{sourcesCompactMode ? "Compact mode focuses on month-level lead visibility." : "Advanced mode includes all source intelligence and conversion depth."}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{sourcesCompactMode ? "Compact" : "Advanced"}</span>
                </div>

                <div className={`grid gap-4 ${sourcesCompactMode ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Current Month Leads</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.currentMonthSourceRow?.total ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-sm text-slate-500">Current Month Won</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{metrics.currentMonthSourceRow?.won ?? 0}</p>
                  </div>
                  {!sourcesCompactMode && (
                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <p className="text-sm text-slate-500">Lead Volume MoM</p>
                      <p className={`mt-2 text-2xl font-bold ${sourcesMoM.className}`}>{sourcesMoM.arrow} {sourcesMoM.value}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">Month Range</span>
                    {(["1", "3", "6", "12", "custom"] as MonthRangePreset[]).map((preset) => (
                      <button key={preset} type="button" onClick={() => setSourcesRangePreset(preset)} className={`rounded px-2 py-1 text-xs ${sourcesRangePreset === preset ? "bg-[#788023] text-white" : "bg-slate-200 text-slate-700"}`}>
                        {preset === "custom" ? "Custom" : `${preset}M`}
                      </button>
                    ))}
                    {sourcesRangePreset === "custom" && (
                      <>
                        <input type="month" className="rounded border border-slate-300 px-2 py-1 text-xs" value={sourcesCustomStart} onChange={(e) => setSourcesCustomStart(e.target.value)} />
                        <span className="text-xs text-slate-500">to</span>
                        <input type="month" className="rounded border border-slate-300 px-2 py-1 text-xs" value={sourcesCustomEnd} onChange={(e) => setSourcesCustomEnd(e.target.value)} />
                      </>
                    )}
                    {(sourcesRangePreset === "1" || sourcesRangePreset === "3") && (
                      <label className="ml-1 inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <input type="checkbox" checked={sourcesComparePrevious} onChange={(e) => setSourcesComparePrevious(e.target.checked)} />
                        Compare vs previous period
                      </label>
                    )}
                  </div>
                  {sourceCompareSummary && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <p className="text-slate-500">Lead Volume ({sourceCompareSummary.currentLabel} vs {sourceCompareSummary.previousLabel})</p>
                        <p className={`mt-1 font-semibold ${sourceCompareSummary.leadTrend.className}`}>{sourceCompareSummary.leadTrend.arrow} {sourceCompareSummary.leadTrend.value}</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <p className="text-slate-500">Won Leads ({sourceCompareSummary.currentLabel} vs {sourceCompareSummary.previousLabel})</p>
                        <p className={`mt-1 font-semibold ${sourceCompareSummary.wonTrend.className}`}>{sourceCompareSummary.wonTrend.arrow} {sourceCompareSummary.wonTrend.value}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{sourcesCompactMode ? "Top 3 Source Trend (Stacked)" : "Monthly Source Summary (Graph)"}</h3>
                      <p className="text-xs text-slate-500">
                        {sourcesCompactMode
                          ? "Basic mode focuses on a stacked trend for top 3 sources only to reduce noise."
                          : "Green bars show total leads, darker bars show won leads inside each month. Hover bars for quick values."}
                      </p>
                    </div>
                    <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportSourceMonthlyCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                  </div>
                  {sourcesCompactMode ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        {sourceBasicTop3.map((source, index) => {
                          const colors = ["bg-[#788023]", "bg-[#a3ad4a]", "bg-[#ced6a3]"];
                          return (
                            <span key={source} className="inline-flex items-center gap-1">
                              <span className={`h-2.5 w-2.5 rounded-full ${colors[index] ?? "bg-slate-300"}`} />
                              {source}
                            </span>
                          );
                        })}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Top 3 sources only</span>
                      </div>
                      {sourceRowsForView.length > 0 && sourceBasicTop3.length > 0 ? (
                        <div className="space-y-3">
                          {sourceRowsForView.map((row) => {
                            const total = Math.max(row.total, 1);
                            const colors = ["bg-[#788023]", "bg-[#a3ad4a]", "bg-[#ced6a3]"];
                            return (
                              <div key={row.monthKey} className="rounded-xl border border-slate-200 p-3">
                                <div className="mb-2 flex items-center justify-between text-xs">
                                  <p className="font-semibold text-slate-800">{row.monthLabel}</p>
                                  <p className="text-slate-600">Total {row.total}</p>
                                </div>
                                <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" title={`${row.monthLabel}: ${sourceBasicTop3.map((source) => `${source} ${row.bySource[source]?.count ?? 0}`).join(" | ")}`}>
                                  {sourceBasicTop3.map((source, index) => {
                                    const count = row.bySource[source]?.count ?? 0;
                                    const width = (count / total) * 100;
                                    return (
                                      <button
                                        key={source}
                                        type="button"
                                        onClick={() => setSourceDrilldown({ source, monthKey: row.monthKey })}
                                        className={`${colors[index] ?? "bg-slate-300"} h-4`}
                                        style={{ width: `${width}%` }}
                                        title={`${row.monthLabel}: ${source} (${count})`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                                  {sourceBasicTop3.map((source) => (
                                    <span key={source}>{source}: {row.bySource[source]?.count ?? 0}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          title="No source trend in this range"
                          description="Try a wider month range or include empty months to inspect source momentum."
                          actionLabel="Reset Source Scope"
                          onAction={() => {
                            setSourcesRangePreset("3");
                            setSourcesCustomStart("");
                            setSourcesCustomEnd("");
                            setSourcesComparePrevious(false);
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
                          Total Leads
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                          Won Leads
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Hover bars to view exact values</span>
                      </div>
                      {sourceRowsForView.length > 0 ? (
                        <div className="space-y-3">
                          {sourceRowsForView.map((row, index) => {
                            const trend = getTrend(row.total, index > 0 ? sourceRowsForView[index - 1].total : 0);
                            const maxTotal = Math.max(...sourceRowsForView.map((entry) => entry.total), 1);
                            const totalWidth = Math.max((row.total / maxTotal) * 100, row.total > 0 ? 4 : 0);
                            const wonWidth = row.total ? Math.max((row.won / row.total) * totalWidth, row.won > 0 ? 2 : 0) : 0;
                            return (
                              <div key={row.monthKey} className="rounded-xl border border-slate-200 p-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-800">{row.monthLabel}</p>
                                    <span className={`font-medium ${trend.className}`}>{trend.arrow} {trend.value}</span>
                                  </div>
                                  <p className="text-slate-600">Top: {row.topSource}</p>
                                </div>
                                <div className="h-4 w-full rounded-full bg-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setSourceDrilldown({ source: null, monthKey: row.monthKey })}
                                    className="group relative h-4 rounded-full bg-emerald-200"
                                    style={{ width: `${totalWidth}%` }}
                                    title={`${row.monthLabel}: Total Leads ${row.total}`}
                                  >
                                    <div
                                      className="absolute left-0 top-0 h-4 rounded-full bg-emerald-600"
                                      style={{ width: `${wonWidth}%` }}
                                      title={`${row.monthLabel}: Won Leads ${row.won}`}
                                    />
                                    <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-sm group-hover:block">
                                      Total {row.total} | Won {row.won}
                                    </div>
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                  <span>Total: {row.total}</span>
                                  <span className="text-emerald-700">Won: {row.won}</span>
                                  <span>{row.total ? ((row.won / row.total) * 100).toFixed(1) : "0.0"}% conversion</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          title="No source trend in this range"
                          description="Adjust the selected range to view monthly lead and win movement."
                          actionLabel="Reset Source Scope"
                          onAction={() => {
                            setSourcesRangePreset("3");
                            setSourcesCustomStart("");
                            setSourcesCustomEnd("");
                            setSourcesComparePrevious(false);
                          }}
                        />
                      )}
                    </>
                  )}
                </div>

                {sourcesCompactMode ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Advanced insights are hidden in Basic mode. Switch to Advanced to view all-time source performance by channel.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Source Performance (All-time Graph)</h3>
                        <p className="text-xs text-slate-500">Each row shows lead volume with won share overlay. Hover bars for quick values.</p>
                      </div>
                      <button type="button" disabled={!canUseExports || isExportingCsv} onClick={exportSourceAllTimeCsv} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{isExportingCsv && <LoadingSpinner className="h-3 w-3 border-[1.5px] border-slate-500/80 border-t-transparent" />}{isExportingCsv ? "Exporting..." : "Export CSV"}</button>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#cfd8a4]" />
                        Total Leads
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#788023]" />
                        Won Leads
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Hover bars to view exact values</span>
                    </div>
                    {sourceRows.length > 0 ? (
                      <div className="space-y-3">
                        {(() => {
                          const maxCount = Math.max(...sourceRows.map((row) => row.count), 1);
                          return sourceRows.map((row) => {
                            const totalWidth = Math.max((row.count / maxCount) * 100, row.count > 0 ? 4 : 0);
                            const wonWidth = row.count ? Math.max((row.won / row.count) * totalWidth, row.won > 0 ? 2 : 0) : 0;
                            return (
                              <div key={row.source} className="rounded-xl border border-slate-200 p-3">
                                <div className="mb-2 flex items-center justify-between text-xs">
                                  <p className="font-semibold text-slate-800">{row.source}</p>
                                  <p className="text-slate-600">{row.count} leads | {row.won} won | {row.conversion.toFixed(1)}%</p>
                                </div>
                                <div className="h-4 w-full rounded-full bg-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setSourceDrilldown({ source: row.source, monthKey: null })}
                                    className="group relative h-4 rounded-full bg-[#cfd8a4]"
                                    style={{ width: `${totalWidth}%` }}
                                    title={`${row.source}: Total Leads ${row.count}`}
                                  >
                                    <div
                                      className="absolute left-0 top-0 h-4 rounded-full bg-[#788023]"
                                      style={{ width: `${wonWidth}%` }}
                                      title={`${row.source}: Won Leads ${row.won}`}
                                    />
                                    <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-sm group-hover:block">
                                      Total {row.count} | Won {row.won}
                                    </div>
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>No source performance data available in this scope.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSourcesRangePreset("3");
                              setSourcesCustomStart("");
                              setSourcesCustomEnd("");
                              setSourcesComparePrevious(false);
                            }}
                            className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                          >
                            Reset Source Scope
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sourceDrilldown && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Source Drill-down</p>
                        <p className="text-xs text-slate-500">
                          Source: {sourceDrilldown.source ?? "All Sources"}
                          {sourceDrilldown.monthKey ? ` | Month: ${sourceDrilldown.monthKey}` : " | All months"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSourceDrilldown(null)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="px-2 py-2">Lead</th>
                            <th className="px-2 py-2">Company</th>
                            <th className="px-2 py-2">Source</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Added</th>
                            <th className="px-2 py-2">Owner</th>
                            <th className="px-2 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceDrilldownLeads.slice(0, 100).map((lead) => (
                            <tr key={`source-drill-${lead.id}`} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-medium text-slate-800">{lead.leadName}</td>
                              <td className="px-2 py-2">{lead.companyName}</td>
                              <td className="px-2 py-2">{lead.leadSource}</td>
                              <td className="px-2 py-2">{lead.leadStatus}</td>
                              <td className="px-2 py-2">{lead.dateAdded}</td>
                              <td className="px-2 py-2">{lead.assignedTo || "Unassigned"}</td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLeadId(lead.id);
                                    setLeadDrawerOpen(true);
                                  }}
                                  className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
                                >
                                  Open Lead
                                </button>
                              </td>
                            </tr>
                          ))}
                          {sourceDrilldownLeads.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-2 py-3 text-slate-500">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>No leads found for this source slice.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSourceDrilldown(null);
                                      setSourcesRangePreset("3");
                                      setSourcesCustomStart("");
                                      setSourcesCustomEnd("");
                                      setSourcesComparePrevious(false);
                                    }}
                                    className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                                  >
                                    Reset Source Scope
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(currentUser.role === "admin" || currentUser.role === "owner") && appView === "users" && (
              <UsersPage>
                <UsersWorkspaceHeader
                  usersTab={usersTab}
                  isOwner={isOwner}
                  usersContextTenantName={usersContextTenant?.name ?? null}
                  usersContextTenantStatus={usersContextTenant ? tenantLifecycle(usersContextTenant).status : null}
                  onUsersTabChange={setUsersTab}
                />

                {usersTab === "licensees" && (
                  <div className="space-y-4">
                    {isOwner && (
                      <form onSubmit={createWorkspace} className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">Create Licensee</h3>
                            <p className="mt-1 text-xs text-slate-500">3-step setup for tenant, plan, and admin login.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3].map((step) => (
                              <button
                                key={`wizard-step-${step}`}
                                type="button"
                                onClick={() => {
                                  resetMessages();
                                  if (step <= createLicenseeStep) {
                                    setCreateLicenseeStep(step as 1 | 2 | 3);
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${createLicenseeStep === step ? "bg-[#788023] text-white" : step < createLicenseeStep ? "bg-[#e8ecd0] text-[#55610f]" : "bg-slate-100 text-slate-500"}`}
                              >
                                Step {step}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <div className="space-y-4 lg:col-span-2">
                            {createLicenseeStep === 1 && (
                              <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1: Basics</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label className="text-xs text-slate-500">
                                    Licensee Name
                                    <input
                                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                      placeholder="Example: Acme Consulting"
                                      value={newWorkspaceName}
                                      onChange={(e) => {
                                        const nextName = e.target.value;
                                        setNewWorkspaceName(nextName);
                                        if (!isWorkspaceUrlNameManual) {
                                          setNewWorkspaceSlug(slugifyWorkspace(nextName));
                                        }
                                      }}
                                    />
                                  </label>
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p>
                                        <span className="font-semibold text-slate-800">Workspace URL Name:</span>{" "}
                                        {newWorkspaceSlug || "Auto-generated from business name"}
                                      </p>
                                      <button
                                        type="button"
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                        onClick={() => setShowWorkspaceUrlNameEditor((prev) => !prev)}
                                      >
                                        {showWorkspaceUrlNameEditor ? "Hide" : "Customize"}
                                      </button>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500">This is your internal workspace identifier. Example: yugamchennai</p>
                                  </div>
                                  {showWorkspaceUrlNameEditor && (
                                    <label className="text-xs text-slate-500 md:col-span-2">
                                      Workspace URL Name
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <input
                                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:flex-1"
                                          placeholder="example: acme-consulting"
                                          value={newWorkspaceSlug}
                                          onChange={(e) => {
                                            setIsWorkspaceUrlNameManual(true);
                                            setNewWorkspaceSlug(slugifyWorkspace(e.target.value));
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                          onClick={() => {
                                            setIsWorkspaceUrlNameManual(false);
                                            setNewWorkspaceSlug(slugifyWorkspace(newWorkspaceName));
                                          }}
                                        >
                                          Use Auto
                                        </button>
                                      </div>
                                      <p className="mt-1 text-[11px] text-slate-500">Only lowercase letters, numbers, and hyphens are allowed.</p>
                                    </label>
                                  )}
                                  <label className="text-xs text-slate-500 md:col-span-2">
                                    Subscription Package
                                    <select
                                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                      value={newWorkspaceProductMode}
                                      onChange={(e) => applyCreatePackagePreset(e.target.value as ProductMode)}
                                    >
                                      <option value="lite">Follow-up Lite (Daily Follow-ups Only)</option>
                                      <option value="pro">Lead Tracker Pro (CRM without invoicing)</option>
                                      <option value="full">Full Suite (CRM + Invoicing)</option>
                                    </select>
                                  </label>
                                  <label className="text-xs text-slate-500 md:col-span-2">
                                    License Term
                                    <select
                                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                      value={newWorkspaceLicenseTerm}
                                      onChange={(e) => setNewWorkspaceLicenseTerm(e.target.value as LicenseTermPreset)}
                                    >
                                      <option value="annual">Standard (1 year)</option>
                                      <option value="trial15">Trial (15 days)</option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            )}

                            {createLicenseeStep === 2 && (
                              <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2: Plan</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label className="text-xs text-slate-500 md:col-span-2">
                                    Plan Template
                                    <select
                                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                      value={newWorkspacePlanChoice}
                                      onChange={(e) => {
                                        setNewWorkspacePlanChoice(e.target.value);
                                        setCustomizeCreateEntitlements(e.target.value === CUSTOM_PLAN_ID);
                                      }}
                                    >
                                      {activePlanTemplates.map((template) => (
                                        <option key={template.id} value={template.id}>
                                          {template.name}
                                        </option>
                                      ))}
                                      <option value={CUSTOM_PLAN_ID}>Custom</option>
                                    </select>
                                  </label>

                                  {newWorkspacePlanChoice !== CUSTOM_PLAN_ID && (() => {
                                    const selectedTemplate = activePlanTemplates.find((template) => template.id === newWorkspacePlanChoice);
                                    if (!selectedTemplate) return null;
                                    return (
                                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 md:col-span-2">
                                        <p className="font-semibold text-slate-900">{selectedTemplate.name} pricing preview</p>
                                        <p className="mt-1">₹ {selectedTemplate.monthlyPriceInr.toLocaleString("en-IN")} / month</p>
                                        <p className="mt-1 text-slate-500">{selectedTemplate.offerLabel || selectedTemplate.description}</p>
                                      </div>
                                    );
                                  })()}

                                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2">
                                    <input type="checkbox" checked={customizeCreateEntitlements || newWorkspacePlanChoice === CUSTOM_PLAN_ID} onChange={(e) => setCustomizeCreateEntitlements(e.target.checked)} disabled={newWorkspacePlanChoice === CUSTOM_PLAN_ID} />
                                    Customize limits for this client
                                  </label>

                                  {(customizeCreateEntitlements || newWorkspacePlanChoice === CUSTOM_PLAN_ID) && (
                                    <>
                                      <label className="text-xs text-slate-500">
                                        Plan Name
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspacePlanName} onChange={(e) => setNewWorkspacePlanName(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Max Users
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} value={newWorkspaceMaxUsers} onChange={(e) => setNewWorkspaceMaxUsers(Number(e.target.value) || 1)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Max Leads / Month
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} value={newWorkspaceMaxLeads} onChange={(e) => setNewWorkspaceMaxLeads(Number(e.target.value) || 1)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Grace Days
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={newWorkspaceGraceDays} onChange={(e) => setNewWorkspaceGraceDays(Number(e.target.value) || 0)} />
                                      </label>
                                      <label className="text-xs text-slate-500 md:col-span-2">
                                        Audit Retention Days
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={30} value={newWorkspaceAuditRetention} onChange={(e) => setNewWorkspaceAuditRetention(Number(e.target.value) || 30)} />
                                      </label>
                                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <input type="checkbox" checked={newWorkspaceFeatureExports} onChange={(e) => setNewWorkspaceFeatureExports(e.target.checked)} />
                                        Enable Exports
                                      </label>
                                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <input type="checkbox" checked={newWorkspaceFeatureForecast} onChange={(e) => setNewWorkspaceFeatureForecast(e.target.checked)} />
                                        Enable Advanced Forecast
                                      </label>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {createLicenseeStep === 3 && (
                              <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3: Tenant Admin</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label className="text-xs text-slate-500">
                                    Admin Name
                                    <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Primary admin full name" value={workspaceAdminName} onChange={(e) => setWorkspaceAdminName(e.target.value)} />
                                  </label>
                                  <label className="text-xs text-slate-500">
                                    Admin Email
                                    <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="admin@licensee.com" type="email" value={workspaceAdminEmail} onChange={(e) => setWorkspaceAdminEmail(e.target.value)} />
                                  </label>
                                  <label className="text-xs text-slate-500 md:col-span-2">
                                    Admin Password
                                    <PasswordField
                                      value={workspaceAdminPassword}
                                      onChange={setWorkspaceAdminPassword}
                                      placeholder="Set a strong password"
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-16 text-sm"
                                      containerClassName="relative mt-1"
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => setShowCreateAdvancedSettings((prev) => !prev)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 md:col-span-2"
                                  >
                                    {showCreateAdvancedSettings ? "Hide Advanced Settings" : "Show Advanced Settings"}
                                  </button>

                                  {showCreateAdvancedSettings && (
                                    <>
                                      <label className="text-xs text-slate-500 md:col-span-2">
                                        Invoice Compliance Mode
                                        <select
                                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                          value={newWorkspaceRequireGstCompliance ? "strict-gst" : "flexible"}
                                          disabled={!newWorkspaceFeatureInvoicing}
                                          onChange={(e) => setNewWorkspaceRequireGstCompliance(e.target.value === "strict-gst")}
                                        >
                                          <option value="strict-gst">Strict GST (GST fields mandatory)</option>
                                          <option value="flexible">Flexible (non-GST invoices allowed)</option>
                                        </select>
                                      </label>
                                      {!newWorkspaceFeatureInvoicing && (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:col-span-2">
                                          Invoicing is disabled for this package. You can still create the licensee now and enable invoicing later from client entitlements.
                                        </div>
                                      )}
                                      {newWorkspaceFeatureInvoicing && (
                                        <>
                                      <label className="text-xs text-slate-500">
                                        Issuer Legal Name
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoiceLegalName} onChange={(e) => setNewWorkspaceInvoiceLegalName(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Issuer Email
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="email" value={newWorkspaceInvoiceEmail} onChange={(e) => setNewWorkspaceInvoiceEmail(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Issuer Phone
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoicePhone} onChange={(e) => setNewWorkspaceInvoicePhone(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        Pincode
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoicePincode} onChange={(e) => setNewWorkspaceInvoicePincode(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500 md:col-span-2">
                                        Address
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoiceAddress} onChange={(e) => setNewWorkspaceInvoiceAddress(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        City
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoiceCity} onChange={(e) => setNewWorkspaceInvoiceCity(e.target.value)} />
                                      </label>
                                      <label className="text-xs text-slate-500">
                                        State
                                        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newWorkspaceInvoiceState} onChange={(e) => setNewWorkspaceInvoiceState(e.target.value)} />
                                      </label>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-submit Checklist</p>
                                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${createLicenseeChecklist.canSubmit ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {createLicenseeChecklist.requiredDone}/{createLicenseeChecklist.requiredTotal} ready
                                    </span>
                                  </div>
                                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                    {createLicenseeChecklist.items.map((item) => (
                                      <li key={item.id} className="flex items-start gap-2">
                                        <span className={`mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                                          {item.done ? "OK" : "-"}
                                        </span>
                                        <span>
                                          {item.label}
                                          {item.required ? "" : " (optional)"}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  resetMessages();
                                  setCreateLicenseeStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev));
                                }}
                                disabled={createLicenseeStep === 1}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Back
                              </button>
                              {createLicenseeStep < 3 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetMessages();
                                    if (validateCreateLicenseeStep(createLicenseeStep)) {
                                      setCreateLicenseeStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
                                    }
                                  }}
                                  className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]"
                                >
                                  Continue
                                </button>
                              ) : (
                                <button
                                  type="submit"
                                  disabled={!createLicenseeChecklist.canSubmit}
                                  className="rounded-lg bg-[#5f56d3] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f47b9] disabled:cursor-not-allowed disabled:opacity-50"
                                  title={!createLicenseeChecklist.canSubmit ? "Complete the pre-submit checklist before creating licensee." : undefined}
                                >
                                  Create Licensee
                                </button>
                              )}
                            </div>
                          </div>

                          <aside className="rounded-xl border border-[#d6daac] bg-[#f7f8eb] p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#788023]">Live Summary</p>
                            <div className="mt-3 space-y-2 text-xs text-slate-700">
                              <p><span className="font-semibold text-slate-900">Client:</span> {newWorkspaceName.trim() || "Not set"}</p>
                              <p><span className="font-semibold text-slate-900">Workspace URL Name:</span> {(newWorkspaceSlug || slugifyWorkspace(newWorkspaceName) || "Auto-generated")}</p>
                              <p><span className="font-semibold text-slate-900">Package:</span> {PRODUCT_MODE_LABELS[newWorkspaceProductMode]}</p>
                              <p><span className="font-semibold text-slate-900">Template:</span> {newWorkspacePlanChoice === CUSTOM_PLAN_ID ? "Custom" : (activePlanTemplates.find((template) => template.id === newWorkspacePlanChoice)?.name ?? "Custom")}</p>
                              <p><span className="font-semibold text-slate-900">Price Band:</span> {(() => {
                                const selectedTemplate = activePlanTemplates.find((template) => template.id === newWorkspacePlanChoice);
                                if (!selectedTemplate) return "Custom";
                                return `₹ ${selectedTemplate.monthlyPriceInr.toLocaleString("en-IN")} / month`;
                              })()}</p>
                              <p><span className="font-semibold text-slate-900">License:</span> {newWorkspaceLicenseTerm === "trial15" ? `${DEFAULT_TRIAL_DAYS}-day trial` : "1 year"}</p>
                              <p><span className="font-semibold text-slate-900">Max users:</span> {newWorkspaceMaxUsers}</p>
                              <p><span className="font-semibold text-slate-900">Leads/month:</span> {newWorkspaceMaxLeads}</p>
                              <p><span className="font-semibold text-slate-900">Invoicing:</span> {newWorkspaceFeatureInvoicing ? "Enabled" : "Disabled"}</p>
                              <p><span className="font-semibold text-slate-900">Admin login:</span> {workspaceAdminEmail.trim() || "Not set"}</p>
                            </div>
                          </aside>
                        </div>
                      </form>
                    )}

                    {isOwner && (
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Selected Client</h3>
                        <p className="mt-1 text-xs text-slate-500">Overview and Selected Client Entitlements below always use this client.</p>
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <label className="text-sm font-medium text-slate-700">
                            Choose Client
                            <select
                              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={selectedUsersTenantId}
                              onChange={(e) => setSelectedUsersTenantId(e.target.value)}
                            >
                              {manageableTenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => setUsersTab("tenant-users")}
                            className="rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
                          >
                            Manage Selected Client Users
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedTenantControl && (
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">Licensee Overview: {selectedTenantControl.tenant.name}</h3>
                            <p className="text-xs text-slate-500">Control tower for license, usage, and health.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setUsersTab("tenant-users")} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">Manage Users</button>
                            {isOwner && (
                              <button type="button" onClick={() => setTenants((prev) => prev.map((row) => (row.id === selectedTenantControl.tenant.id ? { ...row, licenseEndDate: oneYearFrom(row.licenseEndDate), isActive: true } : row)))} className="rounded bg-slate-200 px-2 py-1 text-xs">Renew +1Y</button>
                            )}
                            {isOwner && (
                              <button type="button" onClick={() => setTenants((prev) => prev.map((row) => (row.id === selectedTenantControl.tenant.id ? { ...row, isActive: !row.isActive } : row)))} className={`rounded px-2 py-1 text-xs ${selectedTenantControl.tenant.isActive ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {selectedTenantControl.tenant.isActive ? "Suspend" : "Resume"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Status</p><p className="text-sm font-semibold text-slate-900">{selectedTenantControl.lifecycle.status}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Days to Expiry</p><p className="text-sm font-semibold text-slate-900">{selectedTenantControl.lifecycle.daysToExpiry}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Seats Used</p><p className="text-sm font-semibold text-slate-900">{selectedTenantControl.usage.activeUsers}/{selectedTenantControl.tenant.maxUsers}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Leads This Month</p><p className="text-sm font-semibold text-slate-900">{selectedTenantControl.leadsThisMonth}/{selectedTenantControl.tenant.maxLeadsPerMonth}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Health Score</p><p className={`text-sm font-semibold ${selectedTenantControl.healthBand === "green" ? "text-emerald-700" : selectedTenantControl.healthBand === "yellow" ? "text-amber-700" : "text-rose-700"}`}>{selectedTenantControl.healthScore} ({selectedTenantControl.healthBand.toUpperCase()})</p></div>
                        </div>
                      </div>
                    )}

                    {isOwner && selectedTenantControl && (
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Selected Client Entitlements ({selectedTenantControl.tenant.name})</h3>
                        <p className="mt-1 text-xs text-slate-500">Create Licensee sets defaults. Use this section only to adjust limits and features for this selected client.</p>
                        {(() => {
                          const tenant = selectedTenantControl.tenant;
                          const draft = tenantDrafts[tenant.id] ?? toTenantDraft(tenant);
                          return (
                            <div className="mt-3 space-y-3">
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                  <p className="text-slate-500">Client</p>
                                  <p className="mt-1 font-medium text-slate-800">{tenant.name}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                  <p className="text-slate-500">Current Plan</p>
                                  <p className="mt-1 font-medium text-slate-800">{tenant.planName}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                  <p className="text-slate-500">Template Link</p>
                                  <p className="mt-1 font-medium text-slate-800">{tenant.planTemplateId ? (planTemplateById[tenant.planTemplateId]?.name ?? "Custom") : "Custom"}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                  <p className="text-slate-500">Package</p>
                                  <p className="mt-1 font-medium text-slate-800">{PRODUCT_MODE_LABELS[tenant.productMode]}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {PLAN_PRESET_OPTIONS.map((preset) => (
                                  <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => applyPlanPreset(tenant, preset.key)}
                                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                                <select
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    applyTemplateToTenantDraft(tenant, e.target.value);
                                    e.currentTarget.value = "";
                                  }}
                                >
                                  <option value="" disabled>
                                    Apply Saved Template
                                  </option>
                                  {activePlanTemplates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                              <label className="text-xs text-slate-500">Max Users
                                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} value={draft.maxUsers} onChange={(e) => upsertTenantDraft(tenant, { maxUsers: Number(e.target.value) || 1 })} />
                              </label>
                              <label className="text-xs text-slate-500">Max Leads / Month
                                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} value={draft.maxLeadsPerMonth} onChange={(e) => upsertTenantDraft(tenant, { maxLeadsPerMonth: Number(e.target.value) || 1 })} />
                              </label>
                              <label className="text-xs text-slate-500">Grace Days
                                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} value={draft.graceDays} onChange={(e) => upsertTenantDraft(tenant, { graceDays: Number(e.target.value) || 0 })} />
                              </label>
                              <label className="text-xs text-slate-500">Audit Retention (Days)
                                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={30} value={draft.auditRetentionDays} onChange={(e) => upsertTenantDraft(tenant, { auditRetentionDays: Number(e.target.value) || 30 })} />
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                <input type="checkbox" checked={draft.featureExports} onChange={(e) => upsertTenantDraft(tenant, { featureExports: e.target.checked })} />
                                Exports
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                <input type="checkbox" checked={draft.featureAdvancedForecast} onChange={(e) => upsertTenantDraft(tenant, { featureAdvancedForecast: e.target.checked })} />
                                Advanced Forecast
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2">
                                <input type="checkbox" checked={draft.featureInvoicing} onChange={(e) => upsertTenantDraft(tenant, { featureInvoicing: e.target.checked })} />
                                Invoicing Suite (Full package)
                              </label>
                              <label className="text-xs text-slate-500 md:col-span-2">Invoice Compliance Mode
                                <select
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                  value={draft.requireGstCompliance ? "strict-gst" : "flexible"}
                                  disabled={!draft.featureInvoicing}
                                  onChange={(e) => upsertTenantDraft(tenant, { requireGstCompliance: e.target.value === "strict-gst" })}
                                >
                                  <option value="strict-gst">Strict GST (GST fields mandatory)</option>
                                  <option value="flexible">Flexible (non-GST invoices allowed)</option>
                                </select>
                              </label>
                              <div className="md:col-span-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => saveTenantDraft(tenant)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save Entitlements</button>
                                  <button
                                    type="button"
                                    onClick={() => setTenantDrafts((prev) => ({ ...prev, [tenant.id]: toTenantDraft(tenant) }))}
                                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                                  >
                                    Reset Changes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveTenantDraftAsTemplate(tenant)}
                                    className="rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
                                  >
                                    Save as Template
                                  </button>
                                </div>
                              </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {usersTab === "tenant-users" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-end gap-3">
                        {isOwner ? (
                          <label className="text-sm font-medium text-slate-700">
                            Select Licensee
                            <select className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" value={selectedUsersTenantId} onChange={(e) => setSelectedUsersTenantId(e.target.value)}>
                              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                            </select>
                          </label>
                        ) : (
                          <p className="text-sm text-slate-700">Licensee: <span className="font-semibold">{usersTenantScope?.name}</span></p>
                        )}
                        <p className="text-xs text-slate-500">All user actions in this tab apply only to the selected licensee.</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <h3 className="text-lg font-semibold">Lead Intake Flow ({usersTenantScope?.name ?? "-"})</h3>
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={scopedSettings.autoMoveNewToContacted} onChange={(e) => setSettingsByTenant((prev) => ({ ...prev, [usersTenantScopeId]: { ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS), autoMoveNewToContacted: e.target.checked } }))} />
                        Auto-move new leads to Contacted
                      </label>
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={scopedSettings.promptExpectedClosingOnQualified} onChange={(e) => setSettingsByTenant((prev) => ({ ...prev, [usersTenantScopeId]: { ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS), promptExpectedClosingOnQualified: e.target.checked } }))} />
                        Prompt expected closing date when status moves to Qualified (Proposal Sent/Negotiation always require it)
                      </label>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">
                          SLA Escalation Threshold (days)
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            type="number"
                            min={1}
                            value={scopedSettings.slaEscalationDays}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  slaEscalationDays: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={scopedSettings.reminderWebhookEnabled}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  reminderWebhookEnabled: e.target.checked,
                                },
                              }))
                            }
                          />
                          Enable reminder webhook dispatch
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                          Collections Reminder Channel
                          <select
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={scopedSettings.collectionsChannel}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  collectionsChannel: e.target.value as CollectionsChannel,
                                },
                              }))
                            }
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="email">Email</option>
                            <option value="both">WhatsApp + Email</option>
                          </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                          WhatsApp Provider
                          <select
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={scopedSettings.whatsappProvider}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  whatsappProvider: e.target.value as WhatsAppProvider,
                                },
                              }))
                            }
                          >
                            {WHATSAPP_PROVIDER_OPTIONS.map((provider) => (
                              <option key={provider} value={provider}>{provider}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700 md:col-span-2">
                          WhatsApp Template Name
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={scopedSettings.whatsappTemplateName}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  whatsappTemplateName: e.target.value,
                                },
                              }))
                            }
                            placeholder="invoice_payment_reminder"
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                          <input
                            type="checkbox"
                            checked={scopedSettings.deliverySyncEnabled}
                            onChange={(e) =>
                              setSettingsByTenant((prev) => ({
                                ...prev,
                                [usersTenantScopeId]: {
                                  ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                  deliverySyncEnabled: e.target.checked,
                                },
                              }))
                            }
                          />
                          Auto-sync WhatsApp delivery status
                        </label>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Approval Delegation</p>
                          <p className="mt-1 text-xs text-slate-500">Allow a temporary approver to approve/reject pending invoices for this client.</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                              Delegated Approver
                              <select
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                                value={scopedSettings.delegatedApproverUserId}
                                onChange={(e) =>
                                  setSettingsByTenant((prev) => ({
                                    ...prev,
                                    [usersTenantScopeId]: {
                                      ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                      delegatedApproverUserId: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">No temporary approver</option>
                                {tenantScopedUsers
                                  .filter((user) => user.isActive && !user.isBreakGlass)
                                  .map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name} ({user.role})
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Delegation End Date
                              <input
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                                type="date"
                                value={scopedSettings.delegationEndsAt}
                                min={todayISODate()}
                                onChange={(e) =>
                                  setSettingsByTenant((prev) => ({
                                    ...prev,
                                    [usersTenantScopeId]: {
                                      ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                      delegationEndsAt: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                          {scopedSettings.delegatedApproverUserId && scopedSettings.delegationEndsAt && (
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsByTenant((prev) => ({
                                  ...prev,
                                  [usersTenantScopeId]: {
                                    ...(prev[usersTenantScopeId] ?? DEFAULT_APP_SETTINGS),
                                    delegatedApproverUserId: "",
                                    delegationEndsAt: "",
                                  },
                                }))
                              }
                              className="mt-2 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
                            >
                              Clear delegation
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Use VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL for dispatch and VITE_COLLECTIONS_STATUS_WEBHOOK_URL for delivery sync updates.</p>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">Pipeline WIP Limits ({usersTenantScope?.name ?? "-"})</h3>
                          <p className="mt-1 text-xs text-slate-500">Configure daily WIP thresholds by stage for this client.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPipelineWipLimitsByTenant((prev) => ({
                              ...prev,
                              [usersTenantScopeId]: normalizePipelineWipLimits(PIPELINE_WIP_LIMITS),
                            }))
                          }
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Reset Defaults
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {PIPELINE_WIP_CONFIGURABLE_STATUSES.map((status) => (
                          <label key={`wip-${status}`} className="text-sm font-medium text-slate-700">
                            {status}
                            <input
                              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              type="number"
                              min={1}
                              value={scopedPipelineWipLimits[status] ?? ""}
                              onChange={(e) => {
                                const nextValue = Math.max(1, Number(e.target.value) || 1);
                                setPipelineWipLimitsByTenant((prev) => ({
                                  ...prev,
                                  [usersTenantScopeId]: {
                                    ...normalizePipelineWipLimits(prev[usersTenantScopeId]),
                                    [status]: nextValue,
                                  },
                                }));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <form onSubmit={createUser} className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Invite User</h3>
                        <p className="mt-1 text-xs text-slate-500">User will be created under {usersTenantScope?.name ?? "selected licensee"}.</p>
                        <div className="mt-3 grid gap-3">
                          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                          <PasswordField
                            value={newUserPassword}
                            onChange={setNewUserPassword}
                            placeholder="Password"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            containerClassName="flex items-center gap-2"
                          />
                          <select
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={newUserRole}
                            onChange={(e) => {
                              const nextRole = e.target.value as UserRole;
                              setNewUserRole(nextRole);
                              if (nextRole !== "sales") {
                                setNewUserProfile("operations");
                                setNewUserScope("all");
                                setNewUserCanAccessPipeline(true);
                                setNewUserCanAccessFollowups(true);
                              } else {
                                setNewUserProfile("sales");
                                setNewUserScope("assigned");
                                setNewUserCanAccessPipeline(true);
                                setNewUserCanAccessFollowups(true);
                              }
                            }}
                          >
                            <option value="sales">Sales</option>
                            <option value="admin">Admin</option>
                            {isOwner && <option value="owner">Owner</option>}
                          </select>
                          <select
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={newUserProfile}
                            onChange={(e) => {
                              const nextProfile = e.target.value as StaffProfile;
                              setNewUserProfile(nextProfile);
                              if (nextProfile === "collections") {
                                setNewUserScope("none");
                                setNewUserCanAccessPipeline(false);
                                setNewUserCanAccessFollowups(false);
                              } else if (nextProfile === "followup") {
                                setNewUserCanAccessPipeline(false);
                                setNewUserCanAccessFollowups(true);
                              } else if (newUserScope === "none") {
                                setNewUserScope("assigned");
                              }
                            }}
                            disabled={newUserRole !== "sales"}
                          >
                            {staffProfilesForTenant.map((profile) => (
                              <option key={profile} value={profile}>
                                {STAFF_PROFILE_LABELS[profile]} Profile
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500">Profile: {STAFF_PROFILE_LABELS[selectedCreateProfile]}</p>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-700">Permission Matrix</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {staffProfilesForTenant.map((profile) => (
                                <span key={`create-profile-matrix-${profile}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                                  {STAFF_PROFILE_LABELS[profile]}
                                  <StaffPermissionTooltip profile={profile} mode={usersTenantScope?.productMode ?? "full"} invoicingEnabled={usersTenantScope?.featureInvoicing ?? false} />
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">Access preview: {createProfileHint}</p>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-medium text-slate-700">Member Workflow Access</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-[#788023]"
                                  checked={newUserCanAccessPipeline}
                                  disabled={newUserRole !== "sales" || ["followup", "collections"].includes(selectedCreateProfile)}
                                  onChange={(e) => setNewUserCanAccessPipeline(e.target.checked)}
                                />
                                Pipeline Access
                              </label>
                              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-[#788023]"
                                  checked={newUserCanAccessFollowups}
                                  disabled={newUserRole !== "sales" || selectedCreateProfile === "collections"}
                                  onChange={(e) => setNewUserCanAccessFollowups(e.target.checked)}
                                />
                                Follow-up Access
                              </label>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">Set member-specific workflow access during login creation. Non-sales roles always retain full workflow access.</p>
                          </div>
                          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newUserScope} onChange={(e) => setNewUserScope(e.target.value as AccessScope)} disabled={newUserRole === "admin" || newUserRole === "owner" || newUserProfile === "collections"}>
                            <option value="assigned">Assigned Leads Only</option>
                            <option value="all">All Leads</option>
                            <option value="none">No Lead Access</option>
                          </select>
                          <button type="submit" className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Create Login (1Y Auto)</button>
                        </div>
                      </form>

                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Pending Registrations</h3>
                        <div className="mt-3 space-y-2">
                          {scopedPendingRequests.map((request) => (
                            <div key={request.id} className="rounded-xl border border-slate-200 p-3">
                              <p className="font-medium">{request.name}</p>
                              <p className="text-xs text-slate-500">{request.email}</p>
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => approveRequest(request)} className="rounded bg-[#788023] px-3 py-1.5 text-xs text-white">Approve</button>
                                <button type="button" onClick={() => setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: "rejected" } : r)))} className="rounded bg-slate-200 px-3 py-1.5 text-xs">Reject</button>
                              </div>
                            </div>
                          ))}
                          {scopedPendingRequests.length === 0 && <p className="text-sm text-slate-500">No pending requests for this licensee.</p>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <h3 className="text-lg font-semibold">Manage Logins</h3>
                      <p className="mt-1 text-xs text-slate-500">Password reset and direct password changes are owner-only actions.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setLoginViewFilter("active")} className={`rounded-full px-3 py-1 text-xs font-medium ${loginViewFilter === "active" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>Active ({activeManageableUsers.length})</button>
                        <button type="button" onClick={() => setLoginViewFilter("expired")} className={`rounded-full px-3 py-1 text-xs font-medium ${loginViewFilter === "expired" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>Expired ({expiredManageableUsers.length})</button>
                        <button type="button" onClick={() => setLoginViewFilter("inactive")} className={`rounded-full px-3 py-1 text-xs font-medium ${loginViewFilter === "inactive" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>Inactive ({inactiveManageableUsers.length})</button>
                        <button type="button" onClick={() => setLoginViewFilter("old")} className={`rounded-full px-3 py-1 text-xs font-medium ${loginViewFilter === "old" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>Old Users ({tenantScopedOldUsers.length})</button>
                        {loginViewFilter !== "old" && (
                          <select
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                            value={loginDepartmentFilter}
                            onChange={(e) => setLoginDepartmentFilter(e.target.value as StaffProfile | "All")}
                          >
                            <option value="All">All Departments</option>
                            <option value="sales">Sales</option>
                            <option value="followup">Follow-up</option>
                            <option value="operations">Operations</option>
                            {(usersTenantScope?.productMode ?? "full") === "full" && (usersTenantScope?.featureInvoicing ?? false) && (
                              <option value="collections">Accounts / Collections</option>
                            )}
                          </select>
                        )}
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        {loginViewFilter !== "old" ? (
                          <table className="min-w-full text-left text-sm">
                            <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Name</th><th className="px-2 py-2">Email</th><th className="px-2 py-2">Role</th><th className="px-2 py-2">Department</th><th className="px-2 py-2">Access</th><th className="px-2 py-2">License End</th><th className="px-2 py-2">Actions</th></tr></thead>
                            <tbody>
                              {loginRows.map((u) => (
                                <tr key={u.id} className="border-b border-slate-100">
                                  <td className="px-2 py-2"><input className="w-full rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" value={u.name} disabled={u.isBreakGlass} onChange={(e) => { const next = e.target.value; const old = u.name; updateUser(u.id, { name: next }); renameAssigneeEverywhere(u.tenantId, old, next); }} /></td>
                                  <td className="px-2 py-2"><input className="w-full rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" value={u.email} disabled={u.isBreakGlass} onChange={(e) => updateUser(u.id, { email: e.target.value.toLowerCase() })} /></td>
                                  <td className="px-2 py-2"><select className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" value={u.role} disabled={!!u.isBreakGlass} onChange={(e) => {
                                    const nextRole = e.target.value as UserRole;
                                    const nextUsers = users.map((row) => (row.id === u.id
                                      ? {
                                          ...row,
                                          role: nextRole,
                                          staffProfile: nextRole === "sales" ? resolveStaffProfile(row) : "operations",
                                          ...normalizeWorkflowAccess(nextRole, nextRole === "sales" ? resolveStaffProfile(row) : "operations", row.canAccessPipeline, row.canAccessFollowups),
                                          accessScope: nextRole === "admin" || nextRole === "owner" ? "all" : row.accessScope,
                                        }
                                      : row));
                                    if (!hasMinimumActiveAdmins(nextUsers, u.tenantId)) {
                                      setError("Each workspace must retain at least 2 active Admin/Owner logins.");
                                      return;
                                    }
                                    setUsers(nextUsers);
                                  }}><option value="sales">Sales</option><option value="admin">Admin</option>{isOwner && <option value="owner">Owner</option>}</select></td>
                                  <td className="px-2 py-2">
                                    <div className="inline-flex items-center gap-1">
                                      <select
                                        className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                                        value={resolveStaffProfile(u)}
                                        onChange={(e) => {
                                          const nextProfile = e.target.value as StaffProfile;
                                          const enforcedScope: AccessScope = nextProfile === "collections" ? "none" : (u.accessScope === "none" ? "assigned" : u.accessScope);
                                          const workflow = normalizeWorkflowAccess(u.role, nextProfile, u.canAccessPipeline, u.canAccessFollowups);
                                          updateUser(u.id, { staffProfile: nextProfile, accessScope: enforcedScope, ...workflow });
                                        }}
                                        disabled={u.role !== "sales" || !!u.isBreakGlass}
                                      >
                                        {staffProfilesForTenant.map((profile) => (
                                          <option key={profile} value={profile}>{STAFF_PROFILE_LABELS[profile]}</option>
                                        ))}
                                      </select>
                                      <StaffPermissionTooltip profile={resolveStaffProfile(u)} mode={usersTenantScope?.productMode ?? "full"} invoicingEnabled={usersTenantScope?.featureInvoicing ?? false} />
                                    </div>
                                  </td>
                                  <td className="px-2 py-2"><select className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" value={u.accessScope} onChange={(e) => updateUser(u.id, { accessScope: e.target.value as AccessScope })} disabled={u.role === "admin" || u.role === "owner" || !!u.isBreakGlass || resolveStaffProfile(u) === "collections"}><option value="assigned">Assigned</option><option value="all">All</option><option value="none">None</option></select></td>
                                  <td className="px-2 py-2">{formatDateDisplay(u.licenseEndDate.slice(0, 10))}</td>
                                  <td className="px-2 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {u.mustChangePassword && <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">Reset Pending</span>}
                                      <button type="button" onClick={() => updateUser(u.id, { licenseEndDate: oneYearFrom(u.licenseEndDate) })} className="rounded bg-slate-200 px-2 py-1 text-xs">+1Y</button>
                                      <button type="button" onClick={() => updateUser(u.id, { autoRenew: !u.autoRenew })} className={`rounded px-2 py-1 text-xs ${u.autoRenew ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{u.autoRenew ? "Auto ON" : "Auto OFF"}</button>
                                      {isOwner && (
                                        <button type="button" onClick={async () => {
                                          resetMessages();
                                          if (u.isBreakGlass) {
                                            setError("Break-glass owner password must be rotated from Recovery Safeguards.");
                                            return;
                                          }
                                          await issueResetForUser(u, true);
                                        }} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">Send Reset Code</button>
                                      )}
                                      {isOwner && (
                                        <button type="button" onClick={() => setUserPasswordDirectly(u)} className="rounded bg-violet-100 px-2 py-1 text-xs text-violet-700">Set Password</button>
                                      )}
                                      <button type="button" onClick={() => {
                                        if (u.isBreakGlass) {
                                          setError("Break-glass owner cannot be disabled.");
                                          return;
                                        }
                                        const nextUsers = users.map((row) => (row.id === u.id ? { ...row, isActive: !row.isActive } : row));
                                        if (!hasMinimumActiveAdmins(nextUsers, u.tenantId)) {
                                          setError("Each workspace must retain at least 2 active Admin/Owner logins.");
                                          return;
                                        }
                                        if (u.id === currentUser.id && u.isActive) {
                                          setError("You cannot disable your own active login.");
                                          return;
                                        }
                                        setUsers(nextUsers);
                                      }} className={`rounded px-2 py-1 text-xs ${u.isActive ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"}`}>{u.isBreakGlass ? "Protected" : u.isActive ? "Deactivate" : "Activate"}</button>
                                      <button type="button" onClick={() => archiveUser(u)} className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700">Move to Old</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {loginRows.length === 0 && <tr><td className="px-2 py-3 text-slate-500" colSpan={7}>No users found in this category.</td></tr>}
                            </tbody>
                          </table>
                        ) : (
                          <table className="min-w-full text-left text-sm">
                            <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Name</th><th className="px-2 py-2">Email</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Archived At</th><th className="px-2 py-2">Archived By</th><th className="px-2 py-2">Actions</th></tr></thead>
                            <tbody>
                              {tenantScopedOldUsers.map((u) => (
                                <tr key={u.id} className="border-b border-slate-100">
                                  <td className="px-2 py-2">{u.name}</td>
                                  <td className="px-2 py-2">{u.email}</td>
                                  <td className="px-2 py-2 capitalize">{u.archiveReason}</td>
                                  <td className="px-2 py-2">{formatDateTimeDisplay(u.archivedAt)}</td>
                                  <td className="px-2 py-2">{u.archivedBy}</td>
                                  <td className="px-2 py-2"><div className="flex flex-wrap gap-1"><button type="button" onClick={() => restoreOldUser(u)} className="rounded bg-[#788023] px-2 py-1 text-xs text-white hover:bg-[#646b1d]">Restore</button><button type="button" onClick={() => deleteOldUserPermanently(u)} className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700">Delete Permanently</button></div></td>
                                </tr>
                              ))}
                              {tenantScopedOldUsers.length === 0 && <tr><td className="px-2 py-3 text-slate-500" colSpan={6}>No old users yet.</td></tr>}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Employees</h3>
                        <div className="mt-3 flex gap-2">
                          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="New employee" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} />
                          <button type="button" onClick={() => {
                            if (!newEmployeeName.trim()) return;
                            setEmployees((prev) => [{ id: makeId(), tenantId: usersTenantScopeId, name: newEmployeeName.trim(), isActive: true }, ...prev]);
                            setNewEmployeeName("");
                          }} className="rounded-lg bg-[#788023] px-3 py-2 text-sm text-white">Add</button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {manageableEmployees.map((emp) => (
                            <div key={emp.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                              <input className="flex-1 rounded border border-slate-300 px-2 py-1" value={emp.name} onChange={(e) => { const old = emp.name; const next = e.target.value; setEmployees((prev) => prev.map((row) => (row.id === emp.id ? { ...row, name: next } : row))); renameAssigneeEverywhere(emp.tenantId, old, next); }} />
                              <button type="button" onClick={() => setEmployees((prev) => prev.map((row) => (row.id === emp.id ? { ...row, isActive: !row.isActive } : row)))} className={`rounded px-2 py-1 text-xs ${emp.isActive ? "bg-slate-100" : "bg-slate-200 text-slate-500"}`}>{emp.isActive ? "Active" : "Inactive"}</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Services</h3>
                        <div className="mt-3 flex gap-2">
                          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="New service" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} />
                          <button type="button" onClick={() => {
                            if (!newServiceName.trim()) return;
                            setServicesByTenant((prev) => ({ ...prev, [usersTenantScopeId]: Array.from(new Set([...(prev[usersTenantScopeId] ?? DEFAULT_SERVICES), newServiceName.trim()])) }));
                            setNewServiceName("");
                          }} className="rounded-lg bg-[#788023] px-3 py-2 text-sm text-white">Add</button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {scopedServices.map((srv, idx) => (
                            <div key={`${srv}-${idx}`} className="rounded-lg border border-slate-200 p-2">
                              <input className="w-full rounded border border-slate-300 px-2 py-1" value={srv} onChange={(e) => {
                                const nextName = e.target.value;
                                setServicesByTenant((prev) => ({ ...prev, [usersTenantScopeId]: (prev[usersTenantScopeId] ?? DEFAULT_SERVICES).map((row, i) => (i === idx ? nextName : row)) }));
                                setLeads((prev) => prev.map((lead) => (lead.tenantId === usersTenantScopeId && lead.serviceInterested === srv ? { ...lead, serviceInterested: nextName } : lead)));
                              }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isOwner && usersTab === "platform-controls" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><p className="text-sm text-slate-500">Client Accounts</p><p className="mt-2 text-3xl font-bold text-slate-900">{platformSummary.tenantCount}</p><p className="text-xs text-slate-500">Active: {platformSummary.activeTenants} | Suspended: {platformSummary.suspendedTenants}</p></div>
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><p className="text-sm text-slate-500">Users</p><p className="mt-2 text-3xl font-bold text-slate-900">{platformSummary.userCount}</p><p className="text-xs text-slate-500">Active: {platformSummary.activeUsers} | Pending requests: {platformSummary.pendingRegistrations}</p></div>
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100"><p className="text-sm text-slate-500">Leads</p><p className="mt-2 text-3xl font-bold text-slate-900">{platformSummary.leadCount}</p><p className="text-xs text-slate-500">Tenant licenses expiring in 30 days: {platformSummary.expiringTenants}</p></div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">Trial Dashboard</h3>
                          <p className="mt-1 text-xs text-slate-500">Track who opted for trial, expiring soon, expired, and converted accounts.</p>
                        </div>
                        <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">15-day trial lifecycle</p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Total Trials</p><p className="mt-1 text-2xl font-bold text-slate-900">{trialSummary.total}</p></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Active</p><p className="mt-1 text-2xl font-bold text-emerald-600">{trialSummary.active}</p></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Expiring in 3 Days</p><p className="mt-1 text-2xl font-bold text-amber-600">{trialSummary.expiringSoon}</p></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Expired</p><p className="mt-1 text-2xl font-bold text-rose-600">{trialSummary.expired}</p></div>
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-xs text-slate-500">Converted</p><p className="mt-1 text-2xl font-bold text-indigo-600">{trialSummary.converted}</p></div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2">Workspace</th>
                              <th className="px-2 py-2">Owner</th>
                              <th className="px-2 py-2">Signup Source</th>
                              <th className="px-2 py-2">Trial Window</th>
                              <th className="px-2 py-2">Status</th>
                              <th className="px-2 py-2">Last Login</th>
                              <th className="px-2 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trialDashboardRows.slice(0, 80).map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-2 py-2">
                                  <p className="font-medium text-slate-900">{row.workspaceName}</p>
                                  <p className="text-xs text-slate-500">{row.tenant?.slug ?? row.tenantId}</p>
                                </td>
                                <td className="px-2 py-2">
                                  <p>{row.ownerName}</p>
                                  <p className="text-xs text-slate-500">{row.ownerEmail}</p>
                                </td>
                                <td className="px-2 py-2 capitalize">{row.signupSource.replace("-", " ")}</td>
                                <td className="px-2 py-2 text-xs text-slate-600">
                                  <p>{formatDateDisplay(row.trialStartAt)} {"->"} {formatDateDisplay(row.trialEndAt)}</p>
                                  {row.derivedStatus === "active" ? <p>{row.daysLeft}d left</p> : <p className="text-rose-600">Expired</p>}
                                </td>
                                <td className="px-2 py-2">
                                  <span className={`rounded px-2 py-1 text-xs ${row.derivedStatus === "converted" ? "bg-indigo-100 text-indigo-700" : row.derivedStatus === "expired" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                    {row.derivedStatus}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-xs text-slate-500">{formatDateTimeDisplay(row.lastLoginAt)}</td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedUsersTenantId(row.tenantId);
                                        setUsersTab("tenant-users");
                                      }}
                                      className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700"
                                    >
                                      Open Tenant
                                    </button>
                                    {row.derivedStatus !== "converted" && (
                                      <button
                                        type="button"
                                        onClick={() => convertTrialToPaid(row.tenantId)}
                                        className="rounded bg-[#788023] px-2 py-1 text-xs text-white hover:bg-[#646b1d]"
                                      >
                                        Convert to Paid
                                      </button>
                                    )}
                                    {row.derivedStatus !== "converted" && (
                                      <button
                                        type="button"
                                        onClick={() => extendTrialWorkspace(row.tenantId, 7)}
                                        className="rounded bg-slate-200 px-2 py-1 text-xs"
                                      >
                                        Extend +7d
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {trialDashboardRows.length === 0 && (
                              <tr>
                                <td className="px-2 py-3 text-slate-500" colSpan={7}>
                                  No trial signups yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">License Lifecycle (Graph)</h3>
                        <p className="mt-1 text-xs text-slate-500">Snapshot of tenant lifecycle distribution.</p>
                        {(() => {
                          const lifecycleData = [
                            { label: "Active", value: platformSummary.activeTenants, color: "bg-emerald-500" },
                            { label: "Renewal Due", value: renewalPipeline.upcoming.length, color: "bg-amber-500" },
                            { label: "Grace", value: renewalPipeline.inGrace.length, color: "bg-orange-500" },
                            { label: "Suspended", value: renewalPipeline.suspended.length, color: "bg-rose-500" },
                          ];
                          const maxValue = Math.max(...lifecycleData.map((row) => row.value), 1);
                          return (
                            <div className="mt-3 space-y-3">
                              {lifecycleData.map((row) => {
                                const width = Math.max((row.value / maxValue) * 100, row.value > 0 ? 4 : 0);
                                return (
                                  <div key={row.label}>
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                      <span className="font-medium text-slate-700">{row.label}</span>
                                      <span className="text-slate-600">{row.value}</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-slate-100">
                                      <div className={`${row.color} h-3 rounded-full`} style={{ width: `${width}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                        <h3 className="text-lg font-semibold">Platform Volume (Graph)</h3>
                        <p className="mt-1 text-xs text-slate-500">Total records by entity for quick platform load view.</p>
                        {(() => {
                          const volumeData = [
                            { label: "Client Accounts", value: platformSummary.tenantCount, color: "bg-[#788023]" },
                            { label: "Users", value: platformSummary.userCount, color: "bg-indigo-500" },
                            { label: "Leads", value: platformSummary.leadCount, color: "bg-sky-500" },
                            { label: "Pending Requests", value: platformSummary.pendingRegistrations, color: "bg-violet-500" },
                          ];
                          const maxValue = Math.max(...volumeData.map((row) => row.value), 1);
                          return (
                            <div className="mt-3 space-y-3">
                              {volumeData.map((row) => {
                                const width = Math.max((row.value / maxValue) * 100, row.value > 0 ? 4 : 0);
                                return (
                                  <div key={row.label}>
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                      <span className="font-medium text-slate-700">{row.label}</span>
                                      <span className="text-slate-600">{row.value}</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-slate-100">
                                      <div className={`${row.color} h-3 rounded-full`} style={{ width: `${width}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">License Operations</h3>
                          <p className="mt-1 text-xs text-slate-500">Owner-only registry, renewal pipeline, and one-click tenant controls.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUsersTab("licensees");
                          }}
                          className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700"
                        >
                          Open Client Entitlements
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                          <p className="text-sm text-slate-500">Renewals in 30 Days</p>
                          <p className="mt-1 text-3xl font-bold text-amber-600">{renewalPipeline.upcoming.length}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                          <p className="text-sm text-slate-500">In Grace Period</p>
                          <p className="mt-1 text-3xl font-bold text-orange-600">{renewalPipeline.inGrace.length}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                          <p className="text-sm text-slate-500">Suspended</p>
                          <p className="mt-1 text-3xl font-bold text-rose-600">{renewalPipeline.suspended.length}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <h4 className="text-sm font-semibold text-slate-800">Upcoming Renewals</h4>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {renewalPipeline.upcoming.slice(0, 8).map((row) => (
                              <p key={`upcoming-platform-${row.tenant.id}`}>{row.tenant.name} ({row.lifecycle.daysToExpiry}d)</p>
                            ))}
                            {renewalPipeline.upcoming.length === 0 && <p className="text-slate-400">No renewals due.</p>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <h4 className="text-sm font-semibold text-slate-800">Grace Window</h4>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {renewalPipeline.inGrace.slice(0, 8).map((row) => (
                              <p key={`grace-platform-${row.tenant.id}`}>{row.tenant.name} ({row.lifecycle.daysPastDue}d late)</p>
                            ))}
                            {renewalPipeline.inGrace.length === 0 && <p className="text-slate-400">No tenants in grace.</p>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <h4 className="text-sm font-semibold text-slate-800">Suspended</h4>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {renewalPipeline.suspended.slice(0, 8).map((row) => (
                              <p key={`suspended-platform-${row.tenant.id}`}>{row.tenant.name}</p>
                            ))}
                            {renewalPipeline.suspended.length === 0 && <p className="text-slate-400">No suspended tenants.</p>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2">Licensee</th>
                              <th className="px-2 py-2">Plan</th>
                              <th className="px-2 py-2">Package</th>
                              <th className="px-2 py-2">Status</th>
                              <th className="px-2 py-2">Usage</th>
                              <th className="px-2 py-2">Health</th>
                              <th className="px-2 py-2">Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantControlRows.map((row) => {
                              const tenant = row.tenant;
                              return (
                                <tr key={tenant.id} className="border-b border-slate-100">
                                  <td className="px-2 py-2">
                                    <p className="font-medium text-slate-900">{tenant.name}</p>
                                    <p className="text-xs text-slate-500">{tenant.slug}</p>
                                  </td>
                                  <td className="px-2 py-2">{tenant.planName}</td>
                                  <td className="px-2 py-2">
                                    <span className={`rounded px-2 py-1 text-xs ${tenant.productMode === "full" ? "bg-indigo-100 text-indigo-700" : tenant.productMode === "pro" ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
                                      {tenant.productMode === "full" ? "Full" : tenant.productMode === "pro" ? "Pro" : "Lite"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className={`rounded px-2 py-1 text-xs ${row.lifecycle.status === "Active" ? "bg-emerald-100 text-emerald-700" : row.lifecycle.status === "Grace" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                      {row.lifecycle.status}
                                    </span>
                                    <p className="mt-1 text-xs text-slate-500">Ends: {formatDateDisplay(tenant.licenseEndDate.slice(0, 10))}</p>
                                  </td>
                                  <td className="px-2 py-2 text-xs text-slate-600">{row.usage.activeUsers}/{tenant.maxUsers} seats | {row.leadsThisMonth}/{tenant.maxLeadsPerMonth} monthly leads</td>
                                  <td className={`px-2 py-2 font-semibold ${row.healthBand === "green" ? "text-emerald-700" : row.healthBand === "yellow" ? "text-amber-700" : "text-rose-700"}`}>{row.healthScore}</td>
                                  <td className="px-2 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      <button type="button" onClick={() => setSelectedUsersTenantId(tenant.id)} className="rounded bg-slate-200 px-2 py-1 text-xs">Select</button>
                                      <button type="button" onClick={() => { setSelectedUsersTenantId(tenant.id); setUsersTab("licensees"); }} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">Entitlements</button>
                                      <button type="button" onClick={() => { setSelectedUsersTenantId(tenant.id); setUsersTab("tenant-users"); }} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">Users</button>
                                      <button type="button" onClick={() => setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, licenseEndDate: oneYearFrom(t.licenseEndDate), isActive: true } : t)))} className="rounded bg-slate-200 px-2 py-1 text-xs">+1Y</button>
                                      <button type="button" onClick={() => setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, autoRenew: !t.autoRenew } : t)))} className={`rounded px-2 py-1 text-xs ${tenant.autoRenew ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{tenant.autoRenew ? "Auto ON" : "Auto OFF"}</button>
                                      <button type="button" onClick={() => setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, isActive: !t.isActive } : t)))} className={`rounded px-2 py-1 text-xs ${tenant.isActive ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"}`}>{tenant.isActive ? "Suspend" : "Resume"}</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <h3 className="text-lg font-semibold">Plan Templates</h3>
                      <p className="mt-1 text-xs text-slate-500">Create reusable plans and apply them while creating or editing licensees.</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Description" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Offer Headline (optional)" value={templateOfferLabel} onChange={(e) => setTemplateOfferLabel(e.target.value)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} placeholder="Monthly Price (INR)" value={templateMonthlyPrice} onChange={(e) => setTemplateMonthlyPrice(Number(e.target.value) || 0)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} placeholder="Max Users" value={templateMaxUsers} onChange={(e) => setTemplateMaxUsers(Number(e.target.value) || 1)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={1} placeholder="Max Leads / Month" value={templateMaxLeads} onChange={(e) => setTemplateMaxLeads(Number(e.target.value) || 1)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={0} placeholder="Grace Days" value={templateGraceDays} onChange={(e) => setTemplateGraceDays(Number(e.target.value) || 0)} />
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min={30} placeholder="Audit Retention" value={templateAuditRetention} onChange={(e) => setTemplateAuditRetention(Number(e.target.value) || 30)} />
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={templateFeatureExports} onChange={(e) => setTemplateFeatureExports(e.target.checked)} />
                          Exports
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={templateFeatureForecast} onChange={(e) => setTemplateFeatureForecast(e.target.checked)} />
                          Advanced Forecast
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={templateFeatureInvoicing} onChange={(e) => setTemplateFeatureInvoicing(e.target.checked)} />
                          Invoicing Suite
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={templateRequireGstCompliance} onChange={(e) => setTemplateRequireGstCompliance(e.target.checked)} disabled={!templateFeatureInvoicing} />
                          GST Required
                        </label>
                        <button type="button" onClick={createPlanTemplate} className="rounded-lg bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
                          Create Template
                        </button>
                      </div>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Name</th><th className="px-2 py-2">Limits</th><th className="px-2 py-2">Features</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
                          <tbody>
                            {planTemplates.map((template) => (
                              <tr key={template.id} className="border-b border-slate-100">
                                <td className="px-2 py-2">
                                  <input className="w-full rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" value={template.name} disabled={template.isSystemPreset} onChange={(e) => updatePlanTemplate(template.id, { name: e.target.value })} />
                                  <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100" value={template.description} disabled={template.isSystemPreset} onChange={(e) => updatePlanTemplate(template.id, { description: e.target.value })} placeholder="Description" />
                                  <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" value={template.offerLabel} onChange={(e) => updatePlanTemplate(template.id, { offerLabel: e.target.value })} placeholder="Offer headline" />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="grid gap-1 text-xs text-slate-600">
                                    <label>Price/mo <input className="ml-1 w-24 rounded border border-slate-300 px-1 py-0.5" type="number" min={0} value={template.monthlyPriceInr} onChange={(e) => updatePlanTemplate(template.id, { monthlyPriceInr: Math.max(0, Number(e.target.value) || 0) })} /></label>
                                    <label>Users <input className="ml-1 w-20 rounded border border-slate-300 px-1 py-0.5" type="number" min={1} value={template.maxUsers} onChange={(e) => updatePlanTemplate(template.id, { maxUsers: Number(e.target.value) || 1 })} /></label>
                                    <label>Leads/mo <input className="ml-1 w-24 rounded border border-slate-300 px-1 py-0.5" type="number" min={1} value={template.maxLeadsPerMonth} onChange={(e) => updatePlanTemplate(template.id, { maxLeadsPerMonth: Number(e.target.value) || 1 })} /></label>
                                    <label>Grace <input className="ml-1 w-16 rounded border border-slate-300 px-1 py-0.5" type="number" min={0} value={template.graceDays} onChange={(e) => updatePlanTemplate(template.id, { graceDays: Number(e.target.value) || 0 })} />d</label>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-xs text-slate-600">
                                  <div className="grid gap-1">
                                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={template.featureExports} onChange={(e) => updatePlanTemplate(template.id, { featureExports: e.target.checked })} />Exports</label>
                                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={template.featureAdvancedForecast} onChange={(e) => updatePlanTemplate(template.id, { featureAdvancedForecast: e.target.checked })} />Forecast</label>
                                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={template.featureInvoicing} onChange={(e) => updatePlanTemplate(template.id, { featureInvoicing: e.target.checked })} />Invoicing</label>
                                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={template.requireGstCompliance} onChange={(e) => updatePlanTemplate(template.id, { requireGstCompliance: e.target.checked })} disabled={!template.featureInvoicing} />GST Required</label>
                                    <label>Audit <input className="ml-1 w-20 rounded border border-slate-300 px-1 py-0.5" type="number" min={30} value={template.auditRetentionDays} onChange={(e) => updatePlanTemplate(template.id, { auditRetentionDays: Number(e.target.value) || 30 })} />d</label>
                                  </div>
                                </td>
                                <td className="px-2 py-2"><span className={`rounded px-2 py-1 text-xs ${template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{template.isActive ? "Active" : "Inactive"}</span></td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    <button type="button" onClick={() => duplicatePlanTemplate(template)} className="rounded bg-slate-200 px-2 py-1 text-xs">Duplicate</button>
                                    {!template.isSystemPreset && (
                                      <button type="button" onClick={() => updatePlanTemplate(template.id, { isActive: !template.isActive })} className={`rounded px-2 py-1 text-xs ${template.isActive ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                        {template.isActive ? "Deactivate" : "Activate"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">Website Content JSON</h3>
                          <p className="mt-1 text-xs text-slate-500">Update public proof metrics, changelog, and roadmap from one JSON source without editing code.</p>
                        </div>
                        <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Storage key: {STORAGE_MARKETING_CONTENT}</p>
                      </div>
                      <textarea
                        value={marketingJsonDraft}
                        onChange={(event) => {
                          setMarketingJsonDraft(event.target.value);
                          if (marketingJsonError) setMarketingJsonError("");
                        }}
                        rows={14}
                        className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40"
                      />
                      {marketingJsonError && <p className="mt-2 text-xs text-rose-600">{marketingJsonError}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={applyMarketingJsonDraft}
                          className="rounded-lg bg-[#788023] px-3 py-2 text-xs font-semibold text-white hover:bg-[#646b1d]"
                        >
                          Save JSON
                        </button>
                        <button
                          type="button"
                          onClick={loadMarketingJsonFromPublicFile}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Load From /marketing-content.json
                        </button>
                        <button
                          type="button"
                          onClick={exportMarketingJson}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Export Current JSON
                        </button>
                        <button
                          type="button"
                          onClick={resetMarketingJsonDraft}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Reset Defaults
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <h3 className="text-lg font-semibold">Emergency Account Recovery</h3>
                      <p className="mt-1 text-xs text-slate-500">Each client account keeps at least 2 active Admin/Owner logins and one protected emergency owner account for lockout recovery.</p>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">Client Account</th><th className="px-2 py-2">Active Admins</th><th className="px-2 py-2">Recovery Login</th><th className="px-2 py-2">Actions</th></tr></thead>
                          <tbody>
                            {manageableTenants.map((tenant) => {
                              const adminCount = activeAdminCount(users, tenant.id);
                              const recovery = breakGlassSecretByTenant[tenant.id];
                              const hasRevealAck = !!breakGlassRevealAckByTenant[tenant.id];
                              return (
                                <tr key={tenant.id} className="border-b border-slate-100">
                                  <td className="px-2 py-2">{tenant.name}</td>
                                  <td className="px-2 py-2"><span className={`rounded px-2 py-1 text-xs ${adminCount >= 2 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{adminCount} active</span></td>
                                  <td className="px-2 py-2 text-xs text-slate-600">
                                    {recovery ? (
                                      <div>
                                        <p>{recovery.email}</p>
                                        <p className="mt-1 font-medium text-amber-700">
                                          Password: {revealedBreakGlassTenantId === tenant.id ? recovery.password : "••••••••••••••••"}
                                        </p>
                                        {revealedBreakGlassTenantId === tenant.id && (
                                          <p className="mt-1 text-[11px] text-amber-700">Visible for 20 seconds. Hide immediately after use.</p>
                                        )}
                                        <p className="mt-1 text-[11px] text-slate-500">Generated: {formatDateTimeDisplay(recovery.generatedAt)}</p>
                                      </div>
                                    ) : "Provisioning..."}
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      <button type="button" onClick={() => rotateBreakGlassCredentials(tenant)} className="rounded bg-[#788023] px-2 py-1 text-xs text-white hover:bg-[#646b1d]">Regenerate</button>
                                      {recovery && (
                                        <label className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={hasRevealAck}
                                            onChange={(e) =>
                                              setBreakGlassRevealAckByTenant((prev) => ({
                                                ...prev,
                                                [tenant.id]: e.target.checked,
                                              }))
                                            }
                                          />
                                          I confirm this screen is private
                                        </label>
                                      )}
                                      {recovery && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (revealedBreakGlassTenantId === tenant.id) {
                                              setRevealedBreakGlassTenantId(null);
                                              return;
                                            }
                                            if (!hasRevealAck) {
                                              setError("Acknowledge private-screen confirmation before revealing emergency recovery password.");
                                              return;
                                            }
                                            const confirmed = await confirmToast(
                                              `Reveal emergency recovery password for ${tenant.name}? This will auto-hide in 20 seconds.`,
                                              "Reveal Password",
                                            );
                                            if (!confirmed) return;
                                            setRevealedBreakGlassTenantId(tenant.id);
                                          }}
                                          className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                          disabled={!hasRevealAck}
                                        >
                                          {revealedBreakGlassTenantId === tenant.id ? "Hide Password" : "Reveal Password"}
                                        </button>
                                      )}
                                      {recovery && !recovery.acknowledged && (
                                        <button type="button" onClick={() => setBreakGlassSecrets((prev) => prev.map((secret) => (secret.tenantId === tenant.id ? { ...secret, acknowledged: true } : secret)))} className="rounded bg-slate-200 px-2 py-1 text-xs">Mark Stored Offline</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                      <h3 className="text-lg font-semibold">Audit Logs Across Tenants</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-xs text-slate-500">
                          Event Type
                          <select
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={auditEventFilter}
                            onChange={(e) => setAuditEventFilter(e.target.value as "all" | "lead" | "registration" | "password" | "trial")}
                          >
                            <option value="all">All Events</option>
                            <option value="lead">Lead Activity</option>
                            <option value="registration">Registrations</option>
                            <option value="password">Password Events</option>
                            <option value="trial">Trial Events</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-500">
                          Date Range
                          <select
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={auditDateRangeFilter}
                            onChange={(e) => setAuditDateRangeFilter(e.target.value as "7d" | "30d" | "90d" | "custom")}
                          >
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="90d">Last 90 days</option>
                            <option value="custom">Custom Range</option>
                          </select>
                        </label>
                        <label className="text-xs text-slate-500">
                          Start Date
                          <input
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            type="date"
                            value={auditStartDate}
                            onChange={(e) => setAuditStartDate(e.target.value)}
                            disabled={auditDateRangeFilter !== "custom"}
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          End Date
                          <input
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            type="date"
                            value={auditEndDate}
                            onChange={(e) => setAuditEndDate(e.target.value)}
                            disabled={auditDateRangeFilter !== "custom"}
                          />
                        </label>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-2 py-2">When</th><th className="px-2 py-2">Client Account</th><th className="px-2 py-2">Event Type</th><th className="px-2 py-2">Actor</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Details</th></tr></thead>
                          <tbody>
                            {filteredPlatformAuditRows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-2 py-2 text-xs text-slate-500">{formatDateTimeDisplay(row.createdAt)}</td>
                                <td className="px-2 py-2">{tenantNameById[row.tenantId] ?? row.tenantId}</td>
                                <td className="px-2 py-2 capitalize">{row.eventType}</td>
                                <td className="px-2 py-2">{row.actor}</td>
                                <td className="px-2 py-2">{row.action}</td>
                                <td className="px-2 py-2 text-xs text-slate-600">{row.details}</td>
                              </tr>
                            ))}
                            {filteredPlatformAuditRows.length === 0 && <tr><td className="px-2 py-3 text-slate-500" colSpan={6}>No audit logs for selected filters.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </UsersPage>
            )}

              </Suspense>
            </SectionErrorBoundary>
              </div>
            </div>
          </section>
        )}

        {currentUser && canViewLeads && (
          <div className="fixed inset-x-0 bottom-4 z-30 px-4 md:hidden">
            <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
              {canCreateLeads && (
                <button
                  type="button"
                  onClick={() => {
                    setAppView("leads");
                    openLeadIntakeModal();
                  }}
                  className="flex-1 rounded-xl bg-[#788023] px-3 py-2 text-sm font-semibold text-white"
                >
                  + Add Lead
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFollowupQueue("today");
                  setAppView(allowedViews.includes("followups") ? "followups" : "mywork");
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Today Queue
              </button>
            </div>
          </div>
        )}

        {leadDrawerOpen && selectedLead && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
            <button type="button" className="h-full flex-1" onClick={() => { setLeadDrawerOpen(false); setSelectedLeadId(null); }} aria-label="Close lead details" />
            <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedLead.leadName}</h3>
                  <p className="text-sm text-slate-500">{selectedLead.companyName}</p>
                </div>
                <button type="button" aria-label="Close lead details drawer" onClick={() => { setLeadDrawerOpen(false); setSelectedLeadId(null); }} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Close</button>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedLead.leadStatus}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Temperature</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedLead.leadTemperature}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Deal Value</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatInr(selectedLead.dealValue)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 p-3 text-sm md:grid-cols-2">
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Phone</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.phoneNumber || "-"}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Email</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.emailId || "-"}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Source</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.leadSource}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Service</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.serviceInterested}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Assignee</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.assignedTo}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">SLA</p><p className="mt-0.5 font-medium text-slate-800">{isOpenLeadStatus(selectedLead.leadStatus) && neglectDays(selectedLead) >= 7 ? `Neglected ${neglectDays(selectedLead)}d` : "Within SLA"}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Expected Close</p><p className="mt-0.5 font-medium text-slate-800">{formatDateDisplay(selectedLead.expectedClosingDate)}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Next Follow-up</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.nextFollowupDate || "-"}</p></div>
                <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"><p className="text-[11px] uppercase tracking-wide text-slate-500">Last Contacted</p><p className="mt-0.5 font-medium text-slate-800">{selectedLead.lastContactedDate || "-"}</p></div>
              </div>

              {selectedLeadStatusTransition && selectedLeadStatusTransition.to === selectedLead.leadStatus && (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-violet-800">
                      Last stage move: {selectedLeadStatusTransition.from}{" -> "}{selectedLeadStatusTransition.to} ({formatDateTimeDisplay(selectedLeadStatusTransition.at)})
                    </p>
                    <button
                      type="button"
                      onClick={() => revertLeadToPreviousStatus(selectedLead)}
                      className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                    >
                      Revert Status Change
                    </button>
                  </div>
                </div>
              )}

              {selectedLead.leadStatus === "Won" && (
                <div className="mt-4 rounded-xl border border-slate-200 p-3">
                  <h4 className="text-sm font-semibold text-slate-800">Collections Controls</h4>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Payment Status
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        value={selectedLead.paymentStatus}
                        onChange={(e) => upsertLead(selectedLead.id, (lead) => ({ ...lead, paymentStatus: e.target.value as PaymentStatus }), "Payment status updated")}
                      >
                        {PAYMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Collections Owner
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        value={selectedLead.collectionsOwner || selectedLead.assignedTo}
                        onChange={(e) => upsertLead(selectedLead.id, (lead) => ({ ...lead, collectionsOwner: e.target.value }), "Collections owner updated")}
                      >
                        {[...new Set([selectedLead.assignedTo, ...assigneeOptions])].map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Collected Amount (INR)
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        type="number"
                        min={0}
                        max={wonRevenueValue(selectedLead)}
                        value={selectedLead.collectedAmount ?? 0}
                        onChange={(e) => {
                          const value = Math.max(0, Number(e.target.value) || 0);
                          upsertLead(
                            selectedLead.id,
                            (lead) => {
                              const bounded = Math.min(value, wonRevenueValue(lead));
                              const nextStatus: PaymentStatus =
                                bounded >= wonRevenueValue(lead)
                                  ? "Fully Collected"
                                  : bounded > 0
                                    ? "Partially Collected"
                                    : lead.paymentStatus === "Invoiced"
                                      ? "Invoiced"
                                      : "Not Invoiced";
                              return {
                                ...lead,
                                collectedAmount: bounded,
                                paymentStatus: nextStatus,
                              };
                            },
                            "Collected amount updated",
                          );
                        }}
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Collected Date
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        type="date"
                        value={selectedLead.collectedDate}
                        onChange={(e) => upsertLead(selectedLead.id, (lead) => ({ ...lead, collectedDate: e.target.value }), "Collected date updated")}
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Outstanding Amount: <span className="font-semibold text-rose-700">{formatInr(outstandingAmount(selectedLead))}</span>
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700">Linked Invoices</p>
                      <button type="button" onClick={() => openInvoiceComposerForLead(selectedLead)} className="rounded bg-[#5f56d3] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#4f47b9]">{requiresGstCompliance ? "Create GST Invoice" : "Create Invoice"}</button>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {selectedLeadInvoices.slice(0, 4).map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between rounded bg-white px-2 py-1 ring-1 ring-slate-200">
                          <span>{invoice.invoiceNumber} ({normalizeInvoiceStatus(invoice)})</span>
                          <span>{formatInr(invoice.totalAmount)}</span>
                        </div>
                      ))}
                      {selectedLeadInvoices.length === 0 && <p>No invoices linked yet.</p>}
                    </div>
                  </div>
                </div>
              )}

              {selectedLead.leadStatus === "Lost" && (
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Loss Reason
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    rows={2}
                    value={selectedLead.lossReason}
                    onChange={(e) => upsertLead(selectedLead.id, (lead) => ({ ...lead, lossReason: e.target.value }), "Loss reason updated")}
                  />
                </label>
              )}

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={3}
                  value={selectedLead.notes}
                  onChange={(e) => upsertLead(selectedLead.id, (lead) => ({ ...lead, notes: e.target.value }), "Notes updated from drawer")}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => upsertLead(selectedLead.id, (lead) => ({ ...lead, leadStatus: "Contacted", lastContactedDate: todayISODate() }), "Marked contacted from drawer")} className="rounded bg-[#788023] px-3 py-2 text-xs font-medium text-white hover:bg-[#646b1d]">Mark Contacted</button>
                <button type="button" onClick={() => markFollowupDoneWithUndo(selectedLead, "Follow-up marked done from drawer")} className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">Mark Follow-up Done</button>
                {canEditAll && (
                  <button
                    type="button"
                    onClick={() => { void softDeleteLead(selectedLead); setLeadDrawerOpen(false); setSelectedLeadId(null); }}
                    className="rounded bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    Delete Lead
                  </button>
                )}
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-800">Activity Timeline</h4>
                <div className="mt-2 space-y-2">
                  {leadActivities.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                      <p className="font-medium text-slate-800">{entry.action}</p>
                      <p className="mt-1 text-slate-500">{entry.actor} | {formatDateTimeDisplay(entry.createdAt)}</p>
                      {entry.changes.length > 0 && <p className="mt-1 text-slate-600">{entry.changes.join(" | ")}</p>}
                    </div>
                  ))}
                  {leadActivities.length === 0 && <p className="text-xs text-slate-500">No activity recorded yet.</p>}
                </div>
              </div>
            </aside>
          </div>
        )}

        {followupReassignPickerOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Select assignee for follow-up bulk reassign">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Choose Assignee</h3>
                  <p className="mt-1 text-sm text-slate-600">Search and pick an assignee for the selected follow-ups.</p>
                </div>
                <button
                  type="button"
                  aria-label="Close assignee picker"
                  onClick={() => setFollowupReassignPickerOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search Assignee
                <input
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Type a name"
                  value={followupReassignSearch}
                  onChange={(e) => setFollowupReassignSearch(e.target.value)}
                />
              </label>

              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {filteredFollowupReassignOptions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setFollowupBulkAssignee(name);
                      setFollowupReassignPickerOpen(false);
                      setFollowupReassignSearch("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${followupBulkAssignee === name ? "bg-[#788023]/15 text-[#5f651f]" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <span>{name}</span>
                    {followupBulkAssignee === name && <span className="text-xs font-semibold">Selected</span>}
                  </button>
                ))}
                {filteredFollowupReassignOptions.length === 0 && (
                  <p className="px-2 py-3 text-xs text-slate-500">No assignee matches this search.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {quickCommandOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Quick command center modal">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Quick Command Center</h3>
                  <p className="mt-1 text-sm text-slate-600">Run common daily actions in one place.</p>
                </div>
                <button type="button" aria-label="Close quick command modal" onClick={() => setQuickCommandOpen(false)} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Close</button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search commands and leads
                    <input
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Try: go to leads, add lead, acme, rajesh..."
                      value={quickCommandSearch}
                      onChange={(e) => setQuickCommandSearch(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCommandOpen(false);
                    setAppView("leads");
                    openLeadIntakeModal();
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-left hover:border-[#788023]"
                >
                  <p className="text-sm font-semibold text-slate-900">Add Lead</p>
                  <p className="mt-1 text-xs text-slate-600">Open intake popup instantly.</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCommandOpen(false);
                    setAppView("followups");
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-left hover:border-[#788023]"
                >
                  <p className="text-sm font-semibold text-slate-900">Go to Follow-ups</p>
                  <p className="mt-1 text-xs text-slate-600">Open command center queue view.</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstInvoiceLead = invoiceEligibleLeads[0];
                    if (!firstInvoiceLead) {
                      setError("No Confirmation/Invoice Sent/Won lead available to create invoice.");
                      return;
                    }
                    openInvoiceComposerForLead(firstInvoiceLead);
                    setQuickCommandOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-left hover:border-[#788023]"
                >
                  <p className="text-sm font-semibold text-slate-900">Create Invoice</p>
                  <p className="mt-1 text-xs text-slate-600">Jump to invoice composer for a confirmation or won lead.</p>
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">Command Matches</p>
                  <div className="mt-2 space-y-2">
                    {commandFilteredActions.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          item.run();
                          setQuickCommandOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-[#788023]"
                      >
                        <span>{item.label}</span>
                        <span className="text-[11px] text-slate-500">{item.hint}</span>
                      </button>
                    ))}
                    {commandFilteredActions.length === 0 && <p className="text-xs text-slate-500">No command matches.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">Lead Matches</p>
                  <div className="mt-2 space-y-2">
                    {commandLeadItems.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => {
                          setQuickCommandOpen(false);
                          setAppView("leads");
                          setSelectedLeadId(lead.id);
                          setLeadDrawerOpen(true);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-[#788023]"
                      >
                        <p className="text-sm font-semibold text-slate-800">{lead.companyName}</p>
                        <p className="text-xs text-slate-500">{lead.leadName} | {lead.phoneNumber || "No phone"}</p>
                      </button>
                    ))}
                    {commandLeadItems.length === 0 && <p className="text-xs text-slate-500">No lead matches.</p>}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">Log Follow-up (1-click)</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={quickFollowLeadId} onChange={(e) => setQuickFollowLeadId(e.target.value)}>
                    <option value="">Select pending follow-up</option>
                    {quickFollowCandidates.map((lead) => (
                      <option key={lead.id} value={lead.id}>{lead.companyName} - {lead.leadName}</option>
                    ))}
                  </select>
                  <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={quickFollowAction} onChange={(e) => setQuickFollowAction(e.target.value as "done" | "today")}>
                    <option value="done">Mark Done</option>
                    <option value="today">Move to Today</option>
                  </select>
                  <button type="button" onClick={runQuickFollowCommand} className="rounded-lg bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Run</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {directPasswordUser && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Set user password modal">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Set Password</h3>
                  <p className="mt-1 text-sm text-slate-600">Update password for {directPasswordUser.email}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close set password modal"
                  onClick={() => {
                    setDirectPasswordUserId(null);
                    setDirectPasswordDraft("");
                    setDirectPasswordConfirmDraft("");
                  }}
                  className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="text-sm font-medium text-slate-700">
                  New Password
                  <PasswordField value={directPasswordDraft} onChange={setDirectPasswordDraft} placeholder="Minimum 8 characters" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Confirm Password
                  <PasswordField value={directPasswordConfirmDraft} onChange={setDirectPasswordConfirmDraft} placeholder="Re-enter password" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDirectPasswordUserId(null);
                    setDirectPasswordDraft("");
                    setDirectPasswordConfirmDraft("");
                  }}
                  className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitDirectPasswordChange();
                  }}
                  className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        )}

        {promiseModalInvoice && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Promise to pay modal">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Set Promise To Pay</h3>
              <p className="mt-1 text-sm text-slate-600">{promiseModalInvoice.invoiceNumber} | Current balance {formatInr(promiseModalInvoice.balanceAmount)}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Promised Amount (INR)
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min={0} max={promiseModalInvoice.balanceAmount} value={promiseDraft.promisedAmount} onChange={(e) => setPromiseDraft((prev) => ({ ...prev, promisedAmount: Math.max(0, Number(e.target.value) || 0) }))} />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Promise Date
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={promiseDraft.promisedDate} onChange={(e) => setPromiseDraft((prev) => ({ ...prev, promisedDate: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Notes
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} value={promiseDraft.notes} onChange={(e) => setPromiseDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Commitment details / contact context" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setPromiseModalInvoiceId(null)} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={submitInvoicePromise} className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save Promise</button>
              </div>
            </div>
          </div>
        )}

        {paymentModalInvoice && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Record payment modal">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
              <p className="mt-1 text-sm text-slate-600">{paymentModalInvoice.invoiceNumber} | Pending {formatInr(paymentModalInvoice.balanceAmount)}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Amount (INR)
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min={0} max={paymentModalInvoice.balanceAmount} value={paymentDraft.amount} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, amount: Math.max(0, Number(e.target.value) || 0) }))} />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Payment Date
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={paymentDraft.paidAt} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, paidAt: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Mode
                  <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={paymentDraft.mode} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, mode: e.target.value as InvoicePaymentMode }))}>
                    {INVOICE_PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Reference
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={paymentDraft.reference} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, reference: e.target.value }))} placeholder="UTR / Txn ID" />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Notes
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} value={paymentDraft.notes} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentModalInvoiceId(null)} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={submitInvoicePayment} className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save Payment</button>
              </div>
            </div>
          </div>
        )}

        {ledgerInvoice && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Payment ledger modal">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Payment Ledger</h3>
                  <p className="mt-1 text-sm text-slate-600">{ledgerInvoice.invoiceNumber} | Total {formatInr(ledgerInvoice.totalAmount)} | Paid {formatInr(ledgerInvoice.amountPaid)} | Balance {formatInr(ledgerInvoice.balanceAmount)}</p>
                </div>
                <button type="button" aria-label="Close payment ledger modal" onClick={() => setLedgerInvoiceId(null)} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Close</button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Mode</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Added By</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="px-3 py-2">{payment.paidAt}</td>
                        <td className="px-3 py-2 text-emerald-700">{formatInr(payment.amount)}</td>
                        <td className="px-3 py-2">{payment.mode}</td>
                        <td className="px-3 py-2">{payment.reference || "-"}</td>
                        <td className="px-3 py-2">{payment.createdBy}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{payment.notes || "-"}</td>
                      </tr>
                    ))}
                    {ledgerPayments.length === 0 && <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={6}>No payments recorded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 max-h-[30vh] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Added By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerAdjustments.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100">
                        <td className="px-3 py-2">{entry.noteDate}</td>
                        <td className="px-3 py-2">{entry.kind}</td>
                        <td className={`px-3 py-2 ${entry.kind === "Credit" ? "text-emerald-700" : "text-amber-700"}`}>{formatInr(entry.amount)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{entry.reason || "-"}</td>
                        <td className="px-3 py-2">{entry.createdBy}</td>
                      </tr>
                    ))}
                    {ledgerAdjustments.length === 0 && <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={5}>No credit/debit notes added.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {adjustmentModalInvoiceId && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Adjustment note modal">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Add {adjustmentDraft.kind} Note</h3>
              <p className="mt-1 text-sm text-slate-600">This updates invoice effective total and balance automatically.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Type
                  <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={adjustmentDraft.kind} onChange={(e) => setAdjustmentDraft((prev) => ({ ...prev, kind: e.target.value as InvoiceAdjustmentType }))}>
                    <option value="Credit">Credit Note</option>
                    <option value="Debit">Debit Note</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Amount (INR)
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min={0} value={adjustmentDraft.amount} onChange={(e) => setAdjustmentDraft((prev) => ({ ...prev, amount: Math.max(0, Number(e.target.value) || 0) }))} />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Note Date
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={adjustmentDraft.noteDate} onChange={(e) => setAdjustmentDraft((prev) => ({ ...prev, noteDate: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Reason
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} value={adjustmentDraft.reason} onChange={(e) => setAdjustmentDraft((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Reason for adjustment" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setAdjustmentModalInvoiceId(null)} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={submitInvoiceAdjustment} className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save Note</button>
              </div>
            </div>
          </div>
        )}

        {lostReasonPrompt && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Loss reason modal">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Loss Reason Required</h3>
              <p className="mt-1 text-sm text-slate-600">Please add a loss reason before moving this lead to Lost.</p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Reason
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={3}
                  value={lostReasonDraft}
                  onChange={(e) => setLostReasonDraft(e.target.value)}
                  placeholder="Example: Budget constraints / Decision delayed / Chose competitor"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => { setLostReasonPrompt(null); setLostReasonDraft(""); }} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={submitLostReason} className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save and Move to Lost</button>
              </div>
            </div>
          </div>
        )}

        {closingDatePrompt && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Expected closing date modal">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Set Expected Closing Date</h3>
              <p className="mt-1 text-sm text-slate-600">
                This lead is moving to {closingDatePrompt.nextStatus}. Add expected closing date now for better forecasting.
                {closingDatePrompt.isMandatory ? " This stage requires expected closing date." : ""}
              </p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Expected Closing Date
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="date"
                  value={closingDateDraft}
                  onChange={(e) => setClosingDateDraft(e.target.value)}
                />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setClosingDatePrompt(null); setClosingDateDraft(""); }} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Cancel
                </button>
                {!closingDatePrompt.isMandatory && (
                  <button type="button" onClick={() => submitStatusWithClosingDate(true)} className="rounded-md bg-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-300">
                    Skip for now
                  </button>
                )}
                <button type="button" onClick={() => submitStatusWithClosingDate(false)} className="rounded-md bg-[#788023] px-3 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
                  Save and Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer onOpenLegal={setLegalOpen} />
      {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </div>
  );
}