import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgencySalesPage from './AgencySalesPage';
import * as portalApi from '../../api/agency-portal';
import type { AgencySalesReport } from '../../types/agency-portal';

const REPORT: AgencySalesReport = {
  tickets: [
    {
      pnr: 'BJAG001',
      status: 'TICKETED',
      flightNo: 'EP-821',
      route: 'THR → DXB',
      departureAt: '2026-08-01T05:00:00.000Z',
      priceIrr: 190_000_000,
      passengerCount: 1,
    },
  ],
  perFlight: [{ flightNo: 'EP-821', route: 'THR → DXB', ticketsCount: 4, salesIrr: 700_000_000 }],
  summary: { totalSalesIrr: 760_000_000, ticketsIssued: 4, avgFareIrr: 190_000_000, refundRatePct: 0 },
};

describe('AgencySalesPage', () => {
  it("renders only this agency's tickets, per-flight breakdown, and real KPIs", async () => {
    vi.spyOn(portalApi, 'fetchSales').mockResolvedValue(REPORT);
    render(<AgencySalesPage />);

    expect(await screen.findByText('BJAG001')).toBeInTheDocument();
    expect(screen.getByText('EP-821 — THR → DXB')).toBeInTheDocument();
    expect(screen.getByText('۷۶٬۰۰۰٬۰۰۰')).toBeInTheDocument();
  });
});
