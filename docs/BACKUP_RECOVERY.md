# Backup and Recovery — topdealsgh

## Overview

Production MongoDB should use **encrypted daily backups** with integrity verification and documented restore drills.

## Recommended setup (MongoDB Atlas)

1. Enable **Cloud Backup** on the Atlas cluster (continuous + daily snapshots).
2. Enable **encryption at rest** (Atlas default on M10+).
3. Store backup access credentials in a secrets manager — never in the repository.
4. Configure backup retention: minimum **30 days** for production.

## Manual encrypted export (fallback)

```bash
# Export (run from a secure admin machine with MONGODB_URI set)
mongodump --uri="$MONGODB_URI" --gzip --archive=backup-$(date +%Y%m%d).gz

# Encrypt archive with AES-256
openssl enc -aes-256-cbc -salt -pbkdf2 -in backup-YYYYMMDD.gz -out backup-YYYYMMDD.gz.enc

# Verify archive integrity
openssl dgst -sha256 backup-YYYYMMDD.gz.enc
```

Store `backup-*.gz.enc` and the SHA-256 digest in separate secure locations.

## Restoration procedure

1. **Stop write traffic** — enable maintenance mode or pause Vercel backend deployments.
2. Decrypt the backup:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in backup-YYYYMMDD.gz.enc -out backup-YYYYMMDD.gz
   ```
3. Restore to a **staging cluster** first and verify:
   - User login (admin/dealer/reseller)
   - Wallet balances match expected totals
   - Recent orders and withdrawals
4. Restore production:
   ```bash
   mongorestore --uri="$MONGODB_URI" --gzip --archive=backup-YYYYMMDD.gz --drop
   ```
5. Re-run application seed/migration on startup (`seedDatabase` handles order numbers and dealer secret migration).
6. Rotate `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `PAYSTACK_WEBHOOK_SECRET` if backup may have been exposed.
7. Resume traffic and monitor audit logs for anomalies.

## Integrity verification (monthly drill)

1. Restore latest backup to a disposable cluster.
2. Run `npm run test:security` against the restored environment.
3. Compare wallet aggregate totals with production reporting.
4. Document drill date and outcome in your ops log.

## Redis (rate limiting)

Redis data is ephemeral. No backup required — limits rebuild automatically.
