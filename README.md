# MedCore EHR — Training Environment

> A self-hosted healthcare integration training system built on real industry tools and standards.
> **Purpose:** Learn the concepts behind Epic and healthcare integration engineering without needing Epic access.

---

## System Requirements

| Tool | Version | Check |
|---|---|---|
| Docker Desktop | 4.x+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| 8 GB RAM (allocated to Docker) | — | Docker Desktop → Settings → Resources |
| ~5 GB disk space | — | For images + data volumes |

> ⚠️ **Mac users:** Open Docker Desktop → Settings → Resources and set Memory to at least **6 GB**.
> Some images (HAPI FHIR, Keycloak) are memory-hungry.

---

## Quick Start

```bash
# 1. Clone or unzip the project
cd medcore

# 2. Start everything
docker compose up -d

# 3. Watch the logs (optional, useful to see startup progress)
docker compose logs -f

# 4. Wait ~2-3 minutes for all services to initialize
# Then open: http://localhost:3000
```

---

## Service URLs

| Service | URL | Credentials |
|---|---|---|
| **MedCore Frontend** | http://localhost:3000 | — |
| **API Gateway** | http://localhost:3001/health | — |
| **HAPI FHIR Server** | http://localhost:8080/fhir | — |
| **Mirth Connect Admin** | https://localhost:8443 | admin / admin |
| **Keycloak Admin** | http://localhost:8090 | admin / admin |
| **RabbitMQ Dashboard** | http://localhost:15672 | guest / guest |
| **PostgreSQL** | localhost:5432 | medcore / medcore |

> For Mirth Connect: your browser will warn about a self-signed certificate. Click "Advanced" → "Proceed anyway."

---

## Module 0 — Acceptance Tests

Run these after `docker compose up -d` to confirm everything is healthy.

### Test 1: Gateway health
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"medcore-gateway",...}
```

### Test 2: FHIR server
```bash
curl http://localhost:8080/fhir/metadata | head -5
# Expected: FHIR CapabilityStatement JSON
```

### Test 3: All containers running
```bash
docker compose ps
# Expected: All containers with Status "running" or "healthy"
```

### Test 4: Frontend
Open http://localhost:3000 in your browser.
You should see the MedCore dashboard with all services shown as Online.

---

## Common Commands

```bash
# Start all services
docker compose up -d

# Stop all services (keeps your data)
docker compose down

# Stop AND wipe all data (fresh start)
docker compose down -v

# View logs for a specific service
docker compose logs -f gateway
docker compose logs -f mirth-connect
docker compose logs -f hapi-fhir

# Restart a single service
docker compose restart gateway

# Open a shell inside a container
docker compose exec postgres psql -U medcore -d medcore
```

---

## Project Structure

```
medcore/
├── docker-compose.yml          ← The entire stack defined here
├── README.md                   ← You are here
├── db/
│   └── init/
│       └── 01_init.sql         ← Runs once on first postgres start
├── services/
│   └── gateway/                ← API Gateway (Node.js/Express)
│       ├── index.js
│       ├── package.json
│       └── Dockerfile
└── frontend/                   ← React dashboard (Vite + Tailwind)
    ├── src/
    │   ├── main.jsx
    │   └── App.jsx
    ├── index.html
    ├── package.json
    └── Dockerfile
```

---

## What Each Service Is Teaching You

| Service | Real-world equivalent | What you learn |
|---|---|---|
| **HAPI FHIR** | Epic Interconnect / any FHIR endpoint | FHIR R4 resources, REST APIs, patient data |
| **Mirth Connect** | Epic Bridges | HL7 v2 channels, transformers, routing |
| **Keycloak** | Epic's auth / SMART on FHIR | OAuth2 flows, SMART scopes, tokens |
| **RabbitMQ** | Epic's internal event bus | Async messaging, event-driven architecture |
| **PostgreSQL** | Epic Chronicles (conceptually) | Data modeling, schemas, clinical data structures |

---

## Next: Module 1 — Registration / ADT

Once all tests pass, you're ready for Module 1.
In Module 1 you will:
- Build the patient registration UI and database schema
- Generate real HL7 ADT messages (A01, A03, A08)
- Route them through Mirth Connect channels
- Sync patient data to the FHIR server as Patient and Encounter resources

This is the **most fundamental workflow in all of healthcare IT.**
Every downstream system — lab, pharmacy, billing, scheduling — depends on ADT.

---

*MedCore EHR is a training environment. Not for clinical or production use.*
