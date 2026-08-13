import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScheduleTemplatesTab from "./ScheduleTemplatesTab";
import * as flightsApi from "../../api/flights";
import * as aircraftApi from "../../api/aircraft";

afterEach(() => vi.restoreAllMocks());

describe("ScheduleTemplatesTab", () => {
  it("loads route templates from real APIs and renders an empty state without filler rows", async () => {
    vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue([]);
    vi.spyOn(aircraftApi, "fetchAircraftDefinitions").mockResolvedValue([]);
    vi.spyOn(flightsApi, "fetchScheduleTemplates").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    render(<ScheduleTemplatesTab />);

    expect(
      await screen.findByText("هنوز مسیر پروازی تعریف نشده است."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "تعریف مسیر پروازی جدید" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/تهران.*مشهد/)).not.toBeInTheDocument();
  });

  it("formats both toman inputs in Persian and spells the value while typing", async () => {
    vi.spyOn(flightsApi, "fetchAirports").mockResolvedValue([]);
    vi.spyOn(aircraftApi, "fetchAircraftDefinitions").mockResolvedValue([]);
    vi.spyOn(flightsApi, "fetchScheduleTemplates").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    const user = userEvent.setup();

    render(<ScheduleTemplatesTab />);
    await screen.findByRole("heading", { name: "تعریف مسیر پروازی جدید" });

    const agencyPrice = screen.getByLabelText("قیمت آژانس (تومان)");
    await user.type(agencyPrice, "50");
    expect(agencyPrice).toHaveValue("۵۰");
    expect(screen.getByText("پنجاه تومان")).toBeInTheDocument();

    await user.type(agencyPrice, "0");
    expect(agencyPrice).toHaveValue("۵۰۰");
    expect(screen.getByText("پانصد تومان")).toBeInTheDocument();

    const legalCeiling = screen.getByLabelText("قیمت قانونی (تومان)");
    await user.type(legalCeiling, "1250000");
    expect(legalCeiling).toHaveValue("۱٬۲۵۰٬۰۰۰");
    expect(
      screen.getByText("یک میلیون و دویست و پنجاه هزار تومان"),
    ).toBeInTheDocument();
  });
});
