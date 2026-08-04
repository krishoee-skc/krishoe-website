# GitHub Actions CI/CD Setup Guide

## अब गर्नुपर्ने काम (Setup Required)

GitHub Actions को CI/CD pipeline automatic deploy गर्नको लागि केही secrets add गर्न पर्छ।

---

## Step 1: Vercel API Token

### Token Generate गर्नुहोस्:
1. Vercel Dashboard खोल्नुहोस्: https://vercel.com
2. **Settings > Tokens** जाउनुहोस्
3. नयाँ token create गर्नुहोस्
4. Token copy गर्नुहोस्

---

## Step 2: GitHub Secrets Add गर्नुहोस्

### Repository मा जाउनुहोस्:
1. GitHub पर आफ्नो repo खोल्नुहोस्
2. **Settings > Secrets and variables > Actions**
3. **New repository secret** क्लिक गर्नुहोस्

### तीनवटा Secrets Add गर्नुहोस्:

#### Secret 1: VERCEL_TOKEN
```
Name: VERCEL_TOKEN
Value: [Vercel बाट copy गरेको token]
```

#### Secret 2: VERCEL_ORG_ID
```
Name: VERCEL_ORG_ID
Value: [Vercel dashboard मा आफ्नो org ID]

कहाँ खोज्ने:
- https://vercel.com/account/teams
- आफ्नो team/account को ID copy गर्नुहोस्
```

#### Secret 3: VERCEL_PROJECT_ID
```
Name: VERCEL_PROJECT_ID
Value: [KRISHOE project को ID]

कहाँ खोज्ने:
- https://vercel.com/krishoe-website
- Project Settings > General
- Project ID copy गर्नुहोस्
```

---

## Step 3: समझ्नुहोस् Pipeline कस्तो काम गर्छ

### Pipeline Triggers:
```
✅ Main branch को कुनै नयाँ commit
✅ Develop branch को commit
✅ Pull requests
```

### Pipeline Stages:

#### Stage 1: Test (2-3 मिनेट)
```
1. Code checkout
2. Dependencies install
3. TypeScript type check
4. ESLint analysis
5. Unit tests run
6. Build project
7. Coverage report
```

#### Stage 2: Deploy (1-2 मिनेट) - Main branch only
```
1. सब tests pass भयो?
2. हो भने Vercel मा deploy गर
3. Production URL तयार छ
```

---

## उदाहरण: Pipeline काम गर्दै छ कस्तो?

### Scenario 1: नयाँ feature add गर्नु (PR)
```
1. नयाँ branch बनाउनुहोस्: git checkout -b feature/new-feature
2. Code लेख्नुहोस्
3. Tests लेख्नुहोस्
4. Push गर्नुहोस्: git push origin feature/new-feature
5. GitHub मा Pull Request बनाउनुहोस्
6. Automatically tests run हुन्छन्
7. Tests pass भए PR approve गर्न सकिन्छ
8. Main मा merge गर्नुहोस्
9. Automatically production मा deploy हुन्छ ✅
```

### Scenario 2: Quick fix (सीधै main मा)
```
1. Main branch मा छ
2. Code change गर्नुहोस्
3. Commit: git commit -am "Fix: description"
4. Push: git push origin main
5. GitHub Actions automatically सुरु हुन्छ
6. सब tests pass भए production deploy हुन्छ
```

---

## Pipeline Status Check गर्नुहोस्

### GitHub मा:
1. आफ्नो repo खोल्नुहोस्
2. **Actions** tab क्लिक गर्नुहोस्
3. Latest workflow run देख्नुहोस्
4. Status check गर्नुहोस्:
   - ✅ Green = Success
   - ❌ Red = Failed
   - 🟡 Yellow = Running

### Details देख्नुहोस्:
- कुन stage fail भयो?
- कुन test fail भयो?
- Error message कस्तो छ?

---

## Troubleshooting

### Problem: Deploy नभएको
**Solution**:
1. Tests run गरे?
2. सब pass भयो?
3. Secrets सेट भएका छन्?
4. GitHub Actions logs check गर्नुहोस्

### Problem: "Authentication failed"
**Solution**:
- VERCEL_TOKEN ठिक छ?
- Token expired तो छैन?
- नयाँ token generate गर्नुहोस्

### Problem: "Project not found"
**Solution**:
- VERCEL_ORG_ID ठिक छ?
- VERCEL_PROJECT_ID ठिक छ?
- Vercel dashboard मा verify गर्नुहोस्

---

## Monitoring & Logs

### Real-time Logs:
```
GitHub Actions > Workflow > Run Details
```

### Deploy Logs:
```
Vercel Dashboard > Deployments > Latest
```

---

## Branch Protection Rules (Advanced)

Production को सुरक्षा को लागि:

1. **Settings > Branches > Add rule**
2. Branch name pattern: `main`
3. Enable: "Require status checks to pass before merging"
4. Select: "Test and Deploy" workflow
5. Save

यसले सुनिश्चित गर्छ कि:
- कुनै नयाँ code merge हुन सक्दैन जब tests fail हो
- Code quality maintain रहेछ
- Production deployment safe छ

---

## Performance Tips

### कस्तो गति गरायु?

1. **Use npm ci** (npm install भन्दा तेज)
2. **Cache dependencies** (Node modules)
3. **Parallel tests** (Multiple tests एकै साथ)
4. **Skip unnecessary checks** (Draft PRs को लागि)

(सब कुरा workflow मा पहिले सेट भएको छ)

---

## Cost Implications

GitHub Actions:
- Free tier: 2000 minutes/month
- हामीको pipeline: ~5 minutes/run
- Maximum runs: 400/month (प्रायः काफी छ)

---

## Success! 🎉

Pipeline अब काम गर्दै छ:

✅ हरेक commit मा tests run हुन्छन्
✅ Main branch मा merge गरे production deploy हुन्छ
✅ Code quality automatically check हुन्छ
✅ Zero-downtime deployments

---

**Ready to start using CI/CD?**

अब commit गर र pipeline काम गर्दै छ हेरनुहोस्! 🚀
