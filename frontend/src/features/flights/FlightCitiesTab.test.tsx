import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FlightCitiesTab from "./FlightCitiesTab";
import * as flightsApi from "../../api/flights";
import type { AirportEntry } from "../../types/flights";

const AIRPORTS: AirportEntry[] = [
  {
    id: "a1",
    code: "THR",
    cityFa: "تهران",
    airportNameFa: "فرودگاه مهرآباد / امام",
    tz: "Asia/Tehran",
  },
];

describe("FlightCitiesTab", () => {
  it("creates a city and refreshes the list", async () => {
    const created: AirportEntry = {
      id: "a2",
      code: "VAS",
      cityFa: "وان",
      airportNameFa: "فرودگاه وان",
      tz: "Asia/Tehran",
    };
    const createSpy = vi
      .spyOn(flightsApi, "createAirport")
      .mockResolvedValue(created);
    const onCreated = vi.fn();

    render(
      <FlightCitiesTab
        airports={AIRPORTS}
        onCreated={onCreated}
        onDeleted={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("نام شهر *"), "وان");
    await userEvent.type(screen.getByLabelText("کد فرودگاه *"), "VAS");
    await userEvent.type(screen.getByLabelText("نام فرودگاه"), "فرودگاه وان");
    await userEvent.click(screen.getByRole("button", { name: "افزودن شهر" }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        cityFa: "وان",
        code: "VAS",
        airportNameFa: "فرودگاه وان",
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("shows the registered airport name, not a fabricated one", () => {
    render(
      <FlightCitiesTab
        airports={AIRPORTS}
        onCreated={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText("فرودگاه مهرآباد / امام")).toBeInTheDocument();
  });
});
