## April 29, 2026 — HL7 Day 3: ORU^R01

### What I Learned
- ORU^R01 is the result message sent by the lab back to the ordering system
- It contains ORC, OBR, and OBX segments
- OBX holds the actual test values, normal ranges, and abnormal flags (H/L)
- ORC-1 = RE in a ORU^R01, meaning "observations to follow"
- RE is the lab's way of saying: here come the results
- An ORU^R01 cannot exist without a prior ORM^O01 — the order creates the thread
- placer_order_num is the shared key linking the order to the result across systems
- Missing ordering provider on a result = data quality issue = real ticket

### What I Struggled With
- SQL: finding table names and columns using information_schema
- Remembering to include the column name after SELECT
- Typos in table names cause SQL errors — database is exact

### What Clicked
- An ORU message can't happen without an ORM message
- The placer order number is the thread that connects both messages
- I traced PLO300011 from the ORM order all the way to the result in the database

### Hands-On Completed
- Queried information_schema.columns to discover result_reports table structure
- Traced PLO300011 from orders table to results table
- Pulled raw HL7 from raw_hl7 column using SQL
- Read a full ORU^R01 cold — identified sender, receiver, filler number, and all 3 abnormal flags
- Identified Sodium HIGH, Chloride LOW, CO2/Bicarb LOW

### Spaced Repetition — Add to Review Table
| Message | Review Day |
|---|---|
| ORU^R01 | May 1 |
| OBX abnormal flags | May 1 |
| placer_order_num concept | May 1 |