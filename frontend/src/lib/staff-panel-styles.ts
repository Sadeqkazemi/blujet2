import type { CSSProperties } from 'react';
import { STAFF_PANEL } from './staff-panel-theme';

export const staffPage: CSSProperties = { padding: '24px 28px' };

export const staffCard: CSSProperties = {
  background: STAFF_PANEL.cardBg,
  border: `1px solid ${STAFF_PANEL.cardBorder}`,
  borderRadius: 14,
  overflow: 'hidden',
};

export const staffCardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '12px 16px',
};

export const staffInput: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${STAFF_PANEL.inputBorder}`,
  background: STAFF_PANEL.inputBg,
  color: STAFF_PANEL.text,
  fontFamily: 'inherit',
  outline: 'none',
};

export const staffMuted: CSSProperties = { color: STAFF_PANEL.textMuted };

export const staffText: CSSProperties = { color: STAFF_PANEL.text };

export const staffTableHeader: CSSProperties = {
  display: 'grid',
  gap: 12,
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '8px 16px',
  fontSize: 11,
  fontWeight: 800,
  color: STAFF_PANEL.textMuted,
};

export const staffTableRow: CSSProperties = {
  display: 'grid',
  gap: 12,
  alignItems: 'center',
  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
  padding: '12px 16px',
  fontSize: 11,
  textAlign: 'right',
  background: 'transparent',
  border: 'none',
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: STAFF_PANEL.sidebarBorder,
  width: '100%',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: STAFF_PANEL.text,
};

export const staffInnerTile: CSSProperties = {
  borderRadius: 10,
  background: STAFF_PANEL.inputBg,
  padding: 10,
};

export function staffStatusStyle(tone: 'success' | 'warning' | 'danger' | 'accent' | 'purple'): CSSProperties {
  const map = {
    success: { background: 'rgba(52,211,153,0.15)', color: STAFF_PANEL.success },
    warning: { background: 'rgba(245,158,11,0.15)', color: STAFF_PANEL.warning },
    danger: { background: 'rgba(248,113,113,0.15)', color: STAFF_PANEL.danger },
    accent: { background: STAFF_PANEL.accentSoft, color: STAFF_PANEL.accent },
    purple: { background: 'rgba(168,85,247,0.18)', color: STAFF_PANEL.purple },
  };
  return {
    borderRadius: 20,
    padding: '4px 10px',
    fontSize: 10,
    fontWeight: 800,
    ...map[tone],
  };
}
