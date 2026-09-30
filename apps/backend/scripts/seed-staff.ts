/**
 * Seeds one staff user for testing the admin console login (S1).
 * Usage: npx tsx scripts/seed-staff.ts <email> <password> <full name>
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: tsx scripts/seed-staff.ts <email> <password> [full name]');
    process.exit(1);
  }
  const fullName = nameParts.join(' ') || 'Admin';

  const prisma = new PrismaClient();
  const existing = await prisma.staff_users.findUnique({ where: { email } });
  if (existing) {
    console.log(`Staff user ${email} already exists (id ${existing.id}).`);
    await prisma.$disconnect();
    return;
  }

  const staff = await prisma.staff_users.create({
    data: {
      id: randomUUID(),
      email,
      full_name: fullName,
      password_hash: await argon2.hash(password),
      // DB check constraint ck_staff_active_2fa forbids ACTIVE without TOTP
      // enrolled. Status flips to ACTIVE on first successful mfa/verify.
      status: 'INVITED',
    },
  });
  console.log(`Created staff user ${staff.email} (id ${staff.id}).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
