# Deploy: single VPS with Docker Compose

The whole stack runs on one server as four containers:

```text
Caddy (:80/:443)
  ├── example.com      -> frontend  (Next.js, :3001)
  └── api.example.com  -> backend   (NestJS, :3000) -> postgres (:5432, internal)
```

Only Caddy publishes ports. Postgres is reachable only from inside the Docker
network — it is never exposed to the internet.

Reference server: 2 vCPU / 4 GB RAM / 100 GB NVMe, Ubuntu 24.04 LTS. At roughly
10–15 concurrent users the stack uses ~1.7 GB, leaving headroom for traffic
spikes and image processing.

## 1. Prepare the server

```bash
# As root, immediately after provisioning
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

Disable password logins in `/etc/ssh/sshd_config` (`PasswordAuthentication no`),
then `systemctl restart ssh`.

```bash
# As deploy
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo apt update && sudo apt install -y fail2ban
```

Install Docker from the official repository (the Ubuntu-packaged `docker.io` is
older):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy   # log out and back in for this to take effect
```

Add swap as a safety net so a memory spike degrades performance instead of
triggering the OOM killer:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. DNS

Point both names at the server's IP **before** the first start — Caddy requests
certificates on startup and fails if the names do not resolve yet.

| Record | Type | Value |
| --- | --- | --- |
| `example.com` | A | server IP |
| `api.example.com` | A | server IP |

Cloudflare's free tier is worth putting in front for CDN caching of images and
static assets, plus DDoS protection. If you use it, set the records to **DNS
only (grey cloud) for the first deployment** so Caddy can complete the ACME
challenge, then switch to proxied.

## 3. Deploy

```bash
git clone https://github.com/banthiarham/Wholesale-Ecom.git
cd Wholesale-Ecom
cp .env.production.example .env
```

Fill in `.env`. Generate each secret separately:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD, JWT_SECRET,
                       # SMTP_CREDENTIALS_KEY, GATEWAY_CREDENTIALS_KEY
```

Then:

```bash
docker compose up -d --build
```

The backend applies `prisma migrate deploy` on start. It does **not** seed
data — see below.

Watch it come up with `docker compose logs -f`.

## 4. Seed reference data

Run only the reference seeds. **Never run `prisma/seed.ts` against production** —
it deletes existing users, products, categories and banners before recreating
demo data.

The seeds are TypeScript and `ts-node` is a dev dependency, so they cannot run
inside the production image. Run them from a development checkout, tunnelling
to the server's Postgres (which is not published on any host port — forward to
the container's address on the Docker network instead):

```bash
# On the server: find the Postgres container address
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' wholesale-ecom-postgres-1

# Locally, from apps/backend
ssh -N -L 15432:<container-ip>:5432 deploy@<server> &
export DATABASE_URL="postgresql://wholesalex:<POSTGRES_PASSWORD>@127.0.0.1:15432/wholesalex?schema=public"
npx ts-node prisma/seed-roles.ts
npx ts-node prisma/seed-settings.ts
npx ts-node prisma/seed-delivery-partners.ts
```

All three are upserts and safe to re-run.

Real catalog data goes in through the admin UI. To move an existing local
catalog instead, see *Restoring* below and `rsync` the uploads alongside it —
that is also the safer way to load a large catalog, since the in-app bulk Excel
import downloads and resizes every image and is memory-hungry on a small server.

## 5. Backups

Self-hosting means backups are your responsibility. Nothing else in this setup
protects against a bad migration or an accidental delete.

Create `/home/deploy/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail
cd /home/deploy/Wholesale-Ecom
STAMP=$(date +%F)
source .env

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/home/deploy/backups/db-$STAMP.sql.gz"

docker run --rm -v wholesale-ecom_uploads:/data -v /home/deploy/backups:/out \
  alpine tar czf "/out/uploads-$STAMP.tar.gz" -C /data .

# Ship off the box — a backup that only exists on this server is not a backup.
# e.g. rclone copy /home/deploy/backups remote:wholesalex-backups

find /home/deploy/backups -type f -mtime +30 -delete
```

```bash
mkdir -p ~/backups && chmod +x ~/backup.sh
(crontab -l 2>/dev/null; echo "30 2 * * * /home/deploy/backup.sh") | crontab -
```

Configure [rclone](https://rclone.org) against Cloudflare R2 (10 GB free) or
Backblaze B2 and uncomment the copy line. **Test a restore before launch** — an
untested backup is not a backup.

### Restoring

```bash
gunzip -c backups/db-YYYY-MM-DD.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## 6. Monitoring

Point UptimeRobot or Better Stack (both free) at `https://example.com` and
`https://api.example.com/api/v1`, alerting by email or SMS.

Container logs are capped at 3 × 10 MB per service, so they cannot fill the disk.

## Updating

```bash
git pull
docker compose up -d --build
```

Rebuilding the frontend is CPU-intensive for a few minutes. If that proves a
problem on this server, move image builds to GitHub Actions and have the server
pull prebuilt images instead of building locally.

## Smoke test

1. `docker compose ps` — all four services up, none restart-looping.
2. `https://example.com` loads over valid HTTPS with products and categories.
3. Register an account, receive the OTP email, log in.
4. Add to cart, apply a coupon, place a test COD order.
5. Upload a product image in the admin, then `docker compose restart backend`
   and confirm it still renders — this proves the uploads volume works.
6. Upload a banner and a bulk-order attachment (these exercise the two upload
   paths that depend on the directories pre-created in the backend image).
7. `curl https://api.example.com/api/docs` returns 404 — Swagger is disabled in
   production.
8. `nmap -p 5432 <server-ip>` shows the port closed.
9. Run `~/backup.sh`, then restore the dump into a scratch database and compare
   row counts.
10. Reboot the server and confirm everything returns on its own.
