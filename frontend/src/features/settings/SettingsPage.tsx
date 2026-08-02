import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchSettings, updateRefundRules, updateSettings } from '../../api/admins';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, latinDigits } from '../../lib/fa-format';
import type { RefundRuleRow, SettingsResult } from '../../types/admins';
import type { SocialLinkEntry, SocialLinkId } from '../../types/social-links';
import { SOCIAL_LINK_IDS } from '../../types/social-links';
import type { AppDownloadLinkEntry, AppLinkId } from '../../types/app-links';
import { APP_LINK_IDS } from '../../types/app-links';
import { SocialIcon, socialBrandColor } from '../../components/public/SocialIcon';
import PanelAlert from '../panel/PanelAlert';
import {
  panelBtnPrimary,
  panelCard,
  panelCardPadded,
  panelInput,
  panelMuted,
  panelSubtitle,
  panelText,
  panelTitle,
} from '../panel/panel-theme';

const GATEWAYS: { key: string; name: string; desc: string }[] = [
  { key: 'gatewayMellat', name: 'درگاه بانک ملت', desc: 'درگاه اصلی پرداخت' },
  { key: 'gatewaySaman', name: 'درگاه بانک سامان', desc: 'درگاه پشتیبان' },
  { key: 'gatewayZarin', name: 'زرین‌پال', desc: 'درگاه واسط' },
];

const GLOBAL_TOGGLES: { key: string; title: string; desc: string }[] = [
  { key: 'maintenance', title: 'حالت تعمیر و نگهداری', desc: 'نمایش صفحه «در دست تعمیر» به کاربران' },
  { key: 'registration', title: 'ثبت‌نام کاربران جدید', desc: 'امکان ساخت حساب کاربری در سایت' },
  { key: 'charterSale', title: 'فروش بلیط چارتر', desc: 'فعال بودن خرید بلیط‌های چارتری' },
  { key: 'apiPublic', title: 'دسترسی عمومی API', desc: 'باز بودن وب‌سرویس برای همه آژانس‌ها' },
  { key: 'sandbox', title: 'حالت آزمایشی (Sandbox)', desc: 'اجرای پرداخت‌ها در محیط تست' },
];

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6.5 w-12 flex-none rounded-full transition ${on ? 'bg-panel-accent' : 'bg-[#28344c]'}`}
    >
      <span
        className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${
          on ? 'start-0.5' : 'end-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isChair = user?.role === 'BOARD_CHAIR';
  const isSiteAdmin = user?.role === 'SITE_ADMIN';
  const [data, setData] = useState<SettingsResult | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [ruleDraft, setRuleDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((d) => {
        setData(d);
        setDraft(d.settings);
        setRuleDraft(
          Object.fromEntries(d.refundRules.map((r) => [r.id, String(r.penaltyPct)])),
        );
      })
      .catch(() => setError('خطا در دریافت تنظیمات.'));
  }, []);

  if (error && !data) return <PanelAlert className="mb-0">{error}</PanelAlert>;
  if (!data) return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;

  const setKey = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));
  const boolOf = (key: string) => Boolean(draft[key]);
  const strOf = (key: string) => String(draft[key] ?? '');

  const socialLinks = (): SocialLinkEntry[] => {
    const raw = draft.socialLinks;
    if (!Array.isArray(raw)) return [];
    return raw as SocialLinkEntry[];
  };

  const updateSocialLink = (id: SocialLinkId, patch: Partial<SocialLinkEntry>) => {
    setKey(
      'socialLinks',
      socialLinks().map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  };

  const appLinks = (): AppDownloadLinkEntry[] => {
    const raw = draft.appDownloadLinks;
    if (!Array.isArray(raw)) return [];
    return raw as AppDownloadLinkEntry[];
  };

  const updateAppLink = (id: AppLinkId, patch: Partial<AppDownloadLinkEntry>) => {
    setKey(
      'appDownloadLinks',
      appLinks().map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  };

  async function onSave() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const patch = isSiteAdmin
        ? {
            socialLinks: draft.socialLinks,
            supportEmail: draft.supportEmail,
            supportPhone: draft.supportPhone,
            appDownloadLinks: draft.appDownloadLinks,
          }
        : draft;
      const result = await updateSettings(patch);

      if (isChair && data && !isSiteAdmin) {
        const changed: { id: string; penaltyPct: number }[] = [];
        for (const rule of data.refundRules) {
          const parsed = parseInt(latinDigits(ruleDraft[rule.id] ?? ''), 10);
          if (!Number.isNaN(parsed) && parsed !== rule.penaltyPct) {
            changed.push({ id: rule.id, penaltyPct: parsed });
          }
        }
        if (changed.length > 0) {
          const withRules = await updateRefundRules(changed);
          setData(withRules);
        } else {
          setData(result);
        }
      } else {
        setData(result);
      }
      setNotice('تنظیمات ذخیره شد ✓');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ذخیرهٔ تنظیمات.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isChair && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>اطلاعات شرکت</div>
            <div className="mt-4 flex flex-col gap-3">
              {(
                [
                  ['companyName', 'نام شرکت'],
                  ['supportEmail', 'ایمیل پشتیبانی'],
                  ['supportPhone', 'تلفن تماس'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`set-${key}`} className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                    {label}
                  </label>
                  <input
                    id={`set-${key}`}
                    value={strOf(key)}
                    onChange={(e) => setKey(key, e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-sm ${panelInput}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isChair && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>محتوای سایت</div>
            <p className={panelSubtitle}>متن صفحات عمومی — بدون نیاز به انتشار نسخهٔ جدید</p>
            <div className="mt-4 flex flex-col gap-3">
              {(
                [
                  ['homeHeroTitle', 'عنوان صفحهٔ اصلی'],
                  ['homeHeroSubtitle', 'زیرعنوان صفحهٔ اصلی'],
                  ['aboutUsText', 'متن دربارهٔ ما'],
                  ['contactAddress', 'آدرس تماس با ما'],
                  ['termsText', 'متن قوانین و مقررات'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`set-${key}`} className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                    {label}
                  </label>
                  <textarea
                    id={`set-${key}`}
                    value={strOf(key)}
                    onChange={(e) => setKey(key, e.target.value)}
                    rows={2}
                    className={`w-full resize-y px-3.5 py-2.5 text-sm ${panelInput}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isChair && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>درگاه پرداخت</div>
            <div className="mt-4 flex flex-col divide-y divide-panel-border">
              {GATEWAYS.map((g) => (
                <div key={g.key} className="flex items-center justify-between py-3">
                  <div>
                    <div className={`text-xs font-bold ${panelText}`}>{g.name}</div>
                    <div className={`text-[10.5px] ${panelMuted}`}>{g.desc}</div>
                  </div>
                  <Toggle
                    on={boolOf(g.key)}
                    onToggle={() => setKey(g.key, !boolOf(g.key))}
                    label={g.name}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isChair && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>قوانین استرداد</div>
            <p className={`${panelSubtitle} leading-6`}>
              این درصدها همان بازه‌های واقعی موتور استرداد (فاز ۷) هستند — تغییر اینجا مستقیماً در محاسبهٔ
              جریمهٔ استرداد اعمال می‌شود.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {data.refundRules.map((r: RefundRuleRow) => (
                <div key={r.id}>
                  <label htmlFor={`rule-${r.id}`} className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                    {r.labelFa} (٪)
                  </label>
                  <input
                    id={`rule-${r.id}`}
                    value={faDigits(ruleDraft[r.id] ?? '')}
                    onChange={(e) =>
                      setRuleDraft((d) => ({ ...d, [r.id]: latinDigits(e.target.value) }))
                    }
                    inputMode="numeric"
                    className={`font-num w-full px-3.5 py-2.5 text-sm ${panelInput}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isSiteAdmin && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>تماس پشتیبانی</div>
            <p className={panelSubtitle}>شماره تلفن و ایمیل نمایش‌داده‌شده در سایت</p>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label htmlFor="set-support-phone" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                  شماره تلفن پشتیبانی
                </label>
                <input
                  id="set-support-phone"
                  dir="ltr"
                  value={strOf('supportPhone')}
                  onChange={(e) => setKey('supportPhone', e.target.value)}
                  className={`font-num w-full px-3.5 py-2.5 text-sm ${panelInput}`}
                />
              </div>
              <div>
                <label htmlFor="set-support-email" className={`mb-1.5 block text-[11.5px] ${panelMuted}`}>
                  ایمیل پشتیبانی
                </label>
                <input
                  id="set-support-email"
                  dir="ltr"
                  value={strOf('supportEmail')}
                  onChange={(e) => setKey('supportEmail', e.target.value)}
                  className={`font-num w-full px-3.5 py-2.5 text-sm ${panelInput}`}
                />
              </div>
            </div>
          </div>
        )}

        {isSiteAdmin && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>لینک دانلود اپلیکیشن</div>
            <p className={panelSubtitle}>دکمه‌های بخش اپلیکیشن در صفحهٔ اصلی</p>
            <div className="mt-4 flex flex-col gap-3">
              {APP_LINK_IDS.map((id) => {
                const entry = appLinks().find((l) => l.id === id);
                if (!entry) return null;
                return (
                  <div key={id} className={`${panelCard} p-3`}>
                    <input
                      aria-label={`نام ${entry.name}`}
                      value={entry.name}
                      onChange={(e) => updateAppLink(id, { name: e.target.value })}
                      className={`mb-1.5 w-full rounded-md border border-panel-border-2 bg-panel-elevated px-2.5 py-1.5 text-xs font-bold ${panelText} outline-none focus:border-panel-accent`}
                    />
                    <input
                      aria-label={`آدرس ${entry.name}`}
                      dir="ltr"
                      value={entry.url}
                      onChange={(e) => updateAppLink(id, { url: e.target.value })}
                      placeholder="apps.apple.com/..."
                      className={`font-num w-full rounded-md border border-panel-border-2 bg-panel-elevated px-2.5 py-1.5 text-[11px] ${panelMuted} outline-none focus:border-panel-accent`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={panelCardPadded}>
          <div className={panelTitle}>شبکه‌های اجتماعی</div>
          <p className={panelSubtitle}>لینک‌های نمایش‌داده‌شده در فوتر سایت</p>
          <div className="mt-4 flex flex-col gap-3">
            {SOCIAL_LINK_IDS.map((id) => {
              const entry = socialLinks().find((l) => l.id === id);
              if (!entry) return null;
              return (
                <div key={id} className={`flex items-center gap-3 ${panelCard} p-3`}>
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-panel-elevated"
                    style={{ color: socialBrandColor(id) }}
                  >
                    <SocialIcon id={id} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={`نام ${entry.name}`}
                      value={entry.name}
                      onChange={(e) => updateSocialLink(id, { name: e.target.value })}
                      className={`mb-1.5 w-full rounded-md border border-panel-border-2 bg-panel-elevated px-2.5 py-1.5 text-xs font-bold ${panelText} outline-none focus:border-panel-accent`}
                    />
                    <input
                      aria-label={`آدرس ${entry.name}`}
                      dir="ltr"
                      value={entry.url}
                      onChange={(e) => updateSocialLink(id, { url: e.target.value })}
                      placeholder="example.com/blujet"
                      className={`font-num w-full rounded-md border border-panel-border-2 bg-panel-elevated px-2.5 py-1.5 text-[11px] ${panelMuted} outline-none focus:border-panel-accent`}
                    />
                  </div>
                  <Toggle
                    on={entry.enabled}
                    onToggle={() => updateSocialLink(id, { enabled: !entry.enabled })}
                    label={entry.name}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {!isSiteAdmin && (
          <div className={panelCardPadded}>
            <div className={panelTitle}>تنظیمات کلی سامانه</div>
            <p className={panelSubtitle}>پیکربندی سراسری سایت — تغییرات روی کل سرویس اعمال می‌شود</p>
            <div className="mt-4 flex flex-col divide-y divide-panel-border">
              {GLOBAL_TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className={`text-xs font-bold ${panelText}`}>{t.title}</div>
                    <div className={`text-[10.5px] ${panelMuted}`}>{t.desc}</div>
                  </div>
                  <Toggle
                    on={boolOf(t.key)}
                    onToggle={() => setKey(t.key, !boolOf(t.key))}
                    label={t.title}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave()}
        className={`${panelBtnPrimary} py-2.5 text-sm disabled:opacity-60`}
      >
        {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
      </button>
    </div>
  );
}
