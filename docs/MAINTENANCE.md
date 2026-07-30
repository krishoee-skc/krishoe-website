# KRISHOE App - Maintenance Guide

## 🎯 App Status: LIVE & RUNNING

**Live URL:** https://krishoe-website.vercel.app  
**Admin Panel:** https://krishoe-website.vercel.app/admin/login  
**Database:** Neon Postgres (ap-southeast-1.aws)  
**Deployment:** Vercel (Auto-deploy on push)  

---

## 📋 Daily Checklist (हरेक दिन)

**सुबह:**
- [ ] App खोलो: https://krishoe-website.vercel.app/admin/factory
- [ ] Dashboard load हुन्छ?
- [ ] Workers list दिखिन्छ?

**शाम (काम entry गरेपछि):**
- [ ] नयाँ entry save हुन्छ?
- [ ] Amount calculate हुन्छ?
- [ ] Ledger update हुन्छ?

**कुनै error आए:**
- [ ] Vercel dashboard check गर
- [ ] App restart गर (Redeploy)
- [ ] Database connection verify गर

---

## 🔧 Weekly Maintenance (हरेक हप्ता)

**Monday:**
- Database backup check (Neon console मा)
- Vercel logs check गर (errors को लागि)

**Friday:**
- Monthly summary generate गर
- Payroll data verify गर

---

## 🚨 Troubleshooting

### Problem: App नहीं load हुन्छ
**Solution:**
1. https://krishoe-website.vercel.app खोलो
2. Page refresh गर (Ctrl+R)
3. अभि पनि काम नगर्यो भने Vercel redeploy गर

**Vercel Redeploy कसरी:**
1. https://vercel.com/krishoe-website खोलो
2. "Deployments" tab click गर
3. Latest deployment को right side मा "..." click गर
4. "Redeploy" select गर

### Problem: Database connection error
**Solution:**
1. Neon console खोलो: https://console.neon.tech
2. "krishoe-website" database select गर
3. Connection string verify गर
4. Vercel को environment variables check गर

### Problem: काम entry save नभैरहन्छ
**Solution:**
1. सब fields भरे छन्?
2. Worker, Product select गरे छन्?
3. Pairs count भरे छन्?
4. Browser console मा error छ? (F12 दबाओ)

---

## 📊 Important Links

| Service | Link | Purpose |
|---------|------|---------|
| **App** | https://krishoe-website.vercel.app | Main application |
| **Admin** | https://krishoe-website.vercel.app/admin/login | Admin panel |
| **Vercel Dashboard** | https://vercel.com/krishoe-website | Deployments & logs |
| **Neon Database** | https://console.neon.tech | Database management |
| **GitHub Repo** | https://github.com/krishoee-5610s-projects/krishoe-website | Code repository |

---

## 🔑 Important Credentials

**Admin Login:**
- Email: `skschhapal@gmail.com`
- Password: Check in .env.local file

**Database Access:**
- Provider: Neon
- Connection: In Vercel environment variables
- Never share publicly!

---

## 📱 Contact & Support

**Email:** skschhapal@gmail.com  
**Phone:** +977 9855019351  
**WhatsApp:** +977 9766630193  

---

## ⚡ How App Stays Live

### 1. Auto-Deployment (Vercel)
- हरेक push पछि automatically deploy हुन्छ
- Zero downtime
- Previous version backup रहन्छ

### 2. Database Backups (Neon)
- Daily automatic backups
- 30 days retention
- Neon console मा restore गर सकिन्छ

### 3. Environment Variables (Secure)
- Vercel मा encrypted storage
- Production environment अलग
- Never in code commits

### 4. Health Monitoring
- Vercel automatic monitoring
- Error tracking enabled
- Failed deployments auto-rollback

---

## 🛠️ When Something Breaks

### Step 1: Identify Problem
```
Error दिखिन्छ? → Note करो
Function काम नगर्छ? → Logs check गर
Database error? → Neon console check गर
```

### Step 2: Quick Fix
```
Redeploy गरो
OR
Environment variables reload गर
OR
Database connection restart गर
```

### Step 3: If Still Broken
```
1. Git मा latest code check गर
2. Local build test गर
3. Vercel logs detailed देख गर
4. Contact developer
```

---

## 📈 Monthly Tasks

**Month Start:**
- [ ] Verify all workers are active
- [ ] Check database size
- [ ] Review error logs

**Month End:**
- [ ] Generate monthly summary
- [ ] Prepare payroll reports
- [ ] Backup important data
- [ ] Update rates if needed

---

## 🔒 Security Best Practices

1. **Never share passwords publicly**
2. **DATABASE_URL रक्षा गर** (Vercel stored, never in git)
3. **Admin credentials secure রাख**
4. **Regular backups verify गर**
5. **2FA enable गर** (Vercel account पर)

---

## 📝 Log Files Location

**Vercel Logs:** https://vercel.com/krishoe-website/deployments  
**Database Logs:** Neon console → Activity tab  
**Application Logs:** Browser console (F12)  

---

## ✅ Setup Verification Checklist

- [x] Database: Neon Postgres connected
- [x] Server: Vercel deployed
- [x] Environment: All variables set
- [x] TypeScript: All errors fixed
- [x] Deployment: Auto-deploy configured
- [x] SSL: HTTPS enabled
- [x] Health: All endpoints responding
- [x] Backup: Database backed up

---

**Last Updated:** 2026-07-30  
**Status:** ✅ LIVE & MONITORING  
**App Uptime:** 99.9%+ (Vercel SLA)

