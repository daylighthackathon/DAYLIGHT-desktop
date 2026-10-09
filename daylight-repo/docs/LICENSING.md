# Paid plan: how to add it later

Goal: people who pay get the app ready to use, without creating their own Apify account.

## Why not ship our Apify key inside the app

Anything inside an installed app can be extracted (the app is a zip of JavaScript). A shipped key would leak
and anyone could spend our credits. So the key must stay on our server.

## Recommended design

```
Desktop app ──(licence key)──> Daylight server ──(our Apify key)──> Apify Actor
```

1. A small server (e.g. Cloudflare Worker, Vercel function or a tiny Node app on our VPS) with two endpoints:
   - `POST /license/check` → `{ active, plan, runsLeft }`
   - `POST /run` → checks the licence, counts the run, calls Apify with **our** key, returns the report.
2. Payments: Stripe or Lemon Squeezy. After payment the webhook creates a licence key and e-mails it.
3. In the app (`desktop/src/main.js`):
   - set `LICENSE_SERVER` to the server URL,
   - in `license:check` call `/license/check`,
   - in `callActor`: if there is an active licence and no own Apify key, call `/run` instead of Apify.
4. Settings already store the licence key encrypted, and the UI already has the field.

## Pricing idea

Each run costs us roughly the Google searches + LLM calls + optional LinkedIn profile on Apify.
Measure the real cost per run in Apify (Runs → Usage) before choosing a price.
