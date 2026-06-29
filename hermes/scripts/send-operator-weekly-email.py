#!/usr/bin/env python3
"""Email Adam a day-by-day operator schedule for the week (social, outreach, leads)."""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def require_env(name: str) -> str:
    value = env(name)
    if not value:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def schedule_block(day: dict[str, Any]) -> str:
    day_name = esc(day.get("day", "Day"))
    date_label = esc(day.get("date", ""))
    priority = day.get("priority", "")
    badge = ""
    if priority == "high":
        badge = ' <span style="background:#dc2626;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;">ACTION REQUIRED</span>'
    elif priority == "optional":
        badge = ' <span style="background:#6b7280;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;">OPTIONAL</span>'

    tasks_html = "".join(
        f"<li style='margin-bottom:8px;'>{esc(task)}</li>"
        for task in day.get("tasks", [])
    )
    notes = day.get("notes")
    notes_html = f"<p style='color:#666;font-size:14px;margin:8px 0 0;'><em>{esc(notes)}</em></p>" if notes else ""

    return f"""
    <section style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
      <h2 style="margin:0 0 10px;font-size:17px;">{day_name}{f" — {date_label}" if date_label else ""}{badge}</h2>
      <ul style="margin:0;padding-left:20px;line-height:1.5;">{tasks_html}</ul>
      {notes_html}
    </section>
    """


def build_html(pack: dict[str, Any]) -> str:
    intro = esc(pack.get("intro", "Your weekly operator checklist from Hermes."))
    week_label = esc(pack.get("week_label", "This week"))

    schedule_html = "".join(schedule_block(day) for day in pack.get("schedule", []))

    pending = pack.get("pending_social_packs", [])
    pending_html = ""
    if pending:
        items = "".join(
            f"<li><a href='{esc(p.get('url', ''))}'>{esc(p.get('title', 'Post pack'))}</a> — post by {esc(p.get('post_by', 'ASAP'))}</li>"
            for p in pending
        )
        pending_html = f"""
        <section style="margin:24px 0;padding:16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;">
          <h2 style="margin:0 0 10px;font-size:17px;">⚠️ Pending social packs</h2>
          <ul style="margin:0;padding-left:20px;">{items}</ul>
        </section>
        """

    reminders = pack.get("standing_reminders", [])
    reminders_html = ""
    if reminders:
        items = "".join(f"<li>{esc(r)}</li>" for r in reminders)
        reminders_html = f"""
        <section style="margin:24px 0;">
          <h2 style="font-size:17px;">Standing reminders</h2>
          <ul style="line-height:1.6;">{items}</ul>
        </section>
        """

    return f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#111;max-width:720px;margin:0 auto;padding:16px;">
  <h1 style="font-size:22px;">📅 Your week — {week_label}</h1>
  <p>{intro}</p>
  <p><strong>Total time:</strong> ~30 min this week (social paste + optional outreach review)</p>
  {pending_html}
  <h2 style="font-size:18px;margin-top:24px;">Day-by-day schedule</h2>
  {schedule_html}
  {reminders_html}
  <hr />
  <p style="color:#666;font-size:13px;">Sent by SAA Homes Hermes. Social post packs arrive separately when content ships or every Wednesday.</p>
</body></html>"""


def send_email(pack: dict[str, Any]) -> None:
    host = require_env("OUTREACH_SMTP_HOST")
    user = require_env("OUTREACH_SMTP_USER")
    password = require_env("OUTREACH_SMTP_PASSWORD")
    to_addr = env("SOCIAL_POST_EMAIL_TO", user)
    from_addr = env("OUTREACH_SMTP_FROM", user)

    subject = pack.get("subject") or f"SAA Homes — Your week | {pack.get('week_label', 'Operator schedule')}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr

    plain_lines = [f"Your week — {pack.get('week_label', '')}", "", pack.get("intro", "")]
    for day in pack.get("schedule", []):
        plain_lines.append(f"\n{day.get('day', 'Day')} {day.get('date', '')}")
        for task in day.get("tasks", []):
            plain_lines.append(f"  • {task}")
    msg.attach(MIMEText("\n".join(plain_lines), "plain", "utf-8"))
    msg.attach(MIMEText(build_html(pack), "html", "utf-8"))

    with smtplib.SMTP(host, 587) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.sendmail(from_addr, [to_addr], msg.as_string())

    print(f"Sent operator weekly email to {to_addr}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Email Adam a weekly operator schedule")
    parser.add_argument("pack_json", help="Path to JSON schedule file")
    args = parser.parse_args()

    pack_path = Path(args.pack_json)
    if not pack_path.is_file():
        print(f"Schedule file not found: {pack_path}", file=sys.stderr)
        sys.exit(1)

    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    send_email(pack)


if __name__ == "__main__":
    main()
