# MedCore Progress — May 3, 2026
**Engineer:** Kenshi (Nixon Abuku)
**Day:** Sunday — Career Simulator Session 1
**Session:** 12pm — 4pm (extended session)

---

## What I Learned Today

**Master Patient Index (MPI):**
Epic has a built in MPI that runs before a new patient record is created. When registration staff enters a new patient the MPI checks for existing records with matching name, date of birth, address, and phone number. If a match is found above the confidence threshold it flags it for review before creating a new MRN. This is Layer 1 of duplicate prevention.

**Three layers of duplicate prevention in real hospitals:**
- Layer 1 — Epic MPI — catches duplicates before they are created. Owned by Epic analyst and registration supervisor.
- Layer 2 — ADT channel in Mirth — catches duplicates that slip past MPI before they reach downstream systems. Owned by Interface Analyst.
- Layer 3 — ADT^A40 patient merge message — cleans up duplicates after they are discovered. Owned by HIM department plus Interface Analyst.

**MLLP Framing — live error learned:**
When sending HL7 messages over TCP to Mirth Connect the message must be wrapped in MLLP framing characters. The VT character 0x0B must start the message and the FS character 0x1C plus CR must end it. Without this Mirth throws a FrameStreamHandlerException — "Start of message byte VT not detected." Learned this from a real live error in our Mirth instance.

**Mirth as a notification system — not a gatekeeper:**
Mirth does not sit between Epic and its own database. Epic writes patient data directly to its own database first. Mirth sits beside Epic and routes notification messages to downstream systems — lab, pharmacy, billing, FHIR, portal. Mirth is the bridge between systems, not the gatekeeper of the primary system.

**MedCore ADT channel gap:**
MedCore_Integration_Hub only has three destinations — lab orders, medication orders, and imaging orders. All three filter out ADT messages. When an ADT^A01 fires for patient registration it gets received by Mirth but filtered on all three destinations. No downstream system ever gets notified. This is a critical infrastructure gap.

**Real cases where duplicates slip past MPI:**
- Name variations — Bob vs Robert
- Data entry typos — transposed date of birth digits
- Name changes after marriage
- Unknown emergency patients registered as John Doe
- Different facilities on same system without cross-facility MPI
- HL7 interfaces that bypass the Epic registration screen entirely

---

## What Was Hard

Working TICK-00012 was genuinely difficult. Figuring out how the duplicate problem could be prevented required understanding the full stack — Epic MPI, Mirth channel architecture, FHIR database, and ADT message flow simultaneously. It took the entire session to trace the problem from the ticket description to the root cause.

---

## What Clicked

The ADT channel as Layer 2 of duplicate prevention. Even if a patient somehow bypasses the MPI — a properly configured Mirth ADT channel can check if that patient MRN already exists in downstream systems before routing the message. This gives the interface analyst a real tool to prevent duplicates from spreading. That is why TICK-00015 — building the ADT channel — is a patient safety issue, not just a configuration task.

---

## Hands-On Completed

- ✅ All spaced repetition reviews done — ADT^A08/A03 and MDM^T02
- ✅ MDM^T02 Anki deck built — 29 cards
- ✅ Python 3.13.5 confirmed installed
- ✅ MLLP error encountered and fixed on live Mirth instance
- ✅ Real SQL written in DBeaver — queried hfj_resource table
- ✅ Mirth Connect message log investigated — found message ID 21 filtered
- ✅ Real JavaScript filter rules read in Mirth — all 3 destinations
- ✅ Root cause of TICK-00012 identified
- 🔄 TICK-00012 documentation — in progress, closing tomorrow

---

## Career Simulator Status

| Ticket | Status | Finding |
|--------|--------|---------|
| TICK-00012 | 🔄 Open — closing tomorrow | Root cause: No ADT channel in MedCore. ADT^A01 for John Doe MRN M100099 received by Mirth message ID 21 but filtered on all 3 destinations. No duplicate created in FHIR database. Fix: Build dedicated ADT channel with duplicate detection logic. |

---

## Key Technical Findings

**Mirth channel filter rules discovered:**
- Destination 1 — Only Lab Orders — accepts ORM^O01 only
- Destination 2 — Only Med Orders — accepts RDE^O11 only
- Destination 3 — Only Imaging Orders — accepts ORM^O01 with RAD/IMG order type only
- ADT messages — filtered on ALL destinations — goes nowhere

**Database investigation:**
- Table: hfj_resource
- Query: SELECT * FROM hfj_resource WHERE res_type = 'Patient'
- Result: 4 rows — res_ids 1000, 1051, 1053, 1055
- No duplicate confirmed — John Doe MRN M100099 never reached FHIR

---

## New Artifacts Created Today

- ✅ MedCore_Ticket_SOP.md — 6 step ticket investigation process
- ✅ MedCore_Full_Roadmap_May4_2026.md — complete plan to Year 5
- ✅ MedCore_MDM_T02_Anki_Flashcards.csv — 29 cards

---

## Upcoming Certifications

| Certification | Target Date | Status |
|--------------|-------------|--------|
| HL7 V2.8 Control Specialist | May 30, 2026 | 🔄 Exam prep starts tomorrow |
| HL7 FHIR Proficiency | July 6, 2026 | Not started |
| Google IT Automation with Python | September 2026 | Not started |
| Epic Bridges | Year 1 — employer sponsored | After first job |

---

## Tomorrow — Monday May 4

| Time | What |
|------|------|
| 11:00am | Anki — weakness deck |
| 11:30am | Exam prep — HL7 encoding characters |
| 12:10pm | SQL Day 1 — first real healthcare SQL query |
| 1:00pm | Close TICK-00012 — final documentation |
| 2:10pm | Python Lesson 1 — first script ever |

---

## Spaced Repetition Due

| Topic | Next Review |
|-------|------------|
| MDM^T02 | Tomorrow May 4 |
| ADT^A08 + ADT^A03 | May 7 |
| ORU^R01 + OBX | May 6 |
| HL7 Week 1 full | May 4 |

