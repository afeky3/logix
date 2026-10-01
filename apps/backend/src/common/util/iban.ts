/** Standard ISO 7064 mod-97 IBAN checksum, scoped to Saudi IBANs (24 chars,
 * `SA` prefix) per backend/md/modules/02-organizations-kyb-terms.md
 * "Bank accounts". */
export function isValidSaudiIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^SA\d{22}$/.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));

  // mod-97 over a (potentially huge) numeric string, done in chunks so it
  // never needs BigInt or overflows a regular number.
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(`${remainder}${numeric.slice(i, i + 7)}`) % 97;
  }
  return remainder === 1;
}
