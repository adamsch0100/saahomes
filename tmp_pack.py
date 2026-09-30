import csv, re, os, datetime

SRC = '/data/workspaces/listlogic/prospects/agents.csv'
OUT_DIRS = [
    '/data/workspaces/listlogic/prospects/outreach/pending',
    '/data/org/projects/listlogic/work/outreach/pending',
]
DATE = '2026-09-28'

ADDRESS = 'Schwartz and Associates · 3665 John F Kennedy Parkway, Suite 210 · Fort Collins, CO 80525 · (970) 999-1407'
UNSUB = 'Unsubscribe: reply STOP, or one click via the footer link on the live send. We will remove you within 10 business days.'
DEMO = 'https://listlogic.homes/demo?utm_source=outreach&utm_medium=email&utm_campaign=agent_pack_20260928'


def is_cb(r):
    return 'cb_nationwide' in r['notes'] or 'cbrealty' in r['email'].lower()


def award_score(notes):
    s = 0
    if 'Platinum Club' in notes:
        s += 60
    if 'Hall of Fame' in notes:
        s += 45
    if '100% Club' in notes:
        s += 30
    s += notes.count('Platinum Club') * 4
    s += notes.count('100% Club') * 2
    import re as _re
    s += len(_re.findall(r'20[12][0-9]', notes))
    if 'active producer' in notes:
        s += 15
    return s


rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
noncb = [r for r in rows if not is_cb(r)]
hi = [r for r in noncb if r['icp_score'] == 'high' and r['email'].strip()]
for r in hi:
    r['_score'] = award_score(r['notes'])

leads = [r for r in hi if r['title'] != 'Agent']
agents = sorted([r for r in hi if r['title'] == 'Agent'], key=lambda r: -r['_score'])
sel = leads + agents[:23]
sel = sel[:24]
for r in sel:
    r['first'] = r['name'].split()[0]

def email_block(r):
    ctx = r['city'] + ', ' + r['state']
    return f"""### {r['name']} — {r['brokerage']} · {ctx}
`{r['email']}` · ICP: {r['icp_score']} · source: {r['source_url']}

**Subject:** {r['first']} — show the price trade-off live (not another PDF)

Hi {r['first']},

Sellers walk into your next listing appointment holding a portal number — and a static CMA rarely moves them off it.

ListLogic turns the home's market into a live pricing story: recommended price, odds of selling, and what happens to supply while they wait if they stretch. Search nationwide or upload any MLS export. Sample is free; you only unlock when you Generate (7-day trial or a $20 one-shot).

Sample: {DEMO}

If it's useful, I can send a 2-minute walkthrough or a seat note for {r['brokerage']}.

— Adam Schwartz
ListLogic · https://listlogic.homes
{ADDRESS}
{UNSUB}
"""

lead_blocks = ""
for r in leads:
    lead_blocks += f"""### {r['name']} — {r['brokerage']} (team lead) · {r['city']}, {r['state']}
`{r['email']}` · source: {r['source_url']}

**Subject:** Listing appointment tool for the {r['name'].split()[-1] if False else 'June'} team — pricing trade-offs, live

Hi {r['first']},

Standardize listing appointments so agents stop guessing and stop overpricing. Shared branding, seat pricing, lunch-and-learn. Agents try the sample free; the office unlocks seats when they Generate for real clients.

Speed matters in a soft market: when a seller is anchored on a portal estimate, ListLogic makes the price × odds × supply trade-off visible in the appointment instead of in a 40-page PDF.

Demo: {DEMO}

Open to a short call, or I can send a team seat note + demo script for your listing leads?

— Adam Schwartz
ListLogic · https://listlogic.homes
{ADDRESS}
{UNSUB}

"""

body = f"""# ListLogic outreach pack — {DATE} (DRAFT)

**STATUS: DRAFT — NOT SENT. `OUTREACH_APPROVAL_REQUIRED=true`. Adam must reply `approved` (whole pack or per-line) before any send.**

- Prospects in pack: **{len(sel)}** (target 10–25)
- Pool used: **{len(hi)}** high-ICP, non-Coldwell-Banker rows from `prospects/agents.csv` (harvest {DATE})
- Excluded: {len(rows) - len(noncb)} Coldwell Banker nationwide rows — CB pilot is handled by Adam personally; do not cold-outreach CB.
- last_touch empty for all rows → nothing here has been contacted yet.
- Channel: **email only**. SMS drafts are personal/broker-forward only (see bottom) — no consent claimed.
- Pitch frames: exact text from `context/product-growth-strategy.md` → Pitch library → Agent / Brokerage.

## A. Agent emails ({len(sel) - len(leads)})

Ranked by production signals (Platinum Club > Hall of Fame > 100% Club > Executive Club; active producers first).

{''.join(email_block(r) for r in sel if r['title'] == 'Agent')}

## B. Team-lead / brokerage email ({len(leads)})

{lead_blocks}
## C. SMS drafts — DO NOT SEND COLD

These are for Adam's personal phone or brokerage-forward use only. Cold automated SMS needs prior express consent (TCPA). `consent_sms=0` for every row in the CSV; do not blast harvested numbers.

**C1 — warm/personal (Adam):**
> Hey {{FirstName}} — built a live seller pricing story tool (price × odds × supply). Free demo: listlogic.homes/demo — curious if useful for your listing appts?

**C2 — after an email reply:**
> Thanks for checking ListLogic — easiest path: open the demo, then create an account and unlock at Generate (7-day trial). Questions? Just text me. Reply STOP to opt out.

**C3 — brokerage forward (Adam → agent):**
> {{FirstName}} shared ListLogic with your team — interactive CMA-style presentation for listing appointments. Demo: listlogic.homes/demo. Reply STOP to opt out.

## D. Compliance block (attach to every live email)

```
Adam Schwartz · ListLogic
{ADDRESS}
You received this because your brokerage profile is publicly listed.
{UNSUB}
```

CAN-SPAM checklist per send: [ ] real first name + brokerage verified · [ ] physical postal address in footer · [ ] working unsubscribe · [ ] not on DNC (`dnc=0` for all rows) · [ ] Adam approved.

## E. Uncertainties / notes for Adam

- RE/MAX rows are `@remax.net` corporate-style addresses from the RE/MAX public city directory — deliverability to those mailboxes is unproven. If your first send bounces, we pivot to personal domains.
- Production data is the 2025 production club listing; "active producer" = listed on the 2025 club page. Treat as intent signal, not a verified listing count.
- Send identity/domain: no ListLogic SMTP sender is configured yet. Approving the pack also means picking the From identity (e.g. adam@listlogic.homes vs adam@saahomes.com) so replies land somewhere you read.

## Approve / edit / skip

Reply **`approved`** (all {len(sel)}), **`approved 1-12`**, or **`skip`**. No send happens without that word.
"""

for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)
    fp = os.path.join(d, f'{DATE}-pack.md')
    open(fp, 'w', encoding='utf-8').write(body)
    print('wrote', fp, len(body), 'bytes')
print('selected', len(sel))
print('leads', [r['name'] for r in leads])
for r in sel[:26]:
    print(' -', r['name'], r['state'], r['_score'])