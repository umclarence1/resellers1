# Cloudflare Hardening — topdealsgh

## DNS and proxy

1. Point `api.yourdomain.com` (backend) and `yourdomain.com` (frontend) to Vercel.
2. Enable **orange-cloud proxy** on API and app hostnames.
3. Set SSL/TLS mode to **Full (strict)**.

## Backend configuration

Set on the Vercel backend project:

| Variable | Value |
|----------|--------|
| `TRUST_CLOUDFLARE` | `true` (blocks direct origin access without `CF-Ray`) |
| `REDIS_URL` | Upstash or Redis Cloud URL for distributed rate limits |

The backend reads `CF-Connecting-IP` for real client IPs (Paystack webhook allowlist, dealer API IP whitelist, audit logs).

## WAF rules (recommended)

- **OWASP Core Ruleset** — enabled
- Rate limit `/api/auth/login` — 10 req/min per IP
- Challenge **Bot Fight Mode** on `/api/auth/*`
- Block countries not in your operating region (optional)
- Custom rule: allow Paystack webhook IPs to `/api/webhooks/paystack` (bypass bot challenge)

## Paystack webhooks

Paystack sends from fixed IPs (also enforced in application middleware):

- `52.31.156.142`
- `52.49.173.169`
- `52.214.14.220`

Override with `PAYSTACK_WEBHOOK_IPS` if Paystack updates their list.

## DDoS and bot protection

- Enable **DDoS L7** protection (Pro plan or higher recommended for APIs).
- Enable **Super Bot Fight Mode** on authentication and webhook paths.
- Use **IP reputation** filtering with default "medium" sensitivity.

## Verification

After enabling Cloudflare:

```bash
curl -I https://api.yourdomain.com/api/health
# Expect CF-Ray header

curl https://<vercel-origin>/api/health
# Expect 403 when TRUST_CLOUDFLARE=true
```
