# KRISHOE Admin — कसरी चलाउने (पूरा Guide)

Admin मा 14 section छन्। तल हरेकको मतलब, कहाँबाट सुरु गर्ने, अनि दैनिक कसरी
चलाउने — सजिलो भाषामा।

Admin खोल्ने: **https://krishoeversal.vercel.app/admin** → password हाल्नुस्।

---

## 🚀 पहिलो पटक — कहाँबाट सुरु गर्ने (यही क्रममा)

**Step 1 — Settings** ⚙️
कम्पनीको जानकारी, branch (पसल), staff (कर्मचारी) accounts, र role हाल्नुस्।
यो जग हो — पहिला यही।

**Step 2 — Products** 👟
तपाईंले बेच्ने जुत्ता-चप्पल यहाँ थप्नुस् — नाम, मूल्य, stock, अनि **photo upload**
(हामीले बनाएको feature)। यहीँ बाट website मा products देखिन्छन्।

**Step 3 — Purchasing** 📦
Supplier बाट किनेको माल record गर्नुस्। दुई किसिम छन् — tab छानेर:

- **Raw material** — छाला, सोल, गम जस्ता कच्चा माल। कारखानाको भण्डारमा जान्छ।
- **Trading goods** — अरूले बनाइसकेको तयारी जुत्ता-चप्पल, सिधै बेच्न किनेको।
  Product dropdown बाट छान्नुस्, channel र size run हाल्नुस् — **bill राख्ने
  बित्तिकै stock आफै बढ्छ**, अलग्गै stock entry गर्नुपर्दैन।

> होलसेल/रिटेलका लागि यही **Trading goods** नै मुख्य बाटो हो। जुत्ता आफै
> नबनाई किनेर बेच्ने भए Operations छुनै पर्दैन।

**Step 4 — Operations** 🏭 *(आफै बनाउनुहुन्छ भने मात्र)*
उत्पादन (production): कति production batch, कर्मचारीले कति बनाए, तयारी stock
(finished stock) कति भयो — यहाँ track हुन्छ।

**Step 5 — बिक्री सुरु** 💰
- **POS Billing** — पसल/काउन्टरमा बिक्री (bill/invoice बनाउने)
- **Orders** — website बाट आएका online order

अनि **Costing** ले माथिका सबैबाट **नाफा-घाटा आफै हिसाब** गरिदिन्छ।

---

## 📋 हरेक Section को मतलब

| Section | Full form / मतलब | के गर्ने |
|---------|------------------|---------|
| **Dashboard** | मुख्य पाना | सबैको सारांश — बिक्री, order, alert एकै ठाउँमा |
| **POS Billing** | **P**oint **O**f **S**ale | पसलमा बिक्री गर्दा bill बनाउने (barcode/QR सहित) |
| **Purchasing** | किनमेल | Supplier बाट कच्चा माल वा तयारी जुत्ता किन्ने record + supplier ledger |
| **Costing** | लागत हिसाब | माल + ज्याला + खर्च जोडेर एक जोर जुत्ताको लागत र नाफा |
| **HR** | **H**uman **R**esources (कर्मचारी) | कर्मचारी, हाजिरी (attendance), तलब (payroll) |
| **Operations** | उत्पादन कार्य | Raw material, production batch, worker task, finished stock, dispatch |
| **Orders** | अनलाइन अर्डर | Website बाट ग्राहकले गरेका order हेर्ने/manage गर्ने |
| **Payments** | भुक्तानी | eSewa/Khalti/COD का payment record र मिलान (reconciliation) |
| **Notifications** | सूचना | System alert (जस्तै stock सकिन लाग्यो) |
| **Reviews** | ग्राहक review | Product मा ग्राहकले दिएका review approve/reject गर्ने |
| **Activity** | गतिविधि लग | कसले, कहिले, के गर्‍यो — audit trail (सुरक्षा) |
| **Settings** | सेटिङ | कम्पनी info, branch, staff accounts, role/permission |
| **Products** | उत्पादन सूची | Catalog — जुत्ता थप्ने/edit/photo, मूल्य, stock |
| **Messages** | सन्देश | Website को Contact form बाट आएका ग्राहक message |

---

## 🛒 Online order को पूरा बाटो (Stock कसरी चल्छ)

Website मा जुत्ता देखिनु र बेचिनु फरक कुरा हो। नियम यस्तो छ:

**1. Order आयो → जोर छेकिन्छ (reserve)**
Status **New** वा **Contacted** भएसम्म ती जोर छेकिएका हुन्छन्। Website ले
बाँकी जोर मात्र देखाउँछ — त्यसैले stock मा भएभन्दा बढी order आउँदैन।

**2. Order पूरा गर्न → POS bill काट्नुस्**
Order खोलेर **"Create POS invoice"** थिच्नुस्। यसले:
- bill बनाउँछ (barcode/QR सहित)
- stock बाट जोर घटाउँछ
- order आफै **Closed** हुन्छ

**3. बिल नकाटी Closed हुँदैन** ⚠️
यो जानीजानी बनाइएको रोक हो। बिल नकाटी बन्द गर्न दिए, जुत्ता गयो तर हिसाबमा
रहिरहन्थ्यो — अनि किताबको stock र भण्डारको stock फरक पर्दै जान्थ्यो।

**4. Order रद्द भयो → जोर आफै फिर्ता**
Status **Cancelled** राख्नुस् — छेकिएका जोर तुरुन्तै website मा फिर्ता
देखिन्छन्। हातले stock मिलाउनु पर्दैन।

---

## 🔄 दैनिक कसरी चलाउने (Daily flow)

**बिहान:**
1. **Dashboard** हेर्नुस् — नयाँ order, alert
2. **Orders** — नयाँ online order process गर्नुस्
3. **Messages** — ग्राहकका सोधपुछ जवाफ दिनुस्

**बिक्री गर्दा:**
- पसलमा: **POS Billing** मा bill बनाउनुस्
- Online: **Orders** खोलेर **Create POS invoice** थिच्नुस् (आफै Closed हुन्छ)
- **Payments** मा भुक्तानी मिलेको check गर्नुस्

**हप्ता/महिनामा:**
- **Purchasing** — नयाँ माल किनेको record (तयारी जुत्ता भए stock आफै बढ्छ)
- **Operations** — production update
- **Costing** — नाफा-घाटा review
- **HR** — हाजिरी/तलब
- **Reviews** — नयाँ review approve

**सधैं:**
- **Activity** — केही गडबड भयो कि हेर्ने (audit)
- **Settings** — नयाँ staff/branch थप्दा

---

## 💡 सुझाव
- सुरुमा **Settings → Products** मात्र गरे पनि website चल्न थाल्छ
- तर **stock नहालेसम्म कसैले किन्न सक्दैन** — website ले 0 जोर देखाउँछ।
  Stock हाल्ने दुई बाटो: **Purchasing → Trading goods** (किनेको माल) वा
  **Operations → Finished stock** (आफै बनाएको)
- **Operations, Costing, HR** — कारखाना/उत्पादन चलाउनेका लागि। किनेर मात्र
  बेच्ने भए यी नछोए पनि हुन्छ
- अल्मलिनुभयो भने कुनै section को नाम भन्नुस् — म step-by-step सिकाउँछु
