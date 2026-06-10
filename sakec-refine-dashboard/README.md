# SAKEC Grading Dashboard

A self-hosted college grading dashboard built with **React + Refine + Ant Design** (frontend) and **Node.js + Express** (backend), using **Azure AD SSO** for authentication and **PostgreSQL 15** as the database.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend   │────▶│  PostgreSQL 15  │
│  React/Vite  │     │  Express.js │     │  (sakec schema) │
│  Port: 80    │     │  Port: 3001 │     │  Port: 5433     │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                    │
       ▼                    ▼
  Azure AD SSO      JWT Validation
  (@azure/msal)     (jwks-rsa)
```

## Quick Start (Local Development)

```bash
# 1. Copy env file and fill in your values
cp .env.example .env

# 2. Install & start backend
cd backend && npm install && npm run dev

# 3. Install & start frontend (new terminal)
cd frontend && npm install --legacy-peer-deps && npm run dev
```

## Docker Compose Service Snippets

Add these to your **existing** `docker-compose.yml` on the college server:

```yaml
  # ── SAKEC Dashboard Backend ───────────────────────
  sakec-api:
    build: ./sakec-refine-dashboard/backend
    container_name: sakec-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: ./sakec-refine-dashboard/.env
    networks:
      - your_existing_network

  # ── SAKEC Dashboard Frontend ──────────────────────
  sakec-frontend:
    build: ./sakec-refine-dashboard/frontend
    container_name: sakec-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - sakec-api
    networks:
      - your_existing_network
```

> **Note**: Replace `your_existing_network` with the network name your PostgreSQL container is on. Update the `CORS_ORIGIN` in `.env` to match the frontend's URL (e.g., `http://172.16.151.3:8080`).

## Folder Structure

```
sakec-refine-dashboard/
├── .env.example            # Template for secrets
├── .env                    # Your local secrets (gitignored)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js        # Express server
│       ├── config/db.js    # PostgreSQL pool (sakec schema)
│       ├── middleware/
│       │   ├── auth.js     # Azure AD JWT validation
│       │   └── errorHandler.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── dashboard.routes.js
│       │   ├── teams.routes.js
│       │   ├── assignments.routes.js
│       │   └── submissions.routes.js
│       └── utils/queries.js  # All SQL (sakec.* prefixed)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── authProvider.ts
│       ├── dataProvider.ts
│       ├── config/msalConfig.ts
│       ├── components/layout/index.tsx
│       └── pages/
│           ├── login/index.tsx
│           ├── dashboard/
│           │   ├── index.tsx
│           │   └── components/  (KpiCards, PendingGradesTable, AlignmentChart, etc.)
│           └── teams/index.tsx
└── DEPLOYMENT.md
```

## Security

- **No auto-provisioning**: Only emails in `sakec.teachers` can log in (403 otherwise)
- **Tenant-locked**: JWT `tid` claim must match `AZURE_TENANT_ID`
- **Strict CORS**: Only `CORS_ORIGIN` is allowed
- **All queries use explicit `sakec.*` schema prefix**
