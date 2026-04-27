# MedCore EHR — Progress Journal
**Engineer:** Nixon Abuku  
**Company (simulated):** PR Seven — Healthcare Integration Consulting  
**Goal:** Learn Epic integration engineering from scratch using open-source tools  
**Updated:** April 27, 2026

---

## Project Overview

MedCore EHR is a self-built healthcare integration training environment. It simulates the full clinical and financial workflow of a hospital EHR using real industry-standard tools. The goal is to build portfolio-ready skills for Epic integration engineer roles at companies like Nordic Consulting, Tegria, Impact Advisors, and Optum — without needing Epic access or prior healthcare IT experience.

**Live deployment:** http://167.172.130.64:3000  
**GitHub:** https://github.com/nixon-abuku/medcore-ehr  
**Local frontend:** http://localhost:3000  
**Career Simulator:** http://localhost:3011

---

## The PR Seven Concept

MedCore is being built as if **PR Seven** (a simulated healthcare IT consulting company) is delivering an integration project to a hospital client. This simulates the real-world structure of how integration projects work:

| Role | Responsibility |
|------|---------------|
| Project Manager | Manages timelines, tracks issues, communicates with hospital |
| Interface Analyst | Gathers requirements, designs message specs, documents flows |
| Integration Engineer | Builds Mirth channels, writes filters and transformers, tests |
| Support Engineer | Monitors production, troubleshoots issues, responds to tickets |

Kenshi plays all roles in the Career Simulator, building a complete understanding of how real healthcare IT projects are delivered.

**What PR Seven provides to hospitals:**
- Integration architecture design
- Mirth Connect channel development
- Data validation and quality filters
- Testing and UAT support
- Go-live support and monitoring
- Ongoing production support

---

## The Three Environments (Real World)

| Environment | Purpose | Who admits patients? |
|-------------|---------|---------------------|
| Development | Build and test integrations | Integration engineer (test data only) |
| UAT | Hospital staff test before go-live | Hospital staff (fake data) |
| Production | Real patients, real data | Nurses and doctors only |

**Key rule:** In production, integration engineers never click admit or enter patient data. They monitor messages and fix problems when they break.

---

## Tech Stack

| Tool | Purpose | Epic Equivalent |
|------|---------|----------------|
| React 18 + Vite + Tailwind | Frontend UI | Epic Hyperspace |
| Node.js microservices | Backend APIs | Epic application services |
| PostgreSQL | Database | Epic Chronicles |
| Mirth Connect 4.5.2 | Integration engine | Epic Bridges |
| HAPI FHIR R4 | FHIR API server | Epic FHIR APIs |
| Keycloak | OAuth2 / SMART on FHIR auth | Epic OAuth |
| RabbitMQ | Message queue | Epic event bus |
| Docker Compose | Container orchestration | Hospital IT infrastructure |

---

## Completed Modules

### ✅ Module 0 — Foundation
- Built Docker Compose stack with 23 containers
- Fixed Mac port conflicts: Mirth 8443→8444, HAPI FHIR 8080→8081
- Removed obsolete `version:` line from docker-compose.yml

### ✅ Module 1 — Registration / ADT
**Epic equivalent:** Prelude + ADT  
**HL7 messages learned:** ADT^A01, A03, A04, A08, A11  
**Key segments:** MSH, EVN, PID, PV1  
- Built patient registration UI
- Implemented admit, discharge, outpatient register, demographic update, cancel
- Built raw HL7 message viewer
- Test patients: John Doe MRN M100000, Marcus Webb MRN M100001, Brian Lucky MRN M100002
- Fixed: `dateStr.replace is not a function` bug in ADT service builder.js
- Fixed: React input focus lost after one character (Field component defined inside RegisterForm — moved outside permanently)

**Key concept learned:** MRN is the patient's permanent identifier. Every downstream system depends on ADT messages to stay in sync.

### ✅ Module 2 — Scheduling / Cadence
**Epic equivalent:** Cadence  
**HL7 messages learned:** SIU^S12, S15, S26  
**Key segments:** SCH, AIL, AIP  
- Built appointment scheduling system
- Provider schedules, slot generation, booking and cancellation workflow

### ✅ Module 3 — Orders / CPOE
**Epic equivalent:** CPOE  
**HL7 messages learned:** ORM^O01, RDE^O11  
- Built Computerized Provider Order Entry
- 28-item order catalog (lab, imaging, medications)
- Placer order number format: PLO3XXXXX

### ✅ Module 4 — Results
**Epic equivalent:** Beaker  
**HL7 messages learned:** ORU^R01  
**Key segments:** OBX with LOINC codes, values, units, reference ranges  
- Built results inbox
- Abnormal flags: H, L, HH (critical high), LL (critical low)

### ✅ Module 5 — Clinical Documentation
**Epic equivalent:** ClinDoc  
**HL7 messages learned:** MDM^T02  
- Draft → Sign workflow
- MDM^T02 fires on sign, not on save

### ✅ Module 6 — Billing & Charging
**Epic equivalent:** Resolute  
**HL7 messages learned:** DFT^P03, BAR^P01  
**X12 transactions:** 270/271 (eligibility), 837 (claim), 835 (remittance)

### ✅ Module 7 — Mock External Systems
- Mock Lab (MLLP port 6662, HTTP port 7001)
- Mock Pharmacy (MLLP port 6663, HTTP port 7002)
- Mock Radiology (MLLP port 6664, HTTP port 7003)

### ✅ Module 8 — Patient Portal
**Epic equivalent:** MyChart  
- Login with MRN (test: M100000)
- Dashboard: vitals, results, medications, appointments, problems, allergies
- FHIR R4 explorer

### ✅ Module 9 — Mirth Connect Deep Dive
**Epic equivalent:** Epic Bridges  
- Built MedCore_Integration_Hub channel
- End-to-end: Place CBC order → Mock Lab → ORU^R01 → Results Inbox ✅

### 🔄 Module 10 — Career Simulator (In Progress)
- AI-powered ticket evaluation using Claude API
- Clock in/out, ticket generation, skill tracking, XP system

---

## Career Simulator — Session 1 Results (April 26, 2026)

| Ticket | Title | Skill | Score | Status |
|--------|-------|-------|-------|--------|
| TICK-00001 | Mirth channel showing Errored status | MIRTH_CHANNELS | HIGH | ✅ Done |
| TICK-00002 | ADT messages not syncing to downstream systems | HL7_READING | 10/10 doc, 9/10 approach, +138 XP | ✅ Done |
| TICK-00003 | Audit: Find orders missing ICD-10 diagnosis codes | SQL_BASIC | 10/10 doc, 6/10 approach, +25 XP | ✅ Done |
| TICK-00004 | ADT messages not syncing to downstream systems | HL7_READING | 🔄 Open |
| TICK-00005 | Document the FHIR API for new mobile app vendor | FHIR_R4 | 🔄 Open |

---

## Bugs Fixed (April 27, 2026)

| Bug | File | Fix |
|-----|------|-----|
| Input focus lost after each keystroke | ADTModule.jsx | Moved Field component outside RegisterForm |
| `dateStr.replace is not a function` on admit | services/adt/hl7/builder.js | Wrapped dateStr in String() before calling .replace() |
| Ticket submission not persisting | CareerSimulator.jsx | Moved onResolved() to Back to Tickets button |
| Closed tickets showing Submit Resolution | CareerSimulator.jsx | Initialize showFeedback from ticket.status on load |

---

## HL7 Knowledge Earned

### The Four Core Segments (ADT message)

| Segment | Name | What it tells you |
|---------|------|-------------------|
| MSH | Message Header | Who sent it, who receives it, what type, when |
| EVN | Event | What event triggered the message |
| PID | Patient Identification | Patient demographics and MRN |
| PV1 | Patient Visit | Encounter details — location, doctor, class |

### Critical Fields to Know Cold

| Field | Meaning | Example |
|-------|---------|---------|
| MSH-3 | Sending application | MEDCORE_EHR |
| MSH-9 | Message type / trigger event | ADT^A01 |
| PID-3 | Medical Record Number (MRN) | M100001^^^MEDCORE^MR |
| PID-5 | Patient name (Last^First) | Webb^Marcus |
| PID-7 | Date of birth | 19880314 |
| PID-8 | Sex | M = Male, F = Female |
| PV1-2 | Patient class | I = Inpatient, O = Outpatient |
| PV1-3 | Location (Unit^Room^Bed) | 4 WEST^401^A |
| PV1-7 | Attending physician | 4^Kim^David^^^1234567893^NPI |
| PV1-19 | CSN (Encounter ID) | 200000016 |

### ADT Message Types

| Message | Meaning |
|---------|---------|
| ADT^A01 | Patient admitted |
| ADT^A03 | Patient discharged |
| ADT^A04 | Outpatient registered |
| ADT^A08 | Patient demographics updated |
| ADT^A11 | Admit cancelled |

### The Golden Rule of HL7 Structure

```
Every HL7 message = segments separated by carriage returns
Every segment = fields separated by pipes |
Every field = components separated by carets ^
```

---

## SQL Skills Learned

```sql
-- Basic select
SELECT * FROM orders.orders;

-- Filter with WHERE
SELECT * FROM orders.orders
WHERE clinical_indication IS NULL OR clinical_indication = '';

-- Group and count
SELECT order_type, COUNT(*) AS missing_indication_count
FROM orders.orders
WHERE clinical_indication IS NULL OR clinical_indication = ''
GROUP BY order_type
ORDER BY missing_indication_count DESC;
```

**Concepts mastered:** SELECT, FROM, WHERE, IS NULL, GROUP BY, COUNT, ORDER BY, schema-qualified table names

---

## Integration Engineering Concepts Learned

### The Source of Truth Rule
The application (EHR) is always the source of truth. Integration engineers never manually edit patient data or fix data by injecting raw messages. Always fix the source, let the application regenerate the message, and verify it flows downstream correctly.

### The Integration Engineer's Job
- Build and maintain Mirth channels
- Write JavaScript filters and transformers
- Monitor message flow in production
- Troubleshoot when messages break
- Never enter patient data in production
- Never fix application bugs — report them to the app team

### The Troubleshooting Workflow
When a downstream system isn't receiving data:
1. Check Mirth dashboard — is the channel started? Any errors?
2. Check Mirth message browser — are messages arriving?
3. Query `integration.message_log` — was the message generated?
4. If not in log → problem is upstream (the sending application)
5. If in log but errored → problem is in the Mirth channel config

### Three Integration Scenarios Mastered
1. **Wrong attending physician** → Check PV1-7 in the original message. Trace whether the error is in the EHR or in Mirth.
2. **Corrupted MRN** → Check PID-3. Build a Mirth JavaScript filter that rejects messages with MRN shorter than expected length.
3. **Wrong patient class** → Send ADT^A08 (not a new A01) with corrected PV1-2. Fix the source in the application first.

---

## Important Local Commands

```bash
# Go to main MedCore project
cd /Users/kenshi/Desktop/medcoreipr/medcore

# Go to Career Simulator
cd /Users/kenshi/Desktop/medcoreipr/simulator

# Start all containers
docker compose up -d

# Rebuild one service
docker compose up -d --build adt
docker compose up -d --build simulator-backend
docker compose up -d --build simulator-frontend
docker compose up -d --build frontend

# Query the database
docker compose exec postgres psql -U medcore -d medcore -c "YOUR QUERY HERE"

# Check message log
docker compose exec postgres psql -U medcore -d medcore -c "SELECT message_type, created_at FROM integration.message_log ORDER BY created_at DESC LIMIT 10;"

# Check all tables
docker compose exec postgres psql -U medcore -d medcore -c "\dt *.*"

# Apply portal route fix after restart
docker compose exec portal sed -i 's|/portal/|/|g' /app/index.js
docker compose restart portal
```

---

## Important Local URLs

| Service | URL |
|---------|-----|
| MedCore EHR | http://localhost:3000 |
| API Gateway | http://localhost:3001/health |
| HAPI FHIR | http://localhost:8081/fhir |
| Mirth Connect | https://localhost:8444 |
| Keycloak | http://localhost:8090 |
| RabbitMQ | http://localhost:15672 |
| Career Simulator | http://localhost:3011 |
| Simulator Backend | http://localhost:3010/health |
| Patient Portal | http://localhost:3000/portal |

---

## Known Issues / Watch List

| Issue | How to check |
|-------|-------------|
| Results /inbound endpoint not persisted | `docker compose exec results grep -n "inbound" /app/index.js` |
| Portal route fix not persisted after restart | `curl http://localhost:3009/health` — if 404, reapply fix |
| Mirth 9 errored messages (MDM^T02 XML parse) | Known, non-critical — radiology results still work via HTTP |
| Mirth channel may not survive Mirth restart | Open Mirth admin, verify MedCore_Integration_Hub shows Started |
| GitHub token was exposed in old chat | Revoke at https://github.com/settings/tokens and generate new one |

---

## Daily Log

### April 26, 2026
- Fixed Career Simulator ticket submission bug
- Built AI evaluator using Claude API (replaced keyword matching)
- Fixed closed tickets showing Submit Resolution
- Completed TICK-00001, TICK-00002, TICK-00003
- Learned SQL: SELECT, FROM, WHERE, GROUP BY, COUNT, ORDER BY
- Learned HL7 investigation: trace missing ADT^A08 through Mirth and database

---

### April 27, 2026 — HL7 Day 1

**Learned:**
- HL7 message structure: MSH → EVN → PID → PV1
- How to read a raw HL7 message cold without notes
- MSH-9 = message type (trigger event)
- PID-3 = MRN (patient's permanent ID)
- PV1-2 = patient class (I=Inpatient, O=Outpatient)
- PV1-7 = attending physician with NPI
- PV1-19 = CSN (encounter ID)
- ADT^A01 = admit, ADT^A08 = update, ADT^A03 = discharge

**Hands-on:**
- Read two real ADT^A01 messages (Marcus Webb, Brian Lucky) cold
- Explained each message out loud segment by segment
- Solved three real integration engineering scenarios from memory
- Registered and admitted three test patients (Marcus Webb M100001, Brian Lucky M100002)
- Fixed two bugs in ADTModule.jsx and builder.js

**Key concepts understood:**
- The application is always the source of truth
- Integration engineers never fix application bugs — they report them
- In development, you admit test patients to generate test messages
- In production, only nurses and doctors enter patient data
- PR Seven concept: simulating a full healthcare IT consulting company

**What I can do now:**
- Read any ADT HL7 message and explain it clearly
- Identify which segment and field contains any piece of patient data
- Choose the correct ADT message type for any clinical event
- Troubleshoot a message mismatch by tracing it through the integration stack

**Question for tomorrow:**
What does an ORM^O01 message look like? How is it different from an ADT message?

**Time spent:** 2 hours (12pm — 2pm)

---

## Learning Schedule

**Monday to Friday: 12pm — 2pm**

| Week | Topic |
|------|-------|
| Week 1-2 | HL7 Fundamentals |
| Week 3-4 | SQL for Healthcare |
| Week 5-7 | Mirth Connect from scratch |
| Week 8 | FHIR R4 |

**Friday routine:** Last 20 minutes = interview questions on that week's topic

---

## Next Steps

1. Tomorrow 12pm — HL7 Day 2: ORM^O01 (Orders)
2. Complete TICK-00004 and TICK-00005 in Career Simulator
3. Plan PR Seven company simulation structure in MedCore
4. Fix Mirth MDM^T02 XML parse error
5. Get domain name for DigitalOcean deployment
6. Set up Nginx + SSL on DigitalOcean

---

## Career Context

MedCore is an honest training environment — not a claim to have Epic experience.

**Target employers:** Nordic Consulting, Tegria, Impact Advisors, Optum, Netsmart

**What MedCore demonstrates:**
- HL7 v2 message reading and routing
- Mirth Connect channel configuration and troubleshooting
- FHIR R4 API understanding
- SQL for healthcare data audits
- Docker and microservices for integration infrastructure
- Revenue cycle and billing workflow understanding
- Full understanding of how healthcare IT projects are delivered (PR Seven model)

---

*MedCore EHR — Not for clinical or production use. Training environment for Epic integration engineering self-study.*
