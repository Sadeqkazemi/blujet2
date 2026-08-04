import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LogoutConfirmModal from './LogoutConfirmModal';

describe('LogoutConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <LogoutConfirmModal open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onConfirm / onCancel from the designed actions', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutConfirmModal open onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByText('خروج از حساب کاربری')).toBeInTheDocument();
    expect(
      screen.getByText('آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('logout-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId('logout-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
