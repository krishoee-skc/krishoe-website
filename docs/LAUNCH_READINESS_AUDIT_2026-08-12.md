# KRISHOE Launch Readiness Audit — 2026-08-12

यो रिपोर्ट अहिलेको source code, automated checks र production Postgres को read-only integrity audit बाट बनेको हो। पुराना roadmap/status files का दाबीलाई यसले प्रतिस्थापन गर्दैन, तर launch decision का लागि यही हालको प्रमाण हो।

## प्रमाणित रूपमा पूरा भएको

- `npm run type-check` सफल — TypeScript error छैन।
- `npm run lint` सफल — ESLint error वा warning छैन।
- `npm run test:run` सफल — 79 test files मा 595 tests pass भएका छन्।
- `npm run check` सफल — type-check, lint, Vitest र Next.js optimized production build एउटै quality gate बाट pass भएका छन्।
- `npm audit --audit-level=high` सफल — high वा critical सहित कुनै dependency vulnerability भेटिएन।
- GitHub Actions CI ले type-check, lint, Vitest र production build चलाउँछ; CI मा `DATA_BACKEND=local-json` हुँदा live database चल्दैन।
- Admin/customer/worker signed sessions, role permission, worker-to-HR identity link, session/device revocation र route/API authorization लागू छन्।
- WhatsApp webhook ले Twilio signature जाँच्छ; signature वा token नभए request अस्वीकार गर्छ।
- Contact, checkout, feedback र verified-purchase review मा server-side validation र rate limit छन्।
- Service worker ले `/api`, `/admin`, `/account`, `/checkout`, `/customer`, `/order` र `/worker` को response Cache Storage मा राख्दैन।
- पुरानो customer dashboard वास्तविक `/account` मा redirect हुन्छ; पुराना feedback र checkout API mutation paths `410 Gone` छन्।
- पुरानो `/admin/factory/add-work-v2` अब canonical `/admin/factory/add-work` मा redirect हुन्छ। यसले दुई work-entry workflow हटाउँछ।
- Stock flow एउटै physical ready-stock pool मा चल्छ: raw-material purchase ले material receipt बढाउँछ; ready-made trading-goods purchase ले `Purchase In` गर्छ; packing/QC-approved production ले `Production In` गर्छ; POS/online order conversion ले `Sale Out`; र POS return ले `Return In` गर्छ। प्रत्येक movement audit trail मा रहन्छ र Postgres मा sale/invoice/ledger posting एकै transaction मा हुन्छ।
- Online-order readiness ले पनि POS सरह shared ready-stock pool हेर्छ; Factory/Wholesale/Retail मा रहेको pair लाई केवल channel फरक भएकाले उपलब्ध नभएको भन्दैन।
- Production Postgres integrity audit सफल:
  - orphan work entries: `0`
  - completed orders without QC: `0`
  - broken QC-to-stock links: `0`
  - duplicate production submission keys: `0`
- विस्तृत `npm run db:smoke` पनि सफल — customer/order/payment/POS/purchasing/HR/stock/factory relation, duplicate callback र negative amount/stock का सबै integrity checks `0` छन्।

## Launch अघि बाह्य रूपमा पूरा गर्नुपर्ने

यी काम credentials, Vercel project access वा वास्तविक business acceptance बिना source code बाट पूरा गर्न सकिँदैन।

1. Vercel Production र Preview मा `.env.example` का आवश्यक secret/env values सेट तथा verify गर्ने।
2. अन्तिम HTTPS domain, `NEXT_PUBLIC_SITE_URL`, DNS र production deployment smoke test गर्ने।
3. कम्तीमा एक active Owner staff account, सुरक्षित backup export र restore drill गर्ने।
4. eSewa/Khalti merchant KYC र production credentials प्राप्त भएपछि sandbox परीक्षण, न्यून-मूल्य real transaction र reconciliation सकेर मात्र `PAYMENT_MODE=live` गर्ने।
5. Customer password reset र order alerts का लागि वास्तविक email/SMS/webhook provider configure गरी delivery retry जाँच्ने।
6. 390px, 768px र 1440px मा browser/manual QA गर्ने; checkout, account, admin login, image upload र worker portal पनि जाँच्ने।

## अहिलेको निष्कर्ष

Code quality, automated tests र audited production data को आधारमा KRISHOE **deployment candidate** हो। तर live payment, notification delivery, domain/DNS र final browser QA बाह्य configuration/testing हुन्; ती प्रमाणित नभएसम्म यसलाई fully public-live भन्न मिल्दैन।
