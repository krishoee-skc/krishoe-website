# KRISHOE — Vercel मा Deploy (public link)

इन्टरनेटमा जहाँबाट पनि खुल्ने स्थायी link को लागि। एकपटक setup गरेपछि,
हरेक `git push` मा **आफै auto-deploy** हुन्छ — बारम्बार गर्नुपर्दैन।

---

## किन पहिले "भएन" जस्तो लाग्थ्यो?

App चल्न password, session secrets, र database URL चाहिन्छ। ती `.env.local`
मा छन् — तर त्यो file **git मा जाँदैन** (secrets हुन्, `.gitignore` ले रोक्छ)।
त्यसैले Vercel मा ती **अलग्गै राख्नुपर्छ**। नराखे app crash हुन्छ। यही मुख्य कारण।

---

## Step 1 — Project import

1. https://vercel.com मा GitHub बाट login गर्नुस्
2. **"Add New…" → "Project"**
3. `krishoee-skc/krishoe-website` repo **"Import"** गर्नुस्
4. Framework आफै **Next.js** देखिन्छ — Build/Output settings नछुनुस्

## Step 2 — Environment Variables (सबैभन्दा महत्त्वपूर्ण) ⚠️

Import screen मा **"Environment Variables"** section मा तलका सबै keys थप्नुस्।
**Value हरू तपाईंको `.env.local` file बाट copy गर्नुस्** (VS Code मा खोल्नुस्):

| Key | कहाँबाट value |
|-----|---------------|
| `ADMIN_PASSWORD` | `.env.local` बाट (वा नयाँ बलियो password) |
| `ADMIN_SESSION_SECRET` | `.env.local` बाट |
| `ADMIN_SESSION_TTL_SECONDS` | `.env.local` बाट (`28800`) |
| `ADMIN_ROLE` | `.env.local` बाट (`Owner`) |
| `DATA_BACKEND` | `postgres` |
| `CUSTOMER_SESSION_SECRET` | `.env.local` बाट |
| `CUSTOMER_SESSION_TTL_SECONDS` | `.env.local` बाट (`2592000`) |
| `PASSWORD_RESET_SHOW_LOCAL_LINK` | `false` |
| `PAYMENT_MODE` | `.env.local` बाट (`manual`) |
| `NOTIFICATION_DELIVERY_TIMEOUT_MS` | `.env.local` बाट (`6000`) |
| `DATABASE_URL` | `.env.local` बाट (Neon को पूरै string) |
| `NEXT_PUBLIC_SITE_URL` | **अहिलेलाई छोड्नुस्** — Step 4 मा राख्ने |

> हरेक variable "Production" (र चाहे "Preview") मा apply गर्नुस्।

## Step 3 — Deploy

**"Deploy"** थिच्नुस्। 1–2 मिनेटमा बन्छ। सकिएपछि Vercel ले link दिन्छ, जस्तै:
`https://krishoe-website.vercel.app`

## Step 4 — Site URL मिलाउने (SEO सही हुन)

1. माथिको Vercel link copy गर्नुस्
2. Vercel → Project → **Settings → Environment Variables**
3. नयाँ थप्नुस्: `NEXT_PUBLIC_SITE_URL` = तपाईंको vercel link (जस्तै
   `https://krishoe-website.vercel.app`)
4. **Deployments → … → Redeploy** — अब SEO/link हरू सही हुन्छन्

---

## अब कस्तो हुन्छ? (तपाईंको प्रश्नको जवाफ)

- **हरेक पटक deploy गर्नुपर्दैन।** अब कोड बदलेर `git push` गर्नासाथ Vercel
  आफै build र deploy गर्छ। Link उही रहन्छ।
- Env vars बदल्नुपरे मात्र Vercel Settings मा गएर बदल्ने + redeploy।

## Health check
Deploy पछि `https://<तपाईंको-link>/api/health` खोल्नुस् → `{"ok":true}`
आयो भने सप्पै ठीक छ। ✅

## सुरक्षा सल्लाह 🔒
Production मा जाँदा `ADMIN_PASSWORD` नयाँ, बलियो राख्नुहोला — अनि `.env.local`
कहीँ share नगर्नुहोला (त्यसमा database password छ)।
