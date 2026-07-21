import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ManagerReportsPage from './ManagerReportsPage';
import * as auditApi from '../../api/audit';
import type { ManagerReportRow } from '../../types/audit';

const ROWS: ManagerReportRow[] = [
  {
    id: 'a1',
    actorId: 'u1',
    actorRole: 'FINANCE_MANAGER',
    category: 'AGENCY',
    action: 'تسویه فاکتور آژانس',
    detail: 'فاکتور INV-1001 توسط سحر کاظمی تسویه شد.',
    entityType: 'AgencyInvoice',
    entityId: 'inv1',
    createdAt: '2026-07-15T10:00:00.000Z',
  },
];

describe('ManagerReportsPage', () => {
  it('renders the real audit feed and filters by actor role', async () => {
    const fetchSpy = vi.spyOn(auditApi, 'fetchManagerReports').mockResolvedValue(ROWS);

    render(<ManagerReportsPage />);
    expect(await screen.findByText('تسویه فاکتور آژانس')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'مدیر مالی' }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith({ actorRole: 'FINANCE_MANAGER', q: undefined }),
    );
  });
});
