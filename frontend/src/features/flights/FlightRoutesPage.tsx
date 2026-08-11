import ScheduleTemplatesTab from "./ScheduleTemplatesTab";

export default function FlightRoutesPage() {
  return (
    <div
      className="px-[21px] pb-[34px] pt-[18px]"
      dir="rtl"
      data-testid="flight-routes-page"
    >
      <div className="mb-5">
        <h1 className="m-0 text-[20.5px] font-black text-panel-ink">
          مسیرهای پروازی
        </h1>
        <p className="mt-1 text-[11.5px] leading-6 text-panel-muted">
          مسیر، شماره پرواز، برنامه هفتگی و ظرفیت هواپیما را به‌صورت مستقل
          مدیریت کنید.
        </p>
      </div>
      <ScheduleTemplatesTab />
    </div>
  );
}
