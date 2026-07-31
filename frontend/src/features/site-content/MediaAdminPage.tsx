import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addLibraryAsset,
  createDestination,
  createRoute,
  deleteDestination,
  deleteLibraryAsset,
  deleteRoute,
  fetchContentBlocks,
  fetchDestinations,
  fetchLibraryAssets,
  fetchRoutes,
  updateContentBlock,
  updateDestination,
  updateRoute,
} from '../../api/site-content';
import { fetchSettings, updateSettings } from '../../api/admins';
import {
  SITE_CONTENT_FIELD_LABELS,
  SITE_PAGE_ROWS,
  type SiteContentFieldKey,
  type SitePageRow,
} from '../../types/site-pages';
import { faDigits, latinDigits, localeMoney } from '../../lib/fa-format';
import Modal from '../../components/Modal';
import { siteMediaUrl } from '../public-site/site-content-shared';
import type {
  ContentBlockRow,
  DestinationRow,
  LibraryAssetRow,
  RouteRow,
  SiteContentBlockKey,
} from '../../types/site-content';

const BLOCK_META: Record<
  SiteContentBlockKey,
  { title: string; subtitle: string; fields: ('title' | 'subtitle' | 'buttonText' | 'badgeText')[] }
> = {
  HERO_BANNER: {
    title: 'بنر اصلی سایت',
    subtitle: 'تصویر و متن بنر صفحه اصلی',
    fields: ['title', 'subtitle', 'buttonText', 'badgeText'],
  },
  ANNOUNCEMENT_BAR: {
    title: 'بنر اطلاع‌رسانی بالای هدر',
    subtitle: 'نوار اطلاعیه در مواقع خاص، بالای هدر صفحه اصلی',
    fields: ['title', 'buttonText'],
  },
  PROMO_BANNER: {
    title: 'بنر تبلیغاتی میانی',
    subtitle: 'بنر بین «پیشنهاد ویژه» و «مقاصد محبوب»',
    fields: ['badgeText', 'title', 'subtitle', 'buttonText'],
  },
};

const FIELD_LABELS: Record<string, string> = {
  title: 'عنوان',
  subtitle: 'زیرعنوان',
  buttonText: 'متن دکمه',
  badgeText: 'برچسب',
};

function cardClass() {
  return 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]';
}

export default function MediaAdminPage() {
  const [library, setLibrary] = useState<LibraryAssetRow[] | null>(null);
  const [blocks, setBlocks] = useState<ContentBlockRow[] | null>(null);
  const [destinations, setDestinations] = useState<DestinationRow[] | null>(null);
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editBlock, setEditBlock] = useState<ContentBlockRow | null>(null);
  const [blockDraft, setBlockDraft] = useState<Partial<ContentBlockRow>>({});
  const [destModal, setDestModal] = useState<'create' | DestinationRow | null>(null);
  const [routeModal, setRouteModal] = useState<'create' | RouteRow | null>(null);
  const [destDraft, setDestDraft] = useState({ airportCode: '', priceToman: '' });
  const [routeDraft, setRouteDraft] = useState({
    fromAirportCode: '',
    toAirportCode: '',
    priceToman: '',
  });
  const [siteContent, setSiteContent] = useState<Record<SiteContentFieldKey, string> | null>(
    null,
  );
  const [editPage, setEditPage] = useState<SitePageRow | null>(null);
  const [pageDraft, setPageDraft] = useState<Partial<Record<SiteContentFieldKey, string>>>({});
  const [savingPage, setSavingPage] = useState(false);

  const blockMap = useMemo(
    () => new Map((blocks ?? []).map((b) => [b.key, b])),
    [blocks],
  );

  const load = useCallback(async () => {
    try {
      const [lib, bl, dest, rt, settings] = await Promise.all([
        fetchLibraryAssets(),
        fetchContentBlocks(),
        fetchDestinations(),
        fetchRoutes(),
        fetchSettings(),
      ]);
      setLibrary(lib);
      setBlocks(bl);
      setDestinations(dest);
      setRoutes(rt);
      const s = settings.settings;
      setSiteContent({
        homeHeroTitle: String(s.homeHeroTitle ?? ''),
        homeHeroSubtitle: String(s.homeHeroSubtitle ?? ''),
        aboutUsText: String(s.aboutUsText ?? ''),
        contactAddress: String(s.contactAddress ?? ''),
        termsText: String(s.termsText ?? ''),
      });
    } catch {
      setError('خطا در دریافت محتوای سایت.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUploadPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      await addLibraryAsset(uploaded.id, file.name);
      setUploadOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در آپلود تصویر.');
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteAsset(id: string) {
    if (!window.confirm('این تصویر از کتابخانه حذف شود؟')) return;
    try {
      await deleteLibraryAsset(id);
      await load();
    } catch {
      setError('خطا در حذف تصویر.');
    }
  }

  function openBlockEdit(key: SiteContentBlockKey) {
    const row = blockMap.get(key);
    if (!row) return;
    setEditBlock(row);
    setBlockDraft({ ...row });
  }

  async function saveBlock() {
    if (!editBlock) return;
    try {
      await updateContentBlock(editBlock.key, {
        enabled: blockDraft.enabled,
        title: blockDraft.title,
        subtitle: blockDraft.subtitle,
        buttonText: blockDraft.buttonText,
        badgeText: blockDraft.badgeText,
        imageFileId: blockDraft.imageFileId,
      });
      setEditBlock(null);
      await load();
    } catch {
      setError('خطا در ذخیرهٔ بنر.');
    }
  }

  async function toggleAnnouncement() {
    const row = blockMap.get('ANNOUNCEMENT_BAR');
    if (!row) return;
    try {
      await updateContentBlock('ANNOUNCEMENT_BAR', { enabled: !row.enabled });
      await load();
    } catch {
      setError('خطا در تغییر وضعیت اطلاعیه.');
    }
  }

  function openDestCreate() {
    setDestDraft({ airportCode: '', priceToman: '' });
    setDestModal('create');
  }

  function openDestEdit(row: DestinationRow) {
    setDestDraft({
      airportCode: row.airportCode,
      priceToman: String(Math.round(Number(row.priceIrr) / 10)),
    });
    setDestModal(row);
  }

  async function saveDestination() {
    const priceIrr = Math.round(Number(latinDigits(destDraft.priceToman)) * 10);
    if (!destDraft.airportCode || Number.isNaN(priceIrr)) {
      setError('کد فرودگاه و قیمت را وارد کنید.');
      return;
    }
    try {
      if (destModal === 'create') {
        await createDestination({ airportCode: destDraft.airportCode, priceIrr });
      } else if (destModal) {
        await updateDestination(destModal.id, {
          airportCode: destDraft.airportCode,
          priceIrr,
        });
      }
      setDestModal(null);
      await load();
    } catch {
      setError('خطا در ذخیرهٔ مقصد.');
    }
  }

  async function removeDestination(id: string) {
    if (!window.confirm('این مقصد حذف شود؟')) return;
    try {
      await deleteDestination(id);
      await load();
    } catch {
      setError('خطا در حذف مقصد.');
    }
  }

  function openPageEdit(page: SitePageRow) {
    if (!siteContent || page.editableFields.length === 0) return;
    const draft: Partial<Record<SiteContentFieldKey, string>> = {};
    for (const key of page.editableFields) {
      draft[key] = siteContent[key];
    }
    setPageDraft(draft);
    setEditPage(page);
  }

  async function savePageFields() {
    if (!editPage) return;
    setSavingPage(true);
    setError(null);
    try {
      const patch: Record<string, string> = {};
      for (const key of editPage.editableFields) {
        patch[key] = pageDraft[key] ?? '';
      }
      await updateSettings(patch);
      setEditPage(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیرهٔ متن صفحه.');
    } finally {
      setSavingPage(false);
    }
  }

  function openRouteCreate() {
    setRouteDraft({ fromAirportCode: '', toAirportCode: '', priceToman: '' });
    setRouteModal('create');
  }

  function openRouteEdit(row: RouteRow) {
    setRouteDraft({
      fromAirportCode: row.fromAirportCode,
      toAirportCode: row.toAirportCode,
      priceToman: String(Math.round(Number(row.priceIrr) / 10)),
    });
    setRouteModal(row);
  }

  async function saveRoute() {
    const priceIrr = Math.round(Number(latinDigits(routeDraft.priceToman)) * 10);
    if (!routeDraft.fromAirportCode || !routeDraft.toAirportCode || Number.isNaN(priceIrr)) {
      setError('مبدأ، مقصد و قیمت را وارد کنید.');
      return;
    }
    try {
      if (routeModal === 'create') {
        await createRoute({
          fromAirportCode: routeDraft.fromAirportCode,
          toAirportCode: routeDraft.toAirportCode,
          priceIrr,
        });
      } else if (routeModal) {
        await updateRoute(routeModal.id, {
          fromAirportCode: routeDraft.fromAirportCode,
          toAirportCode: routeDraft.toAirportCode,
          priceIrr,
        });
      }
      setRouteModal(null);
      await load();
    } catch {
      setError('خطا در ذخیرهٔ مسیر.');
    }
  }

  async function removeRoute(id: string) {
    if (!window.confirm('این مسیر حذف شود؟')) return;
    try {
      await deleteRoute(id);
      await load();
    } catch {
      setError('خطا در حذف مسیر.');
    }
  }

  if (error && !library) {
    return <p className="p-8 text-sm text-danger">{error}</p>;
  }
  if (!library || !blocks || !destinations || !routes) {
    return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;
  }

  const ann = blockMap.get('ANNOUNCEMENT_BAR');
  const hero = blockMap.get('HERO_BANNER');
  const promo = blockMap.get('PROMO_BANNER');

  return (
    <div className="flex flex-col gap-[15px] p-4 text-[#e7ecf3]" dir="rtl">
      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Hero banner */}
      <div className={cardClass()}>
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[14.5px] font-extrabold text-white">بنر اصلی سایت</h3>
            <p className="mt-0.5 text-[11px] text-[#6b7b94]">تصویر و متن بنر صفحه اصلی</p>
          </div>
          <button
            type="button"
            onClick={() => openBlockEdit('HERO_BANNER')}
            className="cursor-pointer rounded-[9px] bg-accent px-2.5 py-1.5 text-[11.5px] font-bold text-white"
          >
            ویرایش بنر
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#aebfd6] bg-[#eef3fa]">
            {hero?.imageUrl ? (
              <img src={siteMediaUrl(hero.imageFileId) ?? ''} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-[#4a5a73]">بدون تصویر</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <PreviewField label="عنوان بنر" value={hero?.title ?? ''} />
            <PreviewField label="زیرعنوان" value={hero?.subtitle ?? ''} />
            <PreviewField label="متن دکمه" value={hero?.buttonText ?? ''} />
          </div>
        </div>
      </div>

      {/* Announcement */}
      <div className={cardClass()}>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="m-0 text-[14.5px] font-extrabold text-white">بنر اطلاع‌رسانی بالای هدر</h3>
            <p className="mt-0.5 text-[11px] text-[#6b7b94]">نوار اطلاعیه بالای صفحه اصلی</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void toggleAnnouncement()}
              className={`cursor-pointer rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-bold text-white ${ann?.enabled ? 'bg-[#059669]' : 'bg-[#6b7280]'}`}
            >
              {ann?.enabled ? 'فعال' : 'غیرفعال'}
            </button>
            <button
              type="button"
              onClick={() => openBlockEdit('ANNOUNCEMENT_BAR')}
              className="cursor-pointer rounded-[9px] bg-accent px-2.5 py-1.5 text-[11.5px] font-bold text-white"
            >
              ویرایش متن
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-[11px] border border-[#28344c] bg-gradient-to-l from-[#123457] to-[#0a1f36] px-3.5 py-2.5">
          <span className={`h-2 w-2 flex-none rounded-full ${ann?.enabled ? 'bg-[#1f8a5b]' : 'bg-[#6b7280]'}`} />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#cdd6e3]">{ann?.title}</span>
          <span className="flex-none rounded-[14px] bg-[#f2c94c] px-2.5 py-1 text-[10.5px] font-extrabold text-[#0d2640]">
            {ann?.buttonText || 'مشاهده'} ←
          </span>
        </div>
      </div>

      {/* Promo banner */}
      <div className={cardClass()}>
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[14.5px] font-extrabold text-white">بنر تبلیغاتی میانی</h3>
            <p className="mt-0.5 text-[11px] text-[#6b7b94]">بنر بین «پیشنهاد ویژه» و «مقاصد محبوب»</p>
          </div>
          <button
            type="button"
            onClick={() => openBlockEdit('PROMO_BANNER')}
            className="cursor-pointer rounded-[9px] bg-accent px-2.5 py-1.5 text-[11.5px] font-bold text-white"
          >
            ویرایش بنر
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="relative flex h-[150px] items-end overflow-hidden rounded-xl border border-dashed border-[#aebfd6] bg-gradient-to-l from-[#1668c4]/20 to-[#0d2666]/80 p-4">
            {promo?.imageUrl && (
              <img
                src={siteMediaUrl(promo.imageFileId) ?? ''}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-40"
              />
            )}
            <div className="relative z-10">
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-[14px] bg-white/20 px-2 py-0.5 text-[9.5px] font-bold text-white">
                {promo?.badgeText}
              </span>
              <div className="text-[13.5px] font-extrabold text-white">{promo?.title}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <PreviewField label="برچسب بالای بنر" value={promo?.badgeText ?? ''} />
            <PreviewField label="عنوان بنر" value={promo?.title ?? ''} />
            <PreviewField label="متن دکمه" value={promo?.buttonText ?? ''} />
          </div>
        </div>
      </div>

      {/* Destinations */}
      <div className={cardClass()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[14.5px] font-extrabold text-white">مقاصد محبوب</h3>
            <p className="mt-0.5 text-[11px] text-[#6b7b94]">کارت‌های مقاصد در صفحه اصلی</p>
          </div>
          <button
            type="button"
            onClick={openDestCreate}
            className="flex cursor-pointer items-center gap-1 rounded-[9px] bg-accent px-3 py-1.5 text-[11.5px] font-bold text-white"
          >
            + افزودن مقصد
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {destinations.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-xl border border-[#28344c] bg-[#18223a]">
              <div className="flex h-[104px] items-center justify-center border-b border-dashed border-[#aebfd6] bg-[#eef3fa]">
                {d.imageFileId ? (
                  <img src={siteMediaUrl(d.imageFileId) ?? ''} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-[#4a5a73]">بدون تصویر</span>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-[13.5px] font-bold">{d.airportCode}</div>
                <div className="mt-1 text-[11.5px] text-[#9fb0c7]">
                  از {localeMoney(d.priceIrr, 'fa')} تومان
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => openDestEdit(d)} className="cursor-pointer text-[11.5px] font-bold text-accent">
                    ویرایش
                  </button>
                  <button type="button" onClick={() => void removeDestination(d.id)} className="cursor-pointer text-[11.5px] font-bold text-[#f87171]">
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routes */}
      <div className={cardClass()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[14.5px] font-extrabold text-white">مسیرهای پرتردد</h3>
            <p className="mt-0.5 text-[11px] text-[#6b7b94]">مسیرهای پیشنهادی زیر باکس جستجو</p>
          </div>
          <button
            type="button"
            onClick={openRouteCreate}
            className="flex cursor-pointer items-center gap-1 rounded-[9px] bg-accent px-3 py-1.5 text-[11.5px] font-bold text-white"
          >
            + افزودن مسیر
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-[11px] border border-[#28344c] px-3 py-2.5">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[#18223a] text-accent">
                ✈
              </span>
              <div className="flex-1">
                <div className="text-xs font-bold">
                  {r.fromAirportCode} ← {r.toAirportCode}
                </div>
                <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">
                  از {localeMoney(r.priceIrr, 'fa')} تومان
                </div>
              </div>
              <button type="button" onClick={() => openRouteEdit(r)} className="cursor-pointer text-[10.5px] font-bold text-accent">
                ویرایش
              </button>
              <button type="button" onClick={() => void removeRoute(r.id)} className="cursor-pointer text-[10.5px] font-bold text-[#f87171]">
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Static site pages */}
      <div className={cardClass()}>
        <h3 className="m-0 text-[14.5px] font-extrabold text-white">صفحات سایت</h3>
        <p className="mb-4 mt-1 text-[11px] text-[#6b7b94]">
          فهرست صفحات عمومی و متن‌های قابل ویرایش
        </p>
        <div className="overflow-hidden rounded-[11px] border border-[#28344c]">
          {SITE_PAGE_ROWS.map((page) => (
            <div
              key={page.id}
              className="flex flex-wrap items-center gap-3 border-b border-[#1a2436] px-3 py-3 last:border-b-0"
            >
              <div className="min-w-[140px] flex-1">
                <div className="text-[12.5px] font-bold text-[#e7ecf3]">{page.nameFa}</div>
                <div className="text-[10.5px] text-[#6b7b94]" dir="ltr">
                  {page.path}
                </div>
              </div>
              <span className="rounded-[18px] bg-[rgba(34,197,94,.12)] px-2.5 py-1 text-[10.5px] font-bold text-[#22c55e]">
                {page.statusLabel}
              </span>
              {page.editableFields.length > 0 ? (
                <button
                  type="button"
                  data-testid={`edit-site-page-${page.id}`}
                  onClick={() => openPageEdit(page)}
                  className="cursor-pointer text-[10.5px] font-bold text-accent"
                >
                  ویرایش متن
                </button>
              ) : (
                <span className="text-[10.5px] text-[#6b7b94]">{page.editHint ?? '—'}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Image library */}
      <div className={cardClass()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="m-0 text-[14.5px] font-extrabold text-white">کتابخانهٔ تصاویر</h3>
          <button
            type="button"
            onClick={() => setUploadOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-1 rounded-[9px] bg-accent px-2.5 py-1.5 text-[11.5px] font-bold text-white"
          >
            + افزودن تصویر
          </button>
        </div>
        <p className="mb-4 text-[11.5px] text-[#6b7b94]">مدیریت تصاویر مورد استفاده در سایت</p>
        {uploadOpen && (
          <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed border-[#2a3a55] bg-[#18223a] p-4 text-center">
            <span className="text-[11.5px] font-semibold text-[#cdd6e3]">
              {uploading ? 'در حال آپلود…' : 'انتخاب تصویر · JPG, PNG تا ۵ مگابایت'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void onUploadPick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {library.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-[11px] border border-[#1f2a3d] bg-[#18223a]">
              <div className="h-[88px] bg-[#eef3fa]">
                <img src={siteMediaUrl(m.fileId) ?? ''} alt={m.label} className="h-full w-full object-cover" />
              </div>
              <div className="p-2">
                <div className="truncate text-[11px] font-semibold">{m.label}</div>
                <div className="text-[10px] text-[#6b7b94]">{faDigits(Math.round(m.sizeBytes / 1024))} KB</div>
                <button
                  type="button"
                  onClick={() => void onDeleteAsset(m.id)}
                  className="mt-1 cursor-pointer text-[10.5px] font-bold text-[#f87171]"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block edit modal */}
      {editBlock && (
        <Modal
          open
          onClose={() => setEditBlock(null)}
          title={`ویرایش ${BLOCK_META[editBlock.key].title}`}
        >
          <div className="flex flex-col gap-3">
            {BLOCK_META[editBlock.key].fields.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{FIELD_LABELS[field]}</span>
                <input
                  className="rounded-lg border border-border bg-panel px-3 py-2"
                  value={String(blockDraft[field] ?? '')}
                  onChange={(e) => setBlockDraft((d) => ({ ...d, [field]: e.target.value }))}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditBlock(null)} className="rounded-lg px-4 py-2 text-sm">
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void saveBlock()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                ذخیره
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Destination modal */}
      {destModal && (
        <Modal
          open
          onClose={() => setDestModal(null)}
          title={destModal === 'create' ? 'افزودن مقصد' : 'ویرایش مقصد'}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">کد فرودگاه</span>
              <input
                className="rounded-lg border border-border bg-panel px-3 py-2 uppercase"
                value={destDraft.airportCode}
                onChange={(e) => setDestDraft((d) => ({ ...d, airportCode: e.target.value.toUpperCase() }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">قیمت (تومان)</span>
              <input
                className="rounded-lg border border-border bg-panel px-3 py-2"
                value={destDraft.priceToman}
                onChange={(e) => setDestDraft((d) => ({ ...d, priceToman: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDestModal(null)} className="rounded-lg px-4 py-2 text-sm">
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void saveDestination()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                ذخیره
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Route modal */}
      {routeModal && (
        <Modal
          open
          onClose={() => setRouteModal(null)}
          title={routeModal === 'create' ? 'افزودن مسیر' : 'ویرایش مسیر'}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">مبدأ</span>
              <input
                className="rounded-lg border border-border bg-panel px-3 py-2 uppercase"
                value={routeDraft.fromAirportCode}
                onChange={(e) =>
                  setRouteDraft((d) => ({ ...d, fromAirportCode: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">مقصد</span>
              <input
                className="rounded-lg border border-border bg-panel px-3 py-2 uppercase"
                value={routeDraft.toAirportCode}
                onChange={(e) =>
                  setRouteDraft((d) => ({ ...d, toAirportCode: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">قیمت (تومان)</span>
              <input
                className="rounded-lg border border-border bg-panel px-3 py-2"
                value={routeDraft.priceToman}
                onChange={(e) => setRouteDraft((d) => ({ ...d, priceToman: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRouteModal(null)} className="rounded-lg px-4 py-2 text-sm">
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void saveRoute()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                ذخیره
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editPage && (
        <Modal open onClose={() => setEditPage(null)} title={`ویرایش ${editPage.nameFa}`}>
          <div className="flex flex-col gap-3">
            {editPage.editHint && (
              <p className="m-0 text-[11px] text-muted">{editPage.editHint}</p>
            )}
            {editPage.editableFields.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{SITE_CONTENT_FIELD_LABELS[field]}</span>
                <textarea
                  rows={field === 'aboutUsText' || field === 'termsText' ? 4 : 2}
                  className="rounded-lg border border-border bg-panel px-3 py-2"
                  value={pageDraft[field] ?? ''}
                  onChange={(e) =>
                    setPageDraft((d) => ({ ...d, [field]: e.target.value }))
                  }
                />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditPage(null)} className="rounded-lg px-4 py-2 text-sm">
                انصراف
              </button>
              <button
                type="button"
                disabled={savingPage}
                onClick={() => void savePageFields()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingPage ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] text-[#6b7b94]">{label}</div>
      <div className="flex min-h-[42px] items-center rounded-[9px] border border-[#28344c] bg-[#0f1623] px-2.5 text-[11.5px] text-[#cdd6e3]">
        {value || '—'}
      </div>
    </div>
  );
}
