import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FlightsPage from "./FlightsPage";
import * as flightsApi from "../../api/flights";
import * as pricingApi from "../../api/pricing";
import * as authApi from "../../api/auth";
import * as useAuthModule from "../../hooks/useAuth";
import { mockAuthUserWithRole } from "../../test/mockAuthUser";
import type {
  AircraftTypeOption,
  AirportEntry,
  FlightsOverview,
  FlightDetail,
  FutureFlightRow,
} from "../../types/flights";
import type { Role } from "../../types/auth";

const AIRPORTS: AirportEntry[] = [
  { id: "a1", code: "THR", cityFa: "تهران", tz: "Asia/Tehran" },
  { id: "a2", code: "MHD", cityFa: "مشهد", tz: "Asia/Tehran" },
  { id: "a3", code: "DXB", cityFa: "دبی", tz: "Asia/Dubai" },
];

const FUTURE_ROW: FutureFlightRow = {
  id: "fu1",
  flightNo: "EP-840",
  originCode: "THR",
  destCode: "DXB",
  departureAt: "2026-08-10T08:30:00.000Z",
  capacity: 180,
  charterSeats: 60,
  sold: 0,
  basePriceIrr: null,
  agencySeatsAllocated: null,
  aiSuggestion: {
    // Advisory-only ML output — a plain JSON number, unlike the other Irr
    // fields on this page (see types/flights.ts).
    priceIrr: 41_000_000,
    reason: "با توجه به فصل تابستان، نرخ پیشنهادی هم‌تراز رقباست.",
    factors: ["فصل: اوج سفر"],
    season: "تابستان",
    occasion: "بدون مناسبت",
    confidence: 0.8,
    modelVersion: "heuristic-v1.0.0",
    generatedAt: "2026-07-17T00:00:00.000Z",
  },
};

const OVERVIEW: FlightsOverview = {
  kpis: { activeCount: 1, soldSeats: 152, meanOccupancyPct: 84 },
  active: [
    {
      id: "fi1",
      flightNo: "EP-821",
      originCode: "THR",
      destCode: "DXB",
      departureAt: "2026-07-20T08:30:00.000Z",
      capacity: 180,
      charterSeats: 60,
      sold: 152,
      // Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON
      // on the backend).
      basePriceIrr: "38000000",
      derivedStatus: "SELLING",
    },
    {
      id: "fi2",
      flightNo: "RV-431",
      originCode: "THR",
      destCode: "MHD",
      departureAt: "2026-07-21T06:20:00.000Z",
      capacity: 140,
      charterSeats: 0,
      sold: 0,
      basePriceIrr: "15000000",
      derivedStatus: "CANCELLED",
    },
  ],
  completed: {
    rows: [
      {
        id: "dn1",
        flightNo: "EP-805",
        originCode: "THR",
        destCode: "DXB",
        departureAt: "2026-07-10T08:30:00.000Z",
        tickets: 3,
        basePriceIrr: "30000000",
        avgPriceIrr: "40000000",
        revenueIrr: "120000000",
        channelRevenueIrr: {
          SYSTEM: "80000000",
          CHARTER: "0",
          AGENCY: "40000000",
        },
        profitIrr: "30000000",
        lossIrr: "0",
      },
    ],
    kpis: {
      totalSalesIrr: "120000000",
      totalProfitIrr: "30000000",
      totalTickets: 3,
      flightCount: 1,
    },
  },
  future: [FUTURE_ROW],
};

const DETAIL: FlightDetail = {
  ...OVERVIEW.active[0],
  channels: [
    { channel: "SYSTEM", seats: 80, revenueIrr: "3040000000" },
    { channel: "CHARTER", seats: 45, revenueIrr: "1710000000" },
    { channel: "AGENCY", seats: 27, revenueIrr: "1026000000" },
  ],
  totalRevenueIrr: "5776000000",
  occupancyPct: 84,
  aircraftType: "Airbus A320",
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    status: "authenticated",
    user: mockAuthUserWithRole(role, { id: "me" }),
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function mockData(overview: FlightsOverview = OVERVIEW) {
  vi.spyOn(flightsApi, "fetchFlightsOverview").mockResolvedValue(overview);
  vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue(AIRPORTS);
}

describe("FlightsPage", () => {
  it("renders KPI cards and the active table with derived statuses, occupancy and toman prices", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    render(<FlightsPage />);

    expect(
      await screen.findByText("مدیریت پروازها و موجودی"),
    ).toBeInTheDocument();
    expect(screen.getByText("پرواز فعال")).toBeInTheDocument();
    expect(screen.getByText("۱۵۲")).toBeInTheDocument(); // sold-seats KPI
    expect(screen.getByText("۸۴٪")).toBeInTheDocument();

    expect(screen.getByText("تهران ← دبی")).toBeInTheDocument();
    expect(screen.getByText("EP-821")).toBeInTheDocument();
    expect(screen.getByText("در حال فروش")).toBeInTheDocument();
    expect(screen.getByText("لغو شده")).toBeInTheDocument();
    // 38,000,000 rial → ۳٬۸۰۰٬۰۰۰ toman
    expect(screen.getByText("۳٬۸۰۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("opens the full-page add-flight form when + افزودن پرواز is clicked", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue([
      { id: "a1", code: "THR", cityFa: "تهران", tz: "Asia/Tehran" },
      { id: "a2", code: "MHD", cityFa: "مشهد", tz: "Asia/Tehran" },
    ]);
    vi.spyOn(flightsApi, "fetchAircraftTypes").mockResolvedValue([
      { aircraftType: "Airbus A320", capacity: 180 },
    ]);

    const { default: userEvent } = await import("@testing-library/user-event");
    render(<FlightsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "+ افزودن پرواز" }),
    );
    expect(await screen.findByTestId("add-flight-page")).toBeInTheDocument();
    expect(screen.getByText("افزودن پرواز جدید")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "ثبت پرواز و ارسال قیمت برای تأیید مدیر عامل",
      }),
    ).toBeInTheDocument();
  });

  it("flight detail modal shows the real channel breakdown and total revenue", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    vi.spyOn(flightsApi, "fetchFlightDetail").mockResolvedValue(DETAIL);

    const { default: userEvent } = await import("@testing-library/user-event");
    render(<FlightsPage />);

    await userEvent.click(await screen.findByText("تهران ← دبی"));
    const dialog = await screen.findByRole("dialog", { name: /EP-821/ });

    expect(
      within(dialog).getByText("تفکیک کانال فروش صندلی"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("فروش سیستمی")).toBeInTheDocument();
    expect(within(dialog).getByText(/۸۰ صندلی/)).toBeInTheDocument();
    expect(within(dialog).getByText("مجموع درآمد پرواز")).toBeInTheDocument();
    // 5,776,000,000 rial → ۵۷۷٬۶۰۰٬۰۰۰ toman
    expect(within(dialog).getByText("۵۷۷٬۶۰۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("future tab: AI panel renders; the plan modal pre-fills from AI and submits toman→rial + agency cap", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    const planSpy = vi.spyOn(flightsApi, "planFlight").mockResolvedValue({
      id: "fu1",
      basePriceIrr: "41000000",
      agencySeatsAllocated: 50,
      directSeats: 70,
      proposalPending: false,
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    render(<FlightsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "پروازهای آینده" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /تهران ← دبی/ })); // expand card
    expect(
      screen.getByText("تحلیل هوش مصنوعی — چرا این قیمت؟"),
    ).toBeInTheDocument();
    expect(screen.getByText("تعیین نشده")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "نرخ‌گذاری" }));
    const dialog = await screen.findByRole("dialog", {
      name: /نرخ‌گذاری و تخصیص/,
    });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "استفاده از قیمت AI" }),
    );
    // 41,000,000 rial → 4,100,000 toman in the input
    expect(within(dialog).getByLabelText("نرخ نهایی (تومان)")).toHaveValue(
      "4100000",
    );

    const agencyInput = within(dialog).getByLabelText(/تخصیص صندلی آژانس/);
    fireEvent.change(agencyInput, { target: { value: "50" } });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "ثبت نرخ و تخصیص صندلی" }),
    );

    await waitFor(() =>
      expect(planSpy).toHaveBeenCalledWith(
        "fu1",
        expect.objectContaining({ priceIrr: 41_000_000, agencySeats: 50 }),
      ),
    );
    expect(
      await screen.findByText(/نرخ و تخصیص صندلی تهران ← دبی ثبت شد ✓/),
    ).toBeInTheDocument();
  });

  it("AI analysis outage shows the graceful degradation message", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    vi.spyOn(flightsApi, "runFlightsAiAnalysis").mockResolvedValue({
      analyzed: 0,
      available: false,
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    render(<FlightsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "پروازهای آینده" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "✦ تحلیل قیمت‌گذاری با هوش مصنوعی" }),
    );
    expect(
      await screen.findByText(
        "سرویس تحلیل هوش مصنوعی در دسترس نیست؛ نرخ‌گذاری دستی همچنان ممکن است.",
      ),
    ).toBeInTheDocument();
  });

  it("Commercial shows cities tab and embedded pricing on active tab", async () => {
    mockRole("COMMERCIAL_MANAGER");
    mockData();
    vi.spyOn(pricingApi, "fetchCommercialPricing").mockResolvedValue({
      flights: [],
    });

    render(<FlightsPage />);
    expect(
      await screen.findByText("تعیین قیمت پرواز و ارسال به مدیر عامل"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "پروازهای آینده" }),
    ).not.toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(
      screen.getByRole("button", { name: "شهرهای پروازی" }),
    );
    expect(await screen.findByText("شهرهای دارای پرواز")).toBeInTheDocument();
    expect(screen.getByText("تهران")).toBeInTheDocument();
  });

  it("Senior does NOT get the pricing section", async () => {
    mockRole("SENIOR_MANAGER");
    mockData();
    render(<FlightsPage />);
    await screen.findByText("مدیریت پروازها و موجودی");
    expect(
      screen.queryByText("تعیین قیمت پرواز و ارسال به مدیر عامل"),
    ).not.toBeInTheDocument();
  });

  describe("aircraft-type change", () => {
    const AIRCRAFT_TYPES: AircraftTypeOption[] = [
      { aircraftType: "Airbus A320", capacity: 180 },
      { aircraftType: "Boeing 737", capacity: 189 },
    ];

    it("shows the current aircraft type, and a change with step-up succeeds and updates the shown type/capacity", async () => {
      mockRole("SENIOR_MANAGER");
      mockData();
      vi.spyOn(flightsApi, "fetchFlightDetail").mockResolvedValue(DETAIL);
      vi.spyOn(flightsApi, "fetchAircraftTypes").mockResolvedValue(
        AIRCRAFT_TYPES,
      );
      vi.spyOn(authApi, "requestStepUp").mockResolvedValue({
        challengeId: "ch1",
      });
      const changeSpy = vi
        .spyOn(flightsApi, "changeFlightAircraft")
        .mockResolvedValue({
          id: "fi1",
          aircraftType: "Boeing 737",
          capacity: 189,
        });

      const { default: userEvent } =
        await import("@testing-library/user-event");
      const user = userEvent.setup();
      render(<FlightsPage />);

      await user.click(await screen.findByText("تهران ← دبی"));
      const dialog = await screen.findByRole("dialog", { name: /EP-821/ });
      expect(within(dialog).getByText("Airbus A320")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "تغییر" }));
      const select = await within(dialog).findByRole("combobox");
      await user.selectOptions(select, "Boeing 737");
      await user.click(
        within(dialog).getByRole("button", { name: "ثبت تغییر" }),
      );

      const stepUpDialog = await screen.findByRole("dialog", {
        name: "تأیید مجدد هویت",
      });
      await user.type(within(stepUpDialog).getByRole("textbox"), "482913");
      await user.click(
        within(stepUpDialog).getByRole("button", { name: "تأیید" }),
      );

      await waitFor(() =>
        expect(changeSpy).toHaveBeenCalledWith("fi1", "Boeing 737", {
          stepUpChallengeId: "ch1",
          stepUpCode: "482913",
        }),
      );
      expect(await within(dialog).findByText("Boeing 737")).toBeInTheDocument();
    });

    it("shows the backend error (e.g. capacity below confirmed bookings) inline without closing the picker", async () => {
      mockRole("SENIOR_MANAGER");
      mockData();
      vi.spyOn(flightsApi, "fetchFlightDetail").mockResolvedValue(DETAIL);
      vi.spyOn(flightsApi, "fetchAircraftTypes").mockResolvedValue(
        AIRCRAFT_TYPES,
      );
      vi.spyOn(authApi, "requestStepUp").mockResolvedValue({
        challengeId: "ch1",
      });
      vi.spyOn(flightsApi, "changeFlightAircraft").mockRejectedValue(
        new Error(
          "ظرفیت هواپیمای جدید کمتر از تعداد رزروهای قطعی/لاک‌شدهٔ فعلی است.",
        ),
      );

      const { default: userEvent } =
        await import("@testing-library/user-event");
      const user = userEvent.setup();
      render(<FlightsPage />);

      await user.click(await screen.findByText("تهران ← دبی"));
      const dialog = await screen.findByRole("dialog", { name: /EP-821/ });
      await user.click(within(dialog).getByRole("button", { name: "تغییر" }));
      const select = await within(dialog).findByRole("combobox");
      await user.selectOptions(select, "Boeing 737");
      await user.click(
        within(dialog).getByRole("button", { name: "ثبت تغییر" }),
      );

      const stepUpDialog = await screen.findByRole("dialog", {
        name: "تأیید مجدد هویت",
      });
      await user.type(within(stepUpDialog).getByRole("textbox"), "482913");
      await user.click(
        within(stepUpDialog).getByRole("button", { name: "تأیید" }),
      );

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "ظرفیت هواپیمای جدید کمتر از تعداد رزروهای قطعی/لاک‌شدهٔ فعلی است.",
      );
      expect(within(dialog).getByRole("combobox")).toBeInTheDocument();
    });
  });
});
