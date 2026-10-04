// Shapes returned by GET /admin/orders and GET /admin/orders/:id
// (apps/backend/src/modules/orders/admin-orders.service.ts). See
// backend/md/12-execution-plan.md S4 scope.
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "VOID"
  | "CONFIRMED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "ACTIVE"
  | "CLOSING"
  | "AWAITING_ACCEPTANCE"
  | "DISPUTED"
  | "COMPLETED"
  | "CANCELLATION_REQUESTED"
  | "CANCELLED";

export interface OrderRow {
  id: string;
  reference: string;
  serviceType: string;
  status: OrderStatus;
  paymentStatus: string;
  customerName: string;
  providerName: string;
  totalAmountHalalas: number;
  createdAt: string;
  confirmedAt: string | null;
  scheduledAt: string | null;
}

export interface PaymentIntentRow {
  id: string;
  status: string;
  amountHalalas: number;
  gateway: string;
  expiresAt: string;
  paidAt: string | null;
  failureCode: string | null;
  createdAt: string;
}

export interface OrderDetail extends OrderRow {
  vatAmountHalalas: number;
  commissionAmountHalalas: number;
  netToProviderHalalas: number;
  completedAt: string | null;
  requestReference: string;
  originSummary: string | null;
  destinationSummary: string | null;
  paymentIntents: PaymentIntentRow[];
}
