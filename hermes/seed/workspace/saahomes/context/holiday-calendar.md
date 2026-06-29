# Approved Holiday Calendar — Social only (SAA Homes)

**Policy:** Post for **major, widely recognized U.S. holidays** only. Social-first — **never a blog post** unless Adam explicitly requests.

**Tone:** Grateful, patriotic, community-minded, professional. Honor the day — **not a sales pitch**. One soft real-estate line max (e.g. “Wishing your family a peaceful holiday from your Northern Colorado neighbors at Schwartz and Associates”).

**Adam's rule:** Main holidays only. No political, DEI, or “awareness day” content.

Read with: `content-calendar.md`, `social-post-pack` skill, `hard-rules.md`.

---

## Approved holidays (post these — ~7–8 per year)

| Holiday | Typical date | Post window | Angle | CTA |
|---------|--------------|-------------|-------|-----|
| **New Year's Day** | Jan 1 | Dec 28 – Jan 2 | Fresh start, gratitude for clients/community | Soft — contact or none |
| **Memorial Day** | Last Mon in May | Sat – Mon | Honor fallen service members. **No sales language.** | None or “grateful to serve this community” |
| **Independence Day** | July 4 | Jul 2 – Jul 4 | Patriotic, community, summer in Northern Colorado | contact (optional) |
| **Labor Day** | First Mon in Sep | Sat – Mon | End-of-summer, family time, community | Optional soft — for-sellers fall preview |
| **Veterans Day** | Nov 11 | Nov 9 – Nov 11 | Thank veterans & military families. **No sales language.** | None |
| **Thanksgiving** | 4th Thu in Nov | Mon – Thu | Gratitude, family, community | Optional — market report |
| **Christmas** | Dec 25 | Dec 20 – Dec 25 | Warm wishes, peace, year-end gratitude | Optional — contact |

**Frequency:** One social post pack per approved holiday (GBP + Meta + X). Do not post the same holiday on multiple platforms as separate campaigns — one pack, Adam pastes once.

---

## Seasonal (not holidays — use Wed rotation, not this calendar)

These are **market/season** themes, not holiday posts:

| When | Theme | Where |
|------|-------|-------|
| Feb–Mar | Spring seller prep, buyer tax timing | Wed rotation week 2 or 4 |
| Aug–Sep | Back-to-school / fall market | Wed rotation + area pages |
| Oct | Winterization, fall market | Wed rotation week 2 |

Do not conflate seasonal market tips with holiday posts.

---

## Do NOT post (hard stop)

Hermes must **never** draft or email social content for:

- Pride month, LGBTQ+ awareness days, or similar
- Juneteenth, Indigenous Peoples' Day (as branded posts), or other politically charged observances
- DEI / inclusion awareness days or months
- International Women's Day, Earth Day, or generic "awareness" days
- Random national days (National Coffee Day, etc.)
- Political elections, candidates, or policy debates
- Tragedies, disasters, or mass events (exploit for leads)
- Religious holidays beyond Christmas (Easter, Hanukkah, etc.) — **skip** unless Adam asks
- Mother's Day / Father's Day — skip (fine line between warm and salesy; not on approved list)

If unsure whether a date qualifies: **skip it** and use normal Wed rotation.

---

## Copy guardrails

### DO
- "Thank you to all who served" (Veterans Day, Memorial Day)
- "Wishing you and your family a Merry Christmas"
- "Grateful to serve Northern Colorado"
- Local tie-in: Fort Collins, Loveland, Windsor, Greeley community
- Sign as Schwartz and Associates · (970) 999-1407

### DO NOT
- Tie military holidays to "use your VA loan today!" on the same post
- Political statements, culture-war references, or partisan language
- Guaranteed outcomes, Fair Housing violations, or steering
- Hashtag spam (#Pride, political tags, etc.)

---

## Hermes execution

### When an approved holiday is within 7 days

1. **Wednesday cron (`social-weekly-content`):** If holiday is Wed–Sun that week, **replace** rotation opener with approved holiday post (still include market/tip if not redundant)
2. **Monday operator email:** Note "Holiday post pack expected [day] — [Holiday name]"
3. **`social-post-pack`:** Set `content_type: holiday`, use hero from `public/images/` (flag, community, winter, or branded SAA — **never AI fake**)
4. Email Adam via `send-social-post-pack.py` with `operator_schedule`
5. Log in MEMORY: `last_social_pillar: holiday-{name}`

### If holiday falls mid-week (not Wednesday)

Email holiday pack **Monday or Tuesday** of that week instead of waiting for Wed — one email only.

### If a new blog ships the same week as a holiday

**Blog post pack takes priority.** Add one line of holiday wishes at the **end** of captions only if natural — do not replace the blog promotion.

---

## MEMORY tracking

Add to `## Content calendar state`:

```
holidays_posted_YYYY: [list of holiday names already emailed this year]
```

Do not re-send the same holiday twice in one year.

---

## Examples (Veterans Day — good)

> On Veterans Day, Schwartz and Associates honors the men and women who served our country — and the military families in our Northern Colorado community. Thank you for your sacrifice. 🇺🇸

> — Adam & Mandi · (970) 999-1407 · saahomes.com

## Examples (Christmas — good)

> Merry Christmas from Adam, Mandi, and the Schwartz and Associates team. Wishing your family warmth, peace, and time together this holiday season.

> — Schwartz and Associates · Northern Colorado Real Estate

## Examples (Memorial Day — good)

> This Memorial Day, we pause to remember those who gave their lives in service to our nation. Grateful to live and work in a community that honors them.

**Bad (never):** "Memorial Day sale — list your home this weekend for 10% off commission!"
