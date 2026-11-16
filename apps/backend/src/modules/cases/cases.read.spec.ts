import { CasesService } from './cases.service';

const USER = 'user-1';
const ORG = 'org-1';
const ID = '11111111-1111-4111-8111-111111111111';

const base = {
  id: ID,
  reference: 'CASE-260001',
  case_type: 'DAMAGE_SHORTAGE',
  status: 'OPEN',
  subject_reference: 'LX-260001',
  description: 'Two boxes were damaged',
  opened_by_org_id: ORG,
  created_at: new Date('2026-11-10T09:00:00Z'),
  updated_at: new Date('2026-11-12T09:00:00Z'),
  first_responded_at: null as Date | null,
  resolved_at: null as Date | null,
  resolution_note: null as string | null,
  closed_at: null as Date | null,
};

function setup(row: Partial<typeof base> | null = {}, member = true) {
  const prisma = {
    memberships: { findUnique: jest.fn(async () => (member ? { status: 'ACTIVE' } : null)) },
    cases: {
      findFirst: jest.fn(async () => (row ? { ...base, ...row } : null)),
      findMany: jest.fn(async () => [{ ...base, ...row }]),
    },
    case_internal_notes: { findMany: jest.fn() },
  };
  return { service: new CasesService(prisma as never, {} as never), prisma };
}

describe('GET /cases?organizationId', () => {
  it('lists the cases the organization opened, in the agreed shape, newest first', async () => {
    const t = setup();
    expect(await t.service.list(USER, ORG)).toEqual([
      { id: ID, reference: 'CASE-260001', caseType: 'DAMAGE_SHORTAGE', status: 'OPEN', orderReference: 'LX-260001', createdAt: base.created_at },
    ]);
    expect(t.prisma.cases.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { opened_by_org_id: ORG }, orderBy: { created_at: 'desc' } }));
  });

  it('is for members only: 403 and nothing read', async () => {
    const t = setup({}, false);
    await expect(t.service.list(USER, ORG)).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    expect(t.prisma.cases.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /cases/:id', () => {
  it('finds a case by id and by reference', async () => {
    const byId = setup();
    await byId.service.get(USER, ID);
    expect(byId.prisma.cases.findFirst).toHaveBeenCalledWith({ where: { id: ID } });

    const byRef = setup();
    await byRef.service.get(USER, 'CASE-260001');
    expect(byRef.prisma.cases.findFirst).toHaveBeenCalledWith({ where: { reference: 'CASE-260001' } });
  });

  it('returns the agreed fields with an OPENED event carrying the description', async () => {
    const res = await setup().service.get(USER, ID);
    expect(res).toMatchObject({
      id: ID, reference: 'CASE-260001', caseType: 'DAMAGE_SHORTAGE', status: 'OPEN', orderReference: 'LX-260001',
      description: 'Two boxes were damaged', createdAt: base.created_at, updatedAt: base.updated_at,
    });
    expect(res.events).toEqual([{ type: 'OPENED', at: base.created_at, note: 'Two boxes were damaged' }]);
  });

  it('the timeline only holds what happened, in order: first answer, resolution with its note, closing', async () => {
    const res = await setup({
      status: 'CLOSED',
      first_responded_at: new Date('2026-11-10T10:00:00Z'),
      resolved_at: new Date('2026-11-11T10:00:00Z'),
      resolution_note: 'Refund issued',
      closed_at: new Date('2026-11-12T10:00:00Z'),
    }).service.get(USER, ID);
    expect(res.events.map((e) => [e.type, e.note])).toEqual([
      ['OPENED', 'Two boxes were damaged'],
      ['FIRST_RESPONSE', null],
      ['RESOLVED', 'Refund issued'],
      ['CLOSED', null],
    ]);
  });

  it('staff internal notes are never read', async () => {
    const t = setup();
    await t.service.get(USER, ID);
    expect(t.prisma.case_internal_notes.findMany).not.toHaveBeenCalled();
  });

  it('another organization\'s case is 403, a missing one is 404', async () => {
    await expect(setup({}, false).service.get(USER, ID)).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    await expect(setup(null).service.get(USER, ID)).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('a case with no owner organization is not shown to anyone', async () => {
    await expect(setup({ opened_by_org_id: null as never }).service.get(USER, ID)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
