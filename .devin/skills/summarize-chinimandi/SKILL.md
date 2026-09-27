---
name: summarize-chinimandi
description: Generate 20–30-word summaries for scraped ChiniMandi posts — finds Post rows whose canonicalUrl starts with https://www.chinimandi.com and summaryGenerated is false, writes the summary, and flips summaryGenerated to true.
argument-hint: '[optional limit of posts to process]'
allowed-tools:
  - exec
  - read
---

# Summarize pending ChiniMandi posts

A backfill subskill of `summarize-30`: for every ingested post whose `canonicalUrl` starts with `https://www.chinimandi.com` and `summaryGenerated = false`, generate a 20–30-word summary (aim near 30) and persist it.

## Step 1 — find pending posts

Run inside the postgres container (same connection pattern as `postgres-expert`):

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -x -c "
SELECT DISTINCT ON (p.id)
  p.id,
  p.\"canonicalUrl\",
  l.code AS locale,
  t.title,
  t.content
FROM \"Post\" p
JOIN \"BlogPost\" b         ON b.\"postId\" = p.id
JOIN \"BlogPostTranslation\" t ON t.\"blogPostId\" = b.\"postId\"
JOIN \"Locale\" l           ON l.id = t.\"localeId\"
WHERE p.\"canonicalUrl\" LIKE 'https://www.chinimandi.com%'
  AND p.\"summaryGenerated\" = false
ORDER BY p.id, CASE l.code WHEN 'en-IN' THEN 0 ELSE 1 END;"
```

This picks one translation per post (en-IN preferred, any other locale as fallback). If the user passed a limit, append `LIMIT <n>` — but `ORDER BY` must keep `p.id` first for `DISTINCT ON` to work.

If the container isn't running: `docker compose up -d postgres` first. If zero rows come back, report that and stop.

## Step 2 — generate the summary

For each row, summarize `title` + `content` following the `summarize-30` rules:

- 20–30 words — aim for the upper end; one or two plain sentences, no label or meta-commentary.
- Read `title` first — the summary sits next to it in the feed, so never restate what the title already says. Add the detail that makes the reader tap through.
- Preserve sugarcane/commodity specifics: mandi names, prices (₹/quintal), quantities, dates, state/district.
- ChiniMandi bodies are Hindi — the en-IN translation mirrors the Hindi text, so the summary will usually be Hindi. Always match the actual language of `content`.
- Strip any HTML remnants before summarizing.

## Step 3 — persist per post

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c "
UPDATE \"Post\"
SET summary = '<20–30-word summary>', \"summaryGenerated\" = true
WHERE id = '<post id>';"
```

- Escape `'` inside the summary by doubling it (`''`). The `id` is a cuid — safe to inline.
- Update only the one row by `id`; never bulk-update a range.
- Set `summaryGenerated = true` in the same statement as the summary — never flip the flag without writing a summary.

## Step 4 — verify and report

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c "
SELECT count(*) FILTER (WHERE \"summaryGenerated\") AS done,
       count(*) FILTER (WHERE NOT \"summaryGenerated\") AS pending
FROM \"Post\" WHERE \"canonicalUrl\" LIKE 'https://www.chinimandi.com%';"
```

Report how many summaries were written and how many remain pending.
