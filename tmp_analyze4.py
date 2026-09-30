import csv, collections, re
p = '/data/workspaces/listlogic/prospects/agents.csv'
rows = list(csv.DictReader(open(p, encoding='utf-8-sig')))

def is_cb(r):
    return 'cb_nationwide' in r['notes'] or 'cbrealty' in r['email'].lower()

noncb = [r for r in rows if not is_cb(r)]
# non-cb leaders
leaders = [r for r in noncb if r['title'] in ('Managing Broker', 'Broker Associate', 'Team Lead', 'Team lead / listing-active')]
print('noncb_leaders', len(leaders))
for r in leaders:
    print(r['name'], '|', r['email'], '|', r['title'], '|', r['brokerage'], '|', r['city'], r['state'], '|', r['icp_score'], '|', r['notes'][:70])
print()
# duplicate emails in hi set
hi = [r for r in noncb if r['icp_score'] == 'high' and r['email'].strip()]
dupes = [e for e, c in collections.Counter(r['email'].lower() for r in hi).items() if c > 1]
print('dupe_emails', dupes[:20], len(dupes))
# check non-remax.net emails in hi
print('non-remax.net in hi:', [r['email'] for r in hi if 'remax.net' not in r['email'].lower()][:20])
# medium non-cb with email
med = [r for r in noncb if r['icp_score'] == 'medium' and r['email'].strip()]
print('medium_noncb', len(med), collections.Counter(r['notes'][:40] for r in med).most_common(5))