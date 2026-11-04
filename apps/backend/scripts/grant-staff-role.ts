/**
 * Gives an existing staff user a built-in role. Idempotent: running it twice changes nothing.
 * Usage: npx tsx scripts/grant-staff-role.ts <email> [ROLE_CODE]   (default SUPER_ADMIN)
 * Run migrations 028a/028b first, they create the role.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const [email, roleCode = 'SUPER_ADMIN'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: tsx scripts/grant-staff-role.ts <email> [ROLE_CODE]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const staff = await prisma.staff_users.findUnique({ where: { email } });
    if (!staff) throw new Error(`No staff user with email ${email}`);
    const role = await prisma.staff_roles.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error(`Role ${roleCode} not found: apply migration 028b first`);

    const result = await prisma.staff_user_roles.createMany({
      data: [{ staff_user_id: staff.id, role_id: role.id }],
      skipDuplicates: true,
    });
    console.log(
      result.count === 1
        ? `Granted ${roleCode} to ${staff.email}.`
        : `${staff.email} already has ${roleCode}, nothing changed.`,
    );

    const roles = await prisma.staff_user_roles.findMany({
      where: { staff_user_id: staff.id },
      include: { staff_roles: { select: { code: true } } },
    });
    console.log(`Roles now: ${roles.map((r) => r.staff_roles.code).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
