import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import {
  EXTERNAL_SERVICE_SEED,
  INTERNAL_SERVICE_SEED,
  PERMISSION_CATALOG,
} from '../src/modules/it-manager/permission-catalog';

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

  // ── Phase 4: cartable demo items + a referral in each state ────────────
  // Mirrors the design mocks' taskDefs/referrals seeds so the panels open
  // with realistic content. Only generated once (idempotent re-runs).
  const ceo = staffByUsername.get('ceo')!;
  const chair = staffByUsername.get('chair')!;

  const existingCartableCount = await prisma.cartableTask.count();
  if (existingCartableCount === 0) {
    const cartableSeeds = [
      {
        assigneeId: ceo.id,
        category: 'ADMIN' as const,
        title: 'درخواست مرخصی تیم پشتیبانی',
        description: 'درخواست هماهنگی مرخصی سه‌نفره تیم پشتیبانی برای هفته آینده.',
        senderLabelFa: 'علی حسینی · پشتیبانی',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        assigneeId: ceo.id,
        category: 'AGENCY' as const,
        title: 'درخواست افزایش سقف اعتبار آژانس blujet',
        description: 'آژانس blujet درخواست افزایش سقف اعتبار برای فصل پیک سفر دارد.',
        senderId: commercialManager.id,
        senderLabelFa: 'رضا مرادی · مدیر بازرگانی',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      },
      {
        assigneeId: ceo.id,
        category: 'MANAGER' as const,
        title: 'گزارش انحراف بودجه تبلیغات',
        description: 'انحراف ۱۲٪ نسبت به بودجه مصوب تبلیغات — نیازمند تصمیم مدیریت.',
        senderId: financeManager.id,
        senderLabelFa: 'سحر کاظمی · مدیر مالی',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        assigneeId: chair.id,
        category: 'MANAGER' as const,
        title: 'گزارش عملکرد فصلی هیئت مدیره',
        description: 'پیش‌نویس گزارش عملکرد فصل برای بازبینی و تأیید نهایی.',
        senderId: ceo.id,
        senderLabelFa: 'محمد رحیمی · مدیر عامل',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        assigneeId: financeManager.id,
        category: 'AGENCY' as const,
        title: 'بررسی تسویه معوق آژانس پرواز آسیا',
        description: 'بدهی معوق بیش از ۳۰ روز — نیازمند تصمیم درباره ادامه همکاری.',
        senderId: commercialManager.id,
        senderLabelFa: 'رضا مرادی · مدیر بازرگانی',
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        assigneeId: commercialManager.id,
        category: 'ADMIN' as const,
        title: 'به‌روزرسانی قرارداد همکاری آژانس‌ها',
        description: 'نسخه جدید قرارداد استاندارد همکاری آماده بازبینی است.',
        senderLabelFa: 'ادمین سایت',
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
      {
        assigneeId: seniorManager.id,
        category: 'MANAGER' as const,
        title: 'درخواست بازنگری دسترسی پنل مالی',
        description: 'درخواست بازبینی سطوح دسترسی پنل مالی پس از تغییرات اخیر.',
        senderId: financeManager.id,
        senderLabelFa: 'سحر کاظمی · مدیر مالی',
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      },
    ];
    for (const t of cartableSeeds) {
      await prisma.cartableTask.create({ data: t });
    }

    // One referral per status so the Senior Manager tab shows all 4 KPI states.
    const referralSeeds: {
      title: string;
      body: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'SENT' | 'REVIEWING' | 'REPORTED' | 'CLOSED';
      recipientIds: string[];
      dueAt?: Date;
      report?: { fromId: string; body: string };
    }[] = [
      {
        title: 'درخواست گزارش فروش سه‌ماهه',
        body: 'گزارش تفکیکی فروش سه‌ماهه اخیر به تفکیک کانال فروش ارسال شود.',
        priority: 'HIGH',
        status: 'SENT',
        recipientIds: [financeManager.id],
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'بازنگری نرخ کمیسیون آژانس‌ها',
        body: 'پیشنهاد نرخ کمیسیون جدید برای آژانس‌های سطح طلایی تهیه شود.',
        priority: 'MEDIUM',
        status: 'REVIEWING',
        recipientIds: [commercialManager.id],
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'گزارش وضعیت مطالبات معوق',
        body: 'فهرست کامل مطالبات معوق آژانس‌ها به همراه پیشنهاد اقدام ارائه شود.',
        priority: 'HIGH',
        status: 'REPORTED',
        recipientIds: [financeManager.id],
        report: {
          fromId: financeManager.id,
          body: 'گزارش مطالبات معوق پیوست شد؛ دو آژانس نیازمند پیگیری حقوقی هستند.',
        },
      },
      {
        title: 'جمع‌بندی کمپین تخفیف تابستان',
        body: 'نتایج کمپین تخفیف تابستان جمع‌بندی و ارسال شود.',
        priority: 'LOW',
        status: 'CLOSED',
        recipientIds: [commercialManager.id],
        report: {
          fromId: commercialManager.id,
          body: 'گزارش کمپین پیوست است؛ نرخ تبدیل ۱۸٪ بالاتر از هدف بود.',
        },
      },
    ];
    for (const r of referralSeeds) {
      const referral = await prisma.managerReferral.create({
        data: {
          fromId: seniorManager.id,
          title: r.title,
          body: r.body,
          priority: r.priority,
          status: r.status,
          dueAt: r.dueAt,
          recipients: { create: r.recipientIds.map((id) => ({ recipientId: id })) },
        },
      });
      if (r.report) {
        await prisma.managerReferralReport.create({
          data: { referralId: referral.id, fromId: r.report.fromId, body: r.report.body },
        });
      }
      // Delivery wiring (⚑): each recipient gets a cartable task, except for
      // CLOSED seeds whose loop is already finished.
      if (r.status !== 'CLOSED') {
        for (const recipientId of r.recipientIds) {
          await prisma.cartableTask.create({
            data: {
              assigneeId: recipientId,
              category: 'MANAGER',
              title: r.title,
              description: r.body,
              senderId: seniorManager.id,
              senderLabelFa: 'محمد رحیمی · مدیر ارشد',
              sourceType: 'MANAGER_REFERRAL',
              sourceId: referral.id,
              status: r.status === 'REPORTED' ? 'APPROVED' : 'OPEN',
              resolutionNote: r.status === 'REPORTED' ? 'گزارش ثبت و ارسال شد.' : undefined,
              resolvedAt: r.status === 'REPORTED' ? new Date() : undefined,
            },
          });
        }
      }
    }
  }

  // ── Phase 5: club members (one per tier/card state) + card requests ────
  // National IDs below are valid per the official checksum but synthetic.
  const existingClubCount = await prisma.clubMember.count();
  if (existingClubCount === 0) {
    const memberSeeds = [
      {
        fullName: 'نگار رضایی',
        email: 'negar@email.example',
        nationalId: '0012345679',
        birthDate: new Date('1993-08-05'),
        joinDate: new Date('2025-05-31'),
        points: 12450,
        level: 'GOLD' as const,
        cardStatus: 'ISSUED' as const,
        cardNo: 'GOLD-8842',
        issuedByLabelFa: 'رئیس هیئت مدیره (تأیید درخواست)',
      },
      {
        fullName: 'محمد کریمی',
        email: 'mkarimi@email.example',
        nationalId: '0023456787',
        birthDate: new Date('1988-02-11'),
        joinDate: new Date('2025-09-10'),
        points: 6200,
        level: 'GOLD' as const,
        cardStatus: 'REVIEW' as const,
      },
      {
        fullName: 'سارا احمدی',
        email: 'sahmadi@email.example',
        nationalId: '0034567895',
        birthDate: new Date('1996-12-01'),
        joinDate: new Date('2026-01-20'),
        points: 2100,
        level: 'SILVER' as const,
        cardStatus: 'NONE' as const,
      },
      {
        fullName: 'علی مرادی',
        email: 'amoradi@email.example',
        nationalId: '0045678901',
        birthDate: new Date('1985-06-25'),
        joinDate: new Date('2024-11-02'),
        points: 18800,
        level: 'PLATINUM' as const,
        cardStatus: 'ISSUED' as const,
        cardNo: 'PLAT-1290',
        issuedByLabelFa: 'مدیر ارشد (صدور مستقیم)',
      },
    ];

    const members: Record<string, string> = {};
    for (const m of memberSeeds) {
      const { nationalId, ...rest } = m;
      const created = await prisma.clubMember.create({
        data: {
          ...rest,
          nationalIdEnc: encryptPii(nationalId),
          nationalIdHash: hashPii(nationalId),
        },
      });
      members[m.fullName] = created.id;
    }

    await prisma.clubCardRequest.create({
      data: {
        memberId: members['محمد کریمی'],
        level: 'GOLD',
        points: 6200,
        status: 'REFERRED',
        assignedTo: 'SENIOR',
        history: [
          { step: 'submitted', labelFa: 'رسیدن به حد امتیاز و ثبت درخواست صدور کارت', at: '۱۴۰۵/۰۴/۰۲ - ۱۰:۱۲' },
          { step: 'referred', labelFa: 'ارجاع به مدیر ارشد توسط ادمین سایت', at: '۱۴۰۵/۰۴/۰۲ - ۱۱:۳۰' },
        ],
      },
    });
    await prisma.clubCardRequest.create({
      data: {
        memberId: members['سارا احمدی'],
        level: 'SILVER',
        points: 5100,
        status: 'REFERRED',
        assignedTo: 'CHAIR',
        history: [
          { step: 'submitted', labelFa: 'رسیدن به حد امتیاز و ثبت درخواست صدور کارت', at: '۱۴۰۵/۰۴/۱۰ - ۰۹:۰۵' },
          { step: 'referred', labelFa: 'ارجاع به رئیس هیئت مدیره توسط ادمین سایت', at: '۱۴۰۵/۰۴/۱۰ - ۱۰:۴۵' },
        ],
      },
    });
    await prisma.clubCardRequest.create({
      data: {
        memberId: members['نگار رضایی'],
        level: 'GOLD',
        points: 12450,
        status: 'APPROVED',
        assignedTo: 'CHAIR',
        cardNo: 'GOLD-8842',
        history: [
          { step: 'submitted', labelFa: 'رسیدن به حد امتیاز و ثبت درخواست صدور کارت', at: '۱۴۰۴/۰۳/۱۲ - ۰۸:۲۰' },
          { step: 'referred', labelFa: 'ارجاع به رئیس هیئت مدیره توسط ادمین سایت', at: '۱۴۰۴/۰۳/۱۲ - ۰۹:۱۵' },
          { step: 'approved', labelFa: 'تأیید و صدور کارت طلایی', at: '۱۴۰۴/۰۳/۱۳ - ۱۲:۴۰' },
        ],
      },
    });
  }

  // ── Phase 6: pricing proposals (one pending, one registered) ───────────
  const existingProposalCount = await prisma.farePricingProposal.count();
  if (existingProposalCount === 0) {
    // Two future SCHEDULED instances so the pricing list has fresh rows.
    for (const daysAhead of [10, 20]) {
      const departureAt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      await prisma.flightInstance.create({
        data: {
          flightId: flight.id,
          departureAt,
          arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
          capacity: 180,
          charterSeats: 60,
          status: 'SCHEDULED',
        },
      });
    }
    const scheduled = await prisma.flightInstance.findMany({
      where: { status: 'SCHEDULED', pricing: null },
      take: 2,
      orderBy: { departureAt: 'desc' },
    });
    const ceoUser = staffByUsername.get('ceo')!;
    if (scheduled[0]) {
      await prisma.farePricingProposal.create({
        data: {
          flightInstanceId: scheduled[0].id,
          basePriceIrr: 38_000_000,
          competitorPriceIrr: 39_000_000,
          proposedPriceIrr: 38_500_000,
          legalRateIrr: 42_000_000,
          note: 'قیمت کمی پایین‌تر از رقبا برای پرکردن صندلی‌های آزاد.',
          proposedById: commercialManager.id,
          status: 'PENDING',
        },
      });
    }
    if (scheduled[1]) {
      await prisma.farePricingProposal.create({
        data: {
          flightInstanceId: scheduled[1].id,
          basePriceIrr: 40_000_000,
          competitorPriceIrr: 42_000_000,
          proposedPriceIrr: 41_000_000,
          legalRateIrr: 45_000_000,
          note: 'تعهد چارتری بالا؛ قیمت متعادل پیشنهاد شد.',
          proposedById: commercialManager.id,
          status: 'REGISTERED',
          registeredPriceIrr: 41_000_000,
          approvedById: ceoUser.id,
          approvedAt: new Date(),
        },
      });
    }
  }

  // ── Phase 7: penalty rules (design's 4-bracket engine) + refund seeds ──
  if ((await prisma.refundPenaltyRule.count()) === 0) {
    await prisma.refundPenaltyRule.createMany({
      data: [
        { minHoursBeforeDeparture: 72, penaltyPct: 30, labelFa: 'بیش از ۷۲ ساعت مانده به پرواز' },
        { minHoursBeforeDeparture: 24, penaltyPct: 50, labelFa: 'بین ۲۴ تا ۷۲ ساعت مانده' },
        { minHoursBeforeDeparture: 3, penaltyPct: 70, labelFa: 'بین ۳ تا ۲۴ ساعت مانده' },
        { minHoursBeforeDeparture: 0, penaltyPct: 100, labelFa: 'کمتر از ۳ ساعت / پس از پرواز' },
      ],
    });
  }

  if ((await prisma.refundRequest.count()) === 0) {
    const someBooking = await prisma.booking.findFirst({ where: { status: 'TICKETED' } });
    if (someBooking) {
      const financeStaffName = 'مریم کاظمی';
      const refundSeeds = [
        {
          passengerName: 'رضا کریمی',
          status: 'SUBMITTED' as const,
          totalPaidIrr: 25_000_000,
          penaltyPct: 30,
          history: [
            { step: 'submitted', labelFa: 'ثبت درخواست کنسلی توسط مشتری — جریمه ٪۳۰', at: 'امروز · ۰۹:۱۵' },
          ],
        },
        {
          passengerName: 'مهدی صادقی',
          status: 'REVIEW' as const,
          totalPaidIrr: 31_000_000,
          penaltyPct: 30,
          history: [
            { step: 'submitted', labelFa: 'ثبت درخواست کنسلی توسط مشتری — جریمه ٪۳۰', at: 'دیروز · ۱۶:۰۲' },
            { step: 'review', labelFa: 'بررسی توسط ادمین سایت', at: 'امروز · ۰۸:۴۰' },
          ],
        },
        {
          passengerName: 'سارا محمدی',
          status: 'FINANCE' as const,
          totalPaidIrr: 42_000_000,
          penaltyPct: 50,
          assigneeLabel: financeStaffName,
          history: [
            { step: 'submitted', labelFa: 'ثبت درخواست کنسلی توسط مشتری — جریمه ٪۵۰', at: '۲ روز پیش · ۱۱:۲۰' },
            { step: 'review', labelFa: 'بررسی توسط ادمین سایت', at: '۲ روز پیش · ۱۴:۰۵' },
            { step: 'finance', labelFa: `ارجاع به ${financeStaffName} (کارشناس مالی) توسط ادمین سایت`, at: 'دیروز · ۰۹:۳۰' },
          ],
        },
        {
          passengerName: 'نگار رضایی',
          status: 'PAID' as const,
          totalPaidIrr: 41_000_000,
          penaltyPct: 30,
          history: [
            { step: 'submitted', labelFa: 'ثبت درخواست کنسلی توسط مشتری — جریمه ٪۳۰', at: 'هفته پیش' },
            { step: 'review', labelFa: 'بررسی توسط ادمین سایت', at: 'هفته پیش' },
            { step: 'finance', labelFa: 'ارجاع به مدیر مالی توسط ادمین سایت', at: '۶ روز پیش' },
            { step: 'paid', labelFa: 'تأیید، واریز وجه و بستن پرونده توسط مدیر مالی', at: '۵ روز پیش' },
          ],
        },
      ];
      for (const r of refundSeeds) {
        const penaltyAmountIrr = Math.round((r.totalPaidIrr * r.penaltyPct) / 100);
        const created = await prisma.refundRequest.create({
          data: {
            bookingId: someBooking.id,
            passengerName: r.passengerName,
            nidEnc: encryptPii('0012345679'),
            mobileEnc: encryptPii('09121112233'),
            ibanEnc: encryptPii('IR820170000000332211009900'),
            totalPaidIrr: r.totalPaidIrr,
            penaltyPct: r.penaltyPct,
            penaltyAmountIrr,
            refundableIrr: r.totalPaidIrr - penaltyAmountIrr,
            status: r.status,
            paidAt: r.status === 'PAID' ? new Date() : undefined,
            processedById: r.status === 'PAID' ? financeManager.id : undefined,
            history: r.history,
          },
        });
        // The PAID seed keeps the ledger consistent with its state.
        if (r.status === 'PAID') {
          await prisma.ledgerEntry.create({
            data: {
              bookingId: someBooking.id,
              type: 'REFUND',
              signedAmountIrr: -created.refundableIrr,
              createdById: financeManager.id,
            },
          });
        }
      }
    }
  }

  // ─── Phase 9: Reservation system (seat lock / PNR) ─────────────────────
  const chairUser = staffByUsername.get('chair')!;

  await prisma.aircraftSeatMap.upsert({
    where: { aircraftType: 'Airbus A320' },
    update: {},
    create: {
      aircraftType: 'Airbus A320',
      // Matches ReservationSystem.dc.html's MD-88 mock numbers verbatim:
      // rows 3-6 business 2-2 (16 seats), rows 7-32 economy 2-3 (130 seats).
      businessRowStart: 3,
      businessRowEnd: 6,
      businessColsLeft: ['A', 'B'],
      businessColsRight: ['C', 'D'],
      economyRowStart: 7,
      economyRowEnd: 32,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['C', 'D', 'E'],
    },
  });

  const demoInstance = await prisma.flightInstance.findFirst({
    where: { flightId: flight.id, status: 'SCHEDULED' },
    orderBy: { departureAt: 'asc' },
  });
  if (demoInstance) {
    const existingPax = await prisma.passenger.count({
      where: { booking: { flightInstanceId: demoInstance.id } },
    });
    if (existingPax === 0) {
      const demoPassengers: { name: string; seat: string }[] = [
        { name: 'نگار رضایی', seat: '3A' },
        { name: 'سارا احمدی', seat: '3C' },
        { name: 'کیوان حسینی', seat: '9A' },
        { name: 'یاسمن مرادی', seat: '9D' },
        { name: 'رضا احمدی', seat: '12B' },
      ];
      for (const p of demoPassengers) {
        const booking = await prisma.booking.create({
          data: {
            pnr: `BJDEMO${p.seat}`,
            flightInstanceId: demoInstance.id,
            channel: 'SYSTEM',
            status: 'TICKETED',
            priceIrr: 38_000_000,
          },
        });
        await prisma.passenger.create({
          data: { bookingId: booking.id, fullName: p.name, seatCode: p.seat },
        });
        await prisma.ledgerEntry.create({
          data: { bookingId: booking.id, type: 'SALE', signedAmountIrr: 38_000_000 },
        });
      }
      // One demo managerial lock so the seat map/lock UI has real data —
      // already APPROVED (Phase 13D) with a real future hold-to-ticket
      // deadline, not the schema's placeholder migration defaults.
      await prisma.seatLock.create({
        data: {
          flightInstanceId: demoInstance.id,
          seatCode: '4A',
          lockedById: chairUser.id,
          passengerName: 'رزرو مدیریتی — رئیس هیئت مدیره',
          reason: 'بازدید رسمی هیئت مدیره',
          classification: 'PAYABLE',
          requesterRank: 'BOARD_CHAIR',
          approvalStatus: 'APPROVED',
          approvedById: staffByUsername.get('ceo')!.id,
          approvedAt: new Date(),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }
  }

  // ─── Phase 8: Employee management (IT Manager) ────────────────────────
  const itManager = staffByUsername.get('itadmin')!;

  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { dept_key: { dept: p.dept, key: p.key } },
      update: { sectionLabelFa: p.sectionLabelFa, labelFa: p.labelFa },
      create: p,
    });
  }

  for (const s of INTERNAL_SERVICE_SEED) {
    await prisma.internalService.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, nameFa: s.nameFa, uptimePct: s.uptimePct, enabled: true },
    });
  }
  // "استرداد آنلاین" starts disabled — matches the design mock's svcDefs.
  await prisma.internalService.updateMany({
    where: { key: 'refund' },
    data: { enabled: false },
  });

  for (const s of EXTERNAL_SERVICE_SEED) {
    await prisma.externalServiceConfig.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        nameFa: s.nameFa,
        provider: s.provider,
        endpoint: s.endpoint,
        enabled: true,
      },
    });
  }
  // "نقشه و مسیریابی نشان" starts disabled — matches the design mock's extDefs.
  await prisma.externalServiceConfig.updateMany({
    where: { key: 'ext_neshan' },
    data: { enabled: false },
  });

  await prisma.securityPolicy.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const commercialEmployee = await prisma.user.upsert({
    where: { username: 'sales.moradi' },
    update: {},
    create: {
      role: 'EMPLOYEE',
      username: 'sales.moradi',
      passwordHash,
      fullName: 'یاسمن مرادی',
      dept: 'commercial',
      rank: 'کارشناس',
      referralScope: 'MANAGERS_ONLY',
      createdById: itManager.id,
      isActive: true,
    },
  });
  const financeEmployee = await prisma.user.upsert({
    where: { username: 'fin.hosseini' },
    update: {},
    create: {
      role: 'EMPLOYEE',
      username: 'fin.hosseini',
      passwordHash,
      fullName: 'کیوان حسینی',
      dept: 'finance',
      rank: 'کارشناس ارشد',
      referralScope: 'MANAGERS_ONLY',
      createdById: itManager.id,
      isActive: false,
    },
  });
  for (const [employee, keys] of [
    [commercialEmployee, ['ag_list', 'fl_view']],
    [financeEmployee, ['rf_list']],
  ] as const) {
    const perms = await prisma.permission.findMany({ where: { key: { in: keys as unknown as string[] } } });
    for (const perm of perms) {
      await prisma.employeePermission.upsert({
        where: { employeeId_permissionId: { employeeId: employee.id, permissionId: perm.id } },
        update: {},
        create: { employeeId: employee.id, permissionId: perm.id, grantedById: itManager.id },
      });
    }
  }

  // ── Phase 10: airport catalog + flight-management seed ────────────────
  const AIRPORTS: Array<[string, string, string]> = [
    ['THR', 'تهران', 'Asia/Tehran'],
    ['MHD', 'مشهد', 'Asia/Tehran'],
    ['SYZ', 'شیراز', 'Asia/Tehran'],
    ['IFN', 'اصفهان', 'Asia/Tehran'],
    ['TBZ', 'تبریز', 'Asia/Tehran'],
    ['KIH', 'کیش', 'Asia/Tehran'],
    ['GSM', 'قشم', 'Asia/Tehran'],
    ['BND', 'بندرعباس', 'Asia/Tehran'],
    ['AWZ', 'اهواز', 'Asia/Tehran'],
    ['RAS', 'رشت', 'Asia/Tehran'],
    ['SRY', 'ساری', 'Asia/Tehran'],
    ['GBT', 'گرگان', 'Asia/Tehran'],
    ['KER', 'کرمان', 'Asia/Tehran'],
    ['KSH', 'کرمانشاه', 'Asia/Tehran'],
    ['OMH', 'ارومیه', 'Asia/Tehran'],
    ['ADU', 'اردبیل', 'Asia/Tehran'],
    ['ZAH', 'زاهدان', 'Asia/Tehran'],
    ['BUZ', 'بوشهر', 'Asia/Tehran'],
    ['AZD', 'یزد', 'Asia/Tehran'],
    ['PGU', 'عسلویه', 'Asia/Tehran'],
    ['DXB', 'دبی', 'Asia/Dubai'],
    ['IST', 'استانبول', 'Europe/Istanbul'],
    ['NJF', 'نجف', 'Asia/Baghdad'],
  ];
  for (const [code, cityFa, tz] of AIRPORTS) {
    await prisma.airport.upsert({
      where: { code },
      update: { cityFa, tz },
      create: { code, cityFa, tz },
    });
  }

  // Seeded per-route durations (the add-flight form has no arrival input).
  await prisma.route.updateMany({
    where: { originCode: 'THR', destCode: 'DXB' },
    data: { durationMin: 180 },
  });

  // Base prices for existing instances so the active/completed tables have
  // the design's «قیمت پایه/نرخ اصلی» figures without fabricating margins.
  await prisma.flightInstance.updateMany({
    where: { basePriceIrr: null },
    data: { basePriceIrr: 38_000_000 },
  });

  // A couple of future SCHEDULED instances for the پروازهای آینده sub-tab
  // (charter commitment set, plan/AI left empty for the E2E to exercise).
  const futureCount = await prisma.flightInstance.count({
    where: { departureAt: { gt: new Date(Date.now() + 8 * 24 * 3_600_000) } },
  });
  if (futureCount === 0) {
    for (const daysAhead of [12, 16]) {
      const dep = new Date(Date.now() + daysAhead * 24 * 3_600_000);
      await prisma.flightInstance.create({
        data: {
          flightId: flight.id,
          departureAt: dep,
          arrivalAt: new Date(dep.getTime() + 3 * 3_600_000),
          capacity: 180,
          charterSeats: 60,
          status: 'SCHEDULED',
          basePriceIrr: 38_000_000,
        },
      });
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
