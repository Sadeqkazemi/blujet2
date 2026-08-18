/**
 * TEMP/DEV ONLY — MOCK ADAPTER. No backend endpoint exists for these two
 * reads yet. Local/design-review use only; never imported by production
 * data paths outside the two agencies pages that need it while the real
 * backend is pending.
 *
 * `docs/API.md` documents the intended real contract this file stands in
 * for ("Phase — Commercial agency cross-view aggregates"):
 *   - GET /agencies/invoices              (cross-agency invoice aggregate)
 *   - GET /agencies/seat-requests         (manager-side seat-request queue)
 *   - PATCH /agencies/seat-requests/:id/decide
 *
 * This module is isolated on purpose: it is never imported by anything
 * outside the two agencies pages that need it, and every function mirrors
 * the exact signature/shape a real `api/agencies.ts` addition would have —
 * swapping it out later is a one-line import change, not a rewrite.
 *
 * To keep this honest per CLAUDE.md's "no fabricated business data" rule,
 * every row below is anchored to a REAL agency fetched from `GET /agencies`
 * — only the request-specific fields (seats/price/status/dates), which have
 * no backend source at all yet, are synthesized.
 */
import { fetchAgencies } from './agencies';
import type {
  AgencyAggregateInvoiceRow,
  AgencySeatRequestRow,
  AggregateInvoiceStatus,
} from '../types/agencies';

const ROUTES_FA = ['تهران - مشهد', 'تهران - کیش', 'تهران - استانبول', 'مشهد - دبی', 'تهران - شیراز'];
const AIRCRAFT = ['Airbus A320', 'Boeing 737', 'ATR 72'];

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function realAgencySample(count: number) {
  const { agencies } = await fetchAgencies({});
  return agencies.slice(0, count);
}

export async function fetchAggregateInvoices(): Promise<AgencyAggregateInvoiceRow[]> {
  const agencies = await realAgencySample(4);
  if (agencies.length === 0) return [];
  const statuses: AggregateInvoiceStatus[] = ['UNPAID', 'PAID', 'VOIDED', 'UNPAID'];
  return agencies.map((a, i) => ({
    id: `mock-inv-${a.id}`,
    invoiceNo: `INV-${1400000 + i}`,
    agencyId: a.id,
    agencyName: a.fullName,
    descriptionFa: 'فاکتور تعهد صندلی چارتری',
    issuedAt: isoDaysFromNow(-i * 6),
    amountIrr: String(BigInt(150_000_000 + i * 40_000_000)),
    status: statuses[i % statuses.length]!,
  }));
}

export async function fetchAggregateSeatRequests(): Promise<AgencySeatRequestRow[]> {
  const agencies = await realAgencySample(3);
  if (agencies.length === 0) return [];
  return agencies.map((a, i) => {
    const seats = 10 + i * 8;
    const unitPriceIrr = BigInt(4_200_000_000) / 1000n; // placeholder unit price
    const totalIrr = unitPriceIrr * BigInt(seats);
    return {
      id: `mock-seatreq-${a.id}`,
      agencyId: a.id,
      agencyName: a.fullName,
      managerName: a.managerName,
      phone: '09120000000',
      city: a.city,
      licenseNo: a.licenseNo,
      routeFa: ROUTES_FA[i % ROUTES_FA.length]!,
      seats,
      months: (i === 0 ? 1 : i === 1 ? 3 : 12) as 1 | 3 | 12,
      aircraftType: AIRCRAFT[i % AIRCRAFT.length]!,
      unitPriceIrr: unitPriceIrr.toString(),
      totalIrr: totalIrr.toString(),
      payMethod: i % 2 === 0 ? 'INVOICE' : 'CREDIT',
      status: i === 0 ? 'PENDING' : i === 1 ? 'PENDING_FINANCE' : 'APPROVED',
      invoiceNo: i === 2 ? `INV-${1400100 + i}` : null,
      dueAt: i === 0 ? isoDaysFromNow(7) : null,
      flights: Array.from({ length: 2 }, (_, f) => ({
        flightNo: `W5-${100 + i * 10 + f}`,
        date: isoDaysFromNow(10 + f * 3).slice(0, 10),
        time: f === 0 ? '08:30' : '19:15',
      })),
      createdAt: isoDaysFromNow(-i * 2),
    } satisfies AgencySeatRequestRow;
  });
}

/** No real decide endpoint yet — resolves locally so the modal's buttons work in review. */
export async function decideAggregateSeatRequest(
  id: string,
  approve: boolean,
): Promise<{ id: string; status: 'APPROVED' | 'REJECTED' }> {
  void approve;
  return { id, status: approve ? 'APPROVED' : 'REJECTED' };
}
