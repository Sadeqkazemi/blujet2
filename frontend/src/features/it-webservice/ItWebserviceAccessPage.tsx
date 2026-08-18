import { useState } from 'react';
import { useOptionalAuth } from '../../hooks/useAuth';
import RequestsSection from './RequestsSection';
import CredentialsSection from './CredentialsSection';
import MonitoringSection from './MonitoringSection';

type TabKey = 'requests' | 'credentials' | 'monitoring';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'requests', label: 'درخواست‌های دسترسی' },
  { key: 'credentials', label: 'کلیدهای آژانس‌ها' },
  { key: 'monitoring', label: 'مانیتورینگ و لاگ‌ها' },
];

/**
 * «وب‌سرویس‌ها / دسترسی API آژانس‌ها» — IT Manager only. Deliberately a
 * standalone nav item, NOT nested inside the reservation-system page.
 *
 * Every list here is either real data (agencies, routes/flights — via the
 * existing `/agencies` and `/reservation/flights` endpoints IT_MANAGER
 * already has access to) or clearly TEMP/DEV mock data from
 * `api/it-webservice-access-mock.ts`, since no backend exists yet for
 * agency API access requests/credentials/monitoring. See
 * docs/features/it-api-access-management.md for the endpoints this page is
 * built against.
 */
export default function ItWebserviceAccessPage() {
  const user = useOptionalAuth()?.user;
  // Route is already IT_MANAGER-only via nav gating (see PanelShell); this
  // mirrors the readOnly convention used across the other it-manager pages
  // for a defensive, testable permission-denied path (e.g. sandbox
  // impersonation or any future partial-access role reaching this route).
  const canManage = user?.role !== 'EMPLOYEE' && user?.role !== 'AGENCY';
  const [tab, setTab] = useState<TabKey>('requests');

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20.5px] font-black text-white">وب‌سرویس‌ها / دسترسی API آژانس‌ها</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">
            بررسی درخواست‌ها، صدور و مدیریت کلید API هر آژانس در محیط Sandbox و Production، و مانیتورینگ مصرف
          </p>
        </div>
        <span className="rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1.5 text-[10.5px] font-bold text-[#f59e0b]">
          پیش‌نمایش — داده‌های نمایشی، بدون اتصال به بک‌اند واقعی
        </span>
      </div>

      <div role="tablist" className="mb-4 flex gap-1.5 rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-[11.5px] font-bold transition ${
              tab === t.key ? 'bg-[#3b82f6] text-white' : 'text-[#9fb0c7] hover:text-[#e7ecf3]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsSection canManage={canManage} />}
      {tab === 'credentials' && <CredentialsSection canManage={canManage} />}
      {tab === 'monitoring' && <MonitoringSection />}
    </div>
  );
}
