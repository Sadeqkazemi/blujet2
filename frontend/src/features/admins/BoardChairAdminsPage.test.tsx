import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import BoardChairAdminsPage from './BoardChairAdminsPage';

describe('BoardChairAdminsPage', () => {
  it('shows empty managers list matching design — no seed/mock names', () => {
    render(<BoardChairAdminsPage />);

    expect(screen.getByRole('heading', { name: 'مدیران' })).toBeInTheDocument();
    expect(screen.getByText('هنوز اطلاعاتی وارد نشده است.')).toBeInTheDocument();
    expect(screen.queryByText('حسین صادقی')).not.toBeInTheDocument();
    expect(screen.queryByText('زهرا کریمی')).not.toBeInTheDocument();
  });

  it('opens add-admin dialog stub without calling API', async () => {
    render(<BoardChairAdminsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'افزودن مدیر / ادمین' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('در فاز بعدی پیاده‌سازی می‌شود');
  });
});
