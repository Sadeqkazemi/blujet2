import { useState } from 'react';
import { faDigits } from '../../lib/fa-format';
import type { AccessConfig, ApiFlightOption, ApiRouteOption, ApiScopeOption } from '../../types/it-webservice-access';

const FLIGHT_SCOPED_KEYS = new Set(['TICKET_ISSUE', 'CANCEL_REFUND']);

const CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

export interface AccessConfigFieldErrors {
  scopes?: string;
  rateLimit?: string;
  cidr?: string;
  expiresAt?: string;
}

export function validateAccessConfig(config: AccessConfig): AccessConfigFieldErrors {
  const errors: AccessConfigFieldErrors = {};
  if (config.scopes.length === 0) errors.scopes = 'حداقل یک قلمرو دسترسی (Scope) انتخاب کنید.';
  if (!Number.isInteger(config.rateLimitPerMinute) || config.rateLimitPerMinute < 1 || config.rateLimitPerMinute > 6000) {
    errors.rateLimit = 'سقف نرخ درخواست باید عددی بین ۱ تا ۶۰۰۰ در دقیقه باشد.';
  }
  const badCidr = config.allowedCidrs.find((c) => !CIDR_PATTERN.test(c.trim()));
  if (badCidr) errors.cidr = `آدرس/بازهٔ IP نامعتبر: «${badCidr}»`;
  if (config.expiresAt && new Date(config.expiresAt).getTime() <= Date.now()) {
    errors.expiresAt = 'تاریخ انقضا باید در آینده باشد.';
  }
  return errors;
}

interface Props {
  value: AccessConfig;
  onChange: (next: AccessConfig) => void;
  scopeOptions: ApiScopeOption[];
  routeOptions: ApiRouteOption[];
  flightOptions: ApiFlightOption[];
  errors?: AccessConfigFieldErrors;
  idPrefix: string;
}

export default function AccessConfigFields({ value, onChange, scopeOptions, routeOptions, flightOptions, errors, idPrefix }: Props) {
  const [cidrDraft, setCidrDraft] = useState('');
  const needsFlights = value.scopes.some((s) => FLIGHT_SCOPED_KEYS.has(s));

  function toggleScope(key: ApiScopeOption['key']) {
    const has = value.scopes.includes(key);
    onChange({ ...value, scopes: has ? value.scopes.filter((s) => s !== key) : [...value.scopes, key] });
  }

  function toggleRoute(key: string) {
    const has = value.allowedRoutes.includes(key);
    onChange({ ...value, allowedRoutes: has ? value.allowedRoutes.filter((r) => r !== key) : [...value.allowedRoutes, key] });
  }

  function toggleFlight(id: string) {
    const has = value.allowedFlightIds.includes(id);
    onChange({ ...value, allowedFlightIds: has ? value.allowedFlightIds.filter((f) => f !== id) : [...value.allowedFlightIds, id] });
  }

  function addCidr() {
    const v = cidrDraft.trim();
    if (!v || value.allowedCidrs.includes(v)) return;
    onChange({ ...value, allowedCidrs: [...value.allowedCidrs, v] });
    setCidrDraft('');
  }

  function removeCidr(cidr: string) {
    onChange({ ...value, allowedCidrs: value.allowedCidrs.filter((c) => c !== cidr) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-xs font-bold text-[#e7ecf3]">قلمروهای دسترسی (Scopes)</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {scopeOptions.map((s) => {
            const checked = value.scopes.includes(s.key);
            return (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-right text-[11px] transition ${
                  checked ? 'border-[#3b82f6] bg-[#3b82f6]/10' : 'border-[#1f2a3d]'
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleScope(s.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#3b82f6]" />
                <span>
                  <span className={`block font-bold ${checked ? 'text-[#60a5fa]' : 'text-[#cdd6e3]'}`}>{s.labelFa}</span>
                  <span className="text-[10px] text-[#6b7b94]">{s.descFa}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors?.scopes && <p role="alert" className="mt-1.5 text-[10.5px] text-[#f87171]">{errors.scopes}</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#e7ecf3]">
          <span>مسیرهای مجاز</span>
          <span className="text-[10px] font-normal text-[#6b7b94]">{value.allowedRoutes.length === 0 ? 'همهٔ مسیرها مجاز' : `${faDigits(value.allowedRoutes.length)} مسیر انتخاب‌شده`}</span>
        </div>
        {routeOptions.length === 0 ? (
          <p className="text-[10.5px] text-[#6b7b94]">مسیر فعالی برای انتخاب یافت نشد؛ پیش‌فرض همهٔ مسیرها مجاز است.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {routeOptions.map((r) => {
              const checked = value.allowedRoutes.includes(r.key);
              return (
                <button
                  type="button"
                  key={r.key}
                  onClick={() => toggleRoute(r.key)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10.5px] font-bold transition ${
                    checked ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#60a5fa]' : 'border-[#1f2a3d] text-[#9fb0c7]'
                  }`}
                >
                  {r.labelFa}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {needsFlights && (
        <div>
          <div className="mb-2 text-xs font-bold text-[#e7ecf3]">پروازهای مجاز <span className="font-normal text-[10px] text-[#f59e0b]">(الزامی برای صدور بلیط/استرداد)</span></div>
          {flightOptions.length === 0 ? (
            <p className="text-[10.5px] text-[#6b7b94]">پروازی برای انتخاب یافت نشد.</p>
          ) : (
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-[#1f2a3d] p-2">
              {flightOptions.map((f) => {
                const checked = value.allowedFlightIds.includes(f.id);
                return (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-[#cdd6e3]">
                    <input type="checkbox" checked={checked} onChange={() => toggleFlight(f.id)} className="h-3.5 w-3.5 accent-[#3b82f6]" />
                    <span className="font-num">{f.labelFa}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-rate`} className="mb-1 block text-xs font-bold text-[#e7ecf3]">
            سقف نرخ درخواست (در دقیقه)
          </label>
          <input
            id={`${idPrefix}-rate`}
            dir="ltr"
            inputMode="numeric"
            value={value.rateLimitPerMinute}
            onChange={(e) => onChange({ ...value, rateLimitPerMinute: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            className="font-num w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none transition focus:border-[#3b82f6]"
          />
          {errors?.rateLimit && <p role="alert" className="mt-1 text-[10.5px] text-[#f87171]">{errors.rateLimit}</p>}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-expiry`} className="mb-1 block text-xs font-bold text-[#e7ecf3]">
            تاریخ انقضا (اختیاری)
          </label>
          <input
            id={`${idPrefix}-expiry`}
            type="date"
            dir="ltr"
            value={value.expiresAt ? value.expiresAt.slice(0, 10) : ''}
            onChange={(e) => onChange({ ...value, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="font-num w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none transition focus:border-[#3b82f6]"
          />
          {errors?.expiresAt && <p role="alert" className="mt-1 text-[10.5px] text-[#f87171]">{errors.expiresAt}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-cidr`} className="mb-1 block text-xs font-bold text-[#e7ecf3]">
          فهرست IP/CIDR مجاز (اختیاری)
        </label>
        <div className="flex gap-2">
          <input
            id={`${idPrefix}-cidr`}
            dir="ltr"
            placeholder="مثلاً 185.143.10.0/24"
            value={cidrDraft}
            onChange={(e) => setCidrDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCidr();
              }
            }}
            className="font-num flex-1 rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none transition focus:border-[#3b82f6]"
          />
          <button type="button" onClick={addCidr} className="rounded-lg bg-[#18223a] px-3 text-xs font-bold text-[#cdd6e3]">
            افزودن
          </button>
        </div>
        {errors?.cidr && <p role="alert" className="mt-1 text-[10.5px] text-[#f87171]">{errors.cidr}</p>}
        {value.allowedCidrs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.allowedCidrs.map((c) => (
              <span key={c} className="font-num flex items-center gap-1.5 rounded-full border border-[#28344c] bg-[#18223a] px-2.5 py-1 text-[10.5px] text-[#cdd6e3]" dir="ltr">
                {c}
                <button type="button" onClick={() => removeCidr(c)} aria-label={`حذف ${c}`} className="text-[#f87171]">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {value.allowedCidrs.length === 0 && <p className="mt-1 text-[10px] text-[#6b7b94]">بدون فهرست IP یعنی دسترسی از هر آدرسی مجاز است.</p>}
      </div>
    </div>
  );
}
