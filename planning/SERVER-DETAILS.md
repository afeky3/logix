# Logix — Server Details & Ports

**Date:** 2026-09-30  
**Environment:** Production (AWS EC2)  
**Status:** ✅ Live

---

## 1. Server Info

| Property | Value |
|----------|-------|
| **Cloud Provider** | AWS |
| **Instance Type** | EC2 `t3.large` (2 vCPU, 8 GB), resized from `t3.medium` on 2026-09-30 |
| **OS** | Ubuntu 26.04 LTS (verified 2026-09-30) |
| **Instance ID** | ip-172-31-28-205 |
| **Private IP** | `172.31.28.205` |
| **Public Domain** | `ec2-16-16-187-248.eu-north-1.compute.amazonaws.com` (public IP `16.16.187.248` since the 2026-09-30 resize; was `13.53.158.8`). **No Elastic IP**, so the IP changes on every stop/start |
| **Region** | eu-north-1 (Stockholm) |
| **Kernel** | 7.0.0-1006-aws x86_64 |
| **Disk** | 28 GB (7 GB used, 22 GB free) |
| **Memory** | 7.6 GB (0.9 GB used, 6.8 GB available after resize), **no swap** |
| **IAM role** | None attached |
| **Uptime** | ~100 days (since Jun 21) |

---

## 2. SSH Access

### Connection

```bash
# Using private key
ssh -i ~/.ssh/logix.pem ubuntu@ec2-16-16-187-248.eu-north-1.compute.amazonaws.com

# Or using IP (internal only)
ssh -i ~/.ssh/logix.pem ubuntu@172.31.28.205
```

### Key Files

| Key | Purpose | Location | Status |
|-----|---------|----------|--------|
| `logix.pem` | Primary SSH key (current) | `~/.ssh/logix.pem` | ✅ Active |
| `emo` | Legacy key | `.ssh/authorized_keys` | ✅ Keep for compatibility |
| Second key | Unknown origin | `.ssh/authorized_keys` | ✅ Keep for compatibility |

**Note:** Multiple keys configured in `~/.ssh/authorized_keys` for redundancy.

---

## 3. Applications & Ports

### 3.1 Running Services

| # | App | Type | Domain | Port | Status | Memory | Uptime |
|---|-----|------|--------|------|--------|--------|--------|
| 1 | **POS BeemoCode** | Laravel Octane | `pos.bemocode.com` | 8000 | ✅ | 66 MB | 4 days |
| 2 | **Workspace System** | Laravel Octane | `workspace.bemocode.com` | 8001 | ✅ | 66 MB | 4 days |
| 3 | **WhatsApp Dashboard** | Node.js (PM2) | `wa.bemocode.com` | 3000 | ✅ | 133 MB | 9 days |
| 4 | **Main Site** | Static HTML | `bemocode.com` | 443 | ✅ | — | — |
| 5 | **Logix Site** | Static HTML | `logix.bemocode.com` | 443 | ✅ | — | — |

### 3.2 Infrastructure Services

| Service | Port | Type | Status | Memory |
|---------|------|------|--------|--------|
| **Nginx** | 80, 443 | Reverse Proxy | ✅ | — |
| **PostgreSQL 18.6** | 5432 | Database | ✅ | — |
| **Redis 8.0.5** | 6379 | Cache/Locks (no password, `noeviction`, only db0 used) | ✅ | 14 MB |
| **PHP 8.5-FPM** | Unix Socket | FastCGI | ✅ | — |

### 3.3 Port Allocation (Firewall Rules)

```
External (0.0.0.0):
├── 22 (SSH)          → ubuntu user
├── 80 (HTTP)         → Nginx → auto-redirect HTTPS
├── 443 (HTTPS/SSL)   → Nginx reverse proxy
└── 3000 (Node.js)    → WhatsApp Dashboard (if exposed)

Internal (127.0.0.1):
├── 8000              → POS Octane (pos.bemocode.com)
├── 8001              → Workspace Octane (workspace.bemocode.com)
├── 5432              → PostgreSQL
├── 6379              → Redis
├── 2019, 2020        → FrankenPHP admin ports
└── 53                → systemd-resolved DNS
```

> **Verified 2026-09-30:** ports 3000, 8000 and 8001 actually listen on **all interfaces** (`*`), not 127.0.0.1, and `ufw` is **inactive**. They are closed from the internet only because the AWS security group blocks them (checked from outside). Binding them to 127.0.0.1 or enabling `ufw` would add a second layer.

---

## 4. Domain Configuration

### Nginx Reverse Proxy Mapping

```
Request Flow:
  Browser → Nginx (443) → Internal proxy → App

pos.bemocode.com:443     → proxy_pass http://127.0.0.1:8000
workspace.bemocode.com:443 → proxy_pass http://127.0.0.1:8001
wa.bemocode.com:443      → proxy_pass http://127.0.0.1:3000
bemocode.com:443         → static /var/www/bemocode.com
logix.bemocode.com:443   → static /var/www/logix.bemocode.com
```

### SSL Certificates

- **Provider:** Let's Encrypt (Certbot)
- **Type:** Automated renewal
- **Domains:**
  - `bemocode.com` + `www.bemocode.com`
  - `pos.bemocode.com`
  - `logix.bemocode.com`
  - `wa.bemocode.com`
  - `workspace.bemocode.com`

---

## 5. Credentials & Access

### WhatsApp Dashboard

```
URL:      https://wa.bemocode.com
Username: admin
Password: admin123

⚠️ SECURITY: Change password immediately on first login
```

### Database Access

```
Host:     127.0.0.1:5432 (local only)
User:     workspace_user
Database: workspace_system
Password: (check .env files)
```

### Redis

```
Host:     127.0.0.1:6379
Auth:     (check systemd service)
```

---

## 6. File Locations

### Application Directories

| App | Path | User | Group |
|-----|------|------|-------|
| **POS BeemoCode** | `/var/www/pos-bemocode` | ubuntu | ubuntu |
| **Workspace System** | `/var/www/workspace_system` | ubuntu | ubuntu |
| **WhatsApp Dashboard** | `/home/ubuntu/whatsapp-dashboard` | ubuntu | ubuntu |

### Config Files

```
/etc/nginx/sites-enabled/
├── bemocode.com
├── pos-bemocode
├── logix.bemocode.com
├── wa.bemocode.com
└── workspace_system

/etc/systemd/system/
├── octane.service
├── workspace-octane.service
├── workspace-queue.service
└── ...
```

### Logs

```
/var/log/nginx/
├── access.log
├── error.log
├── workspace_system.access.log
└── workspace_system.error.log

/home/ubuntu/.pm2/logs/
├── whatsapp-dashboard-out.log
└── whatsapp-dashboard-error.log
```

---

## 7. Monitoring & Health Checks

### Key Metrics (as of 2026-09-30)

```
CPU Usage:    ~1.7% (mostly idle)
Memory:       28.9% (1.1 GB / 3.7 GB)
Disk:         25% (7 GB / 28 GB)
Uptime:       100+ days
```

### Process Health

```bash
# Check running services
systemctl status octane workspace-octane workspace-queue postgresql redis-server nginx

# Check listening ports
ss -tlnp | grep LISTEN

# Check PM2 processes
pm2 list

# Monitor real-time
htop
```

---

## 8. Logix Backend (Future)

### Planned Deployment

| Item | Plan |
|------|------|
| **Port** | TBD (suggest 3001 or 4000) |
| **Domain** | TBD (suggest `api.bemocode.com` or `logix-api.bemocode.com`) |
| **Reverse Proxy** | Nginx → NestJS backend |
| **Database** | ✅ **Created 2026-09-30:** database `logix` on the existing PostgreSQL 18.6, with its own roles (see "Logix Database" below) |
| **Cache** | Existing Redis 8, dedicated DB index (1) + `logix:` key prefix |
| **Socket.IO** | Same port as the API (3001), exposed on 443 via Nginx |
| **Jobs** | BullMQ (uses Redis), separate `logix-worker` process |
| **Processes** | PM2 (already on the server): `logix-api` and `logix-worker` from the same build |

> **Scope of this server.** eu-north-1 is outside Saudi Arabia, so under decision D-23 (PDPL data residency) this box is suitable for **dev/staging with synthetic data only**. Production hosting stays open until legal sign-off.

### Packages to Install

Versions follow [backend/md/01-tech-stack.md](backend/md/01-tech-stack.md). **Status checked on the server on 2026-09-30** (read-only inventory over SSH).

**Needed from the first deploy (Phase 0–1)**

| Package | Status on server | To do | Why |
|---------|------------------|-------|-----|
| Node.js 22 LTS | ✅ v22.23.0 (`/usr/bin/node`), shared with the WhatsApp dashboard | Nothing | NestJS runtime |
| pnpm | ❌ missing | `sudo corepack enable && corepack prepare pnpm@latest --activate` | Monorepo package manager (T-08) |
| PM2 | ✅ 7.0.3 | Nothing | Runs `logix-api` / `logix-worker` |
| PM2 log rotation | ❌ not installed | `pm2 install pm2-logrotate` | Keeps logs bounded on a 28 GB disk (also helps the WhatsApp dashboard) |
| PostgreSQL | ✅ 18.6 | Nothing | Plan said 16; 18 is supported by Prisma and the schema |
| PostGIS | ✅ 3.6.2 installed 2026-09-30 (`postgresql-18-postgis-3`) | Nothing | Required by the schema (`CREATE EXTENSION postgis`) |
| `pg_trgm`, `citext`, `btree_gist`, `pgcrypto` | ✅ enabled in `logix` | Nothing | Required by the schema |
| Redis | ✅ 8.0.5, `noeviction`, no `maxmemory`, only db0 used | Use **db 1** + `logix:` prefix. Optional: add a password (`requirepass`) and update the Laravel apps' `.env` | BullMQ needs `noeviction` (already set) |
| `git`, `gcc`, `python3` | ✅ 2.53 / 15.2 / 3.14 | `sudo apt install build-essential` if a native module fails to build | Native Node modules (argon2) |
| Certbot | ✅ 4.0.0 | `sudo certbot --nginx -d <api domain>` once DNS points here | TLS for the API and WebSocket |

**Needed later (by slice in [12-execution-plan.md](backend/md/12-execution-plan.md))**

| Package | Status on server | Install | Needed by | Why / sizing note |
|---------|------------------|---------|-----------|-------------------|
| ClamAV | ❌ missing | `sudo apt install clamav-daemon clamav-freshclam` | S2 (file uploads) | Scans every upload. **Uses ~1–1.5 GB RAM** with signatures loaded (see memory budget) |
| Chromium for PDF worker | ❌ missing | `npx playwright install --with-deps chromium` | Phase 2 (invoices, statements) | Arabic PDFs rendered in a browser engine. ~300 MB per render. Check Playwright supports Ubuntu 26.04 at that time; otherwise use the distro `chromium` |
| Arabic fonts | Not checked | `sudo apt install fonts-noto-core` + IBM Plex Sans Arabic TTFs in `/usr/local/share/fonts`, then `fc-cache -f` | Phase 2 | Correct Arabic shaping in PDFs, matching the app typeface |

**Cloud resources (not apt packages)**

| Resource | Status | Why |
|----------|--------|-----|
| S3 bucket `logix-private-<env>` (+ `logix-public-<env>` in Phase 3) | To create | Document and photo uploads via pre-signed URLs. No local file storage |
| IAM role attached to the EC2 instance | ❌ none attached | S3 access (and backup upload) without keys in `.env` |
| DNS record for the API domain | To create | Points to this instance |
| Swap file (2 GB) | ❌ no swap | Protects the other apps from OOM kills while Logix is added (see memory budget) |

**Not needed on this server:** Docker (run natively under PM2 like the other apps), MinIO, Mailpit and the fake SMS sink (local development only).

### Logix Database (created 2026-09-30)

| Item | Value |
|------|-------|
| Database | `logix` (UTF8, owner `logix_migrator`) on `127.0.0.1:5432` |
| `logix_migrator` | LOGIN. Owns the database, runs migrations (can create schemas) |
| `logix_app` | LOGIN. API + worker. `CONNECT`/`TEMPORARY` on the database, `USAGE` on `public`. Table grants come from the schema migrations ([11-database-schema §24](backend/md/11-database-schema.md#24-reporting-views-and-grants)) |
| `logix_reporting` | LOGIN. `CONNECT` only, until the `reporting` views exist |
| Extensions | `postgis` 3.6.2, `pg_trgm` 1.6, `citext` 1.8, `btree_gist` 1.8, `pgcrypto` 1.4 |
| Isolation | `PUBLIC` has no access. `workspace_user`, `pos_user`, `thanwya_user` cannot connect; nobody but the owner can create objects in `public` |
| Credentials | `/home/ubuntu/.logix/db.env` (mode 600): `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `REPORTING_DATABASE_URL`. Not stored anywhere else yet; copy them to the password manager / AWS Secrets Manager |
| Tables | None yet. The schema is applied by the backend's migrations (S0), not by hand |

The roles are created at the cluster level here, so the schema's `CREATE ROLE ... NOLOGIN` lines ([11-database-schema §2](backend/md/11-database-schema.md#2-extensions-schemas-and-roles)) must **not** go into the migrations. Migrations only `GRANT` to these roles.

| Item | Change | Why |
|------|--------|-----|
| Redis `maxmemory-policy` | Already `noeviction` ✅. Keep it that way; if a Laravel app ever needs an LRU cache, give Logix its own Redis instance (e.g. port 6380) | BullMQ loses jobs if Redis evicts keys |
| Nginx WebSocket | Keep the `/socket.io` upgrade block in the template below (it includes `proxy_read_timeout 3600s`) | Long-lived Socket.IO connections |
| Bind addresses | Run `logix-api` on `127.0.0.1:3001` (not `0.0.0.0`). Consider the same for 3000/8000/8001, which listen on all interfaces today | Security group is currently the only barrier (`ufw` inactive) |
| Backups | ❌ **No scheduled backup exists.** The latest dumps in `/home/ubuntu/backups` are from Aug 14 and 17, and the only cron job is the Laravel scheduler. Add a daily `pg_dump` cron for all databases (including `logix`) and upload to S3 | Section 9 says "Daily", but nothing runs. A backup on the same disk also doesn't survive losing the instance |

### Memory Budget

Current use is 1.1 GB of 3.7 GB. Estimated Logix additions:

| Process | Approx. RAM |
|---------|-------------|
| `logix-api` | 200–300 MB |
| `logix-worker` | 150–250 MB |
| Postgres/Redis growth | 100–300 MB |
| ClamAV (from S2) | 1,000–1,500 MB |
| Chromium PDF render (Phase 2, spikes) | ~300 MB |

API + worker fit on the current `t3.medium`. **With ClamAV and PDF rendering the box runs out of headroom**, and there is no swap today, so the kernel would kill a process (possibly one of the other apps). Add 2 GB of swap before the first Logix deploy, and resize to `t3.large` (8 GB) before S2.

### Verify Before Installing

```bash
node -v; pnpm -v; pm2 -v
psql --version; sudo -u postgres psql -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('postgis','pg_trgm','citext','btree_gist','pgcrypto');"
redis-server --version; redis-cli CONFIG GET maxmemory-policy
clamscan --version
free -h; df -h /
```

### Ports Reserved (Recommendations)

```
3001 - Logix Backend (NestJS) [primary choice]
4000 - Alternative if 3001 taken
8002 - Reserved for future services
8003 - Reserved for future services
```

### Nginx Configuration (Template)

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.bemocode.com;  # or logix-api.bemocode.com

    # SSL
    ssl_certificate     /etc/letsencrypt/live/api.bemocode.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bemocode.com/privkey.pem;

    # Proxy to NestJS
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # WebSocket upgrade
    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

---

## 9. Maintenance & Updates

### Backup Strategy

| Item | Frequency | Location |
|------|-----------|----------|
| Database | Daily (**planned — not scheduled as of 2026-09-30**, see §8 Configuration Changes) | `/home/ubuntu/backups` → S3 |
| Application | On-demand | Git repository |

### Security

- SSH key rotation: Recommended yearly
- SSL renewal: Automatic via Certbot
- System updates: Ubuntu automatic security updates enabled
- Secrets: Check AWS Secrets Manager for credentials

### Restart Procedures

```bash
# Restart specific service
sudo systemctl restart octane
sudo systemctl restart workspace-octane
sudo systemctl restart postgresql
sudo systemctl restart redis-server
sudo systemctl restart nginx

# Restart all applications
sudo systemctl restart octane workspace-octane workspace-queue nginx
```

---

## 10. Quick Commands

```bash
# SSH into server
ssh -i ~/.ssh/logix.pem ubuntu@ec2-16-16-187-248.eu-north-1.compute.amazonaws.com

# View running processes
ps aux | grep -E 'octane|node|postgres|redis|nginx'

# Check port availability
ss -tlnp | grep LISTEN

# View Nginx logs
tail -f /var/log/nginx/access.log

# View PM2 logs (WhatsApp Dashboard)
pm2 logs whatsapp-dashboard

# Restart application
sudo systemctl restart octane

# Check database connection
psql -h 127.0.0.1 -U workspace_user -d workspace_system -c "SELECT 1;"
```

---

## 11. Emergency Contacts & Notes

- **Server Admin:** Abdulrhman Elfeky
- **GitHub:** Msaratech/Projects/logix
- **Last Update:** 2026-09-30
- **Next Review:** When deploying Logix Backend

---

**Document Status:** ✅ Active | Last Updated: 2026-09-30
