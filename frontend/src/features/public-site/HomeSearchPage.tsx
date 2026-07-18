import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAirports } from '../../api/publicSite';
import type { Airport } from '../../types/public-site';

export default function HomeSearchPage() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setError('خطا در دریافت فهرست فرودگاه‌ها.'));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !dest || !date) {
      setError('مبدأ، مقصد و تاریخ را انتخاب کنید.');
      return;
    }
    if (origin === dest) {
      setError('مبدأ و مقصد نمی‌توانند یکسان باشند.');
      return;
    }
    navigate(`/results?origin=${origin}&dest=${dest}&date=${date}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
      <h1 className="mb-2 text-2xl font-black text-[#0d2640]">بلوجت</h1>
      <p className="mb-6 text-sm text-[#6b7b94]">جستجو و رزرو بلیط هواپیما</p>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-[#e5e9f0] bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="origin" className="mb-1.5 block text-xs text-[#6b7b94]">
            مبدأ
          </label>
          <select
            id="origin"
            data-testid="home-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          >
            <option value="">انتخاب کنید</option>
            {airports.map((a) => (
              <option key={a.id} value={a.code}>
                {a.cityFa} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dest" className="mb-1.5 block text-xs text-[#6b7b94]">
            مقصد
          </label>
          <select
            id="dest"
            data-testid="home-dest"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="w-full rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          >
            <option value="">انتخاب کنید</option>
            {airports.map((a) => (
              <option key={a.id} value={a.code}>
                {a.cityFa} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="mb-1.5 block text-xs text-[#6b7b94]">
            تاریخ پرواز
          </label>
          <input
            id="date"
            data-testid="home-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
        </div>

        <button
          type="submit"
          data-testid="home-search-submit"
          className="rounded-lg bg-[#1668c4] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
        >
          جستجوی پرواز
        </button>
      </form>
    </div>
  );
}
