import { OsmMapsAdapter } from '../../infrastructure/maps/osm-maps.adapter';
import { timeOf } from './requests.service';

describe('timeOf: a Postgres time as HH:mm', () => {
  it('reads the hour and minute, not the date', () => {
    expect(timeOf(new Date('1970-01-01T08:30:00Z'))).toBe('08:30');
    expect(timeOf(new Date('1970-01-01T23:05:00Z'))).toBe('23:05');
    expect(timeOf(new Date('1970-01-01T00:00:00Z'))).toBe('00:00');
  });
  it('is null when there is none', () => {
    expect(timeOf(null)).toBeNull();
    expect(timeOf(undefined)).toBeNull();
  });
  it('round-trips what the service stores', () => {
    for (const t of ['00:00', '08:30', '12:45', '23:59']) expect(timeOf(new Date(`1970-01-01T${t}:00Z`))).toBe(t);
  });
});

describe('route estimate says where the distance came from (G)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const geo = { ok: true, json: async () => [{ lat: '24.7', lon: '46.7', address: { 'ISO3166-2-lvl4': 'SA-01', country_code: 'sa' } }] };

  it('ROUTED when the routing service answered', async () => {
    global.fetch = jest.fn(async (url: string | URL | Request) =>
      String(url).includes('/route/v1/')
        ? ({ ok: true, json: async () => ({ routes: [{ distance: 850_000, duration: 36_000 }] }) } as Response)
        : (geo as unknown as Response),
    ) as typeof fetch;
    const { estimate } = await new OsmMapsAdapter().resolveRoute('Riyadh', 'Abha');
    expect(estimate).toEqual({ distanceKm: 850, durationMin: 600, source: 'ROUTED' });
  });

  it('ESTIMATED when the routing service is down (the fixed fallback)', async () => {
    global.fetch = jest.fn(async (url: string | URL | Request) =>
      String(url).includes('/route/v1/') ? ({ ok: false } as Response) : (geo as unknown as Response),
    ) as typeof fetch;
    const { estimate } = await new OsmMapsAdapter().resolveRoute('Riyadh', 'Abha');
    expect(estimate.source).toBe('ESTIMATED');
    expect(estimate.distanceKm).toBeGreaterThan(0);
  });

  it('ESTIMATED when a place cannot be found at all', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response) as typeof fetch;
    const { estimate } = await new OsmMapsAdapter().resolveRoute('nowhere', 'nowhere else');
    expect(estimate.source).toBe('ESTIMATED');
  });

  it('ESTIMATED when the network throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect((await new OsmMapsAdapter().resolveRoute('a', 'b')).estimate.source).toBe('ESTIMATED');
  });
});
