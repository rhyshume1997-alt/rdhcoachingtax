# RDH Tax Dashboard

Personal tax dashboard for sole trader self-assessment. Tracks RDH Coaching income and expenses across Monzo, Starling, RBS and Amex with AI-powered categorisation.

## Deploy to Vercel (15 minutes, free forever)

### Step 1: Push to GitHub
1. Go to https://github.com/new
2. Name it `rdh-tax` (or anything you want)
3. Set to **Private** (important — keeps your dashboard hidden)
4. Don't initialise with README
5. In your terminal:
   ```bash
   cd rdh-tax
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/rhyshume1997-alt/rdh-tax.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel
1. Go to https://vercel.com/new
2. Click "Import" next to your `rdh-tax` repo
3. Leave all settings as default
4. Click "Deploy"
5. Wait 1-2 minutes
6. You get a URL like `rdh-tax-abc123.vercel.app` — bookmark it on every device

### Step 3: Add your Anthropic API key (for AI categorisation)
1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key", name it `RDH Tax Dashboard`
3. Add £5 credit (lasts months at your usage — Anthropic gives free trial credit too)
4. Copy the key (starts with `sk-ant-`)
5. In Vercel: your project → Settings → Environment Variables
6. Add new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your key
7. Click Save
8. Go to Deployments → click the three dots on the latest → Redeploy

Done. AI categorisation and payslip reading now work.

**Don't want to pay for the API?** Skip step 3 entirely. The dashboard works without AI — you just tap Income/Expense/Personal manually on each transaction.

## Optional: Custom subdomain

In Vercel project → Settings → Domains, add `tax.rdhcoaching.com`.
Then in Namecheap, add a CNAME record pointing `tax` to `cname.vercel-dns.com`.

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

## Data persistence

All your transactions, categorisations, notes, mileage and home office data save to your browser's localStorage automatically. Different browsers and devices have separate data — use the **Download backup** button monthly and save the JSON to Google Drive.
