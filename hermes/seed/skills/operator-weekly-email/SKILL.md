---
name: operator-weekly-email
description: Email Adam a day-by-day schedule for social posting, outreach review, and lead follow-up for the coming week.
---

# Operator Weekly Email — Adam's Schedule

## Goal
Every **Monday morning**, email Adam a clear **day-by-day checklist** so he knows exactly when to post social content, review outreach, and prioritize leads — without guessing.

Adam's inbox is the operator dashboard. No Telegram-only schedules for manual work.

---

## When to run
- **Cron:** `weekly-operator-schedule` — Monday 7:15 AM MT
- **Also run:** After a major content sprint if the week's plan changed materially

---

## Build the schedule JSON

Save to `outreach/pending/operator-week-{YYYY-MM-DD}.json`:

```json
{
  "subject": "SAA Homes — Your week | Jul 1 – Jul 7",
  "week_label": "Jul 1 – Jul 7, 2026",
  "intro": "Here's what you need to do this week. Social packs arrive as separate emails — this is your calendar.",
  "pending_social_packs": [
    {
      "title": "June 2026 market update",
      "url": "https://saahomes.com/blog/northern-colorado-market-update-june-2026/",
      "post_by": "Wednesday Jul 2"
    }
  ],
  "schedule": [
    {
      "day": "Monday",
      "date": "Jul 1",
      "priority": "optional",
      "tasks": [
        "Skim Hermes weekly war room on Telegram (rankings + top 5 actions)",
        "Check Follow Up Boss for weekend form leads — call/text market report leads same day"
      ]
    },
    {
      "day": "Tuesday",
      "date": "Jul 2",
      "priority": "optional",
      "tasks": [
        "Follow Up Boss — speed-to-lead on any new contact or CHFA form submissions"
      ]
    },
    {
      "day": "Wednesday",
      "date": "Jul 3",
      "priority": "high",
      "tasks": [
        "Check email for Hermes Social Post Pack (subject: SAA Homes — Social posts | …)",
        "Open promoted URL — confirm page looks good live",
        "Meta Business Suite: post to Facebook + Instagram (use attached image + captions)",
        "Google Business Profile: post update with same image + link",
        "X (@saahomes): paste X caption + link",
        "Optional: reply posted on Telegram"
      ],
      "notes": "Weekly social email arrives today even if no new blog shipped."
    },
    {
      "day": "Thursday",
      "date": "Jul 4",
      "priority": "high",
      "tasks": [
        "Telegram: review OUTREACH REVIEW drafts — reply approved, edit: …, or skip",
        "If a blog/area page shipped Mon–Wed, post that social pack today if not done Wednesday"
      ]
    },
    {
      "day": "Friday",
      "date": "Jul 5",
      "priority": "optional",
      "tasks": [
        "Catch-up: any social pack emails still unposted? Post before end of week",
        "Follow Up Boss — close out open leads from the week"
      ]
    },
    {
      "day": "Weekend",
      "date": "",
      "priority": "optional",
      "tasks": [
        "Monitor FUB for new leads only — no social posting required unless a pack arrived"
      ]
    }
  ],
  "standing_reminders": [
    "Market report form leads = high intent — call/text same business day",
    "Post social packs within 48 hours of email arrival",
    "Never use Browserbase for social — email packs only",
    "Hermes handles site SEO/blog/deploy — you handle paste + leads + outreach approval"
  ]
}
```

### Customize each week
1. Read MEMORY `## Content calendar state` — note pending packs, rotation week, last blog URL
2. Read `context/repo-maintenance-checklist.md` section D — verify `latest_market_update_slug` matches repo
3. Check if a **new blog or area page** shipped last week → add to `pending_social_packs`
3. Adjust **Wednesday** task to reference the actual promoted URL/title
4. If **approved holiday** this week → see `holiday-calendar.md`; note expected holiday pack day in Wednesday task
5. If **monthly market blog** due (1st week) → note expected pack on deploy day

---

## Send email

```bash
python3 /usr/local/bin/send-operator-weekly-email.py outreach/pending/operator-week-{date}.json
```

On success:
1. Move JSON to `outreach/sent/`
2. Telegram (short):

```
📧 WEEKLY OPERATOR SCHEDULE emailed to adam@saahomes.com
Week: [week_label]
Wednesday: social post pack expected
Thursday: outreach review
```

---

## Relationship to social-post-pack emails

| Email | When | Contains |
|-------|------|----------|
| **Weekly operator schedule** (this skill) | Every Monday | Day-by-day calendar for the week |
| **Social post pack** | On content deploy + every Wednesday | Copy-paste captions + images for GBP/Meta/X |

Adam needs **both**. The weekly email tells him *when*; the post pack tells him *what*.

---

## Constraints
- Email adam@saahomes.com only (SOCIAL_POST_EMAIL_TO)
- Do not email leads or form submitters
- Keep total weekly manual time ~30 min in the intro
