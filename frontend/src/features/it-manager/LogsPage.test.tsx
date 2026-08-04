import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LogsPage from './LogsPage';
import * as itApi from '../../api/it-manager';
import type { AuditLogRow } from '../../types/it-manager';

const LOGS: AuditLogRow[] = [
  {
    id: 'l1',
    actorRole: 'IT_MANAGER',
    category: 'ACCOUNT',
    action: 'ایجاد کارمند',
    detail: 'کارمند «رضا» ایجاد شد',
    createdAt: '2026-07-17T08:00:00.000Z',
    actorName: 'مهندس علی صدر',
    unit: 'IT',
    level: 'info',
  },
];

describe('LogsPage', () => {
  it('renders the 5-column log table with actor and unit', async () => {
    vi.spyOn(itApi, 'fetchSystemLogs').mockResolvedValue(LOGS);

    render(<LogsPage />);

    expect(await screen.findByText('زمان')).toBeInTheDocument();
    expect(screen.getByText('کارمند')).toBeInTheDocument();
    expect(screen.getByText('مهندس علی صدر')).toBeInTheDocument();
    expect(screen.getByText(/ایجاد کارمند/)).toBeInTheDocument();
    expect(screen.getByText('IT')).toBeInTheDocument();
  });
});
