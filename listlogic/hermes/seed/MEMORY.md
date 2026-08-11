# ListLogic Hermes memory

## Integration status

- [x] OpenCode Go — **routing lock:** flash daily · pro next · kimi-k3 super
- [ ] OpenCode China opt-in for DeepSeek V4 Flash/Pro — https://opencode.ai/workspace (Go settings). Until then daily standby = `mimo-v2.5`
- [x] Telegram bot (@ListLogicbot) — allowlist Adam `6320126021`
- [ ] GitHub PAT (listlogic deploy / auto PR)
- [ ] GSC for listlogic.homes
- [x] GA4 Measurement ID `G-WHGZQDZ6ZG` (website + Hermes)
- [x] Stripe live + webhook (product) — Generate-gated trial
- [ ] SMTP outreach (can reuse Gmail later)
- [ ] SMS 10DLC (opt-in only)
- [x] Railway service **ListLogic Hermes** in ListLogic project
- [x] Volume `/opt/data` · dashboard port 9119

## Monetization (locked 2026-08)

- No free custom presentations
- Public `/demo` free
- Signup status `setup` → unlock at Generate
- Stripe `agent_monthly` with `STRIPE_TRIAL_DAYS=7` + card always
- $20 one_time alternative

## Geography

Nationwide ICP. No NoCo-only beachhead.

## Ops notes

- Dashboard: https://listlogic-hermes-production.up.railway.app (basic auth)
- First boot: paste AGENTS.md checklist in Telegram after DM works
