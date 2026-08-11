import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleTemplatesTab from './ScheduleTemplatesTab';
import * as flightsApi from '../../api/flights';
import * as aircraftApi from '../../api/aircraft';

afterEach(() => vi.restoreAllMocks());

describe('ScheduleTemplatesTab', () => {
  it('loads route templates from real APIs and renders an empty state without filler rows', async () => {
    vi.spyOn(flightsApi, 'fetchAirports').mockResolvedValue([]);
    vi.spyOn(aircraftApi, 'fetchAircraftDefinitions').mockResolvedValue([]);
    vi.spyOn(flightsApi, 'fetchScheduleTemplates').mockResolvedValue({
      items: [], page: 1, pageSize: 20, total: 0,
    });

    render(<ScheduleTemplatesTab />);

    expect(await screen.findByText('هنوز مسیر پروازی تعریف نشده است.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'تعریف مسیر پروازی جدید' })).toBeInTheDocument();
    expect(screen.queryByText(/تهران.*مشهد/)).not.toBeInTheDocument();
  });
});
