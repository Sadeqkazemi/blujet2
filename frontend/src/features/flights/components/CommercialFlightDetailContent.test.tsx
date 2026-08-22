import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as flightsApi from "../../../api/flights";
import type { CommercialFlightControl, FlightDetail } from "../../../types/flights";
import CommercialFlightDetailContent from "./CommercialFlightDetailContent";

const detail: FlightDetail = {
  id: "fi-1",
  flightNo: "EP-821",
  originCode: "THR",
  destCode: "DXB",
  departureAt: "2026-08-30T08:30:00.000Z",
  capacity: 180,
  sold: 40,
  basePriceIrr: "38000000",
  publicSaleEnabled: true,
  occupancyPct: 22,
  aircraftType: "Airbus A320",
  channels: [
    { channel: "SYSTEM", seats: 25, revenueIrr: "950000000" },
    { channel: "CHARTER", seats: 10, revenueIrr: "380000000" },
    { channel: "AGENCY", seats: 5, revenueIrr: "190000000" },
  ],
  totalRevenueIrr: "1520000000",
};

const control: CommercialFlightControl = {
  flightInstanceId: "fi-1",
  publicSaleEnabled: true,
  fareClasses: [
    {
      ruleId: "rule-y",
      cabin: "ECONOMY",
      classCode: "Y",
      seatsAllocated: 160,
      soldSeats: 40,
      remainingSeats: 120,
      revenueIrr: "1520000000",
      basePriceIrr: "38000000",
      sitePriceIrr: "38000000",
      agencySeatsReleased: 8,
      agencyReleasePriceIrr: "35000000",
      agencySpecialOffer: false,
      priceHistory: [],
    },
  ],
};

function renderContent() {
  return render(
    <CommercialFlightDetailContent
      detail={detail}
      canManage
      onNotice={vi.fn()}
      onError={vi.fn()}
      onChanged={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );
}

describe("CommercialFlightDetailContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(flightsApi, "fetchCommercialFlightControl").mockResolvedValue(control);
  });

  it("renders the real flight controls and updates sales visibility through the canonical endpoint", async () => {
    const visibilitySpy = vi
      .spyOn(flightsApi, "updateFlightSalesVisibility")
      .mockResolvedValue({ ...control, publicSaleEnabled: false });
    renderContent();

    expect(await screen.findByText("تفکیک کانال فروش صندلی")).toBeInTheDocument();
    expect(screen.getAllByText("اکونومی · Y")).toHaveLength(2);

    fireEvent.click(screen.getByRole("switch", { name: "مجوز نمایش و فروش در سایت" }));
    await waitFor(() => expect(visibilitySpy).toHaveBeenCalledWith("fi-1", false));
  });

  it("saves the per-class agency allocation and website price with their canonical APIs", async () => {
    const releaseSpy = vi
      .spyOn(flightsApi, "upsertAgencyFareRelease")
      .mockResolvedValue(control.fareClasses[0]);
    const priceSpy = vi
      .spyOn(flightsApi, "updateFareClassSitePrice")
      .mockResolvedValue(control.fareClasses[0]);
    renderContent();

    await screen.findByText("آزادسازی صندلی برای فروش آژانسی — به تفکیک کلاس پروازی");
    fireEvent.change(screen.getByLabelText("تعداد صندلی برای فروش"), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByLabelText("قیمت هر صندلی این کلاس (تومان)"), {
      target: { value: "3600000" },
    });
    fireEvent.click(screen.getByLabelText("نمایش به آژانس‌ها به‌عنوان پیشنهاد فوق‌العاده"));
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    await waitFor(() =>
      expect(releaseSpy).toHaveBeenCalledWith("fi-1", "rule-y", {
        seats: 15,
        priceIrr: "36000000",
        specialOffer: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "اصلاح قیمت ✎" }));
    fireEvent.change(screen.getByLabelText("قیمت سایت اکونومی · Y"), {
      target: { value: "4200000" },
    });
    fireEvent.change(screen.getByLabelText("دلیل تغییر قیمت اکونومی · Y"), {
      target: { value: "تقاضای آخر هفته" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() =>
      expect(priceSpy).toHaveBeenCalledWith("fi-1", "rule-y", {
        priceIrr: "42000000",
        reason: "تقاضای آخر هفته",
      }),
    );
  });
});
