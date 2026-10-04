import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Dashboard "order monitor" — the admin-facing half of S4, same pattern as
 * admin-requests.service.ts for S3. Staff-only, read-only. Surfaces VOID
 * orders (payment-expiry.service.ts) so ops can see how often a customer
 * accepts a quote and never pays. */
@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status?: string) {
    const rows = await this.prisma.orders.findMany({
      where: { status: status ? (status as never) : undefined },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        organizations_orders_customer_org_idToorganizations: { select: { display_name: true } },
        organizations_orders_provider_org_idToorganizations: { select: { display_name: true } },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      reference: o.reference,
      serviceType: o.service_type,
      status: o.status,
      paymentStatus: o.payment_status,
      customerName: o.organizations_orders_customer_org_idToorganizations.display_name,
      providerName: o.organizations_orders_provider_org_idToorganizations.display_name,
      totalAmountHalalas: Number(o.total_amount),
      createdAt: o.created_at,
      confirmedAt: o.confirmed_at,
      scheduledAt: o.scheduled_at,
    }));
  }

  async get(id: string) {
    const o = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        organizations_orders_customer_org_idToorganizations: { select: { display_name: true } },
        organizations_orders_provider_org_idToorganizations: { select: { display_name: true } },
        payment_intents: { orderBy: { created_at: 'desc' } },
        service_requests_orders_request_idToservice_requests: {
          select: { reference: true, origin_summary: true, destination_summary: true },
        },
      },
    });
    if (!o) throw new AppError('NOT_FOUND', 'Order not found');

    return {
      id: o.id,
      reference: o.reference,
      serviceType: o.service_type,
      status: o.status,
      paymentStatus: o.payment_status,
      customerName: o.organizations_orders_customer_org_idToorganizations.display_name,
      providerName: o.organizations_orders_provider_org_idToorganizations.display_name,
      totalAmountHalalas: Number(o.total_amount),
      vatAmountHalalas: Number(o.vat_amount),
      commissionAmountHalalas: Number(o.commission_amount),
      netToProviderHalalas: Number(o.net_to_provider),
      createdAt: o.created_at,
      confirmedAt: o.confirmed_at,
      scheduledAt: o.scheduled_at,
      completedAt: o.completed_at,
      requestReference: o.service_requests_orders_request_idToservice_requests.reference,
      originSummary: o.service_requests_orders_request_idToservice_requests.origin_summary,
      destinationSummary: o.service_requests_orders_request_idToservice_requests.destination_summary,
      paymentIntents: o.payment_intents.map((p) => ({
        id: p.id,
        status: p.status,
        amountHalalas: Number(p.amount),
        gateway: p.gateway,
        expiresAt: p.expires_at,
        paidAt: p.paid_at,
        failureCode: p.failure_code,
        createdAt: p.created_at,
      })),
    };
  }
}
