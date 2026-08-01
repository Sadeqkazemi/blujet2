import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpCells, OTP_LEN, isOtpComplete } from './OtpCells';

function applyChange(onChange: ReturnType<typeof vi.fn>, prev: string[] = Array(OTP_LEN).fill('')) {
  const updater = onChange.mock.calls.at(-1)?.[0] as (current: string[]) => string[];
  return updater(prev);
}

describe('OtpCells', () => {
  it('distributes a pasted code across all cells and calls onComplete', async () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    const digits = Array(OTP_LEN).fill('');

    render(<OtpCells digits={digits} onChange={onChange} onComplete={onComplete} testIdPrefix="otp" autoFocus />);

    const first = screen.getByTestId('otp-0');
    await userEvent.click(first);
    await userEvent.paste('482913');

    expect(onChange).toHaveBeenCalled();
    expect(applyChange(onChange).join('')).toBe('482913');
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledWith('482913'));
  });

  it('accepts multi-digit input in a single cell change (SMS autofill)', async () => {
    const onChange = vi.fn();
    const digits = Array(OTP_LEN).fill('');

    render(<OtpCells digits={digits} onChange={onChange} testIdPrefix="otp" />);

    fireEvent.change(screen.getByTestId('otp-0'), { target: { value: '123456' } });

    expect(onChange).toHaveBeenCalled();
    expect(applyChange(onChange).join('')).toBe('123456');
    expect(isOtpComplete(applyChange(onChange))).toBe(true);
  });

  it('normalizes Arabic-Indic digits', () => {
    const onChange = vi.fn();
    const digits = Array(OTP_LEN).fill('');

    render(<OtpCells digits={digits} onChange={onChange} testIdPrefix="otp" />);

    fireEvent.input(screen.getByTestId('otp-0'), { target: { value: '١٢٣٤٥٦' } });

    expect(applyChange(onChange).join('')).toBe('123456');
  });
});
