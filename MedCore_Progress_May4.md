# MedCore Progress — May 4, 2026
**Engineer:** Nixon Abuku (Kenshi)
**Week:** Week 2 Day 1 — SQL for Healthcare
**Session:** 11am — 3pm + evening

---

## What I Learned Today

**SQL — SELECT, FROM, WHERE, ORDER BY:**

Refreshed and applied the core SQL query structure against a real healthcare training database. Learned that SELECT controls which columns come back, FROM tells PostgreSQL which table to look in, WHERE filters the rows, and ORDER BY sorts the results.

Learned that dates in PostgreSQL must always be wrapped in single quotes in the format YYYY-MM-DD. Found this out from a real error — wrote a date as an integer and PostgreSQL threw a type mismatch error. Fixed it by adding single quotes around the date.

Also learned why we write adt.patients instead of just patients. PostgreSQL needs the schema name to know exactly where the table lives. Without the schema name PostgreSQL looks in the public schema by default and throws an error because there is no patients table there.

**Python — variables and f-strings:**

Wrote my first Python scripts in VS Code. A variable is a box that stores a value and you can use that value anywhere in your code. Learned f-strings — by putting f before the quote and wrapping a variable name in curly braces, Python replaces the curly braces with the actual value stored in that variable. Without the f, curly braces print as literal text.

Applied both concepts to a healthcare scenario — stored patient name, MRN, message type, and facility as variables and printed them using f-strings to simulate what an HL7 message header looks like in Python.

---

## What Was Hard

Nothing felt hard today. The pacing was right and everything built naturally on what was already started in Week 1.

---

## What Clicked

F-strings. Once I understood that Python prints exactly what you type character by character including spaces, and that the f tells Python to treat curly braces as instructions rather than literal text, everything made sense. Also understood that the space between {first_name} and {last_name} in the f-string is exactly what creates the space in the output.

---

## Hands-On Completed

- ✅ Anki — weakness deck 14 cards
- ✅ Block 2 exam prep — encoding characters, escape sequences, data types
- ✅ Scored 2 out of 2 on real practice exam questions
- ✅ Built Block 2 Anki deck — 43 cards covering all encoding characters and data types
- ✅ TICK-00012 — closed with full investigation notes and resolution notes
- ✅ Deployed medcore_training database — completely separate from live medcore EHR database
- ✅ Connected medcore_training to DBeaver on port 5435
- ✅ SQL Day 1 — wrote real queries against 50 patient records in the training database
- ✅ Python Lesson 1 — first script, variables, f-strings running in VS Code
- ✅ Spaced repetition R3 reviews — ADT^A01, ORM^O01, HL7 Structure

---

## SQL Queries Written Today

All written from scratch — no copy paste:

```sql
-- Select specific columns from Patient resources in MedCore FHIR database
SELECT res_id, res_type
FROM hfj_resource
WHERE res_type = 'Patient';

-- Female patients sorted alphabetically by last name
SELECT mrn, first_name, last_name, city
FROM adt.patients
WHERE gender = 'F'
ORDER BY last_name ASC;

-- Patients born before 1960 sorted oldest first
SELECT *
FROM adt.patients
WHERE date_of_birth < '1960-01-01'
ORDER BY date_of_birth ASC;
```

Real error encountered and fixed today: used an integer instead of a quoted date string. PostgreSQL threw operator does not exist: date < integer. Fixed by wrapping the date in single quotes with format YYYY-MM-DD.

---

## Python Scripts Written Today

File: /Users/kenshi/Desktop/python-training/lesson1.py

```python
patient_name = "Marcus Webb"
mrn = "M100001"
message_type = "ADT^A01"
facility = "MedCore Medical Center"

print(f"Message Type: {message_type}")
print(f"Patient: {patient_name}")
print(f"MRN: {mrn}")
print(f"Facility: {facility}")
```

---

## Training Database Built Today

Created medcore_training — a dedicated PostgreSQL database completely separate from the live medcore EHR database for safe SQL practice.

| Schema | Tables | Data |
|--------|--------|------|
| adt | patients, providers, encounters | 50 NJ patients, 10 providers, 28 encounters |
| orders | orders | 45 orders including STAT, ROUTINE, ERROR, CANCELLED |
| results | result_reports | 44 results with H, L, N, C abnormal flags |
| integration | message_log | 30 real HL7 messages including SENT and ERROR statuses |
| billing | charges | 20 charges with PAID, DENIED, PENDING statuses |

---

## Career Simulator

| Ticket | Status | Finding |
|--------|--------|---------|
| TICK-00012 | ✅ Closed | Root cause: No dedicated ADT channel exists in MedCore. All 3 Mirth destinations filter ADT messages and only accept order messages. ADT^A01 for John Doe MRN M100099 received on Mirth message ID 21 but filtered on all 3 destinations — never reached FHIR server. Recommended building dedicated ADT channel with MPI duplicate checking logic. ADT channel build scheduled Week 3. |

---

## Exam Prep Progress

| Week | Topic | Status |
|------|-------|--------|
| Week 1 Day 1 | Encoding characters and data types | ✅ Complete |
| Week 1 Day 2 | Escape sequences deep dive | Tomorrow May 5 |
| Week 1 Day 3 | Data types HD, CX, XPN | Wednesday May 6 |
| Week 1 Day 4 | Field optionality R, O, C, B, RE, W | Thursday May 7 |
| Week 1 Day 5 | Full quiz graded | Friday May 8 |

---

## Spaced Repetition Status

| Topic | Learned | R3 Today | Next Review |
|-------|---------|----------|-------------|
| HL7 Structure | Apr 27 | ✅ Done | May 11 |
| ADT^A01 | Apr 27 | ✅ Done | May 11 |
| Integration Engineer Role | Apr 27 | ✅ Done | May 11 |
| ORM^O01 | Apr 28 | ✅ Done | May 12 |
| ORU^R01 + OBX | Apr 29 | Due May 6 | May 6 |
| ADT^A08 + A03 | Apr 30 | Due May 7 | May 7 |
| MDM^T02 | May 1 | Due May 8 | May 8 |

---

## Tomorrow — Tuesday May 5

| Time | What |
|------|------|
| 11:00am | Anki — OBX deck + spaced repetition |
| 11:30am | Exam prep — escape sequences deep dive |
| 12:10pm | SQL Day 2 — AND, OR, IS NULL, multiple conditions |
| 2:10pm | Python Lesson 2 — data types and numbers |

