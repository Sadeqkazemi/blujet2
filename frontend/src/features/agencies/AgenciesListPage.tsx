import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencies,
  fetchAgencyRequests,
  notifyAllDebtors,
  settleAgency,
} from '../../api/agencies';
import { faDigits, faMoney } from '../../lib/fa-format';
import {
  StaffAlert,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
  staffSegmentedControl,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { TIER_LABELS, statusBadge } from './agency-labels';
import type { AgencyListResult, AgencyListRow, AgencyMembershipRequest } from '../../types/agencies';

type SubTab = 'list' | 'credit';

function CreditBar({ usedIrr, limitIrr }: { usedIrr: number; limitIrr: number }) {
  const pct = limitIrr > 0 ? Math.min((usedIrr / limitIrr) * 100, 100) : usedIrr > 0 ? 100 : 0;
  const color = pct >= 90 ? STAFF_PANEL.danger : pct >= 60 ? STAFF_PANEL.warning : STAFF_PANEL.success;
  return (
    <div style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 4, background: STAFF_PANEL.inputBg }}>
      <div style={{ height: '100%', background: color, width: `${pct}%` }} />
    </div>
  );
}

const searchInputStyle: CSSProperties = {
  height: 46,
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${STAFF_PANEL.inputBorder}`,
  background: STAFF_PANEL.inputBg,
  color: STAFF_PANEL.text,
  padding: '0 16px',
  fontSize: 11.5,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const avatarStyle: CSSProperties = {
  display: 'flex',
  width: 40,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  background: STAFF_PANEL.accentSoft,
  fontSize: 13,
  fontWeight: 900,
  color: STAFF_PANEL.accent,
  flexShrink: 0,
};

export default function AgenciesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isCommercial = role === 'COMMERCIAL_MANAGER';

  const [q, setQ] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('list');
  const [result, setResult] = useState<AgencyListResult | null>(null);
  const [requests, setRequests] = useState<AgencyMembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, reqs] = await Promise.all([fetchAgencies({ q: q || undefined }), fetchAgencyRequests()]);
      setResult(list);
      setRequests(reqs);
    } catch {
      setError('خطا در دریافت فهرست آژانس‌ها.');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'PENDING' || r.status === 'REFERRED'),
    [requests],
  );

  const debtors = useMemo(
    () => (result?.agencies ?? []).filter((a) => Number(a.usedIrr) > 0 || a.pendingInvoiceCount > 0),
    [result],
  );

  async function onSettle(agency: AgencyListRow) {
    setSettlingId(agency.id);
    setNotice(null);
    try {
      await settleAgency(agency.id);
      setNotice(`تسویه حساب ${agency.fullName} ثبت شد ✓`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت تسویه.');
    } finally {
      setSettlingId(null);
    }
  }

  async function onNotifyAll() {
    setNotice(null);
    try {
      const { notifiedCount } = await notifyAllDebtors();
      setNotice(`اعلان بدهی برای ${faDigits(notifiedCount)} آژانس ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال اعلان.');
    }
  }

  const kpis = result?.kpis;

  return (
    <div style={{ padding: '24px 28px' }}>
      <StaffPanelPageHeader
        title="آژانس‌ها"
        subtitle={
          isCommercial ? 'آژانس‌های همکار، فاکتورها و مکاتبه‌ها' : 'مدیریت آژانس‌های همکار، اعتبار و تسویه'
        }
      />

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      <StaffPanelCard
        title={isCommercial ? 'درخواست‌های همکاری آژانس‌ها' : 'درخواست‌های جدید عضویت'}
        headerAction={
          <span
            style={{
              borderRadius: 20,
              background: 'rgba(245,158,11,0.12)',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 800,
              color: STAFF_PANEL.warning,
            }}
          >
            {faDigits(pendingRequests.length)} {isCommercial ? 'درخواست' : 'در انتظار'}
          </span>
        }
        style={{ marginBottom: 24 }}
      >
        {pendingRequests.length === 0 ? (
          <p style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
            {isCommercial ? 'درخواست همکاری جدیدی وجود ندارد.' : 'درخواست جدیدی در انتظار تأیید نیست.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pendingRequests.map((r, idx) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                }}
              >
                <span style={avatarStyle}>{r.applicantName.slice(0, 1)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>{r.applicantName}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: STAFF_PANEL.textMuted }}>
                    مدیر: {r.managerName} · مجوز <span style={{ direction: 'ltr' }}>{r.licenseNo}</span> · {r.city}
                  </div>
                </div>
                {r.status === 'REFERRED' && (
                  <span
                    style={{
                      borderRadius: 20,
                      background: STAFF_PANEL.accentSoft,
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: STAFF_PANEL.accent,
                    }}
                  >
                    ارجاع‌شده
                  </span>
                )}
                <Link
                  to={`/panel/agencies/requests/${r.id}`}
                  style={{
                    borderRadius: 10,
                    background: STAFF_PANEL.accent,
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  {isCommercial ? 'بررسی و اقدام' : 'بررسی درخواست'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StaffPanelCard>

      {!isCommercial && kpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StaffKpiCard label="آژانس‌های فعال" value={faDigits(kpis.activeCount)} />
          <StaffKpiCard label="مجموع اعتبار اعطاشده" value={`${faMoney(kpis.totalCreditGrantedIrr)} تومان`} iconColor={STAFF_PANEL.accent} />
          <StaffKpiCard label="اعتبار مصرف‌شده (بدهی)" value={`${faMoney(kpis.totalUsedIrr)} تومان`} iconColor={STAFF_PANEL.danger} />
          <StaffKpiCard label="در انتظار تسویه" value={faDigits(kpis.pendingSettlementCount)} iconColor={STAFF_PANEL.warning} />
        </div>
      )}

      {isCommercial && debtors.length > 0 && (
        <section
          style={{
            marginBottom: 24,
            borderRadius: 14,
            border: `1px solid rgba(245,158,11,0.35)`,
            background: 'rgba(245,158,11,0.08)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.warning, margin: 0 }}>
              آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده
              <span
                style={{
                  marginRight: 8,
                  borderRadius: 20,
                  background: 'rgba(245,158,11,0.15)',
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {faDigits(debtors.length)} آژانس
              </span>
            </h2>
            <button
              type="button"
              onClick={() => void onNotifyAll()}
              style={{
                borderRadius: 10,
                background: STAFF_PANEL.warning,
                color: '#fff',
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ارسال اعلان به همه
            </button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {debtors.map((d, idx) => (
              <li
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: idx > 0 ? '1px solid rgba(245,158,11,0.15)' : undefined,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{d.fullName}</span>
                <span style={{ fontSize: 11, color: STAFF_PANEL.warning }}>مبلغ {faMoney(d.usedIrr)} تومان</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isCommercial && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(
            [
              { key: 'list', label: 'آژانس‌های همکار' },
              { key: 'credit', label: 'اعتبار و تسویه' },
            ] as { key: SubTab; label: string }[]
          ).map((t) => (
            <button key={t.key} type="button" onClick={() => setSubTab(t.key)} style={staffSegmentedControl(subTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isCommercial && (
        <h2 style={{ marginBottom: 12, fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>آژانس‌های همکار</h2>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی آژانس بر اساس نام، مجوز، مدیر یا شهر…"
          style={searchInputStyle}
        />
      </div>

      {loading ? (
        <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>
      ) : (result?.agencies.length ?? 0) === 0 ? (
        <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>آژانسی با این عبارت یافت نشد.</p>
      ) : subTab === 'credit' && !isCommercial ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result!.agencies.map((a) => {
            const settled = Number(a.usedIrr) <= 0;
            return (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: 14,
                  border: `1px solid ${STAFF_PANEL.cardBorder}`,
                  background: STAFF_PANEL.cardBg,
                  padding: 14,
                }}
              >
                <span style={avatarStyle}>{a.fullName.slice(0, 1)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>{a.fullName}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: STAFF_PANEL.textMuted }}>
                    مجوز <span style={{ direction: 'ltr' }}>{a.licenseNo}</span> · {a.city}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>بدهی جاری</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: settled ? STAFF_PANEL.success : STAFF_PANEL.danger }}>
                    {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                  </div>
                </div>
                <span
                  style={{
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: 10,
                    fontWeight: 800,
                    background: settled ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                    color: settled ? STAFF_PANEL.success : STAFF_PANEL.warning,
                  }}
                >
                  {settled ? 'تسویه شد' : 'در انتظار پرداخت'}
                </span>
                <button
                  type="button"
                  disabled={settled || settlingId === a.id}
                  onClick={() => void onSettle(a)}
                  style={{
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 800,
                    border: 'none',
                    cursor: settled ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    background: settled ? STAFF_PANEL.inputBg : STAFF_PANEL.success,
                    color: settled ? STAFF_PANEL.textMuted : '#fff',
                    opacity: settlingId === a.id ? 0.7 : 1,
                  }}
                >
                  {settled ? 'تسویه شده' : settlingId === a.id ? 'در حال ثبت…' : 'ثبت تسویه'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result!.agencies.map((a) => {
            const badge = statusBadge(a.isActive);
            const badgeColor = a.isActive ? STAFF_PANEL.success : STAFF_PANEL.textMuted;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/panel/agencies/${a.id}`)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 14,
                    borderRadius: 14,
                    border: `1px solid ${STAFF_PANEL.cardBorder}`,
                    background: STAFF_PANEL.cardBg,
                    padding: 14,
                    textAlign: 'right',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ ...avatarStyle, width: 44, height: 44, fontSize: 15 }}>{a.fullName.slice(0, 1)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>{a.fullName}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: STAFF_PANEL.textMuted }}>
                      مجوز <span style={{ direction: 'ltr' }}>{a.licenseNo}</span> · {a.city} · سطح همکاری{' '}
                      <span style={{ fontWeight: 800, color: STAFF_PANEL.warning }}>{TIER_LABELS[a.tier]}</span>
                    </div>
                  </div>
                  <div style={{ width: 176 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: STAFF_PANEL.textMuted }}>
                      <span>اعتبار (مانده / سقف)</span>
                      <span>
                        {faMoney(Math.max(Number(a.remainingIrr), 0))} / {faMoney(a.limitIrr)}
                      </span>
                    </div>
                    <CreditBar usedIrr={Math.max(Number(a.usedIrr), 0)} limitIrr={Number(a.limitIrr)} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>بدهی جاری</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: Number(a.usedIrr) > 0 ? STAFF_PANEL.danger : STAFF_PANEL.success }}>
                      {faMoney(Math.max(Number(a.usedIrr), 0))} تومان
                    </div>
                  </div>
                  <span
                    style={{
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: 10,
                      fontWeight: 800,
                      background: a.isActive ? 'rgba(52,211,153,0.15)' : STAFF_PANEL.inputBg,
                      color: badgeColor,
                    }}
                  >
                    {badge.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
