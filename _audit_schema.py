import sys, json, re
html = sys.stdin.read()

schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
print(f'Found {len(schemas)} schema blocks')
for i, s in enumerate(schemas):
    try:
        data = json.loads(s.strip())
        if isinstance(data, dict):
            t = data.get('@type', 'unknown')
            print(f'  Schema {i+1}: @type={t}')
            if t == 'RealEstateAgent':
                print(f'    name: {data.get("name")}')
                if 'areaServed' in data:
                    served = data['areaServed']
                    print(f'    areaServed type: {served.get("@type") if isinstance(served, dict) else "list"}')
                    if isinstance(served, dict):
                        print(f'    areaServed name: {served.get("name")}')
            if t == 'WebPage':
                print(f'    name: {data.get("name")}')
                print(f'    description: {str(data.get("description",""))[:100]}')
                if 'mainEntity' in data:
                    me = data['mainEntity']
                    print(f'    mainEntity type: {me.get("@type") if isinstance(me, dict) else "list"}')
            if t == 'BreadcrumbList':
                items = data.get('itemListElement', [])
                print(f'    items: {len(items)}')
                for item in items:
                    it = item.get('item', {})
                    print(f'      {item.get("position")}: {it.get("name","")} -> {it.get("@id","")}')
            if t == 'FAQPage':
                qs = data.get('mainEntity', [])
                print(f'    questions: {len(qs)}')
                for q in qs[:3]:
                    print(f'      Q: {str(q.get("name",""))[:80]}')
        elif isinstance(data, list):
            print(f'  Schema {i+1}: @graph list ({len(data)} items)')
            for item in data[:3]:
                print(f'    - {item.get("@type","")}')
    except Exception as e:
        print(f'  Schema {i+1}: parse error: {e}')
        print(f'    raw: {s[:200]}')
