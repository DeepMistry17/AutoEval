# DEPLOYMENT GUIDE — SAKEC Grading Dashboard

Step-by-step guide to deploy on the college server (accessed via **MobaXterm**).

---

## Prerequisites

| Item | Requirement |
|---|---|
| Server OS | Linux (Ubuntu/Debian) |
| Docker | v20+ with `docker compose` |
| Node.js | v20+ (only if running without Docker) |
| PostgreSQL | 15 — already running on `172.16.151.3:5433` |
| Azure AD | App Registration with Client ID, Tenant ID, Client Secret |

---

## Step 1: Transfer Files to Server

Open **MobaXterm** and connect to the server via SSH.

```bash
# Option A: Clone from Git
cd /opt
git clone <your-repo-url> sakec-refine-dashboard
cd sakec-refine-dashboard

# Option B: SCP from your local machine (drag & drop in MobaXterm's file browser)
# Upload the entire sakec-refine-dashboard folder to /opt/
```

---

## Step 2: Create Production .env

```bash
cp .env.example .env
nano .env  # or vi .env
```

Fill in the **real values**:

```env
# ─── PostgreSQL ───────────────────────────────────────────
DB_HOST=172.16.151.3
DB_PORT=5433
DB_NAME=<your_actual_database_name>
DB_USER=<your_actual_db_user>
DB_PASSWORD=<your_actual_db_password>
DB_SCHEMA=sakec

# ─── Azure AD ─────────────────────────────────────────────
AZURE_CLIENT_ID=<your_real_client_id>
AZURE_TENANT_ID=<your_real_tenant_id>
AZURE_CLIENT_SECRET=<your_real_client_secret>

# ─── Backend Server ──────────────────────────────────────
PORT=3001
CORS_ORIGIN=http://172.16.151.3:8080
NODE_ENV=production

# ─── Frontend ────────────────────────────────────────────
VITE_API_URL=http://172.16.151.3:3001/api
VITE_AZURE_CLIENT_ID=<your_real_client_id>
VITE_AZURE_TENANT_ID=<your_real_tenant_id>
VITE_AZURE_REDIRECT_URI=http://172.16.151.3:8080
```

> **IMPORTANT**: `CORS_ORIGIN` must match the URL teachers use to access the frontend. `VITE_API_URL` must be reachable from the teacher's browser.

---

## Step 3: Add Services to Your Existing docker-compose.yml

Open your **existing** `docker-compose.yml` on the server:

```bash
nano /path/to/your/existing/docker-compose.yml
```

Append these services:

```yaml
  # ── SAKEC Dashboard Backend ───────────────────────
  sakec-api:
    build: /opt/sakec-refine-dashboard/backend
    container_name: sakec-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: /opt/sakec-refine-dashboard/.env
    networks:
      - default  # same network as your PostgreSQL container

  # ── SAKEC Dashboard Frontend ──────────────────────
  sakec-frontend:
    build:
      context: /opt/sakec-refine-dashboard/frontend
      args:
        - VITE_API_URL=http://172.16.151.3:3001/api
        - VITE_AZURE_CLIENT_ID=<your_real_client_id>
        - VITE_AZURE_TENANT_ID=<your_real_tenant_id>
        - VITE_AZURE_REDIRECT_URI=http://172.16.151.3:8080
    container_name: sakec-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - sakec-api
    networks:
      - default
```

> **Note on VITE_ vars**: Vite bakes env variables into the JS bundle at **build time**. You must pass them as build args OR place a `.env` in the frontend directory before building the Docker image.

---

## Step 4: Build and Start

```bash
# Build both containers
docker compose build sakec-api sakec-frontend

# Start them
docker compose up -d sakec-api sakec-frontend

# Check logs
docker compose logs -f sakec-api
docker compose logs -f sakec-frontend
```

---

## Step 5: Verify

```bash
# 1. Health check
curl http://172.16.151.3:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. Open browser on any college machine
# Navigate to: http://172.16.151.3:8080
# You should see the Azure AD login page
```

---

## Step 6: Azure AD App Registration Setup

If you haven't created one yet:

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App Registrations** → **New Registration**
2. Name: `SAKEC Grading Dashboard`
3. Supported account types: **Single tenant** (this organization only)
4. Redirect URI: **Single-page application** → `http://172.16.151.3:8080`
5. After creation:
   - Copy **Application (client) ID** → `AZURE_CLIENT_ID`
   - Copy **Directory (tenant) ID** → `AZURE_TENANT_ID`
   - Go to **Certificates & Secrets** → **New client secret** → Copy value → `AZURE_CLIENT_SECRET`
   - Go to **Expose an API** → **Add a scope** → `access_as_user`
   - Go to **API Permissions** → Add `User.Read` (delegated)

---

## Step 7: Ensure Teachers Exist in Database

The system does **NOT** auto-create teacher accounts. You must insert teachers manually:

```sql
INSERT INTO sakec.teachers (teacher_id, full_name, email, password_hash, ms_id)
VALUES ('EMP001', 'Dr. Example Teacher', 'teacher@sakec.ac.in', '', 'teacher@sakec.ac.in');
```

> Only emails present in `sakec.teachers` will be allowed to log in. Others get a **403 Forbidden** error.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `403 Forbidden` on login | Teacher email not in `sakec.teachers` — insert it |
| `401 Invalid token` | Check `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` match the App Registration |
| CORS error in browser | Ensure `CORS_ORIGIN` exactly matches the URL in the browser (including port) |
| Frontend shows blank page | Check `VITE_API_URL` is reachable from the browser — not `localhost` |
| Can't connect to DB | Ensure the API container is on the same Docker network as PostgreSQL |

---

## Updating

```bash
cd /opt/sakec-refine-dashboard
git pull
docker compose build sakec-api sakec-frontend
docker compose up -d sakec-api sakec-frontend
```
