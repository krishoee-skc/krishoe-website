# KRISHOE Web App — कसरी खोल्ने (A to Z)

यो app कसरी, कहाँबाट खोल्ने भन्ने पूरा guide। नबिर्सिने ठाउँमा राखिएको —
जहिले confusion भयो, यो file हेर्नुस्।

---

## ⭐ सबैभन्दा सजिलो तरिका (यही गर्नुस्)

Project folder भित्रको **`Start-KRISHOE.bat`** मा **डबल-क्लिक** गर्नुस्। बस्, त्यति!

यसले आफै:
1. जरुरी भए packages install गर्छ
2. App चलाउँछ
3. केही सेकेन्डमा **browser आफै खोल्छ** → http://localhost:3000

App बन्द गर्न: खुलेको कालो window मा `Ctrl + C`, वा window नै बन्द गर्नुस्।

> 🖱️ **Desktop मा shortcut बनाउन:** `Start-KRISHOE.bat` मा right-click →
> "Send to" → "Desktop (create shortcut)"। अब desktop बाटै double-click
> गरेर खोल्न मिल्छ।

तल बाँकी guide manual तरिका (terminal बाट) चलाउन चाहनेका लागि हो।

---

## 1. के चाहिन्छ (एकपटक मात्र)

- **Node.js** install भएको हुनुपर्छ। Check गर्न:
  ```powershell
  node --version
  ```
  Version number देखियो भने ठीक छ।

---

## 2. कहाँबाट खोल्ने — Terminal

App चलाउन **terminal (PowerShell)** चाहिन्छ, project folder भित्रबाट:

```powershell
cd C:\Users\TP\Downloads\krishoe-website
```

> 💡 **सजिलो तरिका:** VS Code मा यो folder खोल्नुस्, अनि `Ctrl + ~` थिच्नुस् —
> terminal तल खुल्छ र पहिले नै सही folder मा हुन्छ, `cd` गर्नै पर्दैन।

---

## 3. पहिलो पटक — packages install

नयाँ computer वा पहिलो पटक भए मात्र:

```powershell
npm install
```

एकपटक गरेपछि फेरि गर्नु पर्दैन।

---

## 4. App चलाउने (दैनिक काम) ⭐

```powershell
npm run dev
```

`✓ Ready` देखियो भने चल्यो। यो terminal खुलै राख्नुस् — बन्द गर्दा app पनि रोकिन्छ।

---

## 5. Browser मा खोल्ने — URLs

| के हेर्ने | URL |
|----------|-----|
| 🏠 **Storefront** (ग्राहकले देख्ने साइट) | http://localhost:3000 |
| 🛒 Shop / products | http://localhost:3000/shop |
| 👤 Customer account | http://localhost:3000/account |
| 🔐 **Admin panel** (dashboard) | http://localhost:3000/admin |

---

## 6. Admin मा login 🔑

`http://localhost:3000/admin` खोल्दा login माग्छ।
Password `.env.local` file मा `ADMIN_PASSWORD` मा छ।

Login पछि manage गर्न पाइने: **Products, Orders, POS, HR/Payroll, Costing,
Purchasing, Operations, Payments, Reviews, Messages, Settings।**

> 🔒 Password गोप्य राख्नुस्। Production मा जानुअघि नयाँ, बलियो password
> राख्नुहोला (`.env.local` मा `ADMIN_PASSWORD` बदल्ने)।

---

## 7. App बन्द गर्ने

जुन terminal मा `npm run dev` चलेको छ, त्यहाँ **`Ctrl + C`** थिच्नुस्।

---

## 8. अन्य उपयोगी commands

| Command | के गर्छ |
|---------|--------|
| `npm run dev` | Development मा चलाउने (auto-reload) — रोजमर्राको काम |
| `npm run build` | Production build बनाउने |
| `npm start` | Production build चलाउने (`build` पछि मात्र) |
| `npm test` | Tests चलाउने (watch mode) |
| `npm run test:run` | Tests एकपटक चलाउने |
| `npm run lint` | Code errors/warnings check गर्ने |
| `npm run db:smoke` | Database health check |

---

## 9. दुई कुरा ध्यान दिनुस्

1. **Port:** App सधैं **`3000`** मा चल्छ (`dev` script मा `-p 3000` fix गरिएको),
   र `.env.local` को `NEXT_PUBLIC_SITE_URL` पनि `3000` मा मिलाइएको — दुबै मिल्छन्।
   एउटै समयमा एकपटक मात्र चलाउनुस्; दोहोरो चलाउँदा "port busy" error आउँछ।

2. **`dev` vs `start`:** परिवर्तन गर्दा/परीक्षण गर्दा `npm run dev`।
   साँच्चै deploy/customer लाई देखाउँदा मात्र `npm run build` → `npm start`।

---

## 10. Production मा (छोटो)

1. `.env.local` मा strong `ADMIN_PASSWORD` + लामो `ADMIN_SESSION_SECRET` राख्ने
2. `npm run build`
3. `npm start`
4. Health check: `http://<your-domain>/api/health` → `{"ok":true}` आउनुपर्छ

पूरा checklist: [production-checklist.md](production-checklist.md)
