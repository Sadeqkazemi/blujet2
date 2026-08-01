import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { faDigits } from '../lib/fa-format';
import { STAFF_PANEL } from '../lib/staff-panel-theme';
import type { CartableListResult } from '../types/cartable';

export function StaffPanelPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 20.5, fontWeight: 900, color: '#fff', margin: 0 }}>{title}</h1>
      {subtitle && (
        <div style={{ fontSize: 11.5, color: STAFF_PANEL.textMuted, marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}

export function StaffPanelCard({
  title,
  subtitle,
  headerAction,
  children,
  style,
  padding = 15,
}: {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  padding?: number;
}) {
  return (
    <div
      style={{
        background: STAFF_PANEL.cardBg,
        border: `1px solid ${STAFF_PANEL.cardBorder}`,
        borderRadius: 14,
        overflow: 'hidden',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: title.length > 20 ? 13.5 : 14.5, fontWeight: 800, color: '#fff', margin: 0 }}>
              {title}
            </h2>
            {subtitle && (
              <div style={{ fontSize: 11, color: STAFF_PANEL.textMuted, marginTop: 3 }}>{subtitle}</div>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

export function StaffKpiCard({
  label,
  value,
  sublabel,
  trend,
  trendUp,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sublabel?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div
      style={{
        background: STAFF_PANEL.cardBg,
        border: `1px solid ${STAFF_PANEL.cardBorder}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {icon && (
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: iconBg ?? STAFF_PANEL.accentSoft,
              color: iconColor ?? STAFF_PANEL.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: trendUp === false ? STAFF_PANEL.danger : STAFF_PANEL.success,
            }}
          >
            {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22.5, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: STAFF_PANEL.textMuted, marginTop: 3 }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 11, color: STAFF_PANEL.textMuted, marginTop: 2 }}>{sublabel}</div>
      )}
    </div>
  );
}

export function StaffCartableWidget({
  cartable,
  limit = 4,
}: {
  cartable: CartableListResult;
  limit?: number;
}) {
  return (
    <StaffPanelCard title="کارتابل" padding={0}>
      <div style={{ padding: '0 8px 8px' }}>
        {cartable.totalOpen > 0 && (
          <div style={{ padding: '8px 6px 4px' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#fff',
                background: STAFF_PANEL.danger,
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {faDigits(cartable.totalOpen)}
            </span>
          </div>
        )}
        {cartable.tasks.length === 0 ? (
          <p style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted, margin: 0 }}>
            کارتابل خالی است ✓
          </p>
        ) : (
          cartable.tasks.slice(0, limit).map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 8px',
                borderRadius: 10,
              }}
            >
              <span
                style={{
                  marginTop: 2,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: STAFF_PANEL.accentSoft,
                  color: STAFF_PANEL.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                  fontSize: 14,
                }}
              >
                ✉
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: STAFF_PANEL.text, fontSize: 12 }}>{t.title}</div>
                <div style={{ marginTop: 2, fontSize: 10, color: STAFF_PANEL.textMuted }}>
                  {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/panel/cartable"
        style={{
          display: 'block',
          padding: '11px 14px',
          borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`,
          textAlign: 'center',
          fontSize: 11.5,
          fontWeight: 700,
          color: STAFF_PANEL.link,
          textDecoration: 'none',
        }}
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </StaffPanelCard>
  );
}

export function StaffFlightsSummaryGrid({
  flightCount,
  totalSeats,
  soldSeats,
  unsoldSeats,
}: {
  flightCount: number;
  totalSeats: number;
  soldSeats: number;
  unsoldSeats: number;
}) {
  const items = [
    { value: faDigits(flightCount), label: 'پروازهای انجام‌شده', color: '#fff' },
    { value: faDigits(totalSeats), label: 'مجموع صندلی', color: '#fff' },
    { value: faDigits(soldSeats), label: 'صندلی فروخته‌شده', color: STAFF_PANEL.success },
    { value: faDigits(unsoldSeats), label: 'صندلی فروش‌نرفته', color: STAFF_PANEL.danger },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginTop: 16,
        padding: 14,
        background: STAFF_PANEL.inputBg,
        border: `1px solid ${STAFF_PANEL.inputBorder}`,
        borderRadius: 12,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
          <div style={{ fontSize: 11, color: STAFF_PANEL.textMuted, marginTop: 2 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function staffSegmentedControl(active: boolean): CSSProperties {
  return {
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: active ? 800 : 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? STAFF_PANEL.accent : 'transparent',
    color: active ? '#fff' : STAFF_PANEL.navMuted,
  };
}

export function StaffAlert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const bg = tone === 'error' ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)';
  const color = tone === 'error' ? STAFF_PANEL.danger : STAFF_PANEL.success;
  return (
    <p style={{ marginBottom: 16, borderRadius: 10, background: bg, padding: '10px 12px', fontSize: 12, color }}>
      {children}
    </p>
  );
}

export function StaffPrimaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 10,
        background: STAFF_PANEL.accent,
        color: '#fff',
        padding: '8px 16px',
        fontSize: 11.5,
        fontWeight: 800,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function StaffCountPill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        borderRadius: 20,
        background: STAFF_PANEL.inputBg,
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 800,
        color: STAFF_PANEL.navMuted,
      }}
    >
      {children}
    </span>
  );
}
