/** HttpOnly refresh-token cookie — never readable from client JS
 * (planning/web_dashboard/md/02-architecture.md §2). */
export const REFRESH_COOKIE = 'logix_staff_refresh';

export function refreshCookieOptions(maxAgeDays = 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}
