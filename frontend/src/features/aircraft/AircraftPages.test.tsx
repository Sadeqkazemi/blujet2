import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AircraftListPage from './AircraftListPage';
import AircraftDetailPage from './AircraftDetailPage';
import AircraftFormPage from './AircraftFormPage';
import * as aircraftApi from '../../api/aircraft';
import type { AircraftDefinition, AircraftDefinitionListItem } from '../../types/aircraft';

const LIST: AircraftDefinitionListItem[] = [
  {
    id: 'ac1',
    name: 'مک‌دانل داگلاس MD-80',
    code: 'MD-80',
    status: 'ACTIVE',
    totalSeats: 140,
    cabinSummary: 'اکونومی ۱۲۰ · بیزنس ۲۰',
  },
  {
    id: 'ac2',
    name: 'ایرباس A320',
    code: 'A320',
    status: 'INACTIVE',
    totalSeats: 180,
    cabinSummary: 'اکونومی ۱۵۰ · بیزنس ۳۰',
  },
];

const DETAIL: AircraftDefinition = {
  id: 'ac2',
  name: 'ایرباس A320',
  code: 'A320',
  status: 'INACTIVE',
  totalSeats: 180,
  cabins: [
    { cabin: 'ECONOMY', enabled: true, seats: 150 },
    { cabin: 'PREMIUM_ECONOMY', enabled: false, seats: 0 },
    { cabin: 'COMFORT', enabled: false, seats: 0 },
    { cabin: 'BUSINESS', enabled: true, seats: 30 },
    { cabin: 'FIRST', enabled: false, seats: 0 },
  ],
  seatMap: [
    {
      rowStart: 1,
      rowEnd: 2,
      colsLeft: ['A', 'B'],
      colsRight: ['C', 'D', 'E'],
      cabin: 'BUSINESS',
      disabledSeatCodes: [],
    },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
};

describe('AircraftListPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading then list rows from API', async () => {
    vi.spyOn(aircraftApi, 'fetchAircraftDefinitions').mockResolvedValue(LIST);

    render(
      <MemoryRouter>
        <AircraftListPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('aircraft-list-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('aircraft-list-table')).toBeInTheDocument();
    });

    expect(screen.getByText('مک‌دانل داگلاس MD-80')).toBeInTheDocument();
    expect(screen.getByText('ایرباس A320')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ تعریف هواپیمای جدید' })).toHaveAttribute(
      'href',
      '/panel/aircraft/new',
    );
  });

  it('shows error when list API fails', async () => {
    vi.spyOn(aircraftApi, 'fetchAircraftDefinitions').mockRejectedValue(
      new Error('سرویس در دسترس نیست'),
    );

    render(
      <MemoryRouter>
        <AircraftListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('aircraft-list-error')).toHaveTextContent('سرویس در دسترس نیست');
    });
  });

  it('shows empty state when API returns no rows', async () => {
    vi.spyOn(aircraftApi, 'fetchAircraftDefinitions').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AircraftListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('aircraft-list-empty')).toHaveTextContent('اطلاعاتی یافت نشد');
    });
  });
});

describe('AircraftDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders aircraft detail', async () => {
    vi.spyOn(aircraftApi, 'fetchAircraftDefinition').mockResolvedValue(DETAIL);

    render(
      <MemoryRouter initialEntries={['/panel/aircraft/ac2']}>
        <Routes>
          <Route path="/panel/aircraft/:id" element={<AircraftDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ایرباس A320' })).toBeInTheDocument();
    });

    expect(screen.getByText('غیرفعال')).toBeInTheDocument();
    expect(screen.getByTestId('seat-map-editor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ویرایش' })).toHaveAttribute(
      'href',
      '/panel/aircraft/ac2/edit',
    );
  });

  it('shows MD-80 locked message instead of seat map editor', async () => {
    vi.spyOn(aircraftApi, 'fetchAircraftDefinition').mockResolvedValue({
      ...DETAIL,
      id: 'ac1',
      name: 'مک‌دانل داگلاس MD-80',
      code: 'MD-80',
      lockedSeatMap: true,
      seatMap: [],
    });

    render(
      <MemoryRouter initialEntries={['/panel/aircraft/ac1']}>
        <Routes>
          <Route path="/panel/aircraft/:id" element={<AircraftDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('md80-locked-message')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('seat-map-editor')).not.toBeInTheDocument();
  });
});

describe('AircraftFormPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('create form shows MD-80 lock message when code is MD-80', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/panel/aircraft/new']}>
        <Routes>
          <Route path="/panel/aircraft/new" element={<AircraftFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByTestId('aircraft-code'), 'MD-80');
    await user.type(screen.getByTestId('aircraft-name'), 'MD-80');

    expect(screen.getByTestId('md80-locked-message')).toBeInTheDocument();
    expect(screen.queryByTestId('seat-map-editor')).not.toBeInTheDocument();
  });

  it('validates cabin seat sum before submit', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(aircraftApi, 'createAircraftDefinition');

    render(
      <MemoryRouter initialEntries={['/panel/aircraft/new']}>
        <Routes>
          <Route path="/panel/aircraft/new" element={<AircraftFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByTestId('aircraft-name'), 'بوئینگ ۷۳۷');
    await user.type(screen.getByTestId('aircraft-code'), 'B737');
    await user.clear(screen.getByTestId('aircraft-total-seats'));
    await user.type(screen.getByTestId('aircraft-total-seats'), '100');

    await user.click(screen.getByTestId('aircraft-form-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('aircraft-form-error')).toHaveTextContent('مجموع صندلی');
    });

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('loads edit form and submits update', async () => {
    const user = userEvent.setup();
    vi.spyOn(aircraftApi, 'fetchAircraftDefinition').mockResolvedValue(DETAIL);
    const updateSpy = vi.spyOn(aircraftApi, 'updateAircraftDefinition').mockResolvedValue({
      ...DETAIL,
      name: 'ایرباس A320neo',
    });

    render(
      <MemoryRouter initialEntries={['/panel/aircraft/ac2/edit']}>
        <Routes>
          <Route path="/panel/aircraft/:id/edit" element={<AircraftFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('ایرباس A320')).toBeInTheDocument();
    });

    await user.clear(screen.getByTestId('aircraft-name'));
    await user.type(screen.getByTestId('aircraft-name'), 'ایرباس A320neo');
    await user.click(screen.getByTestId('aircraft-form-submit'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });
  });
});
