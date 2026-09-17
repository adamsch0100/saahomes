#!/usr/bin/env python3
"""Verify youtubeId placement in neighborhoods.js (top-level only)."""
import re, sys, subprocess

PATH = "src/data/neighborhoods.js"
src = open(PATH).read()

# String-aware brace scan to isolate each top-level object
start = src.find("export const neighborhoods = [")
assert start != -1, "array not found"
i = src.find("[", start)
depth = 0
in_str = False
str_char = None
objs = []  # (start,end) of each top-level object IN the array
obj_start = None
j = i
while j < len(src):
    ch = src[j]
    prev = src[j-1] if j > 0 else ""
    if in_str:
        if ch == str_char and prev != "\\":
            in_str = False
    else:
        if ch in ("'", '"'):
            in_str = True
            str_char = ch
        elif ch == "{":
            if depth == 0:
                obj_start = j
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and obj_start is not None:
                objs.append((obj_start, j + 1))
                obj_start = None
    j += 1

targets = ["wellington-crossing", "wellington-village", "gardens-wellington"]
ok = True
for slug in targets:
    block = None
    for (s, e) in objs:
        if re.search(rf"slug:\s*'{slug}'", src[s:e]):
            block = src[s:e]
            break
    if block is None:
        print(f"FAIL: {slug} — object not found")
        ok = False
        continue
    # youtubeId occurrences with their depth inside the object
    ids = [(m.start(), m.group(1)) for m in re.finditer(r"youtubeId:\s*'([^']+)'", block)]
    # depth of a position: count braces before it (string-aware)
    def depth_at(pos):
        d = 0
        ins = False
        sc = None
        for k in range(pos):
            ch = block[k]
            p = block[k-1] if k > 0 else ""
            if ins:
                if ch == sc and p != "\\":
                    ins = False
            else:
                if ch in ("'", '"'):
                    ins = True
                    sc = ch
                elif ch == "{":
                    d += 1
                elif ch == "}":
                    d -= 1
        return d
    if not ids:
        print(f"FAIL: {slug} — no youtubeId found")
        ok = False
        continue
    depth1 = [depth_at(pos) for (pos, vid) in ids if depth_at(pos) == 1]
    if not depth1:
        print(f"FAIL: {slug} — youtubeId NOT at top level (depths: {[depth_at(p) for p, v in ids]})")
        ok = False
        continue
    vid = ids[0][1]
    # confirm keywords line precedes it and neighborhoodHighlights follows at top level
    kw = re.search(r"keywords:\s*'", block)
    nh = re.search(r"neighborhoodHighlights:\s*\[", block)
    yp = ids[0][0]
    top_nh = depth_at(nh.start()) == 1
    print(f"OK: {slug} -> https://youtu.be/{vid} | after keywords: {kw is not None and kw.end() < yp} | nh follows & top-level: {nh is not None and nh.start() > yp and top_nh}")

print("\nSyntax check:", end=" ")
r = subprocess.run(["node", "--check", PATH], capture_output=True, text=True)
if r.returncode == 0:
    print("PASS (node --check clean)")
else:
    print("FAIL:", r.stderr[-500:])
    ok = False

sys.exit(0 if ok else 1)