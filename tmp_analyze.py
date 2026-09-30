import csv, collections
p = '/data/workspaces/listlogic/prospects/agents.csv'
rows = list(csv.DictReader(open(p, encoding='utf-8-sig')))
print('total', len(rows))
print('cols', list(rows[0].keys()))
for f in ['icp_score', 'consent_sms', 'dnc', 'last_touch', 'title', 'state']:
    c = collections.Counter(r[f] for r in rows)
    print(f, dict(c.most_common(12)))
print('has_email', sum(1 for r in rows if r.get('email', '').strip()))
n = collections.Counter(r['notes'][:45] for r in rows)
print('NOTES', n.most_common(15))