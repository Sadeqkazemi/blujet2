import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgencyProfilePage from './AgencyProfilePage';
import * as portalApi from '../../api/agency-portal';
import type { AgencyDocument, AgencyProfile } from '../../types/agency-portal';

const PROFILE: AgencyProfile = {
  fullName: 'آژانس blujet',
  managerName: 'کامران یوسفی',
  licenseNo: 'AG-10234',
  phone: '+989120000002',
  email: 'info@blujet-agency.example',
  city: 'تهران',
  address: 'تهران، خیابان ولیعصر',
  tier: 'GOLD',
  isActive: true,
  suspendedAt: null,
  suspendReason: null,
  joinedAt: '2023-04-10T00:00:00.000Z',
};

const DOCUMENTS: AgencyDocument[] = [
  {
    id: 'd1',
    docType: 'LICENSE',
    status: 'PENDING',
    createdAt: '2026-07-01T00:00:00.000Z',
    file: { fileName: 'license.pdf', sizeBytes: 1024, mimeType: 'application/pdf' },
  },
];

describe('AgencyProfilePage', () => {
  it('renders read-only profile fields and the uploaded documents list', async () => {
    vi.spyOn(portalApi, 'fetchProfile').mockResolvedValue(PROFILE);
    vi.spyOn(portalApi, 'fetchDocuments').mockResolvedValue(DOCUMENTS);

    render(<AgencyProfilePage />);

    expect(await screen.findByText('کامران یوسفی')).toBeInTheDocument();
    expect(screen.getByText('AG-10234')).toBeInTheDocument();
    expect(screen.getByText(/license\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('در انتظار بررسی')).toBeInTheDocument();
  });
});
