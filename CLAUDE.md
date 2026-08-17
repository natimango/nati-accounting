# NATI Accounting — Project Context

## Server
- **Host:** DigitalOcean droplet — `root@64.227.130.193`
- **App directory:** `/root/nati-finance`
- **Runs via:** Docker Compose (not PM2, not bare node)
- **App container:** built from `docker-compose.yml` in `/root/nati-finance`
- **DB container:** `nati-accounting-db` (postgres:15-alpine, always running)

## Restart procedure
Whenever code is pushed and the server needs to pick it up:
```bash
ssh root@64.227.130.193
cd /root/nati-finance
git pull origin claude/gallant-babbage-JMe69
docker compose up -d --build
```
Check logs after restart:
```bash
docker compose logs -f app
```

> **ALL changes require a Docker rebuild** — the Dockerfile does `COPY . .` which
> bakes everything (including /public) into the image at build time.
> There is NO live-mount of /public. Always run `docker compose up -d --build`
> after every push, whether backend or frontend.

## Dev branch
- All work goes to branch: `claude/gallant-babbage-JMe69`
- Remote: `https://github.com/natimango/nati-accounting`

## Stack
- **Backend:** Node.js + Express, plain JS (not TypeScript)
- **Frontend:** Plain HTML + vanilla JS in `/public/` — NO React/Vue
- **Database:** PostgreSQL via `pool.query()`
- **Auth:** JWT in cookie `nati_token`, middleware: `authenticate` + `authorize(roles)`
- **Migrations:** Auto-run on server start via `src/utils/runMigrations.js`
- **Live URL:** https://accounts.nati.co.in

## Business context
- NATI is an Indian D2C clothing brand
- Currency: ₹ Indian Rupees — always use `toLocaleString('en-IN', { maximumFractionDigits: 0 })`
- Drops = clothing collections (e.g. "Hemp Hase Drop 1" = drop_number 1)
- All pre-production bills (rent, salaries, ops costs) are tagged to Hemp Hase Drop 1

## Critical rules
- NEVER commit credentials or secrets
- Always use `credentials: 'include'` on all fetch calls
- The `frontend/` TypeScript directory is dead code — ignore it
- Work only in `src/` (backend) and `public/` (frontend)
