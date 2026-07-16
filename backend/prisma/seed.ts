import 'dotenv/config';
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

  const staffByUsername = new Map<string, { id: string }>();
  for (const s of staff) {
    const user = await prisma.user.upsert({
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
    staffByUsername.set(s.username, user);
  }
  const seniorManager = staffByUsername.get('senior.rahimi')!;
  const commercialManager = staffByUsername.get('comm.abbasi')!;
  const financeManager = staffByUsername.get('finance.karimi')!;

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

  const agencyUserGold = await prisma.user.upsert({
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

  const agencyUserSilver = await prisma.user.upsert({
    where: { phone: '+989120000003' },
    update: {},
    create: {
      role: 'AGENCY',
      phone: '+989120000003',
      passwordHash,
      fullName: 'آژانس پرواز آسیا',
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

  // Sample bookings/ledger entries are only generated once — re-running the
  // seed (e.g. after a later phase adds more seed data) must stay idempotent.
  const existingBookingCount = await prisma.booking.count();
  for (let monthsAgo = 0; existingBookingCount === 0 && monthsAgo < 6; monthsAgo++) {
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
          // Bulk historical bookings stay agencyId-less — they exist to give
          // the SYSTEM/CHARTER/AGENCY sales-chart bars real totals, not to
          // represent any one agency's outstanding balance (see the small,
          // explicitly-sized agency bookings added in the Phase 3 block below).
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

  // ── Phase 3: agency profiles, credit, membership requests, invoices ────
  await prisma.agencyProfile.upsert({
    where: { userId: agencyUserGold.id },
    update: {},
    create: {
      userId: agencyUserGold.id,
      licenseNo: 'AG-10234',
      managerName: 'کامران یوسفی',
      phone: '+989120000002',
      email: 'info@blujet-agency.example',
      city: 'تهران',
      address: 'تهران، خیابان ولیعصر، پلاک ۱۲۰',
      tier: 'GOLD',
      joinedAt: new Date('2023-04-10'),
    },
  });

  await prisma.agencyProfile.upsert({
    where: { userId: agencyUserSilver.id },
    update: {},
    create: {
      userId: agencyUserSilver.id,
      licenseNo: 'AG-10891',
      managerName: 'سارا نجفی',
      phone: '+989120000003',
      email: 'info@asia-flight.example',
      city: 'مشهد',
      address: 'مشهد، بلوار وکیل‌آباد، پلاک ۴۵',
      tier: 'SILVER',
      suspendedAt: new Date('2026-06-01'),
      suspendReason: 'عدم تسویه بدهی معوق بیش از ۳۰ روز',
      joinedAt: new Date('2024-01-15'),
    },
  });

  // NOTE: limitIrr/amountIrr/priceIrr/signedAmountIrr are Postgres `integer`
  // (max ~2.14e9) — fine for dev seed data and single-ticket/invoice amounts,
  // but a real agency credit line or yearly-revenue aggregate could exceed
  // that. Tracked in PLAN.md as a pre-launch item (Int → BigInt migration).
  await prisma.agencyCreditLine.upsert({
    where: { agencyId: agencyUserGold.id },
    update: {},
    create: { agencyId: agencyUserGold.id, limitIrr: 1_800_000_000, updatedById: financeManager.id },
  });

  await prisma.agencyCreditLine.upsert({
    where: { agencyId: agencyUserSilver.id },
    update: {},
    create: { agencyId: agencyUserSilver.id, limitIrr: 900_000_000, updatedById: financeManager.id },
  });

  // A handful of agency-attributed bookings/sale entries, sized to give the
  // credit-used derivation real (but modest — see PLAN.md's Int-column note)
  // numbers: gold stays under its limit, silver goes over it (matches its
  // "suspended for overdue debt" seed narrative above).
  const anyInstance = await prisma.flightInstance.findFirst();
  if (anyInstance) {
    const agencyBookingSeeds: { agencyId: string; count: number; pricePerTicketIrr: number }[] = [
      { agencyId: agencyUserGold.id, count: 4, pricePerTicketIrr: 190_000_000 },
      { agencyId: agencyUserSilver.id, count: 7, pricePerTicketIrr: 190_000_000 },
    ];
    for (const s of agencyBookingSeeds) {
      for (let i = 0; i < s.count; i++) {
        const existing = await prisma.booking.findUnique({
          where: { pnr: `BJAG${s.agencyId.slice(0, 4)}${i}` },
        });
        if (existing) continue;

        const booking = await prisma.booking.create({
          data: {
            pnr: `BJAG${s.agencyId.slice(0, 4)}${i}`,
            flightInstanceId: anyInstance.id,
            channel: 'AGENCY',
            agencyId: s.agencyId,
            status: 'TICKETED',
            priceIrr: s.pricePerTicketIrr,
          },
        });
        await prisma.ledgerEntry.create({
          data: {
            bookingId: booking.id,
            agencyId: s.agencyId,
            type: 'SALE',
            signedAmountIrr: s.pricePerTicketIrr,
          },
        });
      }
    }
  }

  await prisma.agencyApiKey.upsert({
    where: { keyHash: 'seed-dev-only-key-hash-gold' },
    update: {},
    create: {
      agencyId: agencyUserGold.id,
      keyHash: 'seed-dev-only-key-hash-gold',
      scope: 'FULL',
      status: 'ACTIVE',
    },
  });

  const invoicePaid = await prisma.agencyInvoice.upsert({
    where: { invoiceNo: 'INV-1001' },
    update: {},
    create: {
      agencyId: agencyUserGold.id,
      invoiceNo: 'INV-1001',
      issuedById: commercialManager.id,
      issuedAt: new Date('2026-05-01'),
      dueAt: new Date('2026-05-15'),
      amountIrr: 450_000_000,
      status: 'PAID',
      paidAt: new Date('2026-05-10'),
    },
  });

  await prisma.ledgerEntry.upsert({
    where: { id: 'seed-settlement-inv-1001' },
    update: {},
    create: {
      id: 'seed-settlement-inv-1001',
      agencyId: agencyUserGold.id,
      type: 'SETTLEMENT',
      signedAmountIrr: -invoicePaid.amountIrr,
      occurredAt: invoicePaid.paidAt!,
      createdById: financeManager.id,
    },
  });

  await prisma.agencyInvoice.upsert({
    where: { invoiceNo: 'INV-1002' },
    update: {},
    create: {
      agencyId: agencyUserGold.id,
      invoiceNo: 'INV-1002',
      issuedById: commercialManager.id,
      issuedAt: new Date('2026-06-20'),
      dueAt: new Date('2026-07-05'),
      amountIrr: 800_000_000,
      status: 'UNPAID',
    },
  });

  await prisma.agencyInvoice.upsert({
    where: { invoiceNo: 'INV-1003' },
    update: {},
    create: {
      agencyId: agencyUserSilver.id,
      invoiceNo: 'INV-1003',
      issuedById: commercialManager.id,
      issuedAt: new Date('2026-05-20'),
      dueAt: new Date('2026-06-05'),
      amountIrr: 300_000_000,
      status: 'OVERDUE',
    },
  });

  await prisma.agencyMessage.createMany({
    data: [
      {
        agencyId: agencyUserGold.id,
        senderId: commercialManager.id,
        senderIsAgency: false,
        body: 'سلام، لطفاً فاکتور شماره INV-1002 را تا پایان هفته تسویه بفرمایید.',
        createdAt: new Date('2026-07-01'),
      },
      {
        agencyId: agencyUserGold.id,
        senderId: agencyUserGold.id,
        senderIsAgency: true,
        body: 'سلام، حتماً تا پنجشنبه پرداخت انجام می‌شود.',
        createdAt: new Date('2026-07-02'),
      },
    ],
    skipDuplicates: true,
  });

  const membershipRequests: {
    applicantName: string;
    managerName: string;
    licenseNo: string;
    city: string;
    phone: string;
    email: string;
    status: 'PENDING' | 'REFERRED' | 'APPROVED' | 'REJECTED';
    referredToId?: string;
    reviewNote?: string;
    reviewedById?: string;
    reviewedAt?: Date;
  }[] = [
    {
      applicantName: 'آژانس ستاره شرق',
      managerName: 'بهرام قاسمی',
      licenseNo: 'AG-20011',
      city: 'اصفهان',
      phone: '+989130000001',
      email: 'info@setareh-sharq.example',
      status: 'PENDING',
    },
    {
      applicantName: 'آژانس کیش پرواز',
      managerName: 'مریم اکبری',
      licenseNo: 'AG-20034',
      city: 'کیش',
      phone: '+989130000002',
      email: 'info@kish-parvaz.example',
      status: 'REFERRED',
      referredToId: financeManager.id,
      reviewNote: 'لطفاً وضعیت اعتباری متقاضی بررسی شود.',
      reviewedById: seniorManager.id,
      reviewedAt: new Date('2026-07-05'),
    },
    {
      applicantName: 'آژانس پیام سفر',
      managerName: 'حسین طاهری',
      licenseNo: 'AG-19987',
      city: 'شیراز',
      phone: '+989130000003',
      email: 'info@payam-safar.example',
      status: 'REJECTED',
      reviewNote: 'مدارک مجوز فعالیت ناقص بود.',
      reviewedById: commercialManager.id,
      reviewedAt: new Date('2026-06-18'),
    },
  ];

  for (const r of membershipRequests) {
    const existing = await prisma.agencyMembershipRequest.findFirst({ where: { licenseNo: r.licenseNo } });
    if (!existing) {
      await prisma.agencyMembershipRequest.create({ data: r });
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
