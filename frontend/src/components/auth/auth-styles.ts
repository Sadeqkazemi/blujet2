import type { CSSProperties } from 'react';

export const AUTH_INPUT: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 54,
  border: '1.5px solid #dfe6ef',
  borderRadius: 13,
  background: '#fafbfd',
  padding: '0 16px',
  fontFamily: 'inherit',
  fontSize: 14.5,
  fontWeight: 600,
  color: '#16202e',
  outline: 'none',
};

export const AUTH_INPUT_TALL: CSSProperties = {
  ...AUTH_INPUT,
  height: 56,
  fontSize: 15,
};

export const AUTH_LABEL: CSSProperties = {
  fontSize: 12,
  color: '#42506a',
  fontWeight: 700,
  marginBottom: 8,
};

export function authBtn(ok: boolean, green = false): CSSProperties {
  return {
    height: 56,
    borderRadius: 13,
    border: 'none',
    background: ok ? (green ? '#1f8a5b' : '#1668c4') : '#c3cedd',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    cursor: ok ? 'pointer' : 'not-allowed',
    boxShadow: ok
      ? green
        ? '0 14px 30px -12px rgba(31,138,91,.6)'
        : '0 14px 30px -12px rgba(22,104,196,.65)'
      : 'none',
    fontFamily: 'inherit',
    width: '100%',
    transition: 'background .2s',
  };
}

export function segStyle(on: boolean): CSSProperties {
  return {
    flex: 1,
    textAlign: 'center',
    padding: '9px 0',
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: on ? 700 : 600,
    color: on ? '#1668c4' : '#6b7585',
    background: on ? '#fff' : 'transparent',
    boxShadow: on ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
    cursor: 'pointer',
  };
}

export const AUTH_FOCUS_CSS = `
  @keyframes authPlaneFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-16px) rotate(-1.5deg); }
  }
  .auth-input:focus {
    outline: none;
    border-color: #1668c4 !important;
    background: #f3f7fc !important;
  }
`;
