import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AgencyWebservicePage from './AgencyWebservicePage';
import * as portalApi from '../../api/agency-portal';
import type { AgencyApiKeySummary, AgencyWebserviceRequest } from '../../types/agency-portal';

function mockLoads(requests: AgencyWebserviceRequest[] = [], apiKeys: AgencyApiKeySummary[] = []) {
  vi.spyOn(portalApi, 'fetchMyWebserviceRequests').mockResolvedValue(requests);
  vi.spyOn(portalApi, 'fetchApiKeys').mockResolvedValue(apiKeys);
}

const PENDING_REQUEST: AgencyWebserviceRequest = {
  id: 'wr1',
  scope: 'SEARCH_BOOK',
  months: 1,
  priceIrr: 45_000_000,
  note: null,
  status: 'PENDING',
  decidedAt: null,
  createdAt: '2026-07-20T00:00:00.000Z',
};

const ACTIVE_KEY: AgencyApiKeySummary = {
  id: 'k1',
  scope: 'FULL',
  status: 'ACTIVE',
  activatedAt: '2026-07-21T00:00:00.000Z',
  expiresAt: null,
  lastUsedAt: null,
  callCount: 0,
};

describe('AgencyWebservicePage', () => {
  it('submits a real request with the selected scope and plan', async () => {
    mockLoads();
    const requestSpy = vi.spyOn(portalApi, 'requestWebservice').mockResolvedValue({
      ...PENDING_REQUEST,
    });

    render(<AgencyWebservicePage />);
    await screen.findByTestId('ws-buy');

    const user = userEvent.setup();
    await user.click(screen.getByTestId('ws-type-FULL'));
    await user.click(screen.getByTestId('ws-plan-12'));
    await user.click(screen.getByTestId('ws-buy'));

    await waitFor(() => expect(requestSpy).toHaveBeenCalledWith('FULL', 12));
  });

  it('shows the pending state when a request is already PENDING', async () => {
    mockLoads([PENDING_REQUEST]);
    render(<AgencyWebservicePage />);
    expect(await screen.findByTestId('ws-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('ws-buy')).not.toBeInTheDocument();
  });

  it('shows the active connection with scope/status but never a raw key', async () => {
    mockLoads([], [ACTIVE_KEY]);
    render(<AgencyWebservicePage />);
    expect(await screen.findByTestId('ws-active-status')).toBeInTheDocument();
    expect(screen.getByTestId('ws-active-scope')).toHaveTextContent('فروش کامل (صدور بلیط)');
    expect(screen.queryByTestId('ws-key')).not.toBeInTheDocument();
    expect(screen.getByTestId('ws-buy')).toBeInTheDocument();
  });

  it('shows a rejected notice and still allows a new request', async () => {
    mockLoads([{ ...PENDING_REQUEST, status: 'REJECTED', decidedAt: '2026-07-22T00:00:00.000Z' }]);
    render(<AgencyWebservicePage />);
    expect(await screen.findByText(/آخرین درخواست شما رد شد/)).toBeInTheDocument();
    expect(screen.getByTestId('ws-buy')).toBeInTheDocument();
  });
});
