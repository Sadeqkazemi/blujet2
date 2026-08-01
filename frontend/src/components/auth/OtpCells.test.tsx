import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpCells, OTP_LEN } from './OtpCells';

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
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(lastCall.join('')).toBe('482913');
    expect(onComplete).toHaveBeenCalled();
  });

  it('accepts multi-digit input in a single cell change (SMS autofill)', () => {
    const onChange = vi.fn();
    const digits = Array(OTP_LEN).fill('');

    render(<OtpCells digits={digits} onChange={onChange} testIdPrefix="otp" />);

    fireEvent.change(screen.getByTestId('otp-0'), { target: { value: '123456' } });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(lastCall.join('')).toBe('123456');
  });
});
