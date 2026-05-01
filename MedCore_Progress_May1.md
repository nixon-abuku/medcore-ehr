# MedCore Progress — May 1, 2026
**Engineer:** Kenshi (Nixon Abuku)
**Day:** 5 of 5 — Week 1 Complete
**Session:** 12pm – 2pm

---

## What I Learned

- **MDM^T02** — Medical Document Management message. Sent when a clinical document is created and needs to travel between systems (discharge summary, operative note, radiology report, consent forms).
- MDM^T02 shares the same core segments as ORU^R01 (MSH, PID, PV1, ORC, OBX) but adds two new segments: **EVN** (event type T02) and **TXA** (Transcription Document Header — controls document type and authentication status).
- Key difference: OBX-2 = **NM** (Numeric) in ORU^R01. OBX-2 = **TX** (Text) in MDM^T02. This changes how OBX-5 is handled — a number vs a full clinical document.
- **Why MDM^T02 breaks Mirth channels:** OBX-5 in MDM contains free text with special characters and pipe characters. XML parsers fail on this. ORU^R01 OBX-5 is a clean number — no parsing issues.

---

## What I Struggled With

- **Filler order number** — knew the concept existed but could not define it cleanly under pressure. Gap: the filler is the performing system (lab) and it assigns its own ID to the order. That ID lives in ORC-3 and OBR-3.
- **MSH-3 vs MSH-4** — still mixing up Application (software) vs Facility (location). MSH-3 = sending application. MSH-4 = sending facility.
- **OBR-4 vs OBR-3** — called OBR-3 the test name. It is not. OBR-4 = test name (Universal Service ID). OBR-3 = filler order number.
- **Always give value + direction** when naming abnormal results — not just the flag letter.

---

## What Clicked

- MDM^T02 and ORU^R01 share the same skeleton but OBX-2 tells the system how to read OBX-5. NM = treat it as a number. TX = treat it as a document. That one field changes everything downstream.
- The reason MDM^T02 broke TICK-00001 in the Career Simulator — now fully understood.

---

## Hands-On Completed

- ✅ R2 review — ORU^R01 + OBX (scored 47/100 — gaps identified and added to Anki)
- ✅ R1 review — ADT^A08 + ADT^A03
- ✅ MDM^T02 lesson complete
- ✅ Full Week 1 cold drill — unrecognized patient, unrecognized message (scored 73%)
- ✅ 5 interview questions — Week 1 HL7 (scored 70%)
- ✅ Anki weakness deck built — 35 cards covering every gap from this week
- ✅ Anki general deck built — 63 cards covering all segment fields

---

## Spaced Repetition Status

| Topic | Learned | R0 | R1 | R2 | R3 | R4 |
|-------|---------|----|----|----|----|-----|
| HL7 Structure | Apr 27 | ✅ | ✅ | ✅ | May 4 | May 11 |
| ADT^A01 | Apr 27 | ✅ | ✅ | ✅ | May 4 | May 11 |
| Integration Engineer Role | Apr 27 | ✅ | ✅ | ✅ | May 4 | May 11 |
| Source of Truth | Apr 27 | ✅ | ✅ | ✅ | May 4 | May 11 |
| SQL Basics | Apr 26 | ✅ | ✅ | ✅ | May 4 | May 11 |
| ORM^O01 | Apr 28 | ✅ | ✅ | ✅ | May 5 | May 12 |
| ORU^R01 + OBX | Apr 29 | ✅ | ✅ | ✅ | May 6 | May 13 |
| ADT^A08 + A03 | Apr 30 | ✅ | ✅ | May 3 | May 7 | May 14 |
| MDM^T02 | May 1 | Tonight | May 3 | May 4 | May 8 | May 15 |

---

## Interview Score This Week

| Day | Topic | Score |
|-----|-------|-------|
| Day 5 | HL7 Week 1 Drill | 73% |
| Day 5 | HL7 Interview Questions | 70% |

Target by Week 5: 90%+

---

## Week 1 Summary — COMPLETE ✅

| Day | Date | Topic | Status |
|-----|------|-------|--------|
| 1 | Apr 27 | ADT^A01 — Admission | ✅ |
| 2 | Apr 28 | ORM^O01 — Orders | ✅ |
| 3 | Apr 29 | ORU^R01 + OBX — Results | ✅ |
| 4 | Apr 30 | ADT^A08 + ADT^A03 — Update + Discharge | ✅ |
| 5 | May 1 | MDM^T02 + Full Drill + Interview Prep | ✅ |

---

## Tomorrow

- Saturday May 2 — 🔴 FULL REST. No Anki. No studying.
- Sunday May 3 — Career Simulator begins. TICK-00004 + TICK-00005.
- Monday May 4 — Week 2 starts. SQL Day 1.

---

## Anki Status

- ✅ General deck downloaded — 63 cards (all segment fields)
- ✅ Weakness deck downloaded — 35 cards (every gap from Week 1)
- Tonight: Import both decks. Do MSH weakness cards only.

