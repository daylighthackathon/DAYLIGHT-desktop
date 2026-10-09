# Architecture

## Actor pipeline (`actor/src/main.js`)

1. **Input**: `name`, `context`, `goal`, `cv`, `language`. CV is required (min 150 characters).
2. **Extract**: one LLM call lists up to 14 claims, employers and schools from the CV.
3. **Search**: Apify `google-search-scraper`. Base queries: name, name plus context, LinkedIn, talks and publications,
   GitHub for technical CVs. Targeted queries per employer and school (max 6). Two batches run in parallel.
4. **Read**: text of up to 12 pages that mention the surname, cut to excerpts around the name. Social networks are skipped.
5. **Which person?** Results are labelled by whether they mention an employer or school from the CV. One LLM call groups them by person.
   If a second person with at least 2 sources is a plausible match, the Actor stops and returns `needsChoice` with the candidates
   and a `cacheId` (search results are stored in the named key-value store `daylight-cache`). The page shows the choice and calls the Actor
   again with `cacheId` and `selectedCandidate`, which skips the search. Sources are narrowed to the chosen person.
   Low identity confidence also produces a warning and downgrades "verified".
6. **LinkedIn** (optional, after the choice): the profile found in results is read by a LinkedIn actor. Code extracts hard signals
   (`openToWork`, current position, headline) and puts them first in the text, so the model cannot overlook them.
7. **Analysis in small calls** (the proxy caps output at about 2000 tokens): claims in batches of 4, profile and findings,
   LinkedIn cross-check, then summary, identity, employment status, interview questions and limitations.
8. **Code checks**: canonical URL matching, quote search in source text, downgrade of unsupported statuses, removal of foreign URLs,
   deterministic "Open to work" flag.
9. **Output**: JSON in the dataset, readable `REPORT.html` in the key-value store.

## LLM access

Default: Apify OpenRouter proxy (`openai/gpt-4o-mini`, billed to Apify credits).
If `OPENAI_API_KEY` is set as an Actor env var, OpenAI is called directly (`LLM_MODEL` selects the model).

## Frontend (`web/index.html`)

Single file, no build step. Reads CV files in the browser (PDF via pdf.js from a CDN, DOCX by a small ZIP reader, HTML, MD, TXT).
Calls the Actor through the Apify sync endpoint with a 280 s timeout. EN/CS text lives in the `I18N` object.
The token in the page is visible to anyone who opens the page source. Fine for a demo, not for production.
For production put a small backend in front of the Actor.

## Tools (`tools/daylight_tools.py`)

Helper for the team: insert or clear the token, run test cases against the Actor, compare with ground truth, scan for leaked keys.

## Language switch

Static UI text comes from the `I18N` object. A finished report is translated on demand: the page sends its free-text fields
to the Actor in translate mode (`translateTexts`, `language`), caches the result per language and keeps quotes and URLs untouched.
