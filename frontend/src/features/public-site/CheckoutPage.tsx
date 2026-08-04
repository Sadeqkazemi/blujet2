import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createBooking,
  fetchClubPoints,
  fetchMyBooking,
  fetchSavedPassengers,
  fetchSeatMap,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { localeMoney } from '../../lib/fa-format';
import type { BookingDetail, CabinClass, SavedPassenger, SeatMapCell } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';
import { CHECKOUT_COPY } from './checkout/checkout-copy';
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
} from './checkout/checkout-draft';
import CheckoutStepBar from './checkout/CheckoutStepBar';
import ExtrasStep from './checkout/ExtrasStep';
import FlightSummaryCard from './checkout/FlightSummaryCard';
import PassengerStep from './checkout/PassengerStep';
import PricingSidebar from './checkout/PricingSidebar';
import ReviewStep from './checkout/ReviewStep';
import OtpLoginInline from './OtpLoginInline';
import {
  defaultExtras,
  emptyPassenger,
  passengerFullName,
  type CheckoutDraft,
  type CheckoutWizardStep,
  type ExtraServiceState,
  type FlightSnapshot,
  type PassengerFormDraft,
} from './checkout/checkout-types';
import {
  buildMd80Seats,
  looksLikeLegacyA320SeatPayload,
  looksLikeMd80SeatPayload,
  mapLegacyTakenSeatsToMd80,
  shouldUseMd80SeatMap,
} from './checkout/md80-seat-layout';

const BUSINESS_SEAT_MIN_POINTS = 15_000;
const STEP_ORDER: CheckoutWizardStep[] = ['pax', 'extras', 'review'];

function isPassengerComplete(p: PassengerFormDraft): boolean {
  if (!p.firstNameLatin.trim() || !p.lastNameLatin.trim() || !p.gender) return false;
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return false;
  if (p.docType === 'NATIONAL_ID') return p.nationalId.trim().length >= 10;
  return p.passportNo.trim().length >= 5;
}

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { status } = useAuth();
  const isMobile = useIsMobile();
  const t = CHECKOUT_COPY[locale];

  const isWizard = bookingId === 'new';

  const [heldBooking, setHeldBooking] = useState<BookingDetail | null>(null);
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [step, setStep] = useState<CheckoutWizardStep>('pax');
  const [passengers, setPassengers] = useState<PassengerFormDraft[]>([emptyPassenger('')]);
  const [extras, setExtras] = useState<ExtraServiceState[]>(defaultExtras());
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seats, setSeats] = useState<SeatMapCell[] | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [clubBalance, setClubBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load held booking (legacy /payment-bound path)
  useEffect(() => {
    if (!bookingId || bookingId === 'new') return;
    fetchMyBooking(bookingId)
      .then(setHeldBooking)
      .catch(() => setLoadError(t.notFound));
  }, [bookingId, t.notFound]);

  // Resolve wizard draft from location state, query, or sessionStorage.
  // Must run even while OTP gate is showing so cities survive login remount.
  useEffect(() => {
    if (!isWizard) return;
    const stateFlight = (location.state as { flight?: FlightSnapshot; cabin?: CabinClass } | null)
      ?.flight;
    const stateCabin = (location.state as { cabin?: CabinClass } | null)?.cabin;
    const fromStorage = loadCheckoutDraft();
    const flightInstanceId =
      params.get('flightInstanceId') || stateFlight?.flightInstanceId || fromStorage?.flightInstanceId;
    const cabin =
      (params.get('cabin') as CabinClass | null) ||
      stateCabin ||
      fromStorage?.cabin ||
      'ECONOMY';
    const originFromQuery = (params.get('origin') || '').toUpperCase();
    const destFromQuery = (params.get('dest') || '').toUpperCase();

    const mergeFlight = (base: FlightSnapshot): FlightSnapshot => ({
      ...base,
      originCode:
        base.originCode && base.originCode !== '—'
          ? base.originCode
          : originFromQuery || fromStorage?.flight.originCode || base.originCode,
      destCode:
        base.destCode && base.destCode !== '—'
          ? base.destCode
          : destFromQuery || fromStorage?.flight.destCode || base.destCode,
      flightNo: base.flightNo !== '—' ? base.flightNo : fromStorage?.flight.flightNo || base.flightNo,
      priceIrr:
        base.priceIrr && base.priceIrr !== '0'
          ? base.priceIrr
          : fromStorage?.flight.priceIrr || base.priceIrr,
      aircraftType: base.aircraftType || fromStorage?.flight.aircraftType,
      departureAt: base.departureAt || fromStorage?.flight.departureAt || new Date().toISOString(),
      arrivalAt: base.arrivalAt || fromStorage?.flight.arrivalAt || new Date().toISOString(),
    });

    if (stateFlight) {
      const d: CheckoutDraft = {
        flightInstanceId: stateFlight.flightInstanceId,
        cabin,
        selectedSeats: fromStorage?.selectedSeats ?? [],
        flight: mergeFlight(stateFlight),
      };
      setDraft(d);
      saveCheckoutDraft(d);
      setSelectedSeats(d.selectedSeats);
      return;
    }
    if (fromStorage && (!flightInstanceId || fromStorage.flightInstanceId === flightInstanceId)) {
      const d: CheckoutDraft = {
        ...fromStorage,
        cabin,
        flight: mergeFlight(fromStorage.flight),
      };
      setDraft(d);
      saveCheckoutDraft(d);
      setSelectedSeats(d.selectedSeats);
      return;
    }
    if (flightInstanceId) {
      const d: CheckoutDraft = {
        flightInstanceId,
        cabin,
        selectedSeats: [],
        flight: mergeFlight({
          flightInstanceId,
          flightNo: 'BJ',
          originCode: originFromQuery || 'THR',
          destCode: destFromQuery || 'MHD',
          departureAt: new Date().toISOString(),
          arrivalAt: new Date().toISOString(),
          priceIrr: '0',
        }),
      };
      setDraft(d);
      saveCheckoutDraft(d);
      return;
    }
    setLoadError(t.notFound);
  }, [isWizard, location.state, params, t.notFound]);

  useEffect(() => {
    if (!draft) return;
    // Full aircraft map. For MD-80, if the API is empty or still on legacy
    // lettering, fall back to the PDF chart inventory so the picker is never blank.
    const aircraft = draft.flight.aircraftType ?? 'MD-80';
    fetchSeatMap(draft.flightInstanceId)
      .then((m) => {
        const useMd80 = shouldUseMd80SeatMap(aircraft, m.seats);
        if (useMd80 && !looksLikeMd80SeatPayload(m.seats)) {
          const takenRaw = m.seats.filter((s) => s.status === 'TAKEN').map((s) => s.seatCode);
          const taken = looksLikeLegacyA320SeatPayload(m.seats)
            ? mapLegacyTakenSeatsToMd80(takenRaw)
            : takenRaw;
          setSeats(buildMd80Seats(taken));
          return;
        }
        setSeats(m.seats.length ? m.seats : useMd80 ? buildMd80Seats() : []);
      })
      .catch(() => {
        const useMd80 = shouldUseMd80SeatMap(aircraft, []);
        setSeats(useMd80 ? buildMd80Seats() : []);
      });
  }, [draft]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchSavedPassengers()
      .then(setSavedPassengers)
      .catch(() => setSavedPassengers([]));
    fetchClubPoints()
      .then((c) => setClubBalance(c.balance))
      .catch(() => setClubBalance(0));
  }, [status]);

  // Keep passenger seat codes in sync with selected seats
  useEffect(() => {
    if (!isWizard) return;
    setPassengers((prev) => {
      if (selectedSeats.length === 0) {
        return prev.length ? prev : [emptyPassenger('')];
      }
      return selectedSeats.map((seat, i) => ({
        ...(prev[i] ?? emptyPassenger(seat)),
        seatCode: seat,
      }));
    });
  }, [selectedSeats, isWizard]);

  // Design: business seats need ≥15,000 club points (hint + locked styling).
  const businessLocked = clubBalance < BUSINESS_SEAT_MIN_POINTS;

  const nextLabel = useMemo(() => {
    if (step === 'pax') return t.nextPax;
    if (step === 'extras') return t.nextExtras;
    return t.nextReview;
  }, [step, t]);

  function toggleSeat(seatCode: string) {
    setSelectedSeats((prev) => {
      const next = prev.includes(seatCode)
        ? prev.filter((s) => s !== seatCode)
        : [...prev, seatCode];
      if (draft) {
        const updated = { ...draft, selectedSeats: next };
        setDraft(updated);
        saveCheckoutDraft(updated);
      }
      return next;
    });
  }

  function toggleExtra(id: ExtraServiceState['id']) {
    setExtras((arr) => arr.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)));
  }

  function goNext() {
    setError(null);
    if (step === 'pax') {
      if (passengers.some((p) => !isPassengerComplete(p))) {
        setError(t.completePaxError);
        return;
      }
      setStep('extras');
      return;
    }
    if (step === 'extras') {
      // Seat selection is optional per design («انتخاب صندلی (اختیاری)»).
      setStep('review');
      return;
    }
    void submitBooking();
  }

  function goBack() {
    setError(null);
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]!);
  }

  function resolveSeatCodesForBooking(): string[] | null {
    if (!draft) return null;
    const needed = passengers.length;
    const picked = selectedSeats.filter((code) => {
      const cell = seats?.find((s) => s.seatCode === code);
      return cell?.cabin === draft.cabin && cell.status === 'FREE';
    });
    if (picked.length >= needed) return picked.slice(0, needed);
    const used = new Set(picked);
    const free = (seats ?? [])
      .filter((s) => s.cabin === draft.cabin && s.status === 'FREE' && !used.has(s.seatCode))
      .map((s) => s.seatCode);
    const result = [...picked];
    for (const code of free) {
      if (result.length >= needed) break;
      result.push(code);
    }
    return result.length >= needed ? result : null;
  }

  async function submitBooking() {
    if (!draft) return;
    if (status !== 'authenticated') {
      navigate('/signin', { state: { from: location.pathname + location.search } });
      return;
    }
    if (passengers.some((p) => !isPassengerComplete(p))) {
      setError(t.completePaxError);
      setStep('pax');
      return;
    }
    const seatCodes = resolveSeatCodesForBooking();
    if (!seatCodes) {
      setError(
        locale === 'en'
          ? 'No free seats left for this cabin.'
          : 'صندلی خالی برای این کلاس باقی نمانده است.',
      );
      setStep('extras');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const booking = await createBooking({
        flightInstanceId: draft.flightInstanceId,
        cabin: draft.cabin,
        passengers: passengers.map((p, i) => ({
          fullName: passengerFullName(p),
          nationalId: p.docType === 'NATIONAL_ID' ? p.nationalId || undefined : undefined,
          seatCode: seatCodes[i]!,
        })),
      });
      clearCheckoutDraft();
      navigate(`/payment/${booking.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'UNAUTHORIZED') {
        setError(
          locale === 'en'
            ? 'Your session expired. Please sign in again.'
            : 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
        );
        navigate('/signin', { state: { from: location.pathname + location.search } });
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : t.notFound);
    } finally {
      setBusy(false);
    }
  }

  // Auth gate for wizard — design requires login before passenger entry
  if (isWizard && status === 'loading') {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
      </PublicPageShell>
    );
  }
  if (isWizard && status === 'unauthenticated') {
    return (
      <PublicPageShell>
        <div className="p-6">
          <OtpLoginInline />
        </div>
      </PublicPageShell>
    );
  }

  if (loadError) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-red-600">{loadError}</p>
      </PublicPageShell>
    );
  }

  // Legacy held-booking summary (after booking already created)
  if (!isWizard) {
    if (!heldBooking) {
      return (
        <PublicPageShell>
          <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
        </PublicPageShell>
      );
    }
    if (heldBooking.status === 'EXPIRED') {
      return (
        <PublicPageShell>
          <div className="mx-auto max-w-md p-8 text-center">
            <p className="mb-4 text-sm text-red-600">{t.expired}</p>
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white"
            >
              {t.searchAgain}
            </button>
          </div>
        </PublicPageShell>
      );
    }
    // Redirect held bookings straight into payment — wizard already happened
    return (
      <PublicPageShell>
        <FlowStepper current="checkout" onBack={() => navigate(-1)} />
        <div className="mx-auto max-w-lg p-6">
          <FlightSummaryCard
            flight={{
              flightInstanceId: heldBooking.flightInstanceId,
              flightNo: heldBooking.flightNo,
              originCode: heldBooking.originCode,
              destCode: heldBooking.destCode,
              departureAt: heldBooking.departureAt,
              arrivalAt: heldBooking.arrivalAt,
              priceIrr: heldBooking.priceIrr,
            }}
            cabin={heldBooking.cabin}
            locale={locale}
          />
          <div className="mt-4 rounded-2xl border border-[#eef1f5] bg-white p-5">
            <div className="mb-3 text-[11px] font-black text-[#0d2640]">{t.enterPax}</div>
            {heldBooking.passengers.map((p) => (
              <div key={p.seatCode} className="mb-1 flex justify-between text-xs text-[#6b7b94]">
                <span>{p.fullName}</span>
                <span dir="ltr">{p.seatCode}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(`/payment/${bookingId}`)}
            data-testid="continue-to-payment"
            className="mt-4 w-full rounded-xl bg-[#1668c4] px-6 py-3 text-sm font-bold text-white"
          >
            {t.nextPay}
          </button>
        </div>
      </PublicPageShell>
    );
  }

  if (!draft) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
      </PublicPageShell>
    );
  }

  const priceIrr =
    draft.flight.priceIrr && draft.flight.priceIrr !== '0'
      ? draft.flight.priceIrr
      : String(397_000_000 * Math.max(1, passengers.length));
  const extrasIrr =
    extras.filter((e) => e.selected).reduce((s, e) => s + e.priceToman, 0) * 10;
  const grandIrr = Number(priceIrr) + extrasIrr;
  const grandDisplay = localeMoney(grandIrr, locale);

  const stepBody = (
    <>
      {step === 'pax' && (
        <PassengerStep
          locale={locale}
          passengers={passengers}
          onChange={setPassengers}
          savedPassengers={savedPassengers}
        />
      )}
      {step === 'extras' && (
        <ExtrasStep
          locale={locale}
          extras={extras}
          onToggleExtra={toggleExtra}
          seats={seats}
          selectedSeats={selectedSeats}
          onToggleSeat={toggleSeat}
          businessLocked={businessLocked}
          bookedCabin={draft?.cabin ?? 'ECONOMY'}
          aircraftType={draft?.flight.aircraftType ?? 'MD-80'}
        />
      )}
      {step === 'review' && (
        <ReviewStep
          locale={locale}
          passengers={passengers}
          extras={extras}
          selectedSeats={selectedSeats}
        />
      )}
    </>
  );

  // Explicit mobile/desktop trees (design bundle) — do not rely on Tailwind
  // breakpoints alone; Cursor/device preview can desync CSS media queries.
  if (isMobile) {
    return (
      <PublicPageShell>
        <div
          className="flex items-center gap-3 border-b border-[#eef1f5] bg-white px-4 py-3"
          data-testid="checkout-mobile-titlebar"
        >
          <button
            type="button"
            onClick={() => (step === 'pax' ? navigate(-1) : goBack())}
            data-testid="checkout-mobile-back"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#e6eaf0] bg-[#f3f5f8] text-[#0d2640]"
          >
            →
          </button>
          <span className="text-sm font-extrabold text-[#16202e]">{t.title}</span>
        </div>

        <div
          className="mx-auto flex w-full max-w-[1180px] flex-col gap-[15px] px-3.5 py-3.5 pb-28"
          data-testid="checkout-mobile-main"
        >
          <FlightSummaryCard flight={draft.flight} cabin={draft.cabin} locale={locale} />
          {stepBody}
          {error && (
            <div
              className="rounded-[10px] border border-[#f5c6c6] bg-[#fdecec] px-3.5 py-2.5 text-xs font-semibold text-[#c0343a]"
              data-testid="checkout-error"
            >
              {error}
            </div>
          )}
          {/* Design: full CTA in price card + sticky duplicate at bottom */}
          <PricingSidebar
            locale={locale}
            priceIrr={priceIrr}
            paxCount={Math.max(1, passengers.length)}
            extras={extras}
            nextLabel={nextLabel}
            onNext={goNext}
            onBack={goBack}
            canBack={step !== 'pax'}
            busy={busy}
            error={error}
          />
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 z-[80] flex items-center justify-between gap-2.5 border-t border-[#e6eaf0] bg-white px-4 py-2.5 shadow-[0_-8px_24px_-14px_rgba(13,38,102,.3)]"
          data-testid="checkout-mobile-sticky"
        >
          {step !== 'pax' && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-[#e6eaf0] bg-[#f2f5f9]"
            >
              →
            </button>
          )}
          <div className="min-w-0">
            <div className="text-[10.5px] text-[#9aa4b2]">{t.total}</div>
            <div className="whitespace-nowrap text-[15px] font-black text-[#1668c4]">
              {grandDisplay} {t.toman}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={goNext}
            data-testid="checkout-next-mobile"
            className="flex h-12 max-w-[220px] flex-1 items-center justify-center rounded-xl bg-[#1668c4] text-[12.5px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? t.loading : nextLabel}
          </button>
        </div>
      </PublicPageShell>
    );
  }

  const sidebarLabels = {
    paymentDetails: t.paymentDetails,
    description: t.description,
    amountToman: t.amountToman,
    ticketPrice: t.ticketPrice,
    adult: t.adult,
    taxesFees: t.taxesFees,
    total: t.total,
    toman: t.toman,
    securePayment: t.securePayment,
    agreeTermsPrefix: t.agreeTermsPrefix,
    siteTerms: t.siteTerms,
    agreeTermsSuffix: t.agreeTermsSuffix,
    continueToPayment: t.continueToPayment,
  };

  return (
    <PublicPageShell>
      <CheckoutStepBar current={step} locale={locale} />
      <div
        className="mx-auto grid max-w-[1180px] items-start gap-2.5 px-6 py-5"
        data-testid="checkout-desktop-main"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}
      >
        <div className="flex min-w-0 flex-col gap-[15px]">
          <FlightSummaryCard flight={draft.flight} cabin={draft.cabin} locale={locale} />
          {stepBody}
        </div>
        <PricingSidebar
          locale={locale}
          priceIrr={priceIrr}
          paxCount={Math.max(1, passengers.length)}
          extras={extras}
          nextLabel={nextLabel}
          onNext={goNext}
          onBack={goBack}
          canBack={step !== 'pax'}
          busy={busy}
          error={error}
        />
      </div>
    </PublicPageShell>
  );
}
