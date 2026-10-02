import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

export interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** Nominatim's `address.ISO3166-2-lvl4` — an authoritative ISO 3166-2
   * subdivision code (e.g. `SA-01` for Riyadh), verified live against all
   * 13 Saudi provinces (migrations/008's doc). Matched directly against
   * `ref.regions.code` by `resolveRegionCode` — no fuzzy name matching. */
  isoRegionCode?: string;
  countryCode?: string;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';
// Nominatim's usage policy requires an identifying User-Agent —
// https://operations.osmfoundation.org/policies/nominatim/ — unidentified
// traffic gets blocked.
const USER_AGENT = 'Logix-B2B-Logistics/1.0 (support@logix.sa)';

/**
 * Real geocoding + routing via OpenStreetMap's public services (Nominatim
 * for geocoding, OSRM's demo server for routing) — both free, no API key,
 * which is why they're the pick until the execution plan's open "maps
 * provider" decision is made for a production SLA/volume. Replaces the
 * purely-synthetic FakeMapsAdapter.
 *
 * Both are public demo infrastructure with informal rate limits (~1 req/s)
 * and no uptime guarantee, so every call degrades to the same deterministic
 * synthetic estimate FakeMapsAdapter used (never fails/blocks the request
 * flow — a route estimate is "illustrative" either way, per
 * backend/md/modules/05-requests-quotes-matching.md §1).
 */
@Injectable()
export class OsmMapsAdapter {
  private readonly logger = new Logger(OsmMapsAdapter.name);

  async geocode(label: string): Promise<GeocodeResult | null> {
    try {
      const url = `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(label)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{
        lat: string;
        lon: string;
        address?: { 'ISO3166-2-lvl4'?: string; country_code?: string };
      }>;
      const row = rows[0];
      if (!row) return null;
      return {
        lat: Number(row.lat),
        lon: Number(row.lon),
        isoRegionCode: row.address?.['ISO3166-2-lvl4'],
        countryCode: row.address?.country_code?.toUpperCase(),
      };
    } catch (err) {
      this.logger.warn(`Geocode failed for "${label}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async estimateRoute(pickupLabel: string, dropoffLabel: string): Promise<RouteEstimate> {
    const { estimate } = await this.resolveRoute(pickupLabel, dropoffLabel);
    return estimate;
  }

  /** Geocodes both ends once and returns the route estimate alongside the
   * raw geocode results, so a caller that also needs region resolution
   * (runMatching) doesn't geocode the same two labels twice. */
  async resolveRoute(
    pickupLabel: string,
    dropoffLabel: string,
  ): Promise<{ estimate: RouteEstimate; pickup: GeocodeResult | null; dropoff: GeocodeResult | null }> {
    const [pickup, dropoff] = await Promise.all([this.geocode(pickupLabel), this.geocode(dropoffLabel)]);
    const real = pickup && dropoff ? await this.route(pickup, dropoff) : null;
    const estimate = real ?? this.syntheticEstimate(pickupLabel, dropoffLabel);
    return { estimate, pickup, dropoff };
  }

  private async route(a: GeocodeResult, b: GeocodeResult): Promise<RouteEstimate | null> {
    try {
      const url = `${OSRM_BASE}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const body = (await res.json()) as { routes?: Array<{ distance: number; duration: number }> };
      const route = body.routes?.[0];
      if (!route) return null;
      return {
        distanceKm: Math.round(route.distance / 100) / 10, // m -> km, 1 decimal
        durationMin: Math.round(route.duration / 60),
      };
    } catch (err) {
      this.logger.warn(`OSRM route failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /** Same deterministic fallback FakeMapsAdapter used — kept so a geocoding
   * outage never blocks the request flow, just loses real-world accuracy
   * for that one estimate. */
  private syntheticEstimate(pickupLabel: string, dropoffLabel: string): RouteEstimate {
    const hash = createHash('sha1').update(`${pickupLabel}|${dropoffLabel}`).digest();
    const km = 80 + (hash.readUInt16BE(0) % 1400);
    const minutes = Math.round((km / 65) * 60);
    return { distanceKm: km, durationMin: minutes };
  }

  /** Nominatim's ISO code is authoritative, so this is an exact lookup
   * against our seeded ref.regions, not a guess. Still returns `null`
   * when geocoding didn't resolve one (e.g. outside Saudi, or the
   * service was unreachable) — callers treat `null` as "don't restrict
   * matching on this request" rather than as a hard failure. */
  resolveRegionCode(result: GeocodeResult | null, regions: { code: string }[]): string | null {
    if (!result?.isoRegionCode) return null;
    return regions.some((r) => r.code === result.isoRegionCode) ? result.isoRegionCode : null;
  }
}
