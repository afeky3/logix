// TODO(S2): replace with GET /admin/verification-cases (module 02-verification-kyb.md, D10).
export type KybStatus = "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
export type Workspace = "CUSTOMER" | "SUPPLIER" | "PROVIDER";

export interface KybRow {
  id: string;
  submittedAt: string;
  organization: string;
  workspace: Workspace;
  activities: string[];
  crNumber: string;
  city: string;
  itemsAccepted: number;
  itemsTotal: number;
  resubmissions: number;
  assignedTo: string | null;
  status: KybStatus;
}

export const mockKybRows: KybRow[] = [
  {
    id: "1",
    submittedAt: "2026-09-28T08:12:00Z",
    organization: "Al Masar Transport",
    workspace: "PROVIDER",
    activities: ["TRANSPORT_CARRIER"],
    crNumber: "1010123456",
    city: "Riyadh",
    itemsAccepted: 2,
    itemsTotal: 4,
    resubmissions: 0,
    assignedTo: null,
    status: "UNDER_REVIEW",
  },
  {
    id: "2",
    submittedAt: "2026-09-27T14:40:00Z",
    organization: "Gulf Freight Forwarders",
    workspace: "PROVIDER",
    activities: ["FREIGHT_SEA", "FREIGHT_AIR"],
    crNumber: "4030654321",
    city: "Jeddah",
    itemsAccepted: 5,
    itemsTotal: 5,
    resubmissions: 1,
    assignedTo: "Sara T.",
    status: "SUBMITTED",
  },
  {
    id: "3",
    submittedAt: "2026-09-25T09:05:00Z",
    organization: "Packaging Factory Co.",
    workspace: "SUPPLIER",
    activities: [],
    crNumber: "1010987654",
    city: "Dammam",
    itemsAccepted: 1,
    itemsTotal: 3,
    resubmissions: 2,
    assignedTo: "Omar K.",
    status: "CHANGES_REQUESTED",
  },
  {
    id: "4",
    submittedAt: "2026-09-24T11:00:00Z",
    organization: "Ahmed Bin Salem (customer)",
    workspace: "CUSTOMER",
    activities: [],
    crNumber: "2050112233",
    city: "Riyadh",
    itemsAccepted: 3,
    itemsTotal: 3,
    resubmissions: 0,
    assignedTo: "Sara T.",
    status: "APPROVED",
  },
  {
    id: "5",
    submittedAt: "2026-09-20T16:22:00Z",
    organization: "National Warehousing Ltd.",
    workspace: "PROVIDER",
    activities: ["WAREHOUSE"],
    crNumber: "1010556677",
    city: "Jeddah",
    itemsAccepted: 0,
    itemsTotal: 4,
    resubmissions: 0,
    assignedTo: null,
    status: "REJECTED",
  },
];
