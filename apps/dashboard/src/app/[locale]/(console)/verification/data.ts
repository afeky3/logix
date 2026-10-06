// Shapes returned by GET /admin/verification-cases and GET /admin/organizations/:id
// (apps/backend/src/modules/admin-kyb). See module 02-verification-kyb.md D10.
export type KybStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
export type Workspace = "CUSTOMER" | "SUPPLIER" | "PROVIDER" | "DRIVER";
export type ItemStatus = "PENDING" | "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED";

export interface KybRow {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationKind: "INDIVIDUAL" | "BUSINESS";
  workspace: Workspace;
  activities: string[];
  crNumber: string | null;
  city: string | null;
  itemsAccepted: number;
  itemsTotal: number;
  resubmissionCount: number;
  assignedTo: string | null;
  status: KybStatus;
  submittedAt: string | null;
}

export interface OrgDetail {
  id: string;
  kind: "INDIVIDUAL" | "BUSINESS";
  displayName: string;
  status: string;
  businessProfile: {
    legalName: string;
    tradeName: string | null;
    crNumber: string;
    crExpiry: string | null;
    vatNumber: string | null;
    verificationStatus: string;
  } | null;
  addresses: { id: string; district: string | null; street: string | null; buildingNumber: string | null; isRegistered: boolean }[];
  licenses: { id: string; licenseType: string; number: string; status: string; documentId: string; expiresAt: string | null }[];
  bankAccounts: { id: string; bankName: string; accountHolderName: string; ibanLast4: string; status: string; payoutHoldUntil: string | null }[];
  workspaces: { workspace: Workspace; status: string }[];
  files: { id: string; purpose: string; mimeType: string; originalName: string | null; scanStatus: string; createdAt: string }[];
  verificationCases: {
    id: string;
    workspace: Workspace;
    status: KybStatus;
    submittedAt: string | null;
    decidedAt: string | null;
    items: { id: string; type: "BUSINESS_PROFILE" | "LICENSE" | "BANK_ACCOUNT" | "ACTIVITY" | "DOCUMENT"; refId: string; status: ItemStatus; reasonNote: string | null }[];
  }[];
}
