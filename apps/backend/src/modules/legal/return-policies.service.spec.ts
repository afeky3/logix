import { AppError } from '../../common/errors/app-error';
import { ReturnPoliciesService } from './return-policies.service';

const SUPPLIER = 'org-supplier';
const OWNER = 'user-owner';
const body = { text: 'Returns accepted within 14 days if unopened.', returnWindowDays: 14, allowsReturn: true, allowsExchange: false };

/** In-memory versions + pointer, with a member table keyed "user|org". */
function setup(members: Record<string, string> = { [`${OWNER}|${SUPPLIER}`]: 'OWNER' }, suppliers = [SUPPLIER]) {
  const versions: Record<string, unknown>[] = [];
  let pointer: { organization_id: string; current_version_id: string } | null = null;
  const db = {
    $queryRaw: jest.fn(async () => []),
    memberships: {
      findUnique: jest.fn(async ({ where }: { where: { user_id_organization_id: { user_id: string; organization_id: string } } }) => {
        const k = where.user_id_organization_id;
        const role = members[`${k.user_id}|${k.organization_id}`];
        return role ? { role, status: 'ACTIVE' } : null;
      }),
    },
    org_workspaces: {
      findUnique: jest.fn(async ({ where }: { where: { organization_id_workspace: { organization_id: string } } }) =>
        suppliers.includes(where.organization_id_workspace.organization_id) ? { workspace: 'SUPPLIER' } : null,
      ),
    },
    organizations: { findUnique: jest.fn(async () => ({ id: SUPPLIER })) },
    return_policy_versions: {
      findFirst: jest.fn(async () => {
        const v = [...versions].sort((a, b) => (b.version as number) - (a.version as number))[0];
        return v ? { version: v.version } : null;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => versions.find((v) => v.id === where.id) ?? null),
      findMany: jest.fn(async () => [...versions].reverse()),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, created_at: new Date() };
        versions.push(row);
        return row;
      }),
      // There is deliberately no update/delete: versions are append-only.
    },
    return_policies: {
      findUnique: jest.fn(async () => pointer),
      upsert: jest.fn(async ({ create, update }: { create: typeof pointer; update: { current_version_id: string } }) => {
        pointer = pointer ? { ...pointer, current_version_id: update.current_version_id } : create;
      }),
    },
    users: { findMany: jest.fn(async () => [{ id: OWNER, full_name: 'Owner' }]) },
  };
  const tx = db as unknown as { $transaction: unknown };
  tx.$transaction = jest.fn(async (fn: (t: unknown) => unknown) => fn(db));
  return { service: new ReturnPoliciesService(db as never), versions };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('ReturnPoliciesService', () => {
  it('is null before the first PUT', async () => {
    expect(await setup().service.get(SUPPLIER)).toBeNull();
  });

  it('every PUT adds a version and keeps the old ones', async () => {
    const t = setup();
    const v1 = await t.service.put(SUPPLIER, OWNER, body);
    const v2 = await t.service.put(SUPPLIER, OWNER, { ...body, text: 'Exchanges only, within 7 days.', returnWindowDays: 7, allowsReturn: false, allowsExchange: true });

    expect(v1.version).toBe('1');
    expect(v2).toMatchObject({ version: '2', text: 'Exchanges only, within 7 days.', allowsExchange: true, returnWindowDays: 7 });
    expect(await t.service.get(SUPPLIER)).toMatchObject({ version: '2' });
    expect(t.versions.map((v) => [v.version, v.text])).toEqual([
      [1, body.text],
      [2, 'Exchanges only, within 7 days.'],
    ]);
    const history = await t.service.history(SUPPLIER);
    expect(history.currentVersion).toBe('2');
    expect(history.items.map((i) => [i.version, i.isCurrent])).toEqual([
      ['2', true],
      ['1', false],
    ]);
  });

  it('a member of another supplier cannot change it', async () => {
    const t = setup({ [`${OWNER}|${SUPPLIER}`]: 'OWNER', ['user-rival|org-rival']: 'OWNER' }, [SUPPLIER, 'org-rival']);
    expect((await failure(t.service.put(SUPPLIER, 'user-rival', body))).code).toBe('FORBIDDEN');
    expect(t.versions).toHaveLength(0);
  });

  it('a plain member cannot change it', async () => {
    const t = setup({ [`user-m|${SUPPLIER}`]: 'MEMBER' });
    expect((await failure(t.service.put(SUPPLIER, 'user-m', body))).httpStatus).toBe(403);
  });

  it('only a supplier account has a policy', async () => {
    const t = setup({ [`${OWNER}|${SUPPLIER}`]: 'OWNER' }, []);
    expect((await failure(t.service.put(SUPPLIER, OWNER, body))).code).toBe('FORBIDDEN');
  });
});
