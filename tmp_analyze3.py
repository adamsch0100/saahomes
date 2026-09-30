import csv, collections, re
p = '/data/workspaces/listlogic/prospects/agents.csv'
rows = list(csv.DictReader(open(p, encoding='utf-8-sig')))

def is_cb(r):
    return 'cb_nationwide' in r['notes'] or 'cbrealty' in r['email'].lower()

noncb = [r for r in rows if not is_cb(r)]
hi = [r for r in noncb if r['icp_score'] == 'high' and r['email'].strip()]

# awards detail
named = [r for r in hi if 'awards:' in r['notes']]
print('with_named_awards', len(named))
print(collections.Counter(re.search(r'awards: (.*)', r['notes']).group(1).strip() for r in named).most_common(20))
print()
print('active_producer', sum(1 for r in hi if 'active producer' in r['notes']))
print('club', sum(1 for r in hi if 'production club member' in r['notes']))
print()
# states for active producers
ap = [r for r in hi if 'active producer' in r['notes']]
print('AP by state', collections.Counter(r['state'] for r in ap).most_common())
# full sample of notes
for r in hi[:5]:
    print(r['name'], '||', r['notes'])