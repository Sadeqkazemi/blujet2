import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ServicesPage from './ServicesPage';
import * as itApi from '../../api/it-manager';
import type { ExternalService, InternalService, ItServicesResult } from '../../types/it-manager';

const INTERNAL: InternalService[] = [
  { id: 'i1', key: 'search', nameFa: 'موتور جستجوی پرواز', enabled: true, uptimePct: 99.99 },
];

const EXTERNAL: ExternalService[] = [
  {
    id: 'x1',
    key: 'ext_zarinpal',
    nameFa: 'درگاه پرداخت زرین‌پال',
    provider: 'زرین‌پال',
    endpoint: 'https://api.zarinpal.com/pg/v4',
    method: 'POST',
    timeoutMs: 30000,
    sandbox: false,
    enabled: true,
    hasApiKey: true,
    lastTestAt: null,
    lastTestOk: null,
    lastTestMessage: null,
  },
];

const RESULT: ItServicesResult = { internal: INTERNAL, external: EXTERNAL };

describe('ServicesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders internal and external service cards and toggles an internal service', async () => {
    vi.spyOn(itApi, 'fetchItServices').mockResolvedValue(RESULT);
    const toggleSpy = vi.spyOn(itApi, 'toggleInternalService').mockResolvedValue({});

    render(<ServicesPage />);
    expect(await screen.findByText('موتور جستجوی پرواز')).toBeInTheDocument();
    expect(screen.getByText('درگاه پرداخت زرین‌پال')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'موتور جستجوی پرواز' }));
    await waitFor(() => expect(toggleSpy).toHaveBeenCalledWith('search', false));
  });

  it('shows the real test-connection result banner', async () => {
    vi.spyOn(itApi, 'fetchItServices').mockResolvedValue(RESULT);
    vi.spyOn(itApi, 'testExternalService').mockResolvedValue({
      ok: false,
      message: 'مهلت اتصال (30000ms) به پایان رسید',
      service: EXTERNAL[0],
    });

    render(<ServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تست اتصال' }));

    expect(await screen.findByText('مهلت اتصال (30000ms) به پایان رسید')).toBeInTheDocument();
  });

  it('تنظیمات modal pre-fills current values and saves without an apiKey field when left blank', async () => {
    vi.spyOn(itApi, 'fetchItServices').mockResolvedValue(RESULT);
    const updateSpy = vi.spyOn(itApi, 'updateExternalService').mockResolvedValue(EXTERNAL[0]);

    render(<ServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تنظیمات' }));

    expect(screen.getByLabelText('نام سرویس')).toHaveValue('درگاه پرداخت زرین‌پال');
    expect(screen.getByLabelText('آدرس Endpoint')).toHaveValue('https://api.zarinpal.com/pg/v4');
    expect(screen.getByLabelText('مهلت اتصال (میلی‌ثانیه)')).toHaveValue('30000');

    await user.clear(screen.getByLabelText('مهلت اتصال (میلی‌ثانیه)'));
    await user.type(screen.getByLabelText('مهلت اتصال (میلی‌ثانیه)'), '15000');
    await user.click(screen.getByRole('button', { name: 'ثبت تغییرات' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('x1', {
        nameFa: 'درگاه پرداخت زرین‌پال',
        endpoint: 'https://api.zarinpal.com/pg/v4',
        method: 'POST',
        timeoutMs: 15000,
      }),
    );
  });

  it('تنظیمات modal sends a new apiKey only when the operator typed one', async () => {
    vi.spyOn(itApi, 'fetchItServices').mockResolvedValue(RESULT);
    const updateSpy = vi.spyOn(itApi, 'updateExternalService').mockResolvedValue(EXTERNAL[0]);

    render(<ServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تنظیمات' }));
    await user.type(screen.getByLabelText('کلید احراز (API Key)'), 'new-secret-key');
    await user.click(screen.getByRole('button', { name: 'ثبت تغییرات' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        'x1',
        expect.objectContaining({ apiKey: 'new-secret-key' }),
      ),
    );
  });

  it('تنظیمات modal rejects an empty required field without calling the API', async () => {
    vi.spyOn(itApi, 'fetchItServices').mockResolvedValue(RESULT);
    const updateSpy = vi.spyOn(itApi, 'updateExternalService').mockResolvedValue(EXTERNAL[0]);

    render(<ServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تنظیمات' }));
    await user.clear(screen.getByLabelText('نام سرویس'));
    await user.click(screen.getByRole('button', { name: 'ثبت تغییرات' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('نام سرویس و آدرس Endpoint الزامی است.');
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
