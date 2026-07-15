# Product Photos — कसरी थप्ने

Admin बाट **सिधै photo upload** गर्न मिल्छ। पहिलो पटक एकपटक setup चाहिन्छ
(Vercel Blob storage — free tier छ), त्यसपछि जहिले पनि upload गर्न मिल्छ।

---

## एकपटकको Setup (Vercel Blob)

1. https://vercel.com मा आफ्नो project (`krishoe_versal`) खोल्नुस्
2. बायाँ menu → **Storage** → **Create Database** → **Blob** रोज्नुस्
3. नाम दिएर create गर्नुस् — यसले project सँग आफै जोडिन्छ
4. **`BLOB_READ_WRITE_TOKEN`** token देखिन्छ / Settings → Environment Variables मा
   आफै थपिन्छ। नथपिए, token copy गरेर
   **Settings → Environment Variables** मा नयाँ थप्नुस्:
   - Key: `BLOB_READ_WRITE_TOKEN`
   - Value: (copy गरेको token)
   - Environments: Production and Preview
5. **Redeploy** (Deployments → latest → ⋯ → Redeploy)

> Local मा पनि upload test गर्न: `.env.local` मा उही `BLOB_READ_WRITE_TOKEN=...`
> राख्नुस्, अनि `npm run dev`।

---

## Photo थप्ने (हरेक product मा)

1. Admin → **Products** → कुनै product **Edit** (वा नयाँ Create)
2. **Main Image** मुनि **"Upload photo"** थिच्नुस् → आफ्नो computer/फोनबाट
   footwear को photo रोज्नुस् — आफै upload भएर URL भरिन्छ, तल preview देखिन्छ
3. **Gallery Images** मा **"Upload photos"** ले धेरै photo एकैचोटि थप्न मिल्छ
4. **Save Changes** थिच्नुस् — storefront मा तुरुन्तै देखिन्छ

> URL पनि manually paste गर्न मिल्छ (कतै host गरेको भए)।

---

## सुझाव (राम्रो देखिन)

- **Square वा 4:3** photo राम्रो (product cards त्यही ratio मा देखिन्छन्)
- सफा background, राम्रो light — footwear स्पष्ट देखियोस्
- हरेक photo **8 MB भन्दा सानो**, format: JPG / PNG / WebP
- एउटै product का धेरै angle gallery मा राख्नुस्

---

## अहिले किन "placeholder" छन्?

केही products मा असली photo नभएकोले branded placeholder (`ph-*.svg`) देखिन्छ।
माथिको तरिकाले असली footwear photo upload गर्नासाथ ती हट्छन् र site professional
देखिन्छ।
