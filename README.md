# MedCore EHR — Healthcare Integration Training Environment

A complete Epic-equivalent EHR built for learning healthcare integration engineering. Built with real HL7 v2 messaging, Mirth Connect routing, HAPI FHIR R4, and a patient portal.

## What This Is

MedCore simulates the full clinical and financial workflow of a hospital EHR — the same workflows that Epic, Cerner, and other enterprise systems use in production. Every HL7 message, every integration pattern, and every clinical workflow is based on real healthcare IT standards.

Built as a self-study program for Epic integration engineering certification.

## Modules

| Module | Epic Equivalent | Key Technology | Status |
|--------|----------------|----------------|--------|
| Registration / ADT | ADT/Registration | ADT^A01/A03/A08/A11 | ✅ Complete |
| Scheduling | Cadence | SIU^S12/S15/S26 | ✅ Complete |
| Orders (CPOE) | Beaker / Willow / Radiant | ORM^O01, RDE^O11 | ✅ Complete |
| Results | Beaker Results / In Basket | ORU^R01, OBX segments | ✅ Complete |
| Clinical Documentation | ClinDoc | MDM^T02, TXA segment | ✅ Complete |
| Billing & Charging | Resolute | DFT^P03, X12 837/835 | ✅ Complete |
| Mock External Systems | Vendor LIS/RIS/Pharmacy | MLLP, Mirth Connect | ✅ Complete |
| Patient Portal | MyChart | FHIR R4, SMART on FHIR | ✅ Complete |

## Tech Stack

- **Frontend:** React 18, Tailwind CSS, Vite
- **Backend:** Node.js microservices (one per clinical module)
- **Database:** PostgreSQL with clinical schemas
- **Integration Engine:** Mirth Connect 4.5.2
- **FHIR Server:** HAPI FHIR R4
- **Auth:** Keycloak (OAuth2 / SMART on FHIR)
- **Message Queue:** RabbitMQ
- **Infrastructure:** Docker Compose (19 containers)

## HL7 Messages Implemented

ADT^A01, ADT^A03, ADT^A04, ADT^A08, ADT^A11, SIU^S12, SIU^S15, SIU^S26, ORM^O01, RDE^O11, ORU^R01, MDM^T02, DFT^P03, BAR^P01, X12 270/271, X12 837, X12 835

## How to Run

```bash
git clone https://github.com/nixon-abuku/medcore-ehr.git
cd medcore-ehr

docker compose up -d
```

Open http://localhost:3000

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | — |
| API Gateway | http://localhost:3001/health | — |
| HAPI FHIR | http://localhost:8081/fhir | — |
| Mirth Connect | https://localhost:8444 | admin / admin |
| Keycloak | http://localhost:8090 | admin / admin |
| RabbitMQ | http://localhost:15672 | guest / guest |
| PostgreSQL | localhost:5432 | medcore / medcore |

## End-to-End Message Flow
Place lab order in MedCore
↓
ORM^O01 sent to Mirth Connect via MLLP
↓
Mirth routes to Mock Lab (LIS) on port 6662
↓
Mock Lab generates realistic values with LOINC codes
↓
ORU^R01 result sent back through Mirth
↓
Result appears automatically in Results Inbox
with OBX values, abnormal flags (H/L/HH/LL)

## What You Learn Building This

- HL7 v2 message structure and all major segment types (MSH, PID, PV1, ORC, OBR, OBX, TXA, FT1)
- How Epic ADT, Cadence, Beaker, Willow, Radiant, and Resolute integrate
- Mirth Connect channel building and JavaScript transformers
- Placer/filler order number concept
- MLLP protocol for HL7 transport
- FHIR R4 resources and SMART on FHIR OAuth2 flow
- X12 EDI transactions for healthcare billing
- Full clinical workflow from patient registration through billing and patient portal

---

*MedCore EHR is a training environment. Not for clinical or production use.*