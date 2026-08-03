import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import argon2 from 'argon2';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { TypeORMClient } from '../generated/typeorm/client';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import {
  EXTERNAL_SERVICE_SEED,
  INTERNAL_SERVICE_SEED,
  PERMISSION_CATALOG,
} from '../src/modules/it-manager/permission-catalog';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

/** Known dev password for every seeded staff account — dev/test only, never production. */
const STAFF_PASSWORD = 'Blujet@1404';

async function main() {
  const passwordHash = await argon2.hash(STAFF_PASSWORD);

  const staff: { username: string; fullName: string; role: 'EMPLOYEE' | 'IT_MANAGER' | 'COMMERCIAL_MANAGER' | 'FINANCE_MANAGER' | 'SENIOR_MANAGER' | 'CEO' | 'BOARD_CHAIR' | 'SITE_ADMIN' }[] = [
    { username: 'com.ahmadi', fullName: 'رضا احمدی', role: 'EMPLOYEE' },
    { username: 'itadmin', fullName: 'مهندس علی صدر', role: 'IT_MANAGER' },
    { username: 'comm.abbasi', fullName: 'رضا مرادی', role: 'COMMERCIAL_MANAGER' },
    { username: 'finance', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER' },
    { username: 'senior.rahimi', fullName: 'محمد رحیمی', role: 'SENIOR_MANAGER' },
    { username: 'ceo', fullName: 'محمد رحیمی', role: 'CEO' },
    { username: 'chair', fullName: 'رئیس هیئت مدیره', role: 'BOARD_CHAIR' },
    { username: 'site.admin', fullName: 'ادمین سایت', role: 'SITE_ADMIN' },
  ];

  // Rename legacy seed username so re-seed on existing DBs picks up `finance`.
  await typeorm.user.updateMany({
    where: { username: 'finance.karimi' },
    data: { username: 'finance' },
  });

  const staffByUsername = new Map<string, { id: string }>();
  for (const s of staff) {
    const user = await typeorm.user.upsert({
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
  const financeManager = staffByUsername.get('finance')!;

  await typeorm.user.upsert({
    where: { phone: '+989120000001' },
    update: {},
    create: {
      role: 'USER',
      phone: '+989120000001',
      fullName: 'نگار رضایی',
      isActive: true,
    },
  });

  const agencyUserGold = await typeorm.user.upsert({
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

  const agencyUserSilver = await typeorm.user.upsert({
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
  const route = await typeorm.route.upsert({
    where: { originCode_destCode: { originCode: 'THR', destCode: 'DXB' } },
    update: {},
    create: { originCode: 'THR', destCode: 'DXB' },
  });

  const flight = await typeorm.flight.upsert({
    where: { flightNo: 'EP-821' },
    update: {},
    create: { flightNo: 'EP-821', routeId: route.id, aircraftType: 'Airbus A320' },
  });

  const now = new Date();
  const channels: Array<'SYSTEM' | 'CHARTER' | 'AGENCY'> = ['SYSTEM', 'CHARTER', 'AGENCY'];

  // Sample bookings/ledger entries are only generated once — re-running the
  // seed (e.g. after a later phase adds more seed data) must stay idempotent.
  const existingBookingCount = await typeorm.booking.count();
  for (let monthsAgo = 0; existingBookingCount === 0 && monthsAgo < 6; monthsAgo++) {
    for (let day = 0; day < 4; day++) {
      const departureAt = new Date(now);
      departureAt.setMonth(departureAt.getMonth() - monthsAgo);
      departureAt.setDate(5 + day * 6);

      const instance = await typeorm.flightInstance.create({
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
          const booking = await typeorm.booking.create({
            data: {
              pnr: `BJ${monthsAgo}${day}${channel[0]}${i}`,
              flightInstanceId: instance.id,
              channel,
              status: 'TICKETED',
              priceIrr: priceIrr * 10,
              createdAt: departureAt,
            },
          });

          await typeorm.ledgerEntry.create({
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
  await typeorm.agencyProfile.upsert({
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

  await typeorm.agencyProfile.upsert({
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
  await typeorm.agencyCreditLine.upsert({
    where: { agencyId: agencyUserGold.id },
    update: {},
    create: { agencyId: agencyUserGold.id, limitIrr: 1_800_000_000, updatedById: financeManager.id },
  });

  await typeorm.agencyCreditLine.upsert({
    where: { agencyId: agencyUserSilver.id },
    update: {},
    create: { agencyId: agencyUserSilver.id, limitIrr: 900_000_000, updatedById: financeManager.id },
  });

  // A handful of agency-attributed bookings/sale entries, sized to give the
  // credit-used derivation real (but modest — see PLAN.md's Int-column note)
  // numbers: gold stays under its limit, silver goes over it (matches its
  // "suspended for overdue debt" seed narrative above).
  const anyInstance = await typeorm.flightInstance.findFirst();
  if (anyInstance) {
    const agencyBookingSeeds: { agencyId: string; count: number; pricePerTicketIrr: number }[] = [
      { agencyId: agencyUserGold.id, count: 4, pricePerTicketIrr: 190_000_000 },
      { agencyId: agencyUserSilver.id, count: 7, pricePerTicketIrr: 190_000_000 },
    ];
    for (const s of agencyBookingSeeds) {
      for (let i = 0; i < s.count; i++) {
        const existing = await typeorm.booking.findUnique({
          where: { pnr: `BJAG${s.agencyId.slice(0, 4)}${i}` },
        });
        if (existing) continue;

        const booking = await typeorm.booking.create({
          data: {
            pnr: `BJAG${s.agencyId.slice(0, 4)}${i}`,
            flightInstanceId: anyInstance.id,
            channel: 'AGENCY',
            agencyId: s.agencyId,
            status: 'TICKETED',
            priceIrr: s.pricePerTicketIrr,
          },
        });
        await typeorm.ledgerEntry.create({
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

  await typeorm.agencyApiKey.upsert({
    where: { keyHash: 'seed-dev-only-key-hash-gold' },
    update: {},
    create: {
      agencyId: agencyUserGold.id,
      keyHash: 'seed-dev-only-key-hash-gold',
      scope: 'FULL',
      status: 'ACTIVE',
    },
  });

  const invoicePaid = await typeorm.agencyInvoice.upsert({
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

  await typeorm.ledgerEntry.upsert({
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

  await typeorm.agencyInvoice.upsert({
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

  await typeorm.agencyInvoice.upsert({
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

  await typeorm.agencyMessage.createMany({
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
    const existing = await typeorm.agencyMembershipRequest.findFirst({ where: { licenseNo: r.licenseNo } });
    if (!existing) {
      await typeorm.agencyMembershipRequest.create({ data: r });
    }
  }

  // ── Phase 4: cartable demo items + a referral in each state ────────────
  // Mirrors the design mocks' taskDefs/referrals seeds so the panels open
  // with realistic content. Only generated once (idempotent re-runs).
  const ceo = staffByUsername.get('ceo')!;
  const chair = staffByUsername.get('chair')!;

  const existingCartableCount = await typeorm.cartableTask.count();
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
      await typeorm.cartableTask.create({ data: t });
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
      const referral = await typeorm.managerReferral.create({
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
        await typeorm.managerReferralReport.create({
          data: { referralId: referral.id, fromId: r.report.fromId, body: r.report.body },
        });
      }
      // Delivery wiring (⚑): each recipient gets a cartable task, except for
      // CLOSED seeds whose loop is already finished.
      if (r.status !== 'CLOSED') {
        for (const recipientId of r.recipientIds) {
          await typeorm.cartableTask.create({
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
  const existingClubCount = await typeorm.clubMember.count();
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
      const created = await typeorm.clubMember.create({
        data: {
          ...rest,
          nationalIdEnc: encryptPii(nationalId),
          nationalIdHash: hashPii(nationalId),
        },
      });
      members[m.fullName] = created.id;
    }

    await typeorm.clubCardRequest.create({
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
    await typeorm.clubCardRequest.create({
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
    await typeorm.clubCardRequest.create({
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

  // ── Phase 65: club tier rules (singleton row, seeded once) ─────────────
  const existingTierRuleCount = await typeorm.clubTierRule.count();
  if (existingTierRuleCount === 0) {
    await typeorm.clubTierRule.create({ data: {} });
  }

  // Link the test USER to the seeded club member + backfill ledger so
  // GET /my/club/membership works for manual testing after seed.
  const testUser = await typeorm.user.findUnique({
    where: { phone: '+989120000001' },
    select: { id: true },
  });
  const negarMember = await typeorm.clubMember.findFirst({
    where: { fullName: 'نگار رضایی' },
  });
  if (testUser && negarMember) {
    if (!negarMember.userId) {
      await typeorm.clubMember.update({
        where: { id: negarMember.id },
        data: { userId: testUser.id },
      });
    }
    const entryCount = await typeorm.clubPointsEntry.count({
      where: { clubMemberId: negarMember.id },
    });
    if (entryCount === 0 && negarMember.points > 0) {
      await typeorm.clubPointsEntry.create({
        data: {
          clubMemberId: negarMember.id,
          type: 'EARN',
          signedPoints: negarMember.points,
        },
      });
    }
  }

  // Sample saved passengers for the test USER (پنل کاربر → مسافران)
  if (testUser) {
    const savedPaxCount = await typeorm.savedPassenger.count({
      where: { userId: testUser.id },
    });
    if (savedPaxCount === 0) {
      await typeorm.savedPassenger.createMany({
        data: [
          {
            userId: testUser.id,
            fullName: 'نگار رضایی',
            latinName: 'NEGAR REZAEI',
            nationalIdEnc: encryptPii('0074185969'),
            nationalIdHash: hashPii('0074185969'),
          },
          {
            userId: testUser.id,
            fullName: 'صادق کاظمی',
            latinName: 'SADEQ KAZEMI',
            nationalIdEnc: encryptPii('0060326786'),
            nationalIdHash: hashPii('0060326786'),
          },
          {
            userId: testUser.id,
            fullName: 'محمد رضایی',
            latinName: 'MOHAMMAD REZAEI',
            nationalIdEnc: encryptPii('0012345679'),
            nationalIdHash: hashPii('0012345679'),
          },
        ],
      });
    }

    const savedBankCount = await typeorm.savedBankAccount.count({
      where: { userId: testUser.id },
    });
    if (savedBankCount === 0) {
      await typeorm.savedBankAccount.create({
        data: {
          userId: testUser.id,
          bankName: 'بانک ملت',
          bankShort: 'ملت',
          brandColor: '#d6336c',
          cardPanEnc: encryptPii('6104337112344521'),
          cardLast4: '4521',
          shebaEnc: encryptPii('IR820540102680020817909002'),
          shebaHash: hashPii('IR820540102680020817909002'),
          isDefault: true,
        },
      });
    }

    await typeorm.user.updateMany({
      where: { id: testUser.id, referralCode: null },
      data: { referralCode: 'NEGAR-4152' },
    });

    const referralCount = await typeorm.customerReferral.count({
      where: { referrerUserId: testUser.id },
    });
    if (referralCount === 0) {
      const friendPhones = [
        { phone: '09180000091', fullName: 'رضا مرادی', status: 'REWARDED' as const, points: 500 },
        { phone: '09180000092', fullName: 'سمیرا کریمی', status: 'REWARDED' as const, points: 500 },
        { phone: '09180000093', fullName: 'آرش هاشمی', status: 'SIGNED_UP' as const, points: 0 },
      ];
      for (const f of friendPhones) {
        const referred = await typeorm.user.upsert({
          where: { phone: f.phone },
          update: { fullName: f.fullName },
          create: { role: 'USER', phone: f.phone, fullName: f.fullName },
        });
        await typeorm.customerReferral.create({
          data: {
            referrerUserId: testUser.id,
            referredUserId: referred.id,
            status: f.status,
            pointsAwarded: f.points,
            rewardedAt: f.status === 'REWARDED' ? new Date() : undefined,
          },
        });
      }
    }

    // Seed one reviewable KYC request with a real tiny PNG so /panel/kyc
    // and its protected file download work immediately after setup.
    const kycUser = await typeorm.user.findUnique({
      where: { phone: '09180000091' },
      select: { id: true },
    });
    if (kycUser) {
      const existingKyc = await typeorm.customerIdentityVerification.count({
        where: { userId: kycUser.id },
      });
      if (existingKyc === 0) {
        await typeorm.user.update({
          where: { id: kycUser.id },
          data: {
            nationalIdEnc: encryptPii('0499370899'),
            nationalIdHash: hashPii('0499370899'),
            birthDate: new Date('1992-05-14'),
          },
        });
        const uploadDir =
          process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        const idCardPath = path.join(uploadDir, 'seed-id-card.png');
        fs.writeFileSync(
          idCardPath,
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64',
          ),
        );
        const idCardFile = await typeorm.storedFile.create({
          data: {
            ownerId: kycUser.id,
            fileName: 'کارت-ملی.png',
            mimeType: 'image/png',
            sizeBytes: fs.statSync(idCardPath).size,
            path: idCardPath,
          },
        });
        await typeorm.customerIdentityVerification.create({
          data: {
            userId: kycUser.id,
            status: 'SUBMITTED',
            idCardFileId: idCardFile.id,
            submittedAt: new Date(),
          },
        });
      }
    }
  }

  // ── Phase 66: passenger survey settings + default question list ────────
  const existingSurveySettingsCount = await typeorm.surveySettings.count();
  if (existingSurveySettingsCount === 0) {
    await typeorm.surveySettings.create({ data: {} });
  }
  const existingSurveyQuestionCount = await typeorm.surveyQuestion.count();
  if (existingSurveyQuestionCount === 0) {
    const defaultQuestions = [
      'رضایت کلی از سفر',
      'برخورد و کیفیت خدمه پروازی',
      'دقت در زمان پرواز',
      'راحتی صندلی و کابین',
      'سرعت پذیرش و چک‌این',
    ];
    for (const [order, label] of defaultQuestions.entries()) {
      await typeorm.surveyQuestion.create({ data: { label, order } });
    }
  }

  // ── Phase 67: careers settings + default job postings ──────────────────
  const existingCareersSettingsCount = await typeorm.careersSettings.count();
  if (existingCareersSettingsCount === 0) {
    await typeorm.careersSettings.create({ data: {} });
  }
  const existingJobPostingCount = await typeorm.jobPosting.count();
  if (existingJobPostingCount === 0) {
    await typeorm.jobPosting.createMany({
      data: [
        {
          title: 'کارشناس پشتیبانی مسافران',
          dept: 'پشتیبانی',
          city: 'تهران',
          type: 'FULL_TIME',
          generalReqs: [
            'حداقل مدرک کارشناسی',
            'روابط عمومی قوی',
            'آشنایی با نرم‌افزارهای اداری',
          ],
          specialReqs: [
            'سابقه کار در صنعت گردشگری یا هوانوردی',
            'آمادگی کار شیفتی',
          ],
        },
        {
          title: 'توسعه‌دهنده فرانت‌اند',
          dept: 'فناوری اطلاعات',
          city: 'تهران',
          type: 'REMOTE',
          generalReqs: [
            'تسلط به JavaScript و React',
            'آشنایی با طراحی واکنش‌گرا',
            'حداقل ۲ سال سابقه کار',
          ],
          specialReqs: ['آشنایی با سامانه‌های رزرواسیون مزیت محسوب می‌شود'],
        },
        {
          title: 'کارشناس فروش و بازرگانی',
          dept: 'بازرگانی',
          city: 'مشهد',
          type: 'PART_TIME',
          generalReqs: ['مهارت مذاکره و فروش', 'آشنایی با اکسل و گزارش‌گیری'],
          specialReqs: ['آشنایی با قراردادهای آژانسی'],
        },
      ],
    });
  }

  // ── Phase D: sample blog posts ─────────────────────────────────────────
  const siteAdmin = staffByUsername.get('site.admin')!;
  const existingBlogCount = await typeorm.blogPost.count();
  if (existingBlogCount === 0) {
    const publishedAt = new Date(Date.now() - 5 * 24 * 3_600_000);
    await typeorm.blogPost.createMany({
      data: [
        {
          title: 'راهنمای کامل چک‌این آنلاین پروازهای داخلی',
          slug: 'online-checkin-guide',
          body: 'برای چک‌این آنلاین، کافی است از ۲۴ ساعت قبل از پرواز وارد سامانه blujet شوید و کد رزرو خود را وارد کنید…',
          category: 'GUIDE',
          status: 'PUBLISHED',
          authorId: siteAdmin.id,
          viewCount: 4210,
          publishedAt,
        },
        {
          title: '۱۰ مقصد بی‌نظیر تابستانی که باید ببینید',
          slug: 'summer-destinations',
          body: 'تابستان فرصت طلایی برای سفر به مقاصد ساحلی و کوهستانی است. در این مقاله ده مقصد محبوب را معرفی می‌کنیم…',
          category: 'DEST',
          status: 'PUBLISHED',
          authorId: siteAdmin.id,
          viewCount: 8740,
          publishedAt: new Date(Date.now() - 3 * 24 * 3_600_000),
        },
        {
          title: 'قوانین جدید بار همراه در پروازهای بین‌المللی',
          slug: 'intl-baggage-rules',
          body: 'از ابتدای مرداد، محدودیت‌های جدیدی برای بار همراه در پروازهای بین‌المللی اعمال می‌شود…',
          category: 'NEWS',
          status: 'PUBLISHED',
          authorId: siteAdmin.id,
          viewCount: 3105,
          publishedAt: new Date(Date.now() - 7 * 24 * 3_600_000),
        },
        {
          title: 'چطور با امتیاز باشگاه بلیط رایگان بگیریم؟',
          slug: 'club-free-ticket-draft',
          body: 'اعضای باشگاه مشتریان blujet می‌توانند با جمع‌آوری امتیاز، بلیط رایگان دریافت کنند…',
          category: 'GUIDE',
          status: 'DRAFT',
          authorId: siteAdmin.id,
          viewCount: 0,
        },
        {
          title: 'تخفیف ویژهٔ پروازهای استانبول تا پایان مرداد',
          slug: 'istanbul-offer-scheduled',
          body: 'تا پایان مرداد ۱۴۰۵، ۱۵٪ تخفیف روی پروازهای مستقیم تهران–استانبول اعمال می‌شود…',
          category: 'OFFERS',
          status: 'SCHEDULED',
          authorId: siteAdmin.id,
          viewCount: 0,
          scheduledAt: new Date(Date.now() + 14 * 24 * 3_600_000),
        },
      ],
    });
  }

  // ── Phase E: site content CMS (home banners, routes, destinations) ───
  const existingRouteHighlights = await typeorm.siteRouteHighlight.count();
  if (existingRouteHighlights === 0) {
    await typeorm.siteContentBlock.createMany({
      data: [
        {
          key: 'HERO_BANNER',
          enabled: true,
          title: 'پرواز بعدی‌ات را با blujet رزرو کن',
          subtitle:
            'بیش از ۲۰۰ مقصد داخلی و بین‌المللی، با بهترین قیمت، پشتیبانی شبانه‌روزی و امتیاز در هر سفر.',
          buttonText: 'مشاهده پیشنهادهای ویژه',
          badgeText: 'در هر پرواز تا ۵٪ کش‌بک بگیرید',
          updatedById: siteAdmin.id,
        },
        {
          key: 'ANNOUNCEMENT_BAR',
          enabled: true,
          title:
            'اطلاعیه مهم: برخی پروازهای امروز به‌دلیل شرایط جوی با تأخیر انجام می‌شوند — آخرین وضعیت پروازها را بررسی کنید',
          subtitle: '',
          buttonText: 'مشاهده',
          badgeText: '',
          updatedById: siteAdmin.id,
        },
        {
          key: 'PROMO_BANNER',
          enabled: true,
          title: 'تا ۴۰٪ تخفیف روی پروازهای خارجی',
          subtitle:
            'رزرو تا پایان مرداد برای سفرهای تابستان — صندلی‌ها محدودند، فرصت را از دست نده.',
          buttonText: 'مشاهده پروازها',
          badgeText: 'حراج تابستانه blujet',
          updatedById: siteAdmin.id,
        },
      ],
      skipDuplicates: true,
    });
    await typeorm.siteRouteHighlight.createMany({
      data: [
        { fromAirportCode: 'THR', toAirportCode: 'MHD', priceIrr: 16_000_000n, sortOrder: 0 },
        { fromAirportCode: 'THR', toAirportCode: 'IST', priceIrr: 42_000_000n, sortOrder: 1 },
        { fromAirportCode: 'THR', toAirportCode: 'DXB', priceIrr: 38_000_000n, sortOrder: 2 },
        { fromAirportCode: 'MHD', toAirportCode: 'KIH', priceIrr: 21_000_000n, sortOrder: 3 },
        { fromAirportCode: 'SYZ', toAirportCode: 'THR', priceIrr: 14_500_000n, sortOrder: 4 },
      ],
    });
    await typeorm.siteDestinationHighlight.createMany({
      data: [
        { airportCode: 'IST', priceIrr: 42_000_000n, sortOrder: 0 },
        { airportCode: 'DXB', priceIrr: 38_000_000n, sortOrder: 1 },
        { airportCode: 'MHD', priceIrr: 16_000_000n, sortOrder: 2 },
        { airportCode: 'KIH', priceIrr: 21_000_000n, sortOrder: 3 },
      ],
    });
  }

  // ── Phase 6: pricing proposals (one pending, one registered) ───────────
  const existingProposalCount = await typeorm.farePricingProposal.count();
  if (existingProposalCount === 0) {
    // Two future SCHEDULED instances so the pricing list has fresh rows.
    for (const daysAhead of [10, 20]) {
      const departureAt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      await typeorm.flightInstance.create({
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
    const scheduled = await typeorm.flightInstance.findMany({
      where: { status: 'SCHEDULED', pricing: null },
      take: 2,
      orderBy: { departureAt: 'desc' },
    });
    const ceoUser = staffByUsername.get('ceo')!;
    if (scheduled[0]) {
      await typeorm.farePricingProposal.create({
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
      await typeorm.farePricingProposal.create({
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
  if ((await typeorm.refundPenaltyRule.count()) === 0) {
    await typeorm.refundPenaltyRule.createMany({
      data: [
        { minHoursBeforeDeparture: 72, penaltyPct: 30, labelFa: 'بیش از ۷۲ ساعت مانده به پرواز' },
        { minHoursBeforeDeparture: 24, penaltyPct: 50, labelFa: 'بین ۲۴ تا ۷۲ ساعت مانده' },
        { minHoursBeforeDeparture: 3, penaltyPct: 70, labelFa: 'بین ۳ تا ۲۴ ساعت مانده' },
        { minHoursBeforeDeparture: 0, penaltyPct: 100, labelFa: 'کمتر از ۳ ساعت / پس از پرواز' },
      ],
    });
  }

  if ((await typeorm.refundRequest.count()) === 0) {
    const someBooking = await typeorm.booking.findFirst({ where: { status: 'TICKETED' } });
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
      for (const [index, r] of refundSeeds.entries()) {
        const penaltyAmountIrr = Math.round((r.totalPaidIrr * r.penaltyPct) / 100);
        const refundBooking = await typeorm.booking.create({
          data: {
            pnr: `RFSEED${String(index + 1).padStart(2, '0')}`,
            flightInstanceId: someBooking.flightInstanceId,
            channel: someBooking.channel,
            status: r.status === 'PAID' ? 'REFUNDED' : 'TICKETED',
            priceIrr: r.totalPaidIrr,
            taxIrr: someBooking.taxIrr,
            userId: someBooking.userId,
            contactPhone: someBooking.contactPhone,
            cabin: someBooking.cabin,
            fareClassCode: someBooking.fareClassCode,
          },
        });
        const created = await typeorm.refundRequest.create({
          data: {
            trackingCode: `RF-${String(index + 1).padStart(8, '0')}`,
            bookingId: refundBooking.id,
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
          await typeorm.ledgerEntry.create({
            data: {
              bookingId: refundBooking.id,
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

  await typeorm.aircraftSeatMap.upsert({
    where: { aircraftType: 'Airbus A320' },
    update: {},
    create: {
      aircraftType: 'Airbus A320',
      // Legacy reservation-panel layout (kept for existing e2e fixtures):
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

  // Public checkout seat map — design-reference-v2/MD-80-seatmap.pdf
  // First Class 3–6: A B | E F; Economy 7–32: A B | D E F;
  // rear exit/galley omits 28A/B, 29A/B, 30A/B → 140 seats.
  await typeorm.aircraftSeatMap.upsert({
    where: { aircraftType: 'MD-80' },
    update: {
      businessRowStart: 3,
      businessRowEnd: 6,
      businessColsLeft: ['A', 'B'],
      businessColsRight: ['E', 'F'],
      economyRowStart: 7,
      economyRowEnd: 32,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['D', 'E', 'F'],
      excludedSeatCodes: ['28A', '28B', '29A', '29B', '30A', '30B'],
    },
    create: {
      aircraftType: 'MD-80',
      businessRowStart: 3,
      businessRowEnd: 6,
      businessColsLeft: ['A', 'B'],
      businessColsRight: ['E', 'F'],
      economyRowStart: 7,
      economyRowEnd: 32,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['D', 'E', 'F'],
      excludedSeatCodes: ['28A', '28B', '29A', '29B', '30A', '30B'],
    },
  });

  const demoInstance = await typeorm.flightInstance.findFirst({
    where: { flightId: flight.id, status: 'SCHEDULED' },
    orderBy: { departureAt: 'asc' },
  });
  if (demoInstance) {
    const existingPax = await typeorm.passenger.count({
      where: { booking: { flightInstanceId: demoInstance.id } },
    });
    if (existingPax === 0) {
      const demoPassengers: { name: string; seat: string }[] = [
        { name: 'نگار رضایی', seat: '3A' },
        { name: 'سارا احمدی', seat: '3E' },
        { name: 'کیوان حسینی', seat: '9A' },
        { name: 'یاسمن مرادی', seat: '9D' },
        { name: 'رضا احمدی', seat: '12B' },
      ];
      for (const p of demoPassengers) {
        const booking = await typeorm.booking.upsert({
          where: { pnr: `BJDEMO${p.seat}` },
          update: {
            flightInstanceId: demoInstance.id,
            channel: 'SYSTEM',
            status: 'TICKETED',
            priceIrr: 38_000_000,
          },
          create: {
            pnr: `BJDEMO${p.seat}`,
            flightInstanceId: demoInstance.id,
            channel: 'SYSTEM',
            status: 'TICKETED',
            priceIrr: 38_000_000,
          },
        });
        const passenger = await typeorm.passenger.findFirst({
          where: { bookingId: booking.id, seatCode: p.seat },
          select: { id: true },
        });
        if (!passenger) {
          await typeorm.passenger.create({
            data: { bookingId: booking.id, fullName: p.name, seatCode: p.seat },
          });
        }
        const sale = await typeorm.ledgerEntry.findFirst({
          where: { bookingId: booking.id, type: 'SALE' },
          select: { id: true },
        });
        if (!sale) {
          await typeorm.ledgerEntry.create({
            data: { bookingId: booking.id, type: 'SALE', signedAmountIrr: 38_000_000 },
          });
        }
      }
      // One demo managerial lock so the seat map/lock UI has real data —
      // already APPROVED (Phase 13D) with a real future hold-to-ticket
      // deadline, not the schema's placeholder migration defaults.
      await typeorm.seatLock.create({
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
    await typeorm.permission.upsert({
      where: { dept_key: { dept: p.dept, key: p.key } },
      update: { sectionLabelFa: p.sectionLabelFa, labelFa: p.labelFa },
      create: p,
    });
  }

  for (const s of INTERNAL_SERVICE_SEED) {
    await typeorm.internalService.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, nameFa: s.nameFa, uptimePct: s.uptimePct, enabled: true },
    });
  }
  // "استرداد آنلاین" starts disabled — matches the design mock's svcDefs.
  await typeorm.internalService.updateMany({
    where: { key: 'refund' },
    data: { enabled: false },
  });

  for (const s of EXTERNAL_SERVICE_SEED) {
    await typeorm.externalServiceConfig.upsert({
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
  await typeorm.externalServiceConfig.updateMany({
    where: { key: 'ext_neshan' },
    data: { enabled: false },
  });

  await typeorm.securityPolicy.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const commercialEmployee = await typeorm.user.upsert({
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
  const financeEmployee = await typeorm.user.upsert({
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
    [commercialEmployee, ['ag_list', 'fl_view', 'ct_list', 'ct_process']],
    [financeEmployee, ['rf_list']],
  ] as const) {
    const perms = await typeorm.permission.findMany({ where: { key: { in: keys as unknown as string[] } } });
    for (const perm of perms) {
      await typeorm.employeePermission.upsert({
        where: { employeeId_permissionId: { employeeId: employee.id, permissionId: perm.id } },
        update: {},
        create: { employeeId: employee.id, permissionId: perm.id, grantedById: itManager.id },
      });
    }
  }

  const employeeCartableCount = await typeorm.cartableTask.count({
    where: { assigneeId: commercialEmployee.id },
  });
  if (employeeCartableCount === 0) {
    await typeorm.cartableTask.createMany({
      data: [
        {
          assigneeId: commercialEmployee.id,
          category: 'ADMIN',
          title: 'بررسی قرارداد همکاری آژانس جدید',
          description: 'نسخه پیش‌نویس قرارداد همکاری آژانس «پرواز آسیا» برای بازبینی واحد بازرگانی.',
          senderId: commercialManager.id,
          senderLabelFa: 'رضا مرادی · مدیر بازرگانی',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        },
        {
          assigneeId: commercialEmployee.id,
          category: 'AGENCY',
          title: 'پیگیری درخواست عضویت آژانس کیان‌سیر',
          description: 'مدارک آژانس کیان‌سیر تکمیل شده — لطفاً صحت مجوز را بررسی کنید.',
          senderLabelFa: 'ادمین سایت',
          createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
        },
      ],
    });
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
    await typeorm.airport.upsert({
      where: { code },
      update: { cityFa, tz },
      create: { code, cityFa, tz },
    });
  }

  // Seeded per-route durations (the add-flight form has no arrival input).
  await typeorm.route.updateMany({
    where: { originCode: 'THR', destCode: 'DXB' },
    data: { durationMin: 180 },
  });

  // Base prices for existing instances so the active/completed tables have
  // the design's «قیمت پایه/نرخ اصلی» figures without fabricating margins.
  await typeorm.flightInstance.updateMany({
    where: { basePriceIrr: null },
    data: { basePriceIrr: 38_000_000 },
  });

  // A couple of future SCHEDULED instances for the پروازهای آینده sub-tab
  // (charter commitment set, plan/AI left empty for the E2E to exercise).
  const futureCount = await typeorm.flightInstance.count({
    where: { departureAt: { gt: new Date(Date.now() + 8 * 24 * 3_600_000) } },
  });
  if (futureCount === 0) {
    for (const daysAhead of [12, 16]) {
      const dep = new Date(Date.now() + daysAhead * 24 * 3_600_000);
      await typeorm.flightInstance.create({
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

  // THR→MHD is the design's primary public search route (home popular routes,
  // نتایج پرواز.dc.html). Seed a few weeks of SCHEDULED inventory so search
  // returns real rows even before the frontend demo fallback kicks in.
  const thrMhdRoute = await typeorm.route.upsert({
    where: { originCode_destCode: { originCode: 'THR', destCode: 'MHD' } },
    update: {},
    create: { originCode: 'THR', destCode: 'MHD', durationMin: 90 },
  });
  const thrMhdFlight = await typeorm.flight.upsert({
    where: { flightNo: 'BJ-100' },
    update: { routeId: thrMhdRoute.id, aircraftType: 'MD-80' },
    create: { flightNo: 'BJ-100', routeId: thrMhdRoute.id, aircraftType: 'MD-80' },
  });
  const thrMhdScheduled = await typeorm.flightInstance.count({
    where: {
      flightId: thrMhdFlight.id,
      status: 'SCHEDULED',
      departureAt: { gt: new Date() },
    },
  });
  if (thrMhdScheduled === 0) {
    for (let d = 1; d <= 21; d++) {
      for (const [hour, minute] of [
        [5, 30],
        [9, 0],
        [13, 10],
        [20, 0],
      ] as const) {
        const departureAt = new Date();
        departureAt.setUTCDate(departureAt.getUTCDate() + d);
        departureAt.setUTCHours(hour, minute, 0, 0);
        await typeorm.flightInstance.create({
          data: {
            flightId: thrMhdFlight.id,
            departureAt,
            arrivalAt: new Date(departureAt.getTime() + 90 * 60_000),
            capacity: 180,
            charterSeats: 60,
            status: 'SCHEDULED',
            basePriceIrr: 16_000_000,
          },
        });
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
    await typeorm.$disconnect();
  });
