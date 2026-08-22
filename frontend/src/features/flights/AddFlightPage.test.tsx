import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AddFlightPage from "./AddFlightPage";
import * as flightsApi from "../../api/flights";
import * as pricingApi from "../../api/pricing";
import * as aircraftApi from "../../api/aircraft";
import * as agenciesApi from "../../api/agencies";
import { ApiRequestError } from "../../api/envelope";

describe("AddFlightPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue([
      { id: "a1", code: "THR", cityFa: "تهران", tz: "Asia/Tehran" },
      { id: "a2", code: "DXB", cityFa: "دبی", tz: "Asia/Dubai" },
    ]);
    vi.spyOn(flightsApi, "fetchAircraftTypes").mockResolvedValue([
      { aircraftType: "Airbus A320", capacity: 180 },
      { aircraftType: "Boeing 737", capacity: 150 },
    ]);
    vi.spyOn(flightsApi, "resolveScheduleTemplate").mockRejectedValue(
      new ApiRequestError("NOT_FOUND", "not found", 404),
    );
    vi.spyOn(flightsApi, "fetchAllotmentsSummary").mockResolvedValue({
      flightInstanceId: "fi-none",
      totalCapacity: 180,
      charterSeats: 0,
      directReserved: 0,
      agencySeats: 0,
      freeSeats: 180,
      agencyRevenueIrr: "0",
      agencies: [],
    });
    vi.spyOn(flightsApi, "fetchCommitments").mockResolvedValue([]);
    vi.spyOn(flightsApi, "fetchFareRules").mockResolvedValue([]);
    vi.spyOn(flightsApi, "createFareRule").mockResolvedValue({} as never);
    vi.spyOn(flightsApi, "updateFareRule").mockResolvedValue({} as never);
    vi.spyOn(flightsApi, "fetchCommitmentsSummary").mockResolvedValue({
      cabins: [],
      totalCapacity: 0,
      charterCommitted: 0,
      agencyCommitted: 0,
      sold: 0,
      availableOnline: 0,
    });
    vi.spyOn(flightsApi, "submitFlightToOperations").mockResolvedValue({} as never);
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
    expect(screen.getByTestId("commercial-pricing-capacity-summary")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-agency-seats")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-agency-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-public-seats")).toBeInTheDocument();
    expect(
      screen.getByText("هنوز کلاس نرخی برای این پرواز تعریف نشده است."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "ثبت پرواز و ارسال برای مدیر عملیات",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "پیشنهاد قیمت هوش مصنوعی" }),
    ).toBeInTheDocument();
  });

  it("submits create + proposal to the operations path", async () => {
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
      version: 1,
    } as never);
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

    await user.click(screen.getByRole("button", { name: "افزودن کلاس نرخی" }));
    const classCodeInput = screen
      .getByText("کد کلاس (مثلاً Y)")
      .parentElement!.querySelector("input")!;
    const seatsInput = screen
      .getByText("ظرفیت اختصاصی (صندلی)")
      .parentElement!.querySelector("input")!;
    await user.type(classCodeInput, "Y");
    await user.type(screen.getByTestId("fare-price-money"), "7200000");
    await user.type(seatsInput, "140");
    await user.click(screen.getByRole("button", { name: "ثبت کلاس نرخی" }));

    await user.click(
      screen.getByRole("button", {
        name: "ثبت پرواز و ارسال برای مدیر عملیات",
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
    expect(flightsApi.submitFlightToOperations).toHaveBeenCalledWith(
      "inst-1",
      1,
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("loads cabin capacities when an aircraft type is selected", async () => {
    vi.spyOn(aircraftApi, "fetchAircraftDefinitions").mockResolvedValue([
      {
        id: "ac-737",
        code: "B737",
        model: "Boeing 737",
        title: "بوئینگ ۷۳۷",
        status: "ACTIVE",
        totalCapacity: 150,
        version: 1,
        cabins: [
          { cabinType: "ECONOMY", capacity: 132 },
          { cabinType: "BUSINESS", capacity: 18 },
        ],
      },
    ]);
    vi.spyOn(aircraftApi, "fetchAircraftDefinition").mockResolvedValue({
      id: "ac-737",
      code: "B737",
      model: "Boeing 737",
      title: "بوئینگ ۷۳۷",
      status: "ACTIVE",
      totalCapacity: 150,
      version: 1,
      cabins: [
        { cabinType: "ECONOMY", capacity: 132 },
        { cabinType: "BUSINESS", capacity: 18 },
      ],
      seats: [],
      seatMap: {
        aircraftDefinitionId: "ac-737",
        cabinLayout: {},
        excludedSeatCodes: [],
        seats: [],
      },
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
      version: 2,
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
      version: 3,
    });
    vi.spyOn(pricingApi, "upsertProposal").mockResolvedValue({} as never);
    vi.mocked(flightsApi.fetchFareRules).mockResolvedValue([
      {
        id: "fare-y",
        flightInstanceId: "inst-edit",
        cabin: "ECONOMY",
        classCode: "Y",
        priceIrr: 72000000,
        seatsAllocated: 160,
        taxIrr: 0,
        refundable: true,
        changeable: true,
        baggageAllowanceKg: 20,
        validFrom: null,
        validUntil: null,
        allowedChannels: ["SYSTEM", "AGENCY"],
      },
    ]);

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
        "تغییرات برای بررسی مجدد مدیر عملیات ارسال شد.",
      ),
    );
    expect(flightsApi.submitFlightToOperations).toHaveBeenCalledWith(
      "inst-edit",
      3,
    );
  });

  it("completes the resolved scheduled occurrence instead of creating a duplicate", async () => {
    const onSuccess = vi.fn();
    vi.mocked(flightsApi.resolveScheduleTemplate).mockResolvedValue({
      id: "template-1",
      originAirportId: "a1",
      destinationAirportId: "a2",
      flightNoBase: "XY1234",
      aircraftDefinitionId: "aircraft-1",
      departureTime: "08:30",
      durationMinutes: 135,
      startDate: "2026-08-22",
      endDate: "2026-09-22",
      weekdays: [6],
      agencyPriceIrr: "68000000",
      legalCeilingIrr: "80000000",
      originCode: "THR",
      destCode: "DXB",
      aircraftCode: "Airbus A320",
      cabinCapacities: [{ cabin: "ECONOMY", seats: 180 }],
      capacity: 180,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deactivatedAt: null,
      nextFlightInstanceId: "scheduled-instance-1",
      nextDepartureAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    vi.spyOn(flightsApi, "updateFlightDefinition").mockResolvedValue({
      id: "scheduled-instance-1",
      version: 2,
      approvalStatus: "DRAFT",
    } as never);
    vi.spyOn(flightsApi, "createFlight").mockResolvedValue({} as never);
    vi.spyOn(flightsApi, "createFareRule").mockResolvedValue({} as never);
    vi.spyOn(pricingApi, "upsertProposal").mockResolvedValue({} as never);

    render(<AddFlightPage onClose={vi.fn()} onSuccess={onSuccess} />);
    const user = userEvent.setup();
    await user.type(await screen.findByTestId("flight-no-input"), "XY1234");
    expect(await screen.findByTestId("resolved-schedule-summary")).toBeInTheDocument();
    expect(screen.getByTestId("af-aircraft")).toHaveValue("Airbus A320");
    expect(screen.getByLabelText(/تعداد صندلی اکونومی/)).toHaveValue("180");

    await user.type(screen.getByTestId("af-base-money"), "6800000");
    await user.type(screen.getByTestId("af-proposed-money"), "7200000");
    await user.click(screen.getByRole("button", { name: "افزودن کلاس نرخی" }));
    await user.type(
      screen.getByText("کد کلاس (مثلاً Y)").parentElement!.querySelector("input")!,
      "Y",
    );
    await user.type(screen.getByTestId("fare-price-money"), "7200000");
    await user.type(
      screen.getByText("ظرفیت اختصاصی (صندلی)").parentElement!.querySelector("input")!,
      "180",
    );
    await user.click(screen.getByRole("button", { name: "ثبت کلاس نرخی" }));
    await user.click(
      screen.getByRole("button", { name: "ثبت پرواز و ارسال برای مدیر عملیات" }),
    );

    await waitFor(() =>
      expect(flightsApi.updateFlightDefinition).toHaveBeenCalledWith(
        "scheduled-instance-1",
        expect.objectContaining({ flightNo: "XY1234", capacity: 180 }),
      ),
    );
    expect(flightsApi.createFlight).not.toHaveBeenCalled();
    expect(flightsApi.createFareRule).toHaveBeenCalledWith(
      "scheduled-instance-1",
      expect.objectContaining({ classCode: "Y", seatsAllocated: 180 }),
    );
    expect(flightsApi.submitFlightToOperations).toHaveBeenCalledWith(
      "scheduled-instance-1",
      2,
    );
  });
});
