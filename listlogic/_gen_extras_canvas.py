"""Generate portal-extras-review.canvas.tsx with embedded data."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "output" / "portal_extras_canvas_data.json"
OUT = Path(r"C:\Users\adamm\.cursor\projects\c-Users-adamm-Projects-saahomes\canvases\portal-extras-review.canvas.tsx")

data = DATA_PATH.read_text(encoding="utf-8")

content = f'''import {{
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
}} from "cursor/canvas";

const DATA = {data} as const;

function money(n: number | null | undefined) {{
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}}

function num(n: number | null | undefined) {{
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}}

export default function PortalExtrasReview() {{
  const [q, setQ] = useCanvasState("q", "");
  const [flag, setFlag] = useCanvasState("flag", "all");

  const rows = DATA.rows.filter((r) => {{
    const hay = (r.address + " " + r.flags).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (flag === "no-gar" && !r.flags.includes("no-gar")) return false;
    if (flag === "sqft<1800" && !r.flags.includes("sqft<1800")) return false;
    if (flag === "sqft<2000" && !r.flags.includes("sqft<2000")) return false;
    if (flag === "<350k" && !r.flags.includes("<350k")) return false;
    if (flag === "pre-1960" && !r.flags.includes("pre-1960")) return false;
    if (flag === "clean" && r.flags.length > 0) return false;
    return true;
  }});

  return (
    <Stack gap={{20}}>
      <Stack gap={{6}}>
        <H1>Portal-only extras vs Matrix</H1>
        <Text tone="secondary">
          House/detached · 3+ beds · 2+ baths · 1,600–2,800 sqft · same Greeley farm map hull.
          These solds are on Realtor but not in your Matrix export — scan for the filter we should mirror.
        </Text>
      </Stack>

      <Grid columns={{4}} gap={{12}}>
        <Stat value={{String(DATA.counts.matrix_sold)}} label="Matrix solds" />
        <Stat value={{String(DATA.counts.portal_sold)}} label="Portal solds" />
        <Stat value={{String(DATA.counts.matched)}} label="Matched" tone="success" />
        <Stat value={{String(DATA.counts.portal_only)}} label="Portal-only extras" tone="warning" />
      </Grid>

      <Callout tone="info" title="Medians: extras vs matched">
        Extras med price {{money(DATA.extras_m.price)}} / sqft {{num(DATA.extras_m.sqft)}} / year {{num(DATA.extras_m.year)}}
        {{" · "}}
        Matched med price {{money(DATA.matched_m.price)}} / sqft {{num(DATA.matched_m.sqft)}} / year {{num(DATA.matched_m.year)}}.
        Price is close — extras still inflate sold count and absorption.
      </Callout>

      <Card>
        <CardHeader>Filter extras</CardHeader>
        <CardBody>
          <Row gap={{12}} wrap>
            <TextInput value={{q}} onChange={{setQ}} placeholder="Search address…" style={{{{ minWidth: 220 }}}} />
            <Select
              value={{flag}}
              onChange={{setFlag}}
              options={{[
                {{ value: "all", label: "All extras" }},
                {{ value: "clean", label: "No flags (hardest to explain)" }},
                {{ value: "no-gar", label: "Garage missing" }},
                {{ value: "sqft<1800", label: "Sqft under 1,800" }},
                {{ value: "sqft<2000", label: "Sqft under 2,000" }},
                {{ value: "<350k", label: "Sold under $350k" }},
                {{ value: "pre-1960", label: "Built before 1960" }},
              ]}}
            />
            <Pill tone="neutral">{{rows.length}} shown</Pill>
          </Row>
        </CardBody>
      </Card>

      <Stack gap={{8}}>
        <H2>Portal-only solds ({{rows.length}})</H2>
        <Text tone="secondary" size="small">
          Source: Realtor via ReefAPI vs Matrix export-71. Full CSV also has Realtor URLs.
        </Text>
        <Table
          stickyHeader
          columns={{[
            {{ id: "address", header: "Address", sortable: true }},
            {{ id: "beds", header: "Bd", align: "right", sortable: true }},
            {{ id: "baths", header: "Ba", align: "right", sortable: true }},
            {{ id: "sqft", header: "Sqft", align: "right", sortable: true }},
            {{ id: "price", header: "Sold", align: "right", sortable: true }},
            {{ id: "sold", header: "Sold date", sortable: true }},
            {{ id: "year", header: "Year", align: "right", sortable: true }},
            {{ id: "gar", header: "Gar", align: "right", sortable: true }},
            {{ id: "lot", header: "Lot", align: "right", sortable: true }},
            {{ id: "flags", header: "Flags", sortable: true }},
          ]}}
          rows={{rows.map((r) => ({{
            id: r.address + r.sold,
            address: r.address,
            beds: r.beds ?? "—",
            baths: r.baths ?? "—",
            sqft: r.sqft != null ? r.sqft.toLocaleString("en-US") : "—",
            price: money(r.price),
            sold: r.sold || "—",
            year: r.year ?? "—",
            gar: r.gar ?? "—",
            lot: r.lot != null ? r.lot.toLocaleString("en-US") : "—",
            flags: r.flags || "—",
          }}))}}
        />
      </Stack>

      <Divider />

      <Stack gap={{8}}>
        <H2>Matrix-only sample (portal missed)</H2>
        <Text tone="secondary">
          In your Matrix pull but not matched on Realtor — includes Style + GarType (MLS-only fields).
        </Text>
        <Table
          stickyHeader
          columns={{[
            {{ id: "address", header: "Address", sortable: true }},
            {{ id: "style", header: "Style", sortable: true }},
            {{ id: "garType", header: "Gar type", sortable: true }},
            {{ id: "sub", header: "Subdivision", sortable: true }},
            {{ id: "beds", header: "Bd", align: "right" }},
            {{ id: "baths", header: "Ba", align: "right" }},
            {{ id: "sqft", header: "Sqft", align: "right", sortable: true }},
            {{ id: "price", header: "Sold", align: "right", sortable: true }},
            {{ id: "year", header: "Year", align: "right" }},
          ]}}
          rows={{DATA.matrix_only.map((r) => ({{
            id: r.address,
            address: r.address,
            style: r.style || "—",
            garType: r.garType || "—",
            sub: r.sub || "—",
            beds: r.beds ?? "—",
            baths: r.baths ?? "—",
            sqft: r.sqft != null ? r.sqft.toLocaleString("en-US") : "—",
            price: money(r.price),
            year: r.year ?? "—",
          }}))}}
        />
      </Stack>

      <Callout tone="warning" title="What to look for">
        Extras look like real detached houses in-band — not condos. Many are missing garage on the portal card,
        and a chunk are under 1,800–2,000 sqft. If Matrix also required Attached garage and/or a tighter
        style/area filter, that is the remaining design lever.
      </Callout>
    </Stack>
  );
}}
'''

OUT.write_text(content, encoding="utf-8")
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
