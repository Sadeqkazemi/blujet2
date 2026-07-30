import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CareersAdminPage from './CareersAdminPage';
import * as careersApi from '../../api/careers';
import type { JobApplicationDetail, JobApplicationRow, JobPosting } from '../../types/careers';

function posting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'p1',
    title: 'کارشناس پشتیبانی مسافران',
    dept: 'پشتیبانی',
    city: 'تهران',
    type: 'FULL_TIME',
    generalReqs: ['حداقل ۲ سال سابقه'],
    specialReqs: ['آشنایی با Excel'],
    active: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function appRow(overrides: Partial<JobApplicationRow> = {}): JobApplicationRow {
  return {
    id: 'a1',
    name: 'نگار رضایی',
    jobTitle: 'کارشناس پشتیبانی مسافران',
    nationalId: '0012345679',
    phone: '09121234567',
    email: null,
    at: '2026-07-20T00:00:00.000Z',
    status: 'SUBMITTED',
    hasResume: true,
    eduCount: 1,
    workCount: 0,
    assigneeLabelFa: null,
    ...overrides,
  };
}

function appDetail(overrides: Partial<JobApplicationDetail> = {}): JobApplicationDetail {
  return {
    id: 'a1',
    name: 'نگار رضایی',
    jobTitle: 'کارشناس پشتیبانی مسافران',
    nationalId: '0012345679',
    fatherName: null,
    birthDate: null,
    phone: '09121234567',
    email: null,
    residenceAddress: null,
    gender: null,
    military: null,
    exemptionType: null,
    skills: null,
    eduEntries: [],
    workEntries: [],
    langEntries: [],
    hasResume: true,
    resumeFileName: 'resume.pdf',
    status: 'SUBMITTED',
    canAct: true,
    history: [{ step: 'submitted', label: 'ثبت درخواست توسط متقاضی', at: '2026-07-20T00:00:00.000Z' }],
    referralTargets: [{ id: 'm1', labelFa: 'رضا مرادی (مدیر بازرگانی)' }],
    ...overrides,
  };
}

function mockLists(postings: JobPosting[] = [posting()], apps: JobApplicationRow[] = [appRow()]) {
  vi.spyOn(careersApi, 'fetchAllPostings').mockResolvedValue(postings);
  vi.spyOn(careersApi, 'fetchApplications').mockResolvedValue(apps);
}

describe('CareersAdminPage', () => {
  it('renders the postings tab with existing job cards', async () => {
    mockLists();
    render(<CareersAdminPage />);
    expect(await screen.findByText('کارشناس پشتیبانی مسافران')).toBeInTheDocument();
    expect(screen.getByText('پشتیبانی · تهران')).toBeInTheDocument();
  });

  it('creates a new posting from the form', async () => {
    mockLists([]);
    const create = vi.spyOn(careersApi, 'createPosting').mockResolvedValue(posting({ id: 'p2' }));

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<CareersAdminPage />);

    await screen.findByText('فرصت شغلی‌ای ثبت نشده است.');
    await userEvent.click(screen.getByRole('button', { name: '+ ایجاد فرصت شغلی' }));

    const dialog = await screen.findByRole('dialog', { name: 'ایجاد فرصت شغلی' });
    await userEvent.type(within(dialog).getByPlaceholderText('عنوان شغل'), 'توسعه‌دهنده فرانت‌اند');
    await userEvent.type(within(dialog).getByPlaceholderText('واحد'), 'IT');
    await userEvent.type(within(dialog).getByPlaceholderText('شهر'), 'تهران');
    await userEvent.click(within(dialog).getByRole('button', { name: 'ذخیره' }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'توسعه‌دهنده فرانت‌اند', dept: 'IT', city: 'تهران' }),
    );
  });

  it('toggles a posting active/inactive', async () => {
    mockLists();
    const update = vi.spyOn(careersApi, 'updatePosting').mockResolvedValue(posting({ active: false }));

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<CareersAdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'غیرفعال‌سازی' }));
    expect(update).toHaveBeenCalledWith('p1', { active: false });
  });

  it('switches to the applications tab and opens a detail with referral targets', async () => {
    mockLists();
    vi.spyOn(careersApi, 'fetchApplicationDetail').mockResolvedValue(appDetail());

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<CareersAdminPage />);

    await userEvent.click(screen.getByRole('button', { name: 'درخواست‌های استخدام' }));
    await userEvent.click(await screen.findByRole('button', { name: /نگار رضایی/ }));

    const dialog = await screen.findByRole('dialog', { name: /نگار رضایی/ });
    expect(within(dialog).getByText('رضا مرادی (مدیر بازرگانی)')).toBeInTheDocument();
  });

  it('refers an application to a selected manager', async () => {
    mockLists();
    vi.spyOn(careersApi, 'fetchApplicationDetail').mockResolvedValue(appDetail());
    const refer = vi.spyOn(careersApi, 'referApplication').mockResolvedValue({ id: 'a1', status: 'REFERRED' });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<CareersAdminPage />);

    await userEvent.click(screen.getByRole('button', { name: 'درخواست‌های استخدام' }));
    await userEvent.click(await screen.findByRole('button', { name: /نگار رضایی/ }));
    const dialog = await screen.findByRole('dialog', { name: /نگار رضایی/ });

    await userEvent.selectOptions(within(dialog).getByLabelText('گیرنده ارجاع'), 'm1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'ثبت ارجاع' }));

    expect(refer).toHaveBeenCalledWith('a1', 'm1');
  });

  it('hires an applicant from the detail modal', async () => {
    mockLists();
    vi.spyOn(careersApi, 'fetchApplicationDetail').mockResolvedValue(appDetail());
    const hire = vi.spyOn(careersApi, 'hireApplication').mockResolvedValue({ id: 'a1', status: 'HIRED' });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<CareersAdminPage />);

    await userEvent.click(screen.getByRole('button', { name: 'درخواست‌های استخدام' }));
    await userEvent.click(await screen.findByRole('button', { name: /نگار رضایی/ }));
    const dialog = await screen.findByRole('dialog', { name: /نگار رضایی/ });

    await userEvent.click(within(dialog).getByRole('button', { name: 'استخدام' }));
    expect(hire).toHaveBeenCalledWith('a1');
  });
});
