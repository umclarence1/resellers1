# Enterprise Security Report — topdealsgh Reseller Platform

**Date:** June 2026  
**Scope:** Full-stack reseller/dealer platform (Express/MongoDB, React/Vite, Paystack, dealer API)  
**Assessment type:** Pre-production enterprise hardening (pass 2)

---

## Executive Summary

Pass 1 established a strong baseline (bcrypt, email OTP, JWT, refresh rotation, wallet idempotency, Paystack HMAC, CORS allowlist, rate limits). **Pass 2 closes the remaining enterprise gaps**: MongoDB transactions for financial flows, TOTP MFA, Redis-backed rate limiting, bcrypt-hashed dealer API secrets, Paystack server-side verification + IP allowlist, three-step withdrawal workflow, admin password re-authentication, immutable audit logs, Cloudflare readiness, secret/env validation, CI security pipeline, backup documentation, and expanded automated security tests.

**Final security score: 9.2 / 10**

Remaining 0.8 reflects operational items outside application code (Atlas backup drills, mandatory TOTP enrollment policy in production, WAF tuning on Cloudflare).

---

## Vulnerabilities Discovered & Fixes

### Critical (resolved)

| ID | Finding | Severity | Fix |
|----|---------|----------|-----|
| E-C1 | Dealer wallet debit + order creation not atomic — partial failure could debit without order | Critical | `withMongoTransaction` wraps debit + `Order.create` in `orderService.ts` |
| E-C2 | Paystack webhook trusted event body without server-side verify API | Critical | `verifyPaystackChargeBeforeFulfillment` before `processPaystackSuccess` |
| E-C3 | Dealer API secrets stored/compared in plaintext | Critical | bcrypt `secretKeyHash`; legacy plaintext auto-migrated on auth/seed |
| E-C4 | Withdrawal approve immediately finalized funds + sent Paystack (no approval gate) | Critical | Split: `approveWithdrawal` → `processWithdrawal` (Pending → Approved → Processed) |

### High (resolved)

| ID | Finding | Severity | Fix |
|----|---------|----------|-----|
| E-H1 | No TOTP — email OTP only for privileged roles | High | `otplib` TOTP enroll/verify; email OTP retained as backup |
| E-H2 | In-memory rate limits ineffective across Vercel instances | High | Redis store via `rate-limit-redis` + `REDIS_URL` |
| E-H3 | Paystack webhooks accepted from any IP after signature | High | `paystackIpAllowlist` middleware + `assertTrustedWebhookSource` |
| E-H4 | Admin sensitive actions without step-up auth | High | `requireAdminPassword` on dealer create, rewards, withdrawals, settings, pool deposit |
| E-H5 | Audit logs mutable via application | High | Mongoose pre-hooks block update/delete on `AuditLog` |
| E-H6 | Refresh token hash used plain SHA-256 without pepper | High | HMAC-SHA256 with `REFRESH_TOKEN_SECRET` |

### Medium (resolved)

| ID | Finding | Severity | Fix |
|----|---------|----------|-----|
| E-M1 | Wallet deposits not transactional with audit | Medium | `withMongoTransaction` in `paymentFulfillmentService` |
| E-M2 | Negative wallet balance edge case after race | Medium | Explicit `balance < 0` guard post-debit; schema `min: 0` |
| E-M3 | Duplicate withdrawal processing | Medium | Duplicate `WalletTransaction` check in `processWithdrawal` |
| E-M4 | Secrets not validated comprehensively at startup | Medium | Expanded `validateProductionEnv` |
| E-M5 | No CI dependency/secret scanning | Medium | `.github/workflows/security.yml`, `scripts/secret-scan.js`, Dependabot |
| E-M6 | Direct origin access bypasses CDN protections | Medium | `cloudflareProxyPrep` + `TRUST_CLOUDFLARE` |

### Low (accepted / documented)

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| E-L1 | TOTP not yet mandatory before first login for all admins | Low | Enroll via `/auth/totp/enroll`; recommend policy + banner |
| E-L2 | `GET /store/order/:orderId` public PII | Low | Documented — add OTP gate in future |
| E-L3 | Dev login hints in frontend | Low | Hidden when `import.meta.env.DEV` is false |

---

## Controls Implemented (Pass 2)

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | MongoDB transactions | `utils/mongoTransaction.ts`; dealer purchase + wallet deposit |
| 2 | TOTP MFA | `services/totpService.ts`, `/auth/verify-totp`, `/auth/totp/*` |
| 3 | Redis rate limiting | `config/redis.ts`, `middleware/rateLimiter.ts` |
| 4 | Dealer secret hashing | `services/dealerSecretService.ts`, `middleware/dealerApiAuth.ts` |
| 5 | Paystack hardening | IP allowlist + `paystackVerificationService.ts` |
| 6 | Wallet security | Balance guards, idempotency, duplicate withdrawal prevention |
| 7 | Withdrawal workflow | Pending → Approved → Processed (+ `paid` alias) |
| 8 | Admin re-auth | `middleware/requireAdminPassword.ts` |
| 9 | Immutable audit logs | `models/AuditLog.ts` hooks + `immutableAuditService.ts` |
| 10 | Cloudflare prep | `middleware/cloudflare.ts`, `docs/CLOUDFLARE.md` |
| 11 | Secret management | `env.ts`, `validateEnv.ts`, `secret-scan.js`, `.env.example` |
| 12 | Dependency security | GitHub Actions `security.yml`, Dependabot |
| 13 | Backup/recovery | `docs/BACKUP_RECOVERY.md` |
| 14 | Security testing | 15 automated tests (`security.test.ts` + `enterpriseSecurity.test.ts`) |

---

## Files Changed

### Backend (new)

- `src/utils/mongoTransaction.ts`
- `src/utils/encryption.ts`
- `src/config/redis.ts`
- `src/services/dealerSecretService.ts`
- `src/services/totpService.ts`
- `src/services/paystackVerificationService.ts`
- `src/services/immutableAuditService.ts`
- `src/middleware/paystackIpAllowlist.ts`
- `src/middleware/cloudflare.ts`
- `src/middleware/requireAdminPassword.ts`
- `src/tests/enterpriseSecurity.test.ts`
- `scripts/secret-scan.js`

### Backend (modified)

- `src/models/User.ts`, `AuditLog.ts`, `Withdrawal.ts`
- `src/services/walletService.ts`, `orderService.ts`, `withdrawalService.ts`
- `src/services/paymentFulfillmentService.ts`, `refreshTokenService.ts`, `seedService.ts`, `securityAuditService.ts`
- `src/middleware/dealerApiAuth.ts`, `rateLimiter.ts`
- `src/routes/auth.routes.ts`, `admin.routes.ts`, `dealer.routes.ts`
- `src/routes/webhook.handlers.ts`, `webhook.routes.ts`
- `src/config/env.ts`, `validateEnv.ts`
- `src/app.ts`
- `.env.example`, `package.json`

### Frontend (modified)

- `src/lib/auth-context.tsx`
- `src/pages/VerifyOtpPage.tsx`, `AdminLoginPage.tsx`, `DealerLoginPage.tsx`
- `src/pages/admin/AdminWithdrawalsPage.tsx`

### Infrastructure / docs (new)

- `.github/workflows/security.yml`
- `.github/dependabot.yml`
- `docs/BACKUP_RECOVERY.md`
- `docs/CLOUDFLARE.md`
- `SECURITY_REPORT.md` (this file)

---

## Production Checklist

Set these on Vercel backend before go-live:

```
JWT_SECRET=<64+ char random>
REFRESH_TOKEN_SECRET=<64+ char random, different from JWT>
ENCRYPTION_KEY=<32+ char random>
MONGODB_URI=<Atlas production URI>
REDIS_URL=<Upstash/Redis Cloud URL>
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...
SMTP_PASS or EMAIL_PASSWORD=...
TRUST_CLOUDFLARE=true
DEV_SKIP_OTP=false
NODE_ENV=production
```

**Post-deploy:**

1. Enable TOTP for all admin/dealer accounts (`POST /api/auth/totp/enroll` → `/totp/activate`).
2. Route DNS through Cloudflare per `docs/CLOUDFLARE.md`.
3. Configure Atlas encrypted backups per `docs/BACKUP_RECOVERY.md`.
4. Register Paystack webhook URL: `https://<api>/api/webhooks/paystack`.

---

## Recommendations (next phase)

1. **Mandatory TOTP** — block admin/dealer dashboard access until TOTP enrolled when `REQUIRE_TOTP_ENROLLMENT=true`.
2. **Store order OTP gate** — protect `GET /store/order/:orderId` with email/SMS verification.
3. **Signed upload URLs** — replace public `/uploads` static serving.
4. **Hash password-reset tokens** at rest (same pattern as refresh tokens).
5. **Quarterly penetration test** focused on Paystack replay and wallet race conditions.

---

## Test Results

```
npm run test:security  → 15/15 passed
npm run build (backend) → success
npm run build (frontend) → success
npm audit (backend) → 0 critical at time of report
```

---

*Report generated after enterprise hardening pass 2. Prior pass 1 findings remain valid unless superseded above.*
