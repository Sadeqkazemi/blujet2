import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Known dev password for every seeded staff account — dev/test only, never production. */
const STAFF_PASSWORD = 'Blujet@1404';

async function main() {
  const passwordHash = await argon2.hash(STAFF_PASSWORD);

  const staff: { username: string; fullName: string; role: 'EMPLOYEE' | 'IT_MANAGER' | 'COMMERCIAL_MANAGER' | 'FINANCE_MANAGER' | 'SENIOR_MANAGER' | 'CEO' | 'BOARD_CHAIR' | 'SITE_ADMIN' }[] = [
    { username: 'com.ahmadi', fullName: 'رضا احمدی', role: 'EMPLOYEE' },
    { username: 'itadmin', fullName: 'مهندس علی صدر', role: 'IT_MANAGER' },
    { username: 'comm.abbasi', fullName: 'رضا مرادی', role: 'COMMERCIAL_MANAGER' },
    { username: 'finance.karimi', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER' },
    { username: 'senior.rahimi', fullName: 'محمد رحیمی', role: 'SENIOR_MANAGER' },
    { username: 'ceo', fullName: 'محمد رحیمی', role: 'CEO' },
    { username: 'chair', fullName: 'رئیس هیئت مدیره', role: 'BOARD_CHAIR' },
    { username: 'site.admin', fullName: 'ادمین سایت', role: 'SITE_ADMIN' },
  ];

  for (const s of staff) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: {
        role: s.role,
        username: s.username,
        passwordHash,
        fullName: s.fullName,
        twoFactorEnabled: true,
        isActive: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { phone: '+989120000001' },
    update: {},
    create: {
      role: 'USER',
      phone: '+989120000001',
      fullName: 'نگار رضایی',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { phone: '+989120000002' },
    update: {},
    create: {
      role: 'AGENCY',
      phone: '+989120000002',
      passwordHash,
      fullName: 'آژانس blujet',
      isActive: true,
    },
  });

  // ── Minimal flight/booking/ledger data so the reporting dashboards have
  // real, non-empty numbers to show across day/month/quarter granularities.
  const route = await prisma.route.upsert({
    where: { originCode_destCode: { originCode: 'THR', destCode: 'DXB' } },
    update: {},
    create: { originCode: 'THR', destCode: 'DXB' },
  });

  const flight = await prisma.flight.upsert({
    where: { flightNo: 'EP-821' },
    update: {},
    create: { flightNo: 'EP-821', routeId: route.id, aircraftType: 'Airbus A320' },
  });

  const now = new Date();
  const channels: Array<'SYSTEM' | 'CHARTER' | 'AGENCY'> = ['SYSTEM', 'CHARTER', 'AGENCY'];

  for (let monthsAgo = 0; monthsAgo < 6; monthsAgo++) {
    for (let day = 0; day < 4; day++) {
      const departureAt = new Date(now);
      departureAt.setMonth(departureAt.getMonth() - monthsAgo);
      departureAt.setDate(5 + day * 6);

      const instance = await prisma.flightInstance.create({
        data: {
          flightId: flight.id,
          departureAt,
          arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
          capacity: 180,
          charterSeats: 60,
          status: monthsAgo === 0 && day === 0 ? 'SCHEDULED' : 'DEPARTED',
        },
      });

      for (const channel of channels) {
        const seatCount = channel === 'SYSTEM' ? 60 : channel === 'CHARTER' ? 45 : 30;
        const priceIrr = 38_000_000;

        for (let i = 0; i < seatCount; i += 10) {
          const booking = await prisma.booking.create({
            data: {
              pnr: `BJ${monthsAgo}${day}${channel[0]}${i}`,
              flightInstanceId: instance.id,
              channel,
              status: 'TICKETED',
              priceIrr: priceIrr * 10,
              createdAt: departureAt,
            },
          });

          await prisma.ledgerEntry.create({
            data: {
              bookingId: booking.id,
              type: 'SALE',
              signedAmountIrr: priceIrr * 10,
              occurredAt: departureAt,
            },
          });
        }
      }
    }
  }

  console.log('Seed complete.');
  console.log(`Staff dev password (all roles): ${STAFF_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
