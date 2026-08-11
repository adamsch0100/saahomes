import os
import sys
import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set")
    sys.exit(1)

conn = psycopg.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT id, email, name FROM users WHERE email = %s", ("adam@saahomes.com",))
u = cur.fetchone()
if not u:
    print("User not found")
    sys.exit(0)

print(f"User: {u[2]} ({u[1]}) — ID: {u[0]}")
print()

cur.execute(
    "SELECT id, address, created_at, html, run_dir FROM presentations WHERE user_id = %s ORDER BY created_at DESC",
    (u[0],),
)
rows = cur.fetchall()

print(f"Found {len(rows)} presentations:")
for p in rows:
    html = p[3] or ""
    has_new = "sectionsModal" in html and "match-badge" in html and "basemaps.cartocdn.com" in html
    marker = "OK " if has_new else "OLD"
    print(f"  [{marker}] {p[1]} — {p[2]} — run_dir={p[4]}")

conn.close()
