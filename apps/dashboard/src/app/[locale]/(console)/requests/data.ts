// Shapes returned by GET /admin/service-requests and GET /admin/service-requests/:id
// (apps/backend/src/modules/requests/admin-requests.service.ts). See module
// 05-requests-quotes-matching.md "Dashboard: request monitor, zero-quote
// alerts, quote anomaly view".
export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "QUOTED"
  | "AWAITING_PAYMENT"
  | "CONVERTED"
  | "EXPIRED"
  | "CANCELLED";

export interface RequestRow {
  id: string;
  reference: string;
  serviceType: string;
  status: RequestStatus;
  customerName: string;
  originSummary: string | null;
  destinationSummary: string | null;
  vehicleTypeCode: string | null;
  matchedProviderCount: number;
  quoteCount: number;
  flags: string[];
  submittedAt: string | null;
  expiresAt: string | null;
  isZeroQuoteAlert: boolean;
}

export interface RequestMatch {
  providerName: string;
  notifiedAt: string | null;
  viewedAt: string | null;
  quotedAt: string | null;
  declinedAt: string | null;
}

export interface RequestQuote {
  id: string;
  providerName: string;
  status: string;
  totalAmountHalalas: number;
  validUntil: string;
  submittedAt: string;
  isAnomaly: boolean;
}

export interface RequestDetail extends Omit<RequestRow, "vehicleTypeCode" | "matchedProviderCount" | "quoteCount" | "isZeroQuoteAlert"> {
  notes: string | null;
  transport: Record<string, unknown> | null;
  storage?: Record<string, unknown> | null;
  customs?: { movement: string | null; billOfLadingNo: string | null; documents: { doc_type: string; original_name: string | null }[] } | null;
  matches: RequestMatch[];
  quotes: RequestQuote[];
}
