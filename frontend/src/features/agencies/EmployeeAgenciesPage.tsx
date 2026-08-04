import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAgencies, fetchAgencyRequests } from '../../api/agencies';
import EmployeeUnitPill from '../../components/EmployeeUnitPill';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { faDigits } from '../../lib/fa-format';
import type { AgencyListRow, AgencyMembershipRequest } from '../../types/agencies';

type RowStatus = 'active' | 'pending' | 'suspended';

type TableRow = {
  id: string;
  name: string;
  city: string;
  license: string;
  status: RowStatus;
  href?: string;
};

const STATUS_META: Record<RowStatus, { label: string; className: string }> = {
  active: { label: 'فعال', className: 'bg-[rgba(52,211,153,.14)] text-[#34d399]' },
  pending: { label: 'در انتظار', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  suspended: { label: 'معلق', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
};

/**
 * Employee agencies view — screenshot: simple table آژانس/شهر/مجوز/وضعیت
 * with green unit pill (not the commercial/finance agencies dashboard).
 */
export default function EmployeeAgenciesPage() {
  const [agencies, setAgencies] = useState<AgencyListRow[]>([]);
  const [requests, setRequests] = useState<AgencyMembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, reqs] = await Promise.all([
        fetchAgencies({}),
        fetchAgencyRequests().catch(() => [] as AgencyMembershipRequest[]),
      ]);
      setAgencies(list.agencies);
      setRequests(reqs.filter((r) => r.status === 'PENDING' || r.status === 'REFERRED'));
    } catch {
      setError('خطا در دریافت فهرست آژانس‌ها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo((): TableRow[] => {
    const pendingRows: TableRow[] = requests.map((r) => ({
      id: `req-${r.id}`,
      name: r.applicantName,
      city: r.city,
      license: r.licenseNo,
      status: 'pending',
      href: `/panel/agencies/requests/${r.id}`,
    }));
    const agencyRows: TableRow[] = agencies.map((a) => ({
      id: a.id,
      name: a.fullName,
      city: a.city,
      license: a.licenseNo,
      status: a.isActive ? 'active' : 'suspended',
      href: `/panel/agencies/${a.id}`,
    }));
    return [...pendingRows, ...agencyRows];
  }, [agencies, requests]);

  const rowsPager = usePagination(rows);

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[20.5px] font-black text-white">مدیریت آژانس‌ها</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">آژانس‌های همکار در حوزه کاری شما</p>
        </div>
        <EmployeeUnitPill />
      </div>

      {error && <p className="mb-4 text-sm text-[#f87171]">{error}</p>}

      <section className="overflow-hidden rounded-[14px] border border-[#1f2a3d] bg-[#141d2e]">
        <div className="border-b border-[#1f2a3d] px-4 py-3 text-[13px] font-extrabold text-white">
          آژانس‌های همکار در حوزه کاری شما
        </div>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#6b7b94]">آژانسی یافت نشد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-[12.5px]">
              <thead>
                <tr className="border-b border-[#1f2a3d] text-[11px] text-[#6b7b94]">
                  <th className="px-4 py-3 font-bold">آژانس</th>
                  <th className="px-4 py-3 font-bold">شهر</th>
                  <th className="px-4 py-3 font-bold">مجوز</th>
                  <th className="px-4 py-3 font-bold">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {rowsPager.pageItems.map((r) => {
                  const st = STATUS_META[r.status];
                  const inner = (
                    <>
                      <td className="px-4 py-3.5 font-bold text-[#e7ecf3]">{r.name}</td>
                      <td className="px-4 py-3.5 text-[#9fb0c7]">{r.city}</td>
                      <td className="ltr font-num px-4 py-3.5 text-[#9fb0c7]">
                        {r.license ? faDigits(r.license) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-bold ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </td>
                    </>
                  );
                  return (
                    <tr key={r.id} className="border-b border-[#1a2436] last:border-0 hover:bg-[#18223a]/50">
                      {r.href ? (
                        <Link to={r.href} className="contents">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4">
          <Pagination
            page={rowsPager.page}
            totalPages={rowsPager.totalPages}
            onChange={rowsPager.setPage}
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
