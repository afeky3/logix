/** App user access/refresh token claims (backend/md/05-api-conventions.md §3). */
export interface AppTokenPayload {
  sub: string; // users.id
  sid: string; // sessions.id
  aud: 'app';
}

/** Staff console token claims — separate audience (06-security-compliance.md §1). */
export interface StaffTokenPayload {
  sub: string; // staff_users.id
  sid: string; // staff_sessions.id
  aud: 'staff';
}
