export const loginFieldStyle: React.CSSProperties = {
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

export const loginLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#42506a',
  fontWeight: 700,
  marginBottom: 8,
};

export function loginPrimaryBtn(enabled: boolean): React.CSSProperties {
  return {
    height: 56,
    borderRadius: 13,
    border: 'none',
    background: enabled ? '#1668c4' : '#c3cedd',
    color: '#fff',
    width: '100%',
    fontSize: 15,
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'inherit',
    boxShadow: enabled ? '0 14px 30px -12px rgba(22,104,196,.65)' : 'none',
  };
}

export function loginSeg(on: boolean): React.CSSProperties {
  return {
    flex: 1,
    textAlign: 'center',
    padding: 9,
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: on ? 700 : 600,
    color: on ? '#1668c4' : '#6b7585',
    background: on ? '#fff' : 'transparent',
    boxShadow: on ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
  };
}
