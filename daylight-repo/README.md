# Daylight: every claim, in the light

> DRAFT for Max to polish. Facts below are accurate, the tone and visuals are yours.

An HR agent that checks a CV against the open web. Give it a candidate name and a CV
(PDF, DOCX, MD, HTML or text). It returns a report where **every claim is marked
verified / partial / contradicted / unverifiable**, with a source URL and a word-for-word quote as evidence.

Built for the "From Dusk Till Dawn" AI hackathon, track Social Media Deep Research.

## Why it is trustworthy

- The model sees only the sources the Actor fetched. It cannot cite anything else.
- Every evidence URL is checked in code. Unknown URLs are dropped.
- Every quote is searched in the source text. "Verified" without a confirmed quote is downgraded to "partial".
- E-mails and phone numbers are removed before the model sees any text.
- Unverifiable is shown as unverifiable. The report has a Limitations section.
- The agent never decides about a candidate. It prepares evidence and interview questions for a human.

## How it works

```
web/index.html  --POST-->  Apify Actor (actor/src/main.js)
                              1. extract claims from the CV (LLM)
                              2. Google search per name, employer, school (Apify Google Search Scraper)
                              3. fetch page text, group results by person (several matches: ask the user)
                              4. optional LinkedIn profile (Apify actor), verify claims in small batches (LLM), build profile, questions
                              5. code checks: URLs, quotes, downgrades
                           <--JSON + REPORT.html
```

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it

1. Create an Actor on Apify and paste the files from `actor/` (see `actor/README.md`). Build it.
2. Optional LinkedIn step: set Actor env vars `LINKEDIN_ACTOR=harvestapi~linkedin-profile-scraper` and
   `LINKEDIN_INPUT={"profileScraperMode":"Profile details no email ($4 per 1k)","queries":["{{URL}}"]}`.
3. Open `web/index.html`, fill `APIFY_TOKEN` and `ACTOR_ID` (format `username~actor-name`) near the top of the script. **Never commit a real token.**
   Without them the page runs in DEMO mode.
4. Open the page in a browser, upload a CV, press Verify.

The page has an EN/CS switch. The Actor takes `language` (`en` or `cs`) and writes the report in it.

## Desktop app

`desktop/` contains a Windows and Linux app (Electron) with Settings for your own Apify key,
PDF/HTML export of reports and a prepared licence field for a paid plan. See [desktop/README.md](desktop/README.md).

## Limits (honest)

- Only public web pages are searched. Many pages are outdated, so current employment is cross-checked with LinkedIn "Open to work" when available.
- Common names can mix up people. Results are grouped by person; if several people match, the page asks you to choose. The report also shows an identity confidence and the reasoning, and warns when it is low.
- Unverifiable does not mean untrue.
- The LLM output is capped at about 2000 tokens per call on the Apify proxy, so the analysis runs in several small calls.
- A run takes 1 to 3 minutes.

## Team

Erik, Max.

## License

MIT
