import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as flightsApi from "../../api/flights";
import type { OperationsFlightRow } from "../../types/flights";
import OperationsCartablePage from "./OperationsCartablePage";

const ROW: OperationsFlightRow = {
  id: "flight-1",
  flightNo: "XY1234",
  originCode: "THR",
  destCode: "DXB",
  departureAt: "2026-08-20T08:30:00.000Z",
  capacity: 180,
  charterSeats: 60,
  aircraftType: "Airbus A320",
  basePriceIrr: "38000000",
  competitorPriceIrr: "39000000",
  proposal: {
    id: "proposal-1",
    proposedPriceIrr: "38500000",
    legalRateIrr: "42000000",
    note: "پیشنهاد آزمایشی بازرگانی",
    status: "PENDING",
    proposedBy: { id: "commercial-1", fullName: "رضا مرادی" },
  },
  definitionStatus: "PENDING_OPERATIONS",
  publishStatus: "PENDING_APPROVAL",
  uiStatus: "pending_ops",
  version: 3,
  rejectionReason: null,
};

describe("OperationsCartablePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(flightsApi, "fetchOperationsQueue").mockResolvedValue([ROW]);
  });

  it("requires a comment and then approves with the observed version", async () => {
    const decide = vi
      .spyOn(flightsApi, "decideFlightOperations")
      .mockResolvedValue({} as never);
    const user = userEvent.setup();
    render(<OperationsCartablePage />);

    expect(await screen.findByText(/XY1234/)).toBeInTheDocument();
    expect(screen.getByText("پیشنهاد آزمایشی بازرگانی", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تأیید و ارسال به مدیر عامل" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ثبت نظر مدیر عملیات",
    );
    expect(decide).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("نظر / دلیل تصمیم"),
      "برنامه پرواز از نظر عملیاتی قابل انجام است.",
    );
    await user.click(screen.getByRole("button", { name: "تأیید و ارسال به مدیر عامل" }));

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith("flight-1", {
        decision: "APPROVED",
        comment: "برنامه پرواز از نظر عملیاتی قابل انجام است.",
        expectedVersion: 3,
      }),
    );
    expect(
      await screen.findByText("پرواز برای تأیید نهایی مدیر عامل ارسال شد."),
    ).toBeInTheDocument();
  });
});
