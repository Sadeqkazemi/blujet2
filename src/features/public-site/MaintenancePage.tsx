import { faDigits } from '../../lib/fa-format';

// صفحه تعمیر و نگهداری — matches design-reference/در حال تعمیر و نگهداری.dc.html.
// Static standalone page at /maintenance; serve it manually during planned
// downtime (no automatic gate — the app has no maintenance-mode flag yet).
export default function MaintenancePage() {
  return (
    <div dir="rtl" style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", minHeight: '100vh', background: 'linear-gradient(160deg,#0d2640 30%,#124a86)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 30 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✈</div>
          <span style={{ fontWeight: 900, fontSize: 18 }}>blujet</span>
        </div>
        <div style={{ display: 'inline-block', background: '#ffffff22', border: '1px solid #ffffff44', padding: '6px 13px', borderRadius: 28, fontSize: 11.5, fontWeight: 700, marginBottom: 18 }}>
          در حال به‌روزرسانی
        </div>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🛠</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 12px' }}>سایت در حال تعمیر و نگهداری است</h1>
        <p style={{ fontSize: 13.5, color: '#c9dcf3', lineHeight: 2, margin: '0 0 22px' }}>
          برای بهبود سرویس و ارتقای سامانه، سایت به‌طور موقت در دسترس نیست. کمی بعد دوباره در خدمت شما خواهیم بود. از صبوری شما سپاسگزاریم.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff14', border: '1px solid #ffffff26', borderRadius: 12, padding: '10px 18px', fontSize: 12.5, marginBottom: 24 }}>
          <span style={{ color: '#9fb9d8' }}>زمان تقریبی بازگشت:</span>
          <b>حدود {faDigits(2)} ساعت آینده</b>
        </div>
        <div style={{ fontSize: 12, color: '#7d92ad' }}>
          پشتیبانی <span dir="ltr">{faDigits('021-91000000')}</span> · <span dir="ltr">support@blujet.ir</span>
        </div>
      </div>
    </div>
  );
}
