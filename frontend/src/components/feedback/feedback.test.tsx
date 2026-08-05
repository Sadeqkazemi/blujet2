import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_TOAST,
  FullscreenLoading,
  InlineLoading,
  LoadingProvider,
  ToastProvider,
  useLoading,
  useToast,
} from './index';

function ToastProbe() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success('رزرو شما با موفقیت ثبت شد ✓')}>
        success
      </button>
      <button type="button" onClick={() => toast.error('پرداخت با خطا مواجه شد')}>
        error
      </button>
      <button type="button" onClick={() => toast.info(AUTH_TOAST.logoutSuccess)}>
        logout
      </button>
    </div>
  );
}

function LoadingProbe() {
  const loading = useLoading();
  return (
    <button type="button" onClick={() => loading.show('در حال جست‌وجوی بهترین پروازها…')}>
      show-loading
    </button>
  );
}

describe('feedback toast + loading (design نوتیف و لودینگ)', () => {
  it('renders stacked toasts for success/error/info', async () => {
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'success' }));
    expect(screen.getByTestId('toast-success')).toHaveTextContent('رزرو شما با موفقیت ثبت شد');

    await userEvent.click(screen.getByRole('button', { name: 'error' }));
    expect(screen.getByTestId('toast-error')).toHaveTextContent('پرداخت با خطا مواجه شد');

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByTestId('toast-info')).toHaveTextContent(AUTH_TOAST.logoutSuccess);
  });

  it('shows the fullscreen plane loading overlay', async () => {
    render(
      <LoadingProvider>
        <LoadingProbe />
      </LoadingProvider>,
    );

    expect(screen.queryByTestId('fullscreen-loading')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'show-loading' }));
    expect(screen.getByTestId('fullscreen-loading')).toHaveTextContent('در حال جست‌وجوی بهترین پروازها…');
  });

  it('renders inline loading row', () => {
    render(<InlineLoading text="در حال بروزرسانی اطلاعات رزرو…" />);
    expect(screen.getByTestId('inline-loading')).toHaveTextContent('در حال بروزرسانی اطلاعات رزرو…');
  });

  it('renders fullscreen loading presentational component', () => {
    render(<FullscreenLoading message="لطفاً صبر کنید…" />);
    expect(screen.getByTestId('fullscreen-loading')).toHaveTextContent('لطفاً صبر کنید…');
  });

  it('auto-dismisses toasts after the design duration', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(screen.queryByTestId('toast-success')).not.toBeInTheDocument();
    unmount();
    vi.useRealTimers();
  });
});
