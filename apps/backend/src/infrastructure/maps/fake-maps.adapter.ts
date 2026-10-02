import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
}

/**
 * Stand-in for the real maps/geocoding provider — no vendor or API key has
 * been decided yet (not in the execution plan's decisions list, unlike
 * D-05/T-04 which have an explicit "until decided" row). Same shape as
 * `FakeSmsAdapter`/`WhatsAppOtpSender`: a deterministic fake today, swapped
 * for a real HTTP client behind this same interface once a provider is
 * chosen.
 *
 * It has no real coordinates to route (pickup/dropoff are free-text labels
 * — see requests.service.ts class doc), so it derives a stable-but-varied
 * estimate from the two label strings themselves: same pair of labels
 * always gives the same numbers, different pairs give different ones.
 * Shown to the user as "illustrative" per
 * backend/md/modules/05-requests-quotes-matching.md §1.
 */
@Injectable()
export class FakeMapsAdapter {
  estimateRoute(pickupLabel: string, dropoffLabel: string): RouteEstimate {
    const hash = createHash('sha1').update(`${pickupLabel}|${dropoffLabel}`).digest();
    const km = 80 + (hash.readUInt16BE(0) % 1400); // 80–1480 km
    const avgSpeedKmh = 65;
    const minutes = Math.round((km / avgSpeedKmh) * 60);
    return { distanceKm: km, durationMin: minutes };
  }
}
