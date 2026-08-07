import { describe, expect, it } from "vitest";
import {
  computeArrivalHhMm,
  flightNoError,
  formatDurationFa,
  isValidFlightNo,
  isValidHhMm,
  minutesFromDuration,
  previewChargeTotalIrr,
  sanitizeFlightNoInput,
  sumCabinSeats,
} from "./flight-definition";
import { formatTomanGrouped, tomanDigitsOnly } from "../components/MoneyInput";
import { parseTomanToRial } from "./fa-format";

describe("flight number", () => {
  it("sanitizes and uppercases XY1234 style input", () => {
    expect(sanitizeFlightNoInput("xy-12 34")).toBe("XY1234");
    expect(sanitizeFlightNoInput("ab99999")).toBe("AB9999");
  });

  it("validates ^[A-Z]{2}\\d{4}$", () => {
    expect(isValidFlightNo("XY1234")).toBe(true);
    expect(isValidFlightNo("EP905")).toBe(false);
    expect(flightNoError("AB12")).toMatch(/دو حرف/);
  });
});

describe("duration", () => {
  it("rejects zero and builds minutes", () => {
    expect(minutesFromDuration(0, 0)).toBeNull();
    expect(minutesFromDuration(2, 15)).toBe(135);
    expect(formatDurationFa(135)).toBe("۲ ساعت و ۱۵ دقیقه");
  });

  it("computes arrival HH:mm", () => {
    expect(computeArrivalHhMm("08:30", 135)).toBe("10:45");
    expect(isValidHhMm("08:30")).toBe(true);
    expect(isValidHhMm("8:30")).toBe(false);
  });
});

describe("cabin capacities", () => {
  it("sums seats and supports three cabin kinds in preview math", () => {
    expect(sumCabinSeats([{ seats: 12 }, { seats: 20 }, { seats: 148 }])).toBe(
      180,
    );
  });
});

describe("money grouping", () => {
  it("formats separators and converts toman to rial without float", () => {
    expect(formatTomanGrouped("۱۲۳۴۵۶۷")).toBe("۱٬۲۳۴٬۵۶۷");
    expect(formatTomanGrouped("1,234,567")).toBe("۱٬۲۳۴٬۵۶۷");
    expect(tomanDigitsOnly("۱٬۲۳۴٬۵۶۷")).toBe("1234567");
    expect(parseTomanToRial(tomanDigitsOnly("۱٬۲۳۴٬۵۶۷"))).toBe(12_345_670);
  });
});

describe("charge preview", () => {
  it("adds fixed and percent lines", () => {
    const preview = previewChargeTotalIrr(10_000_000, [
      {
        kind: "TAX",
        method: "FIXED",
        amount: 100_000,
        cabin: "ALL",
        active: true,
      },
      {
        kind: "FEE",
        method: "PERCENT",
        amount: 10,
        cabin: "ECONOMY",
        active: true,
      },
    ]);
    expect(preview.lines).toHaveLength(2);
    expect(preview.totalIrr).toBe(11_100_000);
  });
});
