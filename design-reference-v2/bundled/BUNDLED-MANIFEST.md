# Design Reference — Bundled HTML Exports

Self-contained **Bundled Page** HTML files (fonts/JS embedded; open in a browser with JavaScript enabled).  
Use alongside the editable source templates in `design-reference-v2/*.dc.html`.

| Bundled file | Source template (`.dc.html`) | Notes |
|---|---|---|
| `ReservationSystem.html` | `ReservationSystem.dc.html` | Shared reservation/lock component used inside management panels |
| `صفحه اصلی.html` | `صفحه اصلی.dc.html` | Public home + flight search |
| `نتایج پرواز.html` | `نتایج پرواز.dc.html` | Search results |
| `تکمیل خرید.html` | `تکمیل خرید.dc.html` | Checkout / passenger form |
| `پرداخت.html` | `پرداخت.dc.html` | Payment gateway |
| `مدیریت رزرو.html` | `مدیریت رزرو.dc.html` | PNR lookup / change / refund |
| `وضعیت پرواز.html` | `وضعیت پرواز.dc.html` | Flight status |
| `ورود و ثبتنام.html` | `ورود و ثبتنام.dc.html` | Customer auth |
| `فراموشی رمز.html` | `فراموشی رمز.dc.html` | Password recovery |
| `ورود مدیران و کارمندان.html` | `ورود مدیران و کارمندان.dc.html` | Staff auth |
| `پنل کاربر.html` | `پنل کاربر.dc.html` | User panel |
| `پنل آژانس.html` | `پنل آژانس.dc.html` | Agency portal |
| `پنل کارمند.html` | `پنل کارمند.dc.html` | Employee panel |
| `پنل مدیر IT.html` | `پنل مدیر IT.dc.html` | IT manager panel |
| `پنل مدیر ارشد.html` | `پنل مدیر ارشد.dc.html` | Senior manager panel |
| `پنل مدیر بازرگانی.html` | `پنل مدیر بازرگانی.dc.html` | Commercial manager panel |
| `پنل مدیر عامل.html` | `پنل مدیر عامل.dc.html` | CEO panel |
| `پنل مدیر مالی.html` | `پنل مدیر مالی.dc.html` | Finance manager panel |
| `پنل رئیس هیئت مدیره.html` | `پنل رئیس هیئت مدیره.dc.html` | Board chair panel |
| `پنل ادمین سایت.html` | `پنل ادمین سایت.dc.html` | Site admin panel |
| `باشگاه مشتریان.html` | `باشگاه مشتریان.dc.html` | Loyalty club (public) |
| `مقاصد.html` | `مقاصد.dc.html` | Destinations |
| `درباره ما.html` | `درباره ما.dc.html` | About |
| `تماس با ما.html` | `تماس با ما.dc.html` | Contact |
| `پشتیبانی.html` | `پشتیبانی.dc.html` | Support / FAQ |
| `قوانین و مقررات.html` | `قوانین و مقررات.dc.html` | Terms |
| `فرصت‌های شغلی.html` | `فرصت‌های شغلی.dc.html` | Careers listing (also referred to as **استخدام** in some exports) |
| `فرصت‌های شغلی-فرم درخواست.html` | `فرصت‌های شغلی-فرم درخواست.dc.html` | Job application form |
| `صفحه 404.html` | `صفحه 404.dc.html` | Not found |
| `در حال تعمیر و نگهداری.html` | `در حال تعمیر و نگهداری.dc.html` | Maintenance |

**Implementation rule:** match visual design from these bundled previews; implement from `*.dc.html` structure and `docs/API.md` behavior.
