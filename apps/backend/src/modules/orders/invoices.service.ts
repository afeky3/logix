import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

type OrderRow = Prisma.ordersGetPayload<Record<string, never>>;

/**
 * The tax invoice the provider issues to the customer through the platform
 * (client workflow: "the customer receives a payment receipt and an official
 * tax invoice"). Issued the moment the order is paid — and again for every
 * paid cycle of a recurring contract; GET /orders/:id/invoice also issues it
 * lazily for orders that were paid before this existed.
 * ZATCA clearance isn't wired — rows start PENDING for the worker that will do it.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: an invoice problem must not undo a payment that already succeeded. */
  async issueForOrderSafely(orderId: string): Promise<string | null> {
    try {
      return await this.issueForOrder(orderId);
    } catch (err) {
      this.logger.error(`Invoice issuing failed for order ${orderId}`, err instanceof Error ? err.stack : String(err));
      return null;
    }
  }

  async issueForCycleSafely(cycleId: string): Promise<string | null> {
    try {
      return await this.issueForCycle(cycleId);
    } catch (err) {
      this.logger.error(`Invoice issuing failed for cycle ${cycleId}`, err instanceof Error ? err.stack : String(err));
      return null;
    }
  }

  /** The order's first invoice. */
  async issueForOrder(orderId: string): Promise<string> {
    const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
    if (order.payment_status !== 'PAID') throw new AppError('BUSINESS_RULE_VIOLATION', 'Order is not paid');
    return this.createInvoice(order, {
      lockKey: `invoice:${orderId}`,
      issuedAt: order.confirmed_at ?? new Date(),
      suffix: '',
      alreadyIssued: async (tx) =>
        (
          await tx.invoices.findFirst({
            where: { order_id: orderId, invoice_type: 'SERVICE_INVOICE' },
            orderBy: { issue_at: 'asc' },
            select: { id: true },
          })
        )?.id ?? null,
    });
  }

  /** One invoice per paid billing cycle of a recurring contract. */
  async issueForCycle(cycleId: string): Promise<string> {
    const cycle = await this.prisma.contract_cycles.findUniqueOrThrow({
      where: { id: cycleId },
      include: { recurring_contracts: true },
    });
    if (cycle.status !== 'PAID') throw new AppError('BUSINESS_RULE_VIOLATION', 'This cycle is not paid');
    if (cycle.invoice_id) return cycle.invoice_id;
    const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: cycle.recurring_contracts.order_id } });
    const id = await this.createInvoice(order, {
      lockKey: `invoice-cycle:${cycleId}`,
      issuedAt: cycle.paid_at ?? new Date(),
      suffix: ` · cycle ${cycle.cycle_no}`,
      alreadyIssued: async (tx) =>
        (await tx.contract_cycles.findUnique({ where: { id: cycleId }, select: { invoice_id: true } }))?.invoice_id ?? null,
    });
    await this.prisma.$executeRaw`
      UPDATE svc.contract_cycles SET invoice_id = ${id}::uuid WHERE id = ${cycleId}::uuid AND invoice_id IS NULL
    `;
    return id;
  }

  private async createInvoice(
    order: OrderRow,
    opts: {
      lockKey: string;
      issuedAt: Date;
      suffix: string;
      alreadyIssued: (tx: Prisma.TransactionClient) => Promise<string | null>;
    },
  ): Promise<string> {
    const [customerOrg, providerProfile, customerProfile] = await Promise.all([
      this.prisma.organizations.findUniqueOrThrow({ where: { id: order.customer_org_id }, select: { display_name: true } }),
      this.prisma.business_profiles.findUnique({ where: { organization_id: order.provider_org_id } }),
      this.prisma.business_profiles.findUnique({ where: { organization_id: order.customer_org_id } }),
    ]);

    const invoiceId = randomUUID();
    const year = opts.issuedAt.getUTCFullYear();

    const serviceFee = Number(order.service_fee);
    const charges = Number(order.charges_total);
    const passThrough = Number(order.pass_through_total);
    const totalVat = Number(order.vat_amount);
    const rate = order.vat_rate_bps;
    const chargesVat = Math.round((charges * rate) / 10000);
    const lines = [
      { description: `Service fee${opts.suffix}`, amount: serviceFee, vat: totalVat - chargesVat, passThrough: false },
      ...(charges > 0
        ? [{ description: `Additional charges${opts.suffix}`, amount: charges, vat: chargesVat, passThrough: false }]
        : []),
      ...(passThrough > 0
        ? [{ description: `Pass-through costs${opts.suffix}`, amount: passThrough, vat: 0, passThrough: true }]
        : []),
    ];

    // The advisory lock makes a concurrent payment-time and lazy issue produce one invoice.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${opts.lockKey}))`;
      const again = await opts.alreadyIssued(tx);
      if (again) return again;

      const rows = await tx.$queryRaw<{ last_number: number }[]>`
        INSERT INTO fin.invoice_sequences (issuer_key, year, last_number)
        VALUES (${order.provider_org_id}, ${year}::smallint, 1)
        ON CONFLICT (issuer_key, year) DO UPDATE SET last_number = fin.invoice_sequences.last_number + 1
        RETURNING last_number
      `;
      const number = `INV-${year}-${String(rows[0].last_number).padStart(6, '0')}`;

      await tx.$executeRaw`
        INSERT INTO fin.invoices (
          id, number, invoice_type, issuer_type, issuer_org_id, issuer_vat_number,
          recipient_org_id, recipient_name, recipient_vat_number, order_id,
          issue_at, currency, subtotal, vat_amount, total
        ) VALUES (
          ${invoiceId}::uuid, ${number}, 'SERVICE_INVOICE'::core.invoice_type, 'ORGANIZATION',
          ${order.provider_org_id}::uuid, ${providerProfile?.vat_number ?? null},
          ${order.customer_org_id}::uuid, ${customerProfile?.legal_name ?? customerOrg.display_name},
          ${customerProfile?.vat_number ?? null}, ${order.id}::uuid,
          ${opts.issuedAt}::timestamptz, ${order.currency}::core.currency_code,
          ${order.subtotal}::core.halalas, ${order.vat_amount}::core.halalas, ${order.total_amount}::core.halalas
        )
      `;
      for (const [i, l] of lines.entries()) {
        await tx.$executeRaw`
          INSERT INTO fin.invoice_lines (
            id, invoice_id, line_no, description, quantity, unit_price,
            line_subtotal, vat_rate_bps, vat_amount, is_pass_through
          ) VALUES (
            ${randomUUID()}::uuid, ${invoiceId}::uuid, ${i + 1}::smallint, ${l.description}, 1,
            ${l.amount}::core.halalas, ${l.amount}::core.halalas,
            ${l.passThrough ? 0 : rate}::core.bps, ${l.vat}::core.halalas, ${l.passThrough}
          )
        `;
      }
      return invoiceId;
    });
  }

  /** The order's invoice, or — for a recurring contract — the invoice of one cycle. */
  async getForOrder(userId: string, orderId: string, cycleId?: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const membership = await this.prisma.memberships.findFirst({
      where: {
        user_id: userId,
        organization_id: { in: [order.customer_org_id, order.provider_org_id] },
        status: 'ACTIVE',
      },
    });
    if (!membership) throw new AppError('FORBIDDEN', 'Not a party to this order');
    if (order.payment_status !== 'PAID') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'An invoice is issued once the order is paid');
    }

    let invoiceId: string;
    if (cycleId) {
      const cycle = await this.prisma.contract_cycles.findUnique({
        where: { id: cycleId },
        include: { recurring_contracts: true },
      });
      if (!cycle || cycle.recurring_contracts.order_id !== orderId) throw new AppError('NOT_FOUND', 'Cycle not found');
      invoiceId = await this.issueForCycle(cycleId);
    } else {
      invoiceId = await this.issueForOrder(orderId);
    }
    const invoice = await this.prisma.invoices.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { invoice_lines: { orderBy: { line_no: 'asc' } } },
    });
    const seller = invoice.issuer_org_id
      ? await this.prisma.organizations.findUnique({
          where: { id: invoice.issuer_org_id },
          select: { display_name: true, business_profiles: { select: { legal_name: true } } },
        })
      : null;

    return {
      id: invoice.id,
      number: invoice.number,
      issuedAt: invoice.issue_at,
      orderReference: order.reference,
      currency: invoice.currency,
      seller: {
        name: seller?.business_profiles?.legal_name ?? seller?.display_name ?? null,
        vatNumber: invoice.issuer_vat_number,
      },
      buyer: { name: invoice.recipient_name, vatNumber: invoice.recipient_vat_number },
      lines: invoice.invoice_lines.map((l) => ({
        description: l.description,
        amountHalalas: Number(l.line_subtotal),
        vatHalalas: Number(l.vat_amount),
        isPassThrough: l.is_pass_through,
      })),
      subtotalHalalas: Number(invoice.subtotal),
      vatHalalas: Number(invoice.vat_amount),
      totalHalalas: Number(invoice.total),
      zatcaStatus: invoice.zatca_status,
    };
  }
}
