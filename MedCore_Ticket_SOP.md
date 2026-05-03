# MedCore Interface Analyst — Ticket SOP
## Nixon Abuku | PR Seven Consulting
## Standard Operating Procedure for Working Any Ticket

---

## THE 6 STEP PROCESS

Every single ticket — no matter how simple or complex — follows this exact process. No exceptions.

---

### STEP 1 — READ

Read the ticket completely before touching anything.

Ask yourself:
- What is broken?
- Who reported it?
- Which system is affected?
- What is the priority — NORMAL, HIGH, CRITICAL?
- What is NOT affected? (this tells you where the problem is NOT)

**Rule: Never start investigating until you fully understand what is being reported.**

---

### STEP 2 — HYPOTHESIZE

Before opening DBeaver or Mirth — think first.

Ask yourself:
- Which HL7 message type is likely involved?
- Which segment and field is probably the problem?
- Which system sent the message?
- Which system received it?
- What could cause this specific symptom?

Write your hypothesis in one sentence:
*"I believe the problem is caused by _____ in the _____ message affecting the _____ field."*

**Rule: A hypothesis is not a guess. It is an educated prediction based on your HL7 knowledge.**

---

### STEP 3 — INVESTIGATE

Now you open your tools. In this order:

1. **DBeaver first** — query the database to find the data
2. **Mirth Connect second** — check channel logs for errors
3. **MedCore EHR third** — check what the UI is actually showing

Questions to answer during investigation:
- What does the raw data actually say?
- Does it match what the ticket reported?
- What SQL query proves or disproves your hypothesis?

**Rule: Write down every query you run and what it returned. This becomes your evidence.**

---

### STEP 4 — CONFIRM

Prove your hypothesis with real data. Not a feeling — evidence.

Ask yourself:
- Did my query confirm what I suspected?
- Can I show exactly which record is wrong?
- Can I show exactly which field has the problem?
- Can I explain WHY it happened — not just WHAT happened?

**Rule: You do not move to Step 5 until you can answer all four questions above.**

---

### STEP 5 — DOCUMENT

Write your findings clearly in the Investigation Notes field of the ticket.

Your documentation must include:
- What you found (the actual problem)
- Where you found it (which table, which field, which message)
- Evidence (the SQL query result or Mirth log entry)
- Root cause (why it happened)
- The fix (what was done or needs to be done)

**Template:**
```
INVESTIGATION FINDINGS — [Your Name] — [Date]

PROBLEM CONFIRMED:
[What is actually broken]

EVIDENCE:
[SQL query result or log entry proving the problem]

ROOT CAUSE:
[Why this happened]

FIX APPLIED / RECOMMENDED:
[What was done or needs to be done]
```

**Rule: If someone else reads your notes they should understand everything without asking you a single question.**

---

### STEP 6 — CLOSE

Mark the ticket as resolved only when:
- The problem is fixed or escalated with clear documentation
- Your investigation notes are complete
- You can explain the full story in 60 seconds

**Rule: A ticket is not closed until the documentation is complete. The fix without the documentation does not count.**

---

## QUICK REFERENCE — INVESTIGATION TOOLS

| Tool | What you use it for | How to access |
|------|-------------------|---------------|
| DBeaver | Query PostgreSQL database | Open DBeaver app |
| Mirth Connect | Check channel logs and errors | http://localhost:8444 |
| MedCore EHR | Check what the UI shows | http://localhost:3000 |
| Career Simulator | Read ticket and write notes | http://localhost:3011 |
| FHIR Server | Check patient resources | http://localhost:8081/fhir |

---

## QUICK REFERENCE — WHICH MESSAGE TO SUSPECT

| Symptom reported | First message to check |
|-----------------|----------------------|
| Patient appears twice | ADT^A01 or ADT^A08 |
| Demographics wrong in downstream system | ADT^A08 |
| Lab result not showing in chart | ORU^R01 |
| Order not received by lab | ORM^O01 |
| Result attached to wrong patient | ORU^R01 — check PID-3 |
| Document not appearing in portal | MDM^T02 |
| Patient not showing as discharged | ADT^A03 |
| Pharmacy demographics wrong | ADT^A08 routing |

---

## QUICK REFERENCE — FIRST SQL QUERIES TO RUN

**Find duplicate patients:**
```sql
SELECT last_name, first_name, date_of_birth, COUNT(*)
FROM [patient table]
GROUP BY last_name, first_name, date_of_birth
HAVING COUNT(*) > 1;
```

**Check recent messages:**
```sql
SELECT *
FROM [message log table]
WHERE received_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY received_date DESC;
```

**Find a specific patient:**
```sql
SELECT *
FROM [patient table]
WHERE last_name = 'Doe'
AND first_name = 'John';
```

---

## THE GOLDEN RULES

1. **Never panic.** Every problem has a cause. Your job is to find it systematically.
2. **Hypothesis before investigation.** Think before you query.
3. **Evidence before conclusion.** Prove it, do not assume it.
4. **Document everything.** If it is not written down it did not happen.
5. **Understand the why, not just the what.** The why prevents it from happening again.

---

*This SOP was created by Nixon Abuku as part of the MedCore EHR Healthcare Integration Training Program.*
*Last updated: May 3, 2026*
