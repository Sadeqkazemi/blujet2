import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AddFlightPage from "./AddFlightPage";
import * as flightsApi from "../../api/flights";
import * as pricingApi from "../../api/pricing";
import * as aircraftApi from "../../api/aircraft";
import * as agenciesApi from "../../api/agencies";

describe("AddFlightPage", () => {
  beforeEach(() => {
    vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue([
      { id: "a1", code: "THR", cityFa: "تهران", tz: "Asia/Tehran" },
      { id: "a2", code: "DXB", cityFa: "دبی", tz: "Asia/Dubai" },
    ]);
    vi.spyOn(flightsApi, "fetchAircraftTypes").mockResolvedValue([
      { aircraftType: "Airbus A320", capacity: 180 },
      { aircraftType: "Boeing 737", capacity: 150 },
    ]);
    vi.spyOn(flightsApi, "fetchAllotments").mockResolvedValue([]);
    vi.spyOn(agenciesApi, "fetchAgencies").mockResolvedValue({
      agencies: [],
      kpis: {
        activeCount: 0,
        totalCreditGrantedIrr: "0",
        totalUsedIrr: "0",
        pendingSettlementCount: 0,
      },
    });
  });

  it("renders the design sections and empty fare state", async () => {
    render(<AddFlightPage onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByTestId("add-flight-page")).toBeInTheDocument();
    expect(screen.getByText("افزودن پرواز جدید")).toBeInTheDocument();
    expect(screen.getByText("مشخصات پرواز")).toBeInTheDocument();
    expect(screen.getByText("کلاس‌های نرخی پرواز")).toBeInTheDocument();
    expect(screen.getByText("قیمت‌گذاری")).toBeInTheDocument();
    expect(screen.getByTestId("charge-rules-section")).toBeInTheDocument();
    expect(screen.getByTestId("cabin-capacity-editor")).toBeInTheDocument();
    expect(
      screen.getByText("هنوز کلاس نرخی برای این پرواز تعریف نشده است."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "ثبت پرواز و ارسال قیمت برای تأیید مدیر عامل",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "پیشنهاد قیمت هوش مصنوعی" }),
    ).toBeInTheDocument();
  });

  it("submits create + proposal to the CEO path", async () => {
    const onSuccess = vi.fn();
    vi.spyOn(flightsApi, "createFlight").mockResolvedValue({
      id: "inst-1",
      flightNo: "XY1234",
      originCode: "THR",
      destCode: "DXB",
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      capacity: 180,
      charterSeats: 40,
      sold: 0,
      basePriceIrr: "68000000",
      derivedStatus: "ACTIVE",
    });
    vi.spyOn(pricingApi, "upsertProposal").mockResolvedValue({} as never);

    render(<AddFlightPage onClose={vi.fn()} onSuccess={onSuccess} />);
    await screen.findByTestId("add-flight-page");
    const user = userEvent.setup();

    await user.type(screen.getByTestId("flight-no-input"), "XY1234");
    await user.click(screen.getByText("انتخاب شهر مبدأ"));
    await user.click(await screen.findByText("تهران"));
    await user.click(screen.getByText("انتخاب شهر مقصد"));
    await user.click(await screen.findByText("دبی"));

    await user.click(screen.getByTestId("af-date"));
    await user.click(screen.getByTestId("af-date-today"));

    await user.click(screen.getByTestId("af-time-trigger"));
    await user.selectOptions(screen.getByTestId("af-time-hour"), "8");
    await user.selectOptions(screen.getByTestId("af-time-minute"), "30");
    await user.click(screen.getByTestId("af-time-done"));

    await user.selectOptions(screen.getByTestId("duration-hours"), "2");
    await user.selectOptions(screen.getByTestId("duration-minutes"), "15");
    expect(screen.getByTestId("af-arrival")).toHaveValue("۱۰:۴۵");

    const cabinSeatInput = screen.getByLabelText(/تعداد صندلی اکونومی/);
    await user.clear(cabinSeatInput);
    await user.type(cabinSeatInput, "180");

    await user.type(screen.getByTestId("af-base-money"), "6800000");
    await user.type(screen.getByTestId("af-proposed-money"), "7200000");
    await user.type(screen.getByLabelText(/تعهد چارتری/), "40");

    await user.click(
      screen.getByRole("button", {
        name: "ثبت پرواز و ارسال قیمت برای تأیید مدیر عامل",
      }),
    );

    await waitFor(() =>
      expect(flightsApi.createFlight).toHaveBeenCalledWith(
        expect.objectContaining({
          originCode: "THR",
          destCode: "DXB",
          flightNo: "XY1234",
          capacity: 180,
          charterSeats: 40,
          durationMinutes: 135,
          aircraftType: "Airbus A320",
          cabinCapacities: [{ cabin: "ECONOMY", seats: 180 }],
        }),
      ),
    );
    await waitFor(() =>
      expect(pricingApi.upsertProposal).toHaveBeenCalledWith(
        "inst-1",
        expect.objectContaining({ proposedPriceIrr: "72000000" }),
      ),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("loads cabin capacities when an aircraft type is selected", async () => {
    vi.spyOn(aircraftApi, "fetchAircraftTypeDetail").mockResolvedValue({
      id: "ac-737",
      name: "Boeing 737",
      code: "B737",
      status: "ACTIVE",
      totalSeats: 150,
      cabins: [
        { cabin: "ECONOMY", enabled: true, seats: 132 },
        { cabin: "BUSINESS", enabled: true, seats: 18 },
        { cabin: "COMFORT", enabled: false, seats: 0 },
        { cabin: "FIRST", enabled: false, seats: 0 },
        { cabin: "PREMIUM_ECONOMY", enabled: false, seats: 0 },
      ],
      seatMap: [],
    });

    render(<AddFlightPage onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByTestId("add-flight-page");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId("af-aircraft"), "Boeing 737");

    await waitFor(() => {
      expect(screen.getByLabelText(/تعداد صندلی اکونومی/)).toHaveValue("132");
    });
    expect(screen.getByLabelText(/تعداد صندلی بیزینس/)).toHaveValue("18");
  });

  it("keeps duration selects aligned with other h-11 fields and computes arrival", async () => {
    render(<AddFlightPage onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByTestId("add-flight-page");
    const user = userEvent.setup();

    const hours = screen.getByTestId("duration-hours");
    expect(hours.className).toMatch(/h-11/);
    expect(screen.getByTestId("duration-minutes").className).toMatch(/h-11/);

    await user.click(screen.getByTestId("af-time-trigger"));
    await user.selectOptions(screen.getByTestId("af-time-hour"), "9");
    await user.selectOptions(screen.getByTestId("af-time-minute"), "0");
    await user.click(screen.getByTestId("af-time-done"));
    await user.selectOptions(hours, "1");
    await user.selectOptions(screen.getByTestId("duration-minutes"), "30");
    expect(screen.getByTestId("af-arrival")).toHaveValue("۱۰:۳۰");
  });

  it("loads edit mode and shows revision success message", async () => {
    const onSuccess = vi.fn();
    const departure = new Date(Date.now() + 86400000 * 3);
    vi.spyOn(flightsApi, "fetchFlightDefinition").mockResolvedValue({
      id: "inst-edit",
      flightNo: "XY1234",
      originCode: "THR",
      destCode: "DXB",
      departureAt: departure.toISOString(),
      capacity: 180,
      charterSeats: 20,
      sold: 0,
      basePriceIrr: "68000000",
      derivedStatus: "ACTIVE",
      aircraftType: "Airbus A320",
      durationMinutes: 135,
      cabinCapacities: [{ cabin: "ECONOMY", seats: 180 }],
      chargeRules: [],
      calculatedChargeBreakdown: null,
      approvalStatus: "APPROVED",
      rejectionReason: null,
      canEdit: true,
      editBlockedReason: null,
      pendingRevision: false,
      approvedSnapshot: null,
    });
    vi.spyOn(flightsApi, "updateFlightDefinition").mockResolvedValue({
      id: "inst-edit",
      flightNo: "XY1234",
      originCode: "THR",
      destCode: "DXB",
      departureAt: departure.toISOString(),
      capacity: 180,
      charterSeats: 20,
      sold: 0,
      basePriceIrr: "68000000",
      derivedStatus: "ACTIVE",
      aircraftType: "Airbus A320",
      durationMinutes: 135,
      cabinCapacities: [{ cabin: "ECONOMY", seats: 180 }],
      chargeRules: [],
      calculatedChargeBreakdown: null,
      approvalStatus: "PENDING_REVISION",
      rejectionReason: null,
      canEdit: true,
      editBlockedReason: null,
      pendingRevision: true,
      approvedSnapshot: null,
    });
    vi.spyOn(pricingApi, "upsertProposal").mockResolvedValue({} as never);

    render(
      <AddFlightPage
        mode="edit"
        flightId="inst-edit"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    await screen.findByText("ویرایش مشخصات پرواز");
    await waitFor(() =>
      expect(screen.getByTestId("flight-no-input")).toHaveValue("XY1234"),
    );

    const user = userEvent.setup();
    await user.type(screen.getByTestId("af-proposed-money"), "7500000");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));

    await waitFor(() =>
      expect(flightsApi.updateFlightDefinition).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        "تغییرات برای تأیید مجدد مدیرعامل ارسال شد.",
      ),
    );
  });
});
