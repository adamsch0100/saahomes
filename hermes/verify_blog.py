import sys
html = sys.stdin.read()
# Check if our blog title is in there
if 'Market Update — June 2026' in html:
    print('✅ Blog title found in HTML')
else:
    print('❌ Blog title NOT found in HTML')
# Check excerpt
if 'home prices, inventory trends' in html:
    print('✅ Excerpt found')
else:
    print('❌ Excerpt NOT found')
# Check key city mentions
for city in ['Fort Collins', 'Loveland', 'Windsor', 'Greeley']:
    count = html.count(city)
    print(f'  {city} mentioned {count} times')
# Check CHFA mention
print(f'CHFA mentioned: {html.count("CHFA")} times')
print(f'Page length: {len(html)} bytes')
