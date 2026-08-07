import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MoneyInput, { formatTomanGrouped } from "./MoneyInput";
import JalaliDatePicker from "./JalaliDatePicker";
import { dayjs, toIsoDateOnly } from "../lib/jalali";

function MoneyHarness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <MoneyInput
      testId="money"
      valueToman={v}
      onChangeToman={(next) => {
        onChange(next);
        setV(next);
      }}
    />
  );
}

describe("MoneyInput", () => {
  it("shows thousands separators while typing and a تومان unit", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MoneyHarness onChange={onChange} />);
    await user.type(screen.getByTestId("money"), "1234567");
    expect(onChange).toHaveBeenCalled();
    expect(formatTomanGrouped("1234567")).toBe("۱٬۲۳۴٬۵۶۷");
    expect(screen.getByText("تومان")).toBeInTheDocument();
  });
});

describe("JalaliDatePicker dark panel", () => {
  it("opens a viewport-safe popup and respects minDate wiring", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const today = toIsoDateOnly(dayjs());
    render(
      <div style={{ width: 320 }}>
        <JalaliDatePicker
          label="تاریخ"
          theme="dark"
          singleLine
          minDate={today}
          value={null}
          onChange={onChange}
          testId="jalali"
        />
      </div>,
    );
    await user.click(screen.getByTestId("jalali"));
    const popup = screen.getByTestId("jalali-popup");
    expect(popup).toBeInTheDocument();
    expect(popup.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
  });
});
