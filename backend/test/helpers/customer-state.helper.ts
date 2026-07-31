import type { TypeORMService } from '../../src/typeorm/typeorm.service';

/** Removes user-scoped rows left over from prior e2e runs so suites that
 * reuse fixed OTP phones stay deterministic on a non-truncated test DB. */
export async function resetCustomerPhones(
  typeorm: TypeORMService,
  phones: string[],
) {
  const users = await typeorm.user.findMany({
    where: { phone: { in: phones } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const linkedMembers = await typeorm.clubMember.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const memberIds = linkedMembers.map((m) => m.id);
  if (memberIds.length > 0) {
    await typeorm.clubCardRequest.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await typeorm.clubPointsEntry.deleteMany({
      where: { clubMemberId: { in: memberIds } },
    });
    await typeorm.clubMember.updateMany({
      where: { id: { in: memberIds } },
      data: { userId: null, cardStatus: 'NONE', cardNo: null, points: 0 },
    });
  }

  await typeorm.savedPassenger.deleteMany({
    where: { userId: { in: userIds } },
  });
  await typeorm.savedBankAccount.deleteMany({
    where: { userId: { in: userIds } },
  });
  await typeorm.savedFlight.deleteMany({
    where: { userId: { in: userIds } },
  });

  const identityRows = await typeorm.customerIdentityVerification.findMany({
    where: { userId: { in: userIds } },
    select: { idCardFileId: true },
  });
  const fileIds = identityRows
    .map((r) => r.idCardFileId)
    .filter((id): id is string => Boolean(id));
  await typeorm.customerIdentityVerification.deleteMany({
    where: { userId: { in: userIds } },
  });
  if (fileIds.length > 0) {
    await typeorm.storedFile.deleteMany({ where: { id: { in: fileIds } } });
  }

  await typeorm.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      fullName: '',
      nationalIdEnc: null,
      nationalIdHash: null,
      birthDate: null,
    },
  });
}
