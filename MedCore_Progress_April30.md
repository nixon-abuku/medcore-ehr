# MedCore Progress — April 30, 2026
## HL7 Day 4: ADT^A08 + ADT^A03

### What I Learned
- **The full ADT lifecycle of a hospital visit:**
  - **ADT^A01** — fires when a patient is admitted
  - **ADT^A08** — fires when a patient's demographics are updated (phone, address, email, insurance, etc.)
  - **ADT^A03** — fires when a patient is discharged
- All three messages share the **same four segments** — MSH, EVN, PID, PV1. The only thing that changes between them is **MSH-9** (the message type field).
- The carat `^` is the component separator in HL7. So `ADT^A08` means: ADT family + A08 trigger event.
- **CSN vs MRN** — two different identifiers I see all the time in MedCore:
  - **MRN** = Medical Record Number — identifies the *patient* (one per person, lifelong)
  - **CSN** = Contact Serial Number — identifies the *encounter* (a new one for each hospital visit)
- A08 is tied to the **MRN** because demographics belong to the person, not the visit.
- A01 and A03 are tied to the **CSN** because they're about a specific encounter.
- The real-world Epic flow: **Epic DB → Epic Bridges → MLLP → Mirth Connect → downstream systems (billing, lab, pharmacy)**. Each downstream system has its own database. HL7 messages are the glue that keeps all of them in sync.
- "Logged ≠ delivered." A row in `integration.message_log` with status SENT only means the ADT service tried to send. Whether Mirth actually received and forwarded it is a separate question — and a real source of production bugs.

### What I Struggled With
- I was confused about whether A03 (discharge) affects ORU^R01 (results). I thought discharging a patient might cancel pending lab results.
- I had to slow down on **segment vs. field** distinctions. PID is the whole segment; PID-3 is one specific field inside it. The number after the dash matters in interviews.

### What Clicked
- **All ADT messages have the same skeleton — only MSH-9 changes.** Once I read my own A08 and A03 raw HL7 in DBeaver back-to-back, I could see it with my own eyes. Same MSH, same EVN, same PID, same PV1 structure — different message type label.
- A03 closes the encounter to **new activity**. It does NOT cancel work already in progress. Pending lab orders still come back as ORU^R01 messages and route to the ordering provider's inbox. This is critical patient safety logic.
- The placer order number is the thread that connects an order to its result, regardless of whether the patient is still admitted.

### Hands-On Completed
- Reviewed ORU^R01 (R1 cold explanation) — scored 83/100
- Reviewed ORM^O01 (R2 — three questions from memory) — scored 73/100, scheduled re-test on Sunday
- Investigated `services/adt/routes/patients.js` and discovered the A08 backend was already fully wired — only the UI was missing
- Built a new **Update Demographics** dialog in `ADTModule.jsx` (purple theme, fires `PUT /api/adt/patients/:mrn`)
- Added an **Update** button on every Census row (between HL7 and Discharge)
- Fired my first ADT^A08 against Marcus Webb (M100001) with fake demographics
- Verified the A08 landed in `integration.message_log` via DBeaver
- Read the raw A08 message segment by segment and saw my fake address, phone, and marital status living inside the PID segment
- Built a **clickable HL7 viewer** for the Message Log tab — click any row to see the raw HL7 in a color-coded modal (MSH yellow, EVN purple, PID green, PV1 blue, ORC pink, OBR orange, OBX cyan)
- Added a `GET /messages/:id` endpoint to the ADT service (`services/adt/index.js`) for single-message lookup
- Tested the new endpoint in isolation with `curl` before touching the frontend
- Restarted the ADT service with `docker compose restart adt` (no full stack restart needed)
- Fired ADT^A03 against Jack Adams (M100003) — verified discharge in Census view (patient dropped off the inpatient list)
- Read the raw A03 in DBeaver and walked through every segment

### Bugs Found (Real Tickets)
- **TICK-00006** — HL7 viewer on the Census tab only fetches messages by CSN. It misses patient-level messages like A08 (which are tied to MRN, not CSN). Should be enhanced to do MRN-based lookup as well.
- **TICK-00007** — `buildA03()` is not populating PV1-45 (discharge_datetime) properly. The field is essentially empty in the generated HL7. Billing relies on this field to calculate length of stay and finalize claims.

### Spaced Repetition — Add to Review Table
| Topic | Learned | R0 (tonight) | R1 | R2 | R3 |
|---|---|---|---|---|---|
| ADT^A08 — Demographic Update | Apr 30 | Apr 30 9pm | May 1 | May 3 | May 7 |
| ADT^A03 — Discharge | Apr 30 | Apr 30 9pm | May 1 | May 3 | May 7 |
| CSN vs MRN distinction | Apr 30 | Apr 30 9pm | May 1 | May 3 | May 7 |
| Real-world Epic→Bridges→Mirth flow | Apr 30 | Apr 30 9pm | May 1 | May 3 | May 7 |

### Tomorrow (Day 5 — Friday May 1)
- R1 review for ADT^A08 + ADT^A03
- R2 review for ORU^R01 + OBX
- New lesson: **MDM^T02** (Clinical Documentation message)
- Full HL7 cold-read drill
- 5 timed interview questions (Friday Interview Prep)