import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SurveyResultsPage from './SurveyResultsPage';
import * as surveyApi from '../../api/survey';
import type { SurveyResults } from '../../types/survey';

const RESULTS: SurveyResults = {
  disabled: false,
  flights: [
    {
      flightInstanceId: 'fi-1',
      flightNo: 'EP-821',
      originCityFa: 'تهران',
      destCityFa: 'دبی',
      departureAt: '2026-07-01T05:00:00.000Z',
      count: 3,
      avgRating: 4.3,
    },
  ],
};

describe('SurveyResultsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the per-flight results table', async () => {
    vi.spyOn(surveyApi, 'fetchSurveyResults').mockResolvedValue(RESULTS);
    render(<SurveyResultsPage />);

    expect(await screen.findByText('EP-821')).toBeInTheDocument();
    expect(screen.getByTestId('survey-result-row')).toBeInTheDocument();
  });

  it('shows the disabled banner instead of an empty-state when the survey is off', async () => {
    vi.spyOn(surveyApi, 'fetchSurveyResults').mockResolvedValue({ disabled: true, flights: [] });
    render(<SurveyResultsPage />);

    expect(
      await screen.findByText('نظرسنجی پس از پرواز توسط مدیر IT غیرفعال است.'),
    ).toBeInTheDocument();
  });

  it('calls analyze and renders the returned summary', async () => {
    vi.spyOn(surveyApi, 'fetchSurveyResults').mockResolvedValue(RESULTS);
    const analyze = vi
      .spyOn(surveyApi, 'analyzeSurveyFlight')
      .mockResolvedValue({ summary: 'در کل رضایت بالا بود.' });
    render(<SurveyResultsPage />);
    await screen.findByText('EP-821');

    await userEvent.click(screen.getByText('تحلیل با هوش مصنوعی'));

    await waitFor(() => expect(analyze).toHaveBeenCalledWith('fi-1'));
    expect(await screen.findByTestId('survey-ai-summary')).toHaveTextContent(
      'در کل رضایت بالا بود.',
    );
  });
});
