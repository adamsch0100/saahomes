import csv, collections
p = '/data/workspaces/listlogic/prospects/agents.csv'
rows = list(csv.DictReader(open(p, encoding='utf-8-sig')))

def is_cb(r):
    return 'cb_nationwide' in r['notes'] or 'cbrealty' in r['email'].lower()

noncb = [r for r in rows if not is_cb(r)]
print('noncb_total', len(noncb))
print('noncb_with_email', sum(1 for r in noncb if r['email'].strip()))
print('noncb_high', sum(1 for r in noncb if r['icp_score'] == 'high'))
print('noncb_by_note', collections.Counter(r['notes'][:40] for r in noncb).most_common(10))
print()
# high ICP non-cb, with email
hi = [r for r in noncb if r['icp_score'] == 'high' and r['email'].strip()]
print('high_noncb_withemail', len(hi))
print('by brokerage:', collections.Counter(r['brokerage'] for r in hi).most_common(20))
print('by state:', collections.Counter(r['state'] for r in hi).most_common(15))
print('titles:', collections.Counter(r['title'] for r in hi).most_common(10))
print()
for r in hi[:15]:
    print(r['name'], '|', r['email'], '|', r['brokerage'], '|', r['city'], r['state'], '|', r['title'], '|', r['notes'][:60])