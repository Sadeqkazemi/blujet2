import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoardChairAccountSection from './BoardChairAccountSection';
import * as boardChairApi from '../../api/it-board-chair-mock';

describe('BoardChairAccountSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the preview/limitation notice and an empty state when no account exists', async () => {
    vi.spyOn(boardChairApi, 'fetchBoardChairAccountMock').mockResolvedValue({
      exists: false,
      fullName: null,
      username: null,
      lastPasswordChangeAt: null,
    });

    render(<BoardChairAccountSection />);
    expect(await screen.findByText('حسابی برای رئیس هیئت مدیره ثبت نشده است.')).toBeInTheDocument();
    expect(screen.getByText(/پیش‌نمایش رابط کاربری/)).toBeInTheDocument();
  });

  it('validates the create form and creates the account', async () => {
    vi.spyOn(boardChairApi, 'fetchBoardChairAccountMock').mockResolvedValue({
      exists: false,
      fullName: null,
      username: null,
      lastPasswordChangeAt: null,
    });
    // Real (unmocked) createBoardChairAccountMock — its own validation is
    // exactly what should reject the empty submit below.
    const createSpy = vi.spyOn(boardChairApi, 'createBoardChairAccountMock');

    render(<BoardChairAccountSection />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'ایجاد حساب' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'ایجاد حساب' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نام و نام کاربری الزامی است.');

    await user.type(screen.getByLabelText('نام و نام خانوادگی'), 'دکتر رضایی');
    await user.type(screen.getByLabelText('نام کاربری'), 'board.chair');
    await user.type(screen.getByLabelText('رمز عبور اولیه'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'ایجاد حساب' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith({ fullName: 'دکتر رضایی', username: 'board.chair', password: '123456' }));
    expect(await screen.findByText(/پیش‌نمایش — بدون اتصال به بک‌اند واقعی/)).toBeInTheDocument();
  });

  it('lets an existing account change its password', async () => {
    vi.spyOn(boardChairApi, 'fetchBoardChairAccountMock').mockResolvedValue({
      exists: true,
      fullName: 'دکتر رضایی',
      username: 'board.chair',
      lastPasswordChangeAt: '2026-08-01T08:00:00.000Z',
    });
    const changeSpy = vi.spyOn(boardChairApi, 'changeBoardChairPasswordMock').mockResolvedValue({
      exists: true,
      fullName: 'دکتر رضایی',
      username: 'board.chair',
      lastPasswordChangeAt: '2026-08-05T08:00:00.000Z',
    });

    render(<BoardChairAccountSection />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تغییر رمز عبور' }));
    await user.type(screen.getByLabelText('رمز عبور جدید'), 'newpass1');
    await user.click(screen.getByRole('button', { name: 'ثبت رمز جدید' }));

    await waitFor(() => expect(changeSpy).toHaveBeenCalledWith('newpass1'));
  });
});
