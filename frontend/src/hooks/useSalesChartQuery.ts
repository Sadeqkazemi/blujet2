import { useEffect, useMemo, useState } from 'react';
import { dayjs } from '../lib/jalali';
import type { PeriodQuery, SalesGranularity } from '../types/reporting';

const STANDARD_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'q3', label: '۳ ماهه' },
  { key: 'q6', label: '۶ ماهه' },
  { key: 'year', label: 'سالانه' },
];

const EXTENDED_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'day', label: 'روزانه' },
  { key: 'month', label: 'ماهانه' },
  { key: 'flight', label: 'شماره پرواز' },
];

function currentMonthStartIso() {
  return dayjs().calendar('jalali').startOf('month').toDate().toISOString();
}

export function useSalesChartQuery(options: { includeFlightMode?: boolean } = {}) {
  const { includeFlightMode = false } = options;

  const [granularity, setGranularity] = useState<SalesGranularity>('q6');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString());
  const [selectedMonthStart, setSelectedMonthStart] = useState<string>(currentMonthStartIso);
  const [flightNo, setFlightNo] = useState('');
  const [appliedFlightNo, setAppliedFlightNo] = useState('');

  const modes = useMemo(
    () => [...STANDARD_MODES, ...(includeFlightMode ? EXTENDED_MODES : EXTENDED_MODES.filter((m) => m.key !== 'flight'))],
    [includeFlightMode],
  );

  useEffect(() => {
    setPeriodKey(null);
    if (granularity === 'flight') setAppliedFlightNo('');
  }, [granularity]);

  const query: PeriodQuery = useMemo(() => {
    const q: PeriodQuery = { granularity, periodKey: periodKey ?? undefined };
    if (granularity === 'day') q.date = selectedDate;
    if (granularity === 'month') q.periodStart = selectedMonthStart;
    if (granularity === 'flight' && appliedFlightNo) q.flightNo = appliedFlightNo;
    return q;
  }, [granularity, periodKey, selectedDate, selectedMonthStart, appliedFlightNo]);

  const isQueryReady = useMemo(() => {
    if (granularity === 'flight') return appliedFlightNo.length >= 2;
    return true;
  }, [granularity, appliedFlightNo]);

  function applyFlightNo() {
    setAppliedFlightNo(flightNo.trim().toUpperCase());
    setPeriodKey(null);
  }

  return {
    modes,
    granularity,
    setGranularity,
    periodKey,
    setPeriodKey,
    query,
    isQueryReady,
    selectedDate,
    setSelectedDate,
    selectedMonthStart,
    setSelectedMonthStart,
    flightNo,
    setFlightNo,
    applyFlightNo,
  };
}
