# Deployment Guide — Pipeline Autopilot (GitHub Marketplace App)

---

## How It Works (for users)
1. User finds your app on GitHub Marketplace → clicks **Install**
2. Selects which repos to give access to
3. Their pipeline fails → your app **automatically**:
   - Analyzes the failure logs with AI
   - Shows status on the commit (Check Run)
   - Opens a fix PR in their repo
4. User reviews PR → merges → done

**No website. No login. Everything happens inside GitHub.**

---

## Step 1 — Deploy Backend on Railway

1. Push code to GitHub (create new repo at github.com/new)
2. Go to https://railway.app → **New Project → Deploy from GitHub**
3. Select your repo → set **Root Directory** to `backend`
4. Click **+ New → Database → PostgreSQL**
5. Note your Railway URL: `https://your-app.railway.app`

---

## Step 2 — Create Your GitHub App

1. Go to https://github.com/settings/apps/new
2. Fill in:

| Field | Value |
|---|---|
| **GitHub App name** | Pipeline Autopilot |
| **Homepage URL** | `https://your-app.railway.app` |
| **Webhook URL** | `https://your-app.railway.app/webhook/github` |
| **Webhook secret** | any random string (save it!) |

3. Under **Permissions**, set:
   - Actions → **Read**
   - Checks → **Read & Write**
   - Contents → **Read & Write**
   - Metadata → **Read**
   - Pull requests → **Read & Write**
   - Workflows → **Read & Write**

4. Under **Subscribe to events**, check:
   - `workflow_run`
   - `installation`

5. Set **Where can this GitHub App be installed?** → **Any account**

6. Click **Create GitHub App**

7. On the app page:
   - Note the **App ID**
   - Click **Generate a private key** → downloads a `.pem` file
   - Open the `.pem` file, copy all contents

---

## Step 3 — Set Environment Variables in Railway

Go to Railway → your service → **Variables** tab:

| Variable | Value |
|---|---|
| `GITHUB_APP_ID` | App ID from Step 2 |
| `GITHUB_APP_PRIVATE_KEY` | Full `.pem` contents — replace newlines with `\n` |
| `GITHUB_WEBHOOK_SECRET` | The random string from Step 2 |
| `AZURE_OPENAI_ENDPOINT` | Your hackathon APIM gateway URL, e.g. `https://your-apim.azure-api.net` |
| `AZURE_OPENAI_API_KEY` | Your team key from the onboarding note |
| `AZURE_OPENAI_DEPLOYMENT` | Azure/APIM deployment name, e.g. `gpt-5-chat` |
| `AZURE_OPENAI_API_VERSION` | API version from the onboarding note |
| `OPENAI_API_KEY` | Optional direct OpenAI Platform fallback |
| `OPENAI_MODEL` | Optional direct OpenAI model, e.g. `gpt-5` |
| `OPENROUTER_API_KEY` | Optional fallback if you still use OpenRouter |
| `OPENROUTER_MODEL` | Optional OpenRouter model, e.g. `openai/gpt-4o` |
| `DATABASE_URL` | Auto-filled by Railway PostgreSQL plugin |

### How to format the private key as one line:
```bash
# Run this on your machine to get the one-line version:
cat your-app.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' 
```
Paste that output as the value of `GITHUB_APP_PRIVATE_KEY`.

Railway redeploys automatically after saving variables.

---

## Step 4 — List on GitHub Marketplace

1. Go to your GitHub App settings
2. Click **Edit → List this GitHub App on the Marketplace**
3. Fill in:
   - **Tagline**: AI that fixes your broken pipelines automatically
   - **Categories**: Code quality, CI/CD
   - **Pricing**: Free (or add paid plans later)
   - **Logo**: upload an icon
4. Submit for review (GitHub reviews in 1-3 days)

Once approved → your app appears at `github.com/marketplace/pipeline-autopilot`

---

## Step 5 — Test Before Listing

Install your app on your own repo first:

1. Go to your GitHub App page → **Install App**
2. Choose one of your repos
3. Trigger a failing pipeline (break something in a workflow file)
4. Watch:
   - Check Run appears on the commit: "Pipeline Autopilot: Analyzing..."
   - A few seconds later: "Fix PR opened" with a link
   - PR appears in your repo with the AI-generated fix

---

## Local Development

```bash
# Install dependencies
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Fill in backend/.env with your GitHub App credentials

# Start server
uvicorn app.main:app --reload --port 8000
```

To receive webhooks locally, use smee.io:
```bash
npm install -g smee-client
smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:8000/webhook/github
```
Set the Webhook URL in your GitHub App to your smee.io URL during development.
