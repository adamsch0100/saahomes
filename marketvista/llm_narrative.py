"""
ListLogic – LLM Narrative Layer

Wires to OpenCode Go (preferred), OpenRouter, or OpenAI when keys are present;
otherwise falls back to template narratives in core.py.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional
from pathlib import Path


OPENCODE_GO_API_URL = "https://opencode.ai/zen/go/v1/chat/completions"
OPENCODE_DEFAULT_MODEL = "deepseek-v4-flash"


def _load_env_file() -> None:
    """Load marketvista/.env into os.environ (does not override existing vars)."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and not os.environ.get(key):
                os.environ[key] = val
    except Exception:
        pass


SYSTEM_PROMPT = """You are an expert real estate advisor helping a listing agent prepare a clear, confident market presentation for a home seller.

Your goals:
1. Make the seller smarter about the market in under 60 seconds of reading.
2. Directly address the two big seller fears: leaving money on the table, and sitting on the market too long.
3. Support the agent's recommended list price with clear reasoning.
4. Use calm, professional, consultative language — never salesy or hype.
5. Be specific with the numbers provided. Do not invent data.
6. Keep paragraphs short and scannable.

Tone: experienced, calm, direct, helpful. Like a top-producing agent who is also a trusted advisor.
"""


def build_market_prompt(stats: dict, area_name: str) -> str:
    return f"""Write a concise Market Snapshot narrative for a seller presentation.

Area: {area_name}
Closed sales analyzed: {stats.get('sold_count')}
Months analyzed: {stats.get('months_analyzed')}
Absorption rate (sales/month): {stats.get('absorption_rate')}
Months of inventory: {stats.get('months_of_inventory')}
Odds of selling (monthly): {stats.get('odds_of_selling')}
Median sold price: ${stats.get('median_sold_price') or 0:,.0f}
Typical price range (25-75%): ${stats.get('price_range_25_75', [0,0])[0]:,.0f} – ${stats.get('price_range_25_75', [0,0])[1]:,.0f}
Median price per sqft: ${stats.get('median_price_per_sqft') or 0:.0f}
Median days on market: {stats.get('median_dom')}

Structure:
- 1 short opening on market temperature
- Key numbers in plain English
- What this means for sellers right now
- End with the principle that realistic pricing creates better outcomes

Keep it under 180 words. Use **bold** for key numbers.
"""


def build_subject_prompt(
    stats: dict,
    subject: dict,
    positioning: dict,
) -> str:
    comps = positioning.get("closest_comps", [])[:3]
    comp_lines = []
    for c in comps:
        comp_lines.append(
            f"- {c.get('address')}: sold ${c.get('sold_price') or 0:,.0f}, {c.get('living_area') or 0:.0f} sqft, "
            f"{c.get('year_built')}, {c.get('dom') or 0:.0f} DOM"
        )
    comps_text = "\n".join(comp_lines) if comp_lines else "No close comps listed."

    return f"""Write the "Your Home in This Market" section for a seller presentation.

Subject property:
- Address: {subject.get('address')}
- Living area: {subject.get('living_area')} sqft
- Beds/Baths: {subject.get('beds')} / {subject.get('baths')}
- Year built: {subject.get('year_built')}
- Current list price (if any): {subject.get('list_price')}
- Condition note: {subject.get('condition', 'average')}

Market context:
- Months of inventory: {stats.get('months_of_inventory')}
- Absorption: {stats.get('absorption_rate')} sales/month
- Odds of selling: {stats.get('odds_of_selling')}

Positioning results:
- Recommended list price: ${positioning.get('recommended_price') or 0:,.0f}
- Competitive range: ${positioning.get('price_low') or 0:,.0f} – ${positioning.get('price_high') or 0:,.0f}
- Expected days to contract: {positioning.get('expected_dom')}

Closest comparable sales:
{comps_text}

Advantages: {positioning.get('advantages')}
Risks: {positioning.get('risks')}

Requirements:
- Start with a brief market context tied to this home
- Clearly state the recommended price and range
- Reference the closest sales naturally
- Directly address the fear of overpricing vs underpricing
- End with a clear bottom line for the seller
- Under 220 words
- Use **bold** for the key price numbers
"""


def build_executive_prompt(stats: dict, subject: dict, positioning: dict) -> str:
    return f"""Write a single tight paragraph (max 70 words) that is the "Bottom Line" for a seller.

It must include:
- Market temperature (seller-favorable / balanced / etc.) based on {stats.get('months_of_inventory')} months of inventory
- The recommended list price ${positioning.get('recommended_price') or 0:,.0f}
- The competitive range ${positioning.get('price_low') or 0:,.0f}–${positioning.get('price_high') or 0:,.0f}
- Expected ~{positioning.get('expected_dom')} days to contract
- The principle that launching inside the competitive range produces the best outcomes

No fluff. One paragraph only.
"""


def build_sensitivity_prompt(stats: dict, scenarios: list, recommended: float) -> str:
    lines = []
    for sc in scenarios:
        lines.append(
            f"- {sc['label']}: ${sc['list_price']:,.0f} → ~{sc['expected_dom']:.0f} days, "
            f"{sc['odds_30_day']*100:.0f}% 30-day odds"
        )
    return f"""Write a short Price Strategy narrative (max 120 words) for a seller.

Recommended price: ${recommended:,.0f}
Current inventory: {stats.get('months_of_inventory')} months
Absorption: {stats.get('absorption_rate')} sales/month

Scenarios:
{chr(10).join(lines)}

Explain the trade-off clearly: lower price = faster sale + higher odds; higher price = more days + lower probability.
Recommend the balanced approach for most sellers.
End with the cost of starting too high.
"""


def build_seller_story_prompt(
    stats: dict,
    subject: dict,
    positioning: dict,
    story: dict,
    area_name: str,
) -> str:
    comps = positioning.get("closest_comps", [])[:4]
    comp_lines = []
    for c in comps:
        comp_lines.append(
            f"- {c.get('address')}: sold ${c.get('sold_price') or 0:,.0f}, "
            f"{c.get('living_area') or 0:.0f} sqft, {c.get('dom') or 0:.0f} DOM"
        )
    comps_text = "\n".join(comp_lines) if comp_lines else "No close comps listed."
    ask = story.get("seller_questions") or {}
    bands = story.get("band_insight") or ""
    active_n = story.get("active_on_market", stats.get("active_count"))
    with_yours = story.get("with_your_home", (active_n or 0) + 1)

    return f"""Write the seller-facing story for a listing appointment (shown to the seller on screen and in the leave-behind PDF).

Area: {area_name}
Subject: {subject.get('address')}
Living area: {subject.get('living_area')} sqft · Beds/Baths: {subject.get('beds')}/{subject.get('baths')} · Year: {subject.get('year_built')}
Home rating (condition): {story.get('home_rating', 5)}/10 — {story.get('home_rating_label', 'typical')}

Market:
- Active on market: {active_n} (with yours: {with_yours})
- Months of inventory: {stats.get('months_of_inventory')} (Active only)
- Sales/month: {stats.get('absorption_rate')}
- 30-day odds when well priced: {stats.get('odds_of_selling')}
- Median DOM: {stats.get('median_dom')} days
- Median sold: ${stats.get('median_sold_price') or 0:,.0f}

Positioning (from engine — do not change these numbers):
- Recommended list: ${positioning.get('recommended_price') or 0:,.0f}
- Competitive range: ${positioning.get('price_low') or 0:,.0f} – ${positioning.get('price_high') or 0:,.0f}
- Expected DOM: ~{positioning.get('expected_dom')} days
- Market position: {story.get('top_percent_statement') or 'n/a'}

Closest sales:
{comps_text}

Active price-band insight: {bands or 'n/a'}
Seller questions context: {ask}

Template advantages (refine, don't invent new facts): {positioning.get('advantages')}
Template watch-outs (refine): {positioning.get('risks')}

Return ONLY JSON (no markdown fences):
{{
  "bottom_line": "One paragraph max 70 words. Market temperature, recommended list, range, expected DOM, launch inside range.",
  "advantages": ["3-5 short bullets — specific to this home vs comps/market"],
  "watch_outs": ["2-4 short bullets — honest risks (overpricing, competition, condition)"]
}}

Rules:
- Use only numbers provided above
- Calm consultative tone — never hype
- Advantages and watch-outs are short phrases (not paragraphs)
"""


def build_coach_prompt(stats: dict, subject: dict, positioning: dict, story: dict) -> str:
    ask = story.get("seller_questions") or {}
    bands = story.get("band_insight") or ""
    return f"""Write 3 private coach notes for the listing agent (NOT shown to the seller unless the agent chooses).

Subject: {subject.get('address')}
Recommended list: ${positioning.get('recommended_price') or 0:,.0f}
Range: ${positioning.get('price_low') or 0:,.0f}–${positioning.get('price_high') or 0:,.0f}
Months of inventory: {stats.get('months_of_inventory')}
30-day odds: {stats.get('odds_of_selling')}
Active competition insight: {bands or 'n/a'}
Seller Q context: {ask}

Return ONLY a JSON array of exactly 3 objects:
[{{"title":"...","body":"..."}}]

Rules:
- Titles ≤ 4 words
- Body 1–2 sentences, use the real numbers
- Cover: inventory pressure, overpricing risk, and condition/presentation leverage
- No markdown fences
"""


def _parse_json_from_llm(raw: str) -> Any:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


class NarrativeEngine:
    """
    Narrative generation engine.

    Usage:
        engine = NarrativeEngine.auto()               # OpenCode Go → OpenRouter → OpenAI
        engine = NarrativeEngine(provider="opencode-go")
        engine = NarrativeEngine()                    # templates only
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        client=None,
        model: Optional[str] = None,
    ):
        self.provider = provider
        self.client = client
        self.model = model or OPENCODE_DEFAULT_MODEL
        self._llm_available = False
        self._opencode_key: Optional[str] = None

        if client is not None:
            self._llm_available = True
            return

        default_model = os.getenv("LISTLOGIC_LLM_MODEL") or OPENCODE_DEFAULT_MODEL

        if provider == "opencode-go" and os.getenv("OPENCODE_GO_API_KEY"):
            self._init_opencode(os.getenv("OPENCODE_GO_API_KEY"), model or default_model)
        elif provider == "openai" and os.getenv("OPENAI_API_KEY"):
            self._init_openai(os.getenv("OPENAI_API_KEY"), None, model or "gpt-4o-mini")
        elif provider == "openrouter" and os.getenv("OPENROUTER_API_KEY"):
            self._init_openai(
                os.getenv("OPENROUTER_API_KEY"),
                "https://openrouter.ai/api/v1",
                model or default_model,
            )

    @classmethod
    def auto(cls) -> "NarrativeEngine":
        """Prefer OpenCode Go, then OpenRouter, then OpenAI."""
        _load_env_file()
        if os.getenv("OPENCODE_GO_API_KEY"):
            return cls(provider="opencode-go")
        if os.getenv("OPENROUTER_API_KEY"):
            return cls(provider="openrouter")
        if os.getenv("OPENAI_API_KEY"):
            return cls(provider="openai")
        return cls()

    def _init_opencode(self, api_key: str, model: str) -> None:
        self._opencode_key = api_key.strip()
        self.model = model
        self.provider = "opencode-go"
        self._llm_available = bool(self._opencode_key)

    def _init_openai(self, api_key: str, base_url: Optional[str], model: str) -> None:
        try:
            from openai import OpenAI
            kwargs: dict[str, Any] = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            self.client = OpenAI(**kwargs)
            self.model = model
            self._llm_available = True
        except Exception as exc:
            print(f"[LLM] client init failed: {exc}")
            self._llm_available = False

    def _call_llm(self, user_prompt: str, max_tokens: int = 600) -> Optional[str]:
        if not self._llm_available:
            return None

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        if self._opencode_key:
            try:
                import json as _json
                import urllib.request

                payload = _json.dumps({
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": max_tokens,
                }).encode("utf-8")
                req = urllib.request.Request(
                    OPENCODE_GO_API_URL,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self._opencode_key}",
                        "User-Agent": "ListLogic/1.0",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=90) as resp:
                    data = _json.loads(resp.read().decode("utf-8"))
                return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            except Exception as e:
                print(f"[LLM] OpenCode Go call failed, falling back to template: {e}")
                return None

        if self.client is None:
            return None
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.4,
                max_tokens=max_tokens,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[LLM] call failed, falling back to template: {e}")
            return None

    def market_narrative(self, stats: dict, area_name: str, fallback: str) -> str:
        result = self._call_llm(build_market_prompt(stats, area_name))
        return result or fallback

    def subject_narrative(self, stats: dict, subject: dict, positioning: dict, fallback: str) -> str:
        result = self._call_llm(build_subject_prompt(stats, subject, positioning))
        return result or fallback

    def executive_summary(self, stats: dict, subject: dict, positioning: dict, fallback: str) -> str:
        result = self._call_llm(build_executive_prompt(stats, subject, positioning), max_tokens=220)
        return result or fallback

    def sensitivity_narrative(self, stats: dict, scenarios: list, recommended: float, fallback: str) -> str:
        result = self._call_llm(build_sensitivity_prompt(stats, scenarios, recommended), max_tokens=320)
        return result or fallback

    def seller_story(
        self,
        stats: dict,
        subject: dict,
        positioning: dict,
        story: dict,
        area_name: str,
        fallback: dict,
    ) -> dict:
        """Seller-facing bottom line + advantages + watch-outs (one LLM pass)."""
        raw = self._call_llm(
            build_seller_story_prompt(stats, subject, positioning, story, area_name),
            max_tokens=1000,
        )
        if not raw:
            return fallback
        try:
            data = _parse_json_from_llm(raw)
            if not isinstance(data, dict):
                return fallback
            bottom = str(data.get("bottom_line") or "").strip()
            adv = data.get("advantages") or []
            risks = data.get("watch_outs") or data.get("watch-outs") or data.get("risks") or []
            adv_list = [str(a).strip() for a in adv if str(a).strip()][:6]
            risk_list = [str(r).strip() for r in risks if str(r).strip()][:5]
            if not bottom and not adv_list and not risk_list:
                return fallback
            return {
                "bottom_line": bottom or fallback.get("bottom_line") or "",
                "advantages": adv_list or fallback.get("advantages") or [],
                "watch_outs": risk_list or fallback.get("watch_outs") or [],
            }
        except Exception:
            return fallback

    def coach_notes(
        self,
        stats: dict,
        subject: dict,
        positioning: dict,
        story: dict,
        fallback: list[dict],
    ) -> list[dict]:
        raw = self._call_llm(
            build_coach_prompt(stats, subject, positioning, story),
            max_tokens=500,
        )
        if not raw:
            return fallback
        try:
            data = _parse_json_from_llm(raw)
            out = []
            for item in data[:3]:
                title = str(item.get("title") or "").strip()
                body = str(item.get("body") or "").strip()
                if title and body:
                    out.append({"title": title, "body": body})
            return out or fallback
        except Exception:
            return fallback


def apply_seller_story_to_report(report: dict, story_payload: dict) -> dict:
    """Merge seller-story LLM output into report dict."""
    pos = report.get("positioning") or {}
    if story_payload.get("bottom_line"):
        report["executive_summary"] = story_payload["bottom_line"]
    if story_payload.get("advantages"):
        pos["advantages"] = story_payload["advantages"]
    if story_payload.get("watch_outs"):
        pos["risks"] = story_payload["watch_outs"]
    report["positioning"] = pos
    return report


def apply_coach_notes_to_report(report: dict, cards: list[dict]) -> dict:
    story = report.get("story") or {}
    story["objection_cards"] = cards
    report["story"] = story
    return report


def enhance_report_with_llm(report: dict, engine: Optional[NarrativeEngine] = None) -> dict:
    """
    Optionally replace narratives with LLM versions.
    Safe when no LLM is configured (returns original + llm_enhanced=False).
    """
    if engine is None:
        engine = NarrativeEngine.auto()

    stats = report.get("stats") or {}
    subject = report.get("subject") or {}
    pos = report.get("positioning") or {}
    story = report.get("story") or {}
    area = report.get("area", "Market Area")
    band_insight = (report.get("chart_active_price_bands") or {}).get("insight") or ""
    story_ctx = dict(story)
    story_ctx["band_insight"] = band_insight

    # Priority 1: seller-facing story (bottom line + advantages + watch-outs)
    if pos:
        try:
            seller_fb = {
                "bottom_line": report.get("executive_summary") or "",
                "advantages": pos.get("advantages") or [],
                "watch_outs": pos.get("risks") or [],
            }
            seller_result = engine.seller_story(
                stats, subject, pos, story_ctx, area, seller_fb
            )
            report = apply_seller_story_to_report(report, seller_result)
            pos = report.get("positioning") or {}
        except Exception as exc:
            print(f"[LLM] seller story skipped: {exc}")

    # Priority 2: private coach notes
    if story.get("objection_cards") is not None:
        try:
            cards = engine.coach_notes(
                stats, subject, pos, story_ctx, story.get("objection_cards") or []
            )
            report = apply_coach_notes_to_report(report, cards)
        except Exception as exc:
            print(f"[LLM] coach notes skipped: {exc}")

    # Optional long-form narratives (PDF / legacy) — skip when LLM budget is tight
    if os.getenv("LISTLOGIC_LLM_FULL", "").lower() in {"1", "true", "yes", "on"}:
        if report.get("market_narrative"):
            report["market_narrative"] = engine.market_narrative(
                stats, area, report["market_narrative"]
            )
        if pos:
            if pos.get("narrative"):
                pos["narrative"] = engine.subject_narrative(
                    stats, subject, pos, pos["narrative"]
                )
            if pos.get("price_sensitivity_narrative") and pos.get("price_scenarios"):
                pos["price_sensitivity_narrative"] = engine.sensitivity_narrative(
                    stats,
                    pos["price_scenarios"],
                    pos.get("recommended_price", 0),
                    pos["price_sensitivity_narrative"],
                )
            report["positioning"] = pos

    report["llm_enhanced"] = bool(engine._llm_available)
    report["llm_provider"] = engine.provider or ("custom" if engine.client else None)
    return report


def regenerate_seller_story(report: dict, engine: Optional[NarrativeEngine] = None) -> dict:
    """Regenerate only seller-facing story fields."""
    if engine is None:
        engine = NarrativeEngine.auto()
    stats = report.get("stats") or {}
    subject = report.get("subject") or {}
    pos = report.get("positioning") or {}
    story = report.get("story") or {}
    area = report.get("area", "Market Area")
    story_ctx = dict(story)
    story_ctx["band_insight"] = (report.get("chart_active_price_bands") or {}).get("insight") or ""
    fallback = {
        "bottom_line": report.get("executive_summary") or "",
        "advantages": pos.get("advantages") or [],
        "watch_outs": pos.get("risks") or [],
    }
    result = engine.seller_story(stats, subject, pos, story_ctx, area, fallback)
    report = apply_seller_story_to_report(report, result)
    report["llm_enhanced"] = bool(engine._llm_available)
    report["llm_provider"] = engine.provider or ("custom" if engine.client else None)
    return report


def regenerate_coach_notes(report: dict, engine: Optional[NarrativeEngine] = None) -> dict:
    """Regenerate only private coach notes."""
    if engine is None:
        engine = NarrativeEngine.auto()
    stats = report.get("stats") or {}
    subject = report.get("subject") or {}
    pos = report.get("positioning") or {}
    story = report.get("story") or {}
    story_ctx = dict(story)
    story_ctx["band_insight"] = (report.get("chart_active_price_bands") or {}).get("insight") or ""
    cards = engine.coach_notes(
        stats, subject, pos, story_ctx, story.get("objection_cards") or []
    )
    report = apply_coach_notes_to_report(report, cards)
    report["llm_enhanced"] = bool(engine._llm_available)
    report["llm_provider"] = engine.provider or ("custom" if engine.client else None)
    return report
