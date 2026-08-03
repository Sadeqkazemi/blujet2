import type { PrismaService } from '../../src/prisma/prisma.service';
import { normalizeIranPhone } from '../../src/common/normalize-iran-phone';

/** Removes user-scoped rows left over from prior e2e runs so suites that
 * reuse fixed OTP phones stay deterministic on a non-truncated test DB.
 * The real OTP login flow (auth.service.ts) normalizes phones to E.164
 * before storing them, so the lookup must normalize too — matching on
 * the raw local-form strings never found the rows, silently no-opping. */
export async function resetCustomerPhones(
  prisma: PrismaService,
  phones: string[],
) {
  const normalized = phones.map(normalizeIranPhone);
  const users = await prisma.user.findMany({
    where: { phone: { in: normalized } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const linkedMembers = await prisma.clubMember.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const memberIds = linkedMembers.map((m) => m.id);
  if (memberIds.length > 0) {
    await prisma.clubCardRequest.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await prisma.clubPointsEntry.deleteMany({
      where: { clubMemberId: { in: memberIds } },
    });
    await prisma.clubMember.updateMany({
      where: { id: { in: memberIds } },
      data: { userId: null, cardStatus: 'NONE', cardNo: null, points: 0 },
    });
  }

  await prisma.savedPassenger.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.savedBankAccount.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.savedFlight.deleteMany({
    where: { userId: { in: userIds } },
  });

  const identityRows = await prisma.customerIdentityVerification.findMany({
    where: { userId: { in: userIds } },
    select: { idCardFileId: true },
  });
  const fileIds = identityRows
    .map((r) => r.idCardFileId)
    .filter((id): id is string => Boolean(id));
  await prisma.customerIdentityVerification.deleteMany({
    where: { userId: { in: userIds } },
  });
  if (fileIds.length > 0) {
    await prisma.storedFile.deleteMany({ where: { id: { in: fileIds } } });
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      fullName: '',
      nationalIdEnc: null,
      nationalIdHash: null,
      birthDate: null,
    },
  });
}
