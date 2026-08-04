export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

export const TOAST_STYLES: Record<
  ToastType,
  { bg: string; fg: string; iconBg: string; icon: string }
> = {
  success: { bg: '#1f8a5b', fg: '#fff', iconBg: 'rgba(255,255,255,.25)', icon: '✓' },
  error: { bg: '#d64545', fg: '#fff', iconBg: 'rgba(255,255,255,.25)', icon: '✕' },
  warning: { bg: '#f5a623', fg: '#0d2640', iconBg: 'rgba(13,38,102,.15)', icon: '!' },
  info: { bg: '#1668c4', fg: '#fff', iconBg: 'rgba(255,255,255,.25)', icon: 'i' },
};

export const TOAST_DURATION_MS = 2800;

export const AUTH_TOAST = {
  loginSuccess: 'با موفقیت وارد شدید ✓',
  logoutSuccess: 'با موفقیت از حساب خود خارج شدید',
  loginError: 'ورود ناموفق بود. دوباره تلاش کنید',
} as const;
