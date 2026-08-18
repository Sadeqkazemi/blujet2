/**
 * ⚠️ TEMP / DEV ONLY — no real backend exists for this feature yet.
 *
 * Stand-in adapter for the IT Manager's «پشتیبانی» tab (internal/technical
 * support requests from staff). This is intentionally NOT the same system
 * as backend/src/modules/support-tickets, which is customer-facing and
 * gated to SITE_ADMIN only — routing IT's own helpdesk through that module
 * would be an RBAC mismatch. See docs/features/it-api-access-management.md
 * for a note on the future real endpoints this should be replaced with
 * (`/it/support/tickets`). Nothing here writes to the real database.
 */
import type { ItSupportTicket, ItSupportTicketFilters, ItSupportTicketStatus } from '../types/it-support';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

let store: ItSupportTicket[] | null = null;
let nextId = 1;

function seed(): ItSupportTicket[] {
  return [
    {
      id: 'tk_1',
      subject: 'کندی سامانه فروش در ساعات اوج',
      requesterNameFa: 'مریم یوسفی',
      requesterDeptFa: 'واحد فروش',
      priority: 'HIGH',
      status: 'OPEN',
      body: 'از ساعت ۱۰ صبح ثبت رزرو با تأخیر چند ثانیه‌ای همراه است.',
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
      messages: [],
    },
    {
      id: 'tk_2',
      subject: 'درخواست نصب پرینتر جدید',
      requesterNameFa: 'حسین مهری',
      requesterDeptFa: 'واحد مالی',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      body: 'پرینتر اتاق مالی نیاز به تعویض درایور دارد.',
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(1),
      messages: [
        { id: 'm1', authorNameFa: 'مدیر فناوری اطلاعات', body: 'در حال بررسی — فردا مراجعه می‌کنیم.', createdAt: isoDaysAgo(1) },
      ],
    },
    {
      id: 'tk_3',
      subject: 'قطعی موقت VPN دفتر مرکزی',
      requesterNameFa: 'سارا احمدی',
      requesterDeptFa: 'واحد بازرگانی',
      priority: 'URGENT',
      status: 'RESOLVED',
      body: 'اتصال VPN از ساعت ۹ صبح قطع بود.',
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(4),
      messages: [
        { id: 'm2', authorNameFa: 'مدیر فناوری اطلاعات', body: 'مشکل روتر برطرف شد.', createdAt: isoDaysAgo(4) },
      ],
    },
  ];
}

function ensureSeeded(): ItSupportTicket[] {
  if (!store) store = seed();
  return store;
}

function matches(t: ItSupportTicket, f: ItSupportTicketFilters): boolean {
  if (f.q && !t.subject.toLowerCase().includes(f.q.toLowerCase()) && !t.requesterNameFa.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.status && t.status !== f.status) return false;
  if (f.priority && t.priority !== f.priority) return false;
  return true;
}

export async function fetchItSupportTickets(filters: ItSupportTicketFilters = {}): Promise<ItSupportTicket[]> {
  return ensureSeeded()
    .filter((t) => matches(t, filters))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function fetchItSupportTicketDetail(id: string): Promise<ItSupportTicket> {
  const found = ensureSeeded().find((t) => t.id === id);
  if (!found) throw new Error('تیکت یافت نشد.');
  return found;
}

export async function replyToItSupportTicket(id: string, body: string): Promise<ItSupportTicket> {
  const found = ensureSeeded().find((t) => t.id === id);
  if (!found) throw new Error('تیکت یافت نشد.');
  const trimmed = body.trim();
  if (!trimmed) throw new Error('متن پاسخ نمی‌تواند خالی باشد.');
  found.messages.push({ id: `m_${nextId++}`, authorNameFa: 'مدیر فناوری اطلاعات', body: trimmed, createdAt: new Date().toISOString() });
  found.updatedAt = new Date().toISOString();
  if (found.status === 'OPEN') found.status = 'IN_PROGRESS';
  return found;
}

export async function setItSupportTicketStatus(id: string, status: ItSupportTicketStatus): Promise<ItSupportTicket> {
  const found = ensureSeeded().find((t) => t.id === id);
  if (!found) throw new Error('تیکت یافت نشد.');
  found.status = status;
  found.updatedAt = new Date().toISOString();
  return found;
}
