"""Simple SMTP mailer for ListLogic lifecycle + feedback emails."""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger("ListLogic.mail")


def _smtp_config() -> Optional[dict]:
    host = (os.environ.get("SMTP_HOST") or os.environ.get("OUTREACH_SMTP_HOST") or "").strip()
    user = (os.environ.get("SMTP_USER") or os.environ.get("GMAIL_USER") or os.environ.get("OUTREACH_SMTP_USER") or "").strip()
    password = (
        os.environ.get("SMTP_PASSWORD")
        or os.environ.get("GMAIL_APP_PASSWORD")
        or os.environ.get("OUTREACH_SMTP_PASSWORD")
        or ""
    ).strip()
    if not host and user and "@gmail.com" in user.lower():
        host = "smtp.gmail.com"
    if not host or not user or not password:
        return None
    port = int(os.environ.get("SMTP_PORT") or os.environ.get("OUTREACH_SMTP_PORT") or "587")
    return {"host": host, "port": port, "user": user, "password": password}


def feedback_to() -> str:
    return (os.environ.get("FEEDBACK_TO") or os.environ.get("ADMIN_BOOTSTRAP_EMAIL") or "adam@saahomes.com").strip()


def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    reply_to: str = "",
    html: str = "",
    cc: str = "",
) -> bool:
    cfg = _smtp_config()
    if not cfg:
        logger.info("SMTP not configured — skip email to %s · %s", to, subject)
        return False
    msg = EmailMessage()
    msg["From"] = cfg["user"]
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as smtp:
            smtp.starttls()
            smtp.login(cfg["user"], cfg["password"])
            smtp.send_message(msg)
        logger.info("Email sent to %s · %s", to, subject)
        return True
    except Exception:
        logger.exception("Failed sending email to %s", to)
        return False


def send_team_invite(*, to: str, url: str, owner_name: str = "", brokerage: str = "") -> bool:
    who = (owner_name or "Your team").strip() or "Your team"
    office = (brokerage or "").strip()
    office_bit = f" at {office}" if office else ""
    body = (
        f"Hi,\n\n"
        f"{who}{office_bit} added you to ListLogic.\n\n"
        f"Open this link to join (expires in 30 minutes):\n\n"
        f"{url}\n\n"
        f"You'll share the brokerage seat plan — generate presentations with the same branding.\n\n"
        f"If you didn't expect this, you can ignore the email.\n\n"
        f"— ListLogic\n"
    )
    return send_email(to=to, subject="You're invited to ListLogic", body=body)


def send_magic_link(*, to: str, url: str, is_new: bool = False) -> bool:
    action = "Create your ListLogic account" if is_new else "Sign in to ListLogic"
    body = (
        f"Hi,\n\n"
        f"{action} with this one-time link (expires in 30 minutes):\n\n"
        f"{url}\n\n"
        f"Sample demo stays free. Setup is free. You only unlock when you Generate "
        f"(7-day trial then $39/mo, or $20 for one report).\n\n"
        f"If you didn't request this, you can ignore this email.\n\n"
        f"— ListLogic\n"
    )
    subject = "Your ListLogic sign-in link" if not is_new else "Your ListLogic account link"
    return send_email(to=to, subject=subject, body=body)


def send_welcome(user: dict, base_url: str) -> None:
    body = (
        f"Hi {user.get('name') or 'there'},\n\n"
        f"Welcome to ListLogic — your account is ready.\n\n"
        f"Sample demo (free): {base_url}/demo\n"
        f"App — build your market: {base_url}/saas/app.html\n\n"
        f"When you click Generate, unlock with a 7-day trial (card required, then $39/mo) "
        f"or $20 for that one report. Setup and the sample stay free.\n\n"
        f"Questions or bugs? Use Send feedback in the app, or reply to this email.\n\n"
        f"— ListLogic\n"
    )
    send_email(to=user["email"], subject="Welcome to ListLogic — build yours, unlock at Generate", body=body)
    send_email(
        to=feedback_to(),
        subject=f"ListLogic signup · {user.get('email')}",
        body=(
            f"New signup\n\n"
            f"Name: {user.get('name')}\n"
            f"Email: {user.get('email')}\n"
            f"Phone: {user.get('phone')}\n"
            f"Brokerage: {user.get('brokerage')}\n"
            f"Status: {user.get('status')}\n"
            f"Trial ends: {user.get('trial_ends_at')}\n"
            f"Presentation limit: {user.get('presentation_limit')}\n"
        ),
    )


def send_trial_reminder(user: dict, base_url: str) -> None:
    body = (
        f"Hi {user.get('name') or 'there'},\n\n"
        f"Your ListLogic promo/trial credits end on {user.get('trial_ends_at')}.\n"
        f"Presentations used: {user.get('presentations_used')} / {user.get('presentation_limit')}.\n\n"
        f"After that, unlock at Generate with a 7-day Stripe trial (then $39/mo) or $20 per report:\n"
        f"{base_url}/saas/pricing.html\n"
        f"App: {base_url}/saas/app.html\n\n"
        f"— ListLogic\n"
    )
    send_email(to=user["email"], subject="ListLogic promo access ending soon", body=body)


def send_trial_expired(user: dict, base_url: str) -> None:
    body = (
        f"Hi {user.get('name') or 'there'},\n\n"
        f"Your complimentary ListLogic credits have ended.\n\n"
        f"To generate the next custom presentation, unlock with a 7-day trial "
        f"(card required, then $39/mo) or buy one report for $20:\n"
        f"{base_url}/saas/pricing.html\n\n"
        f"Sample demo stays free anytime: {base_url}/demo\n"
        f"Or reply and we’ll get you set up.\n\n"
        f"— ListLogic\n"
    )
    send_email(to=user["email"], subject="Your ListLogic credits ended — unlock to keep going", body=body)


def send_last_report_notice(user: dict, base_url: str) -> bool:
    """Sent when a promo/credit user is down to their final presentation."""
    body = (
        f"Hi {user.get('name') or 'there'},\n\n"
        f"Quick heads-up: you have 1 complimentary presentation left.\n\n"
        f"After that, unlock with a 7-day trial (then $39/mo unlimited) or $20 per report:\n"
        f"{base_url}/saas/pricing.html?plan=agent_monthly\n"
        f"One-shot: {base_url}/saas/pricing.html?plan=one_time\n\n"
        f"— ListLogic\n"
    )
    return send_email(to=user["email"], subject="1 complimentary presentation left on ListLogic", body=body)


def send_reports_used_up(user: dict, base_url: str) -> bool:
    """Sent when a promo/credit user burns their last presentation."""
    used = user.get("presentation_limit") or user.get("presentations_used") or "your"
    body = (
        f"Hi {user.get('name') or 'there'},\n\n"
        f"You've used all {used} complimentary presentations — nice work putting them in front of sellers.\n\n"
        f"To generate the next one, unlock at Generate (takes about a minute):\n"
        f"  - 7-day trial then $39/mo unlimited — {base_url}/saas/pricing.html?plan=agent_monthly\n"
        f"  - Single report: $20 — {base_url}/saas/pricing.html?plan=one_time\n"
        f"  - Agent annual (2 months free): $390/yr — {base_url}/saas/pricing.html?plan=agent_annual\n\n"
        f"Your saved reports and share links keep working either way.\n\n"
        f"— ListLogic\n"
    )
    return send_email(to=user["email"], subject="Complimentary presentations used — unlock to keep going", body=body)


def send_feedback_notice(payload: dict) -> None:
    body = (
        f"Category: {payload.get('category')}\n"
        f"From: {payload.get('email')}\n"
        f"User id: {payload.get('user_id')}\n"
        f"Page: {payload.get('page_url')}\n\n"
        f"{payload.get('message')}\n"
    )
    send_email(
        to=feedback_to(),
        subject=f"ListLogic feedback · {payload.get('category')}",
        body=body,
        reply_to=payload.get("email") or "",
    )


def send_owner_digest(digest: dict) -> bool:
    """Weekly owner revenue + activity digest."""
    s = digest.get("stats") or {}
    b = digest.get("billing") or {}
    mix = b.get("plan_counts") or {}
    mix_lines = "\n".join(f"  - {k}: {v}" for k, v in mix.items()) or "  - none yet"
    past_due = digest.get("past_due") or []
    past_due_lines = "\n".join(f"  - {p.get('email')} ({p.get('plan_label') or p.get('plan') or 'plan'})" for p in past_due) or "  - none"
    new_users = digest.get("new_users") or []
    new_user_lines = "\n".join(f"  - {u.get('email')} · {u.get('brokerage') or '—'}" for u in new_users[:10]) or "  - none"
    actual = digest.get("stripe_actual") or {}
    actual_line = ""
    if actual:
        actual_line = (
            f"\nStripe actuals: MRR ${actual.get('mrr', 0):,.0f} · "
            f"active subs {actual.get('active_subs', 0)} · past due {actual.get('past_due', 0)}\n"
        )
    body = (
        f"ListLogic weekly digest\n"
        f"{'=' * 40}\n\n"
        f"REVENUE\n"
        f"  Paying subscribers: {b.get('paying', 0)}\n"
        f"  Est. MRR (list prices): ${b.get('mrr', 0):,.0f}\n"
        f"  Stripe customers: {b.get('with_stripe_customer', 0)}\n"
        f"  Plan mix:\n{mix_lines}\n"
        f"{actual_line}\n"
        f"NEEDS ATTENTION\n"
        f"  Past-due / failed payments:\n{past_due_lines}\n\n"
        f"ACTIVITY (7 days)\n"
        f"  New signups: {len(new_users)}\n{new_user_lines}\n"
        f"  Reports generated: {s.get('presentations_week', 0)} ({s.get('presentations_total', 0)} total)\n"
        f"  AI chats: {s.get('assistant_week', 0)} ({s.get('assistant_total', 0)} total)\n"
        f"  Feedback: {s.get('feedback_new', 0)} new · {s.get('feedback_open', 0)} open\n\n"
        f"USERS\n"
        f"  {s.get('users_total', 0)} total · {s.get('users_trial', 0)} trial · "
        f"{s.get('users_active', 0)} active · {s.get('users_expired', 0)} expired\n\n"
        f"Owner console: {digest.get('admin_url', '')}\n"
        f"— ListLogic\n"
    )
    return send_email(to=feedback_to(), subject=f"ListLogic weekly · ${b.get('mrr', 0):,.0f} MRR · {b.get('paying', 0)} paying", body=body)


def _money(n) -> str:
    try:
        return f"${int(round(float(n))):,}"
    except (TypeError, ValueError):
        return "—"


def _esc(text) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _pulse_card_html(card: dict) -> str:
    delta = int(card.get("delta") or 0)
    delta_txt = f"{delta:+,}" if delta else "at the list"
    bits = []
    if card.get("beds"):
        bits.append(f"{card.get('beds'):g} bd")
    if card.get("baths"):
        bits.append(f"{card.get('baths'):g} ba")
    if card.get("sqft"):
        bits.append(f"{int(card['sqft']):,} sf")
    if card.get("list_date"):
        bits.append(str(card["list_date"]))
    if card.get("dom"):
        bits.append(f"{int(card['dom'])} DOM")
    meta = " · ".join(bits)
    links = []
    if card.get("zillow"):
        links.append(f'<a href="{_esc(card["zillow"])}">Zillow</a>')
    if card.get("realtor"):
        links.append(f'<a href="{_esc(card["realtor"])}">Realtor.com</a>')
    return (
        f"<tr><td style='padding:10px 0;border-bottom:1px solid #eee'>"
        f"<strong>{_esc(card.get('address') or 'Listing')}</strong>"
        f"{' · ' + _esc(card.get('city')) if card.get('city') else ''}<br>"
        f"{_money(card.get('price'))} <span style='color:#5c6675'>({_esc(delta_txt)} vs lock)</span>"
        f"{' · ' + _esc(card.get('status')) if card.get('status') else ''}<br>"
        f"<span style='color:#5c6675;font-size:13px'>{_esc(meta)}</span>"
        f"{('<br>' + ' · '.join(links)) if links else ''}"
        f"</td></tr>"
    )


def _pulse_card_text(card: dict) -> str:
    delta = int(card.get("delta") or 0)
    line = f"- {card.get('address') or 'Listing'} · {_money(card.get('price'))} ({delta:+,} vs lock)"
    if card.get("zillow"):
        line += f"\n  {card['zillow']}"
    return line


def send_pulse_brief(
    *,
    to: str,
    brief: dict,
    audience: str = "agent",
    reply_to: str = "",
    cc: str = "",
    opt_out_url: str = "",
    agent_name: str = "",
) -> bool:
    """Weekly locked-list pulse — HTML + plaintext."""
    brief = brief if isinstance(brief, dict) else {}
    digest = brief.get("digest") or {}
    addr = brief.get("subject_address") or "Your listing"
    locked = _money(brief.get("locked_price") or digest.get("locked_price"))
    as_of = brief.get("as_of") or digest.get("as_of") or ""
    days = brief.get("days_locked") or 0
    market = brief.get("market_label") or ""
    report_url = brief.get("report_url") or brief.get("share_url") or ""
    share_url = brief.get("share_url") or report_url
    fingerprint_url = brief.get("fingerprint_url") or share_url
    tracks = (brief.get("talk") or {}).get("seller" if audience == "seller" else "agent") or []
    who = "Market Fingerprint" if audience == "seller" else "Weekly Market Fingerprint"
    subject = f"{who} · {addr} · {as_of}".strip(" ·")

    def section(title: str, cards: list) -> str:
        if not cards:
            return ""
        rows = "".join(_pulse_card_html(c) for c in cards[:12])
        return f"<h3 style='margin:22px 0 8px;font-size:16px'>{_esc(title)}</h3><table width='100%'>{rows}</table>"

    def section_text(title: str, cards: list) -> str:
        if not cards:
            return ""
        lines = "\n".join(_pulse_card_text(c) for c in cards[:12])
        return f"\n{title}\n{lines}\n"

    talk_html = "".join(f"<li>{_esc(t)}</li>" for t in tracks)
    talk_label = "What to tell them" if audience == "agent" else "This week in your market"
    score = (
        f"{int(digest.get('new_under') or 0)} new similar under · "
        f"{int(digest.get('new_over') or 0)} new similar over · "
        f"{int(digest.get('still_active_cheaper') or 0)} still-active cheaper"
    )
    stale = ""
    if brief.get("stale_upload"):
        stale = (
            "<p style='background:#fdf3e7;padding:10px 12px;border-radius:8px'>"
            "This update uses the last market file on hand. Upload a fresh MLS export to refresh."
            "</p>"
        )
    html = f"""<div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;color:#0b1220">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5c6675">{_esc(who)}</p>
  <h1 style="font-size:22px;margin:6px 0 8px">{_esc(addr)}</h1>
  <p style="color:#5c6675;margin:0 0 16px">Locked list {locked} · { _esc(market) } · as of {_esc(as_of)} · {int(days)} days since lock</p>
  <p style="font-size:16px;margin:0 0 16px"><strong>{_esc(score)}</strong></p>
  {stale}
  <h3 style="margin:18px 0 8px;font-size:16px">{_esc(talk_label)}</h3>
  <ul>{talk_html or '<li>Quiet week in the size band.</li>'}</ul>
  {section("New similar — under the list", brief.get("new_under") or [])}
  {section("New similar — over the list", brief.get("new_over") or [])}
  {section("Still active and cheaper", brief.get("cheaper_active") or [])}
  {section("Price cuts since last look", brief.get("price_cuts") or [])}
  {section("Status changes", brief.get("status_changes") or [])}
  {section("No longer in this pull", brief.get("gone") or [])}
  <p style="margin-top:24px"><a href="{_esc(fingerprint_url)}">Open the Market Fingerprint</a>
  {" · <a href='" + _esc(report_url) + "'>Live Story</a>" if report_url and report_url != fingerprint_url else ""}</p>
  <p style="font-size:12px;color:#5c6675;margin-top:28px">
    ListLogic Market Fingerprint for this listing only. Not a pricing recommendation.
    {(" · <a href='" + _esc(opt_out_url) + "'>Stop these emails</a>") if opt_out_url else ""}
    {(" · " + _esc(agent_name)) if agent_name else ""}
  </p>
</div>"""
    text = (
        f"{who}\n{addr}\nLocked list {locked} · {market} · as of {as_of}\n{score}\n\n"
        + "\n".join(f"- {t}" for t in tracks)
        + section_text("New similar — under", brief.get("new_under") or [])
        + section_text("New similar — over", brief.get("new_over") or [])
        + section_text("Still active and cheaper", brief.get("cheaper_active") or [])
        + section_text("Price cuts", brief.get("price_cuts") or [])
        + f"\nOpen Market Fingerprint: {fingerprint_url}\n"
        + (f"Stop: {opt_out_url}\n" if opt_out_url else "")
    )
    return send_email(
        to=to,
        cc=cc,
        subject=subject,
        body=text,
        html=html,
        reply_to=reply_to,
    )
