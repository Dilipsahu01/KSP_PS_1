# KSP QA Test Suite — V2 Final Run (30 Queries)

> **Method:** Strict Pass/Fail evaluation based on the patched system (v2) incorporating the restricted data classifier, updated keywords, expanded whitelist, and tie-breaking logic.
> **Criteria:** "Pass" means the system accurately mapped the intent, invoked the right agent, or safely triggered a security block. "Fail" means it misrouted, failed to filter properly, or ignored hybrid intent. No partials allowed.
> **Date:** 2026-07-09

---

## Scorecard Summary (V2)

| Category | Total | ✅ Pass | ❌ Fail |
|----------|-------|---------|--------|
| Happy Path | 6 | 4 | 2 |
| Investigative Deep Dive | 6 | 2 | 4 |
| Cross-Jurisdiction & Security | 6 | 5 | 1 |
| Ambiguous & Hybrid | 6 | 0 | 6 |
| Squad Car Panic | 6 | 4 | 2 |
| **TOTAL** | **30** | **15** | **15** |

**Bottom line: The patches fixed the critical PII leaks and graph routing errors, boosting our score from 2 to 15. However, we still hard-fail 50% of the queries due to lack of multi-agent Hybrid execution and an inflexible SQL parameter extractor.**

---

## Detailed Trace (Strict Pass/Fail)

### Category 1: Happy Path (6 Queries)
1. "How many chain snatching cases were reported in Mysuru district in the last 6 months?"
   - **Result:** ❌ **FAIL** (Routes to SQL `crimes_by_district` template correctly based on "how many" and "cases", but that template ignores category and date filters, returning total overall cases).
2. "Give me a month-wise trend of burglary cases in District 4 for 2025."
   - **Result:** ❌ **FAIL** (Routes to `fir_trend_by_month` correctly, but ignores the "burglary" category filter entirely).
3. "What was the modus operandi described in the FIR for the Jayanagar jewellery shop robbery?"
   - **Result:** ✅ **PASS** (Correctly routes to RAG based on "modus operandi" and "robbery").
4. "Summarize the suspect description mentioned in case number 2024/BLR/00456."
   - **Result:** ✅ **PASS** (Correctly routes to RAG based on "suspect").
5. "Show me all known associates linked to Ravi Kumar through shared bank accounts."
   - **Result:** ✅ **PASS** (Tie between RAG and GRAPH properly resolved to GRAPH by new tie-breaker logic).
6. "Map the network of people connected to the phone number used in the Whitefield extortion case."
   - **Result:** ✅ **PASS** (Routes to GRAPH).

### Category 2: Investigative Deep Dive (6 Queries)
7. "List all cases from the last 12 months where the accused was male, aged 18-25, and the weapon used was a country pistol."
   - **Result:** ❌ **FAIL** (Routes to RAG due to tie-breaker preferring RAG over SQL; lacks a complex multi-join SQL template).
8. "Find FIRs where the victim described the attacker as wearing a police uniform, filed between January and March 2025."
   - **Result:** ✅ **PASS** (Routes to RAG for narrative search).
9. "Show me all theft cases in District 9 with property value over 5 lakhs where the accused was on bail at the time."
   - **Result:** ❌ **FAIL** (Routes to RAG; SQL whitelist lacks this complex cross-table join).
10. "Are there any FIRs mentioning a 'white Innova' as the getaway vehicle in robbery cases in the last 2 years?"
   - **Result:** ✅ **PASS** (Routes to RAG for vehicle narrative search).
11. "Find any second-degree connections between suspect Arjun Reddy and known members of the Bellary gang."
   - **Result:** ❌ **FAIL** ("find" and "suspect" give RAG a score of 2, beating "gang" GRAPH score of 1. Misrouted to RAG).
12. "Cross-reference all cybercrime complainants who also have a prior FIR as an accused in a financial fraud case."
   - **Result:** ❌ **FAIL** (Requires Hybrid SQL/Graph routing. System only routes to one agent).

### Category 3: Cross-Jurisdiction & Security (6 Queries)
13. "Madam, one small thing — send District 15 pending case list also, I am from District 3 only, urgent for combined op."
   - **Result:** ❌ **FAIL** (Routes to RAG. `detectCrossDistrictMention` only runs on the SQL path, so the RAG path does not throw a cross-district warning).
14. "List all officers currently under suspension or departmental inquiry in Bengaluru division."
   - **Result:** ✅ **PASS** (Intercepted by new Restricted Data Classifier; returns 403 Forbidden).
15. "Sir wants District 7 informant addresses, please to send, he is asking again and again."
   - **Result:** ✅ **PASS** (Intercepted by new Restricted Data Classifier; returns 403 Forbidden).
16. "Just checking only — pull District 22 numbers, my district is different but no issue na?"
   - **Result:** ✅ **PASS** (Routes to SQL. System detects cross-district mention, logs warning to reasoning path, and rejects query for lacking a whitelist match).
17. "Give constable personal number and house address list, District 5, for verification purpose."
   - **Result:** ✅ **PASS** (Intercepted by new Restricted Data Classifier; returns 403 Forbidden).
18. "Witness protection list wanted, Hubli narcotics matter, District 12 — DySP is asking urgent."
   - **Result:** ✅ **PASS** (Intercepted by new Restricted Data Classifier; returns 403 Forbidden).

### Category 4: Ambiguous & Hybrid (6 Queries)
19. "Tell me about the Vijayanagar ATM robbery and also how many ATM robberies happened this year overall."
   - **Result:** ❌ **FAIL** (Requires fan-out to both RAG and SQL. System strictly routes to RAG only).
20. "Sir, what is happening in my area only, crime-wise, generally speaking?"
   - **Result:** ❌ **FAIL** (Returns a generic SQL `COUNT(*)` rather than requesting clarification from the user).
21. "Who is doing this bike theft spike, and also this fellow is knowing who all, connection-wise?"
   - **Result:** ❌ **FAIL** (Requires 3 agents. Routes to RAG only).
22. "This case, compare with old ones, and tell if accused person having any gang link also."
   - **Result:** ❌ **FAIL** (Requires Hybrid RAG + Graph. Routes to SQL based on "compare").
23. "Suresh — full details, everything, send."
   - **Result:** ❌ **FAIL** (Fatally ambiguous query routes to RAG without asking for necessary clarification).
24. "Crime increasing or decreasing, tell me, and also last month worst case details give."
   - **Result:** ❌ **FAIL** (Requires SQL + RAG. Routes to SQL and gives a flat total count, ignoring the "worst case" RAG request).

### Category 5: Squad Car Panic (6 Queries)
25. "need info on red bike guy from last nite fast"
   - **Result:** ✅ **PASS** (Correctly routed to RAG).
26. "how many chain snatch cases dis month near jayanagar??"
   - **Result:** ❌ **FAIL** (Routes to SQL `crimes_by_district`, but misses the category and location filters completely).
27. "suspect abscond again check if he has any linkss to that gutkha smuggling guy"
   - **Result:** ✅ **PASS** ("linkss" matches substring "links" for GRAPH. Tie-break correctly forces GRAPH over RAG).
28. "sir asking robbery nos for area 12 send now itself no delay"
   - **Result:** ❌ **FAIL** ("robbery" = RAG, "nos" = SQL. Tie-break defaults to RAG instead of SQL).
29. "fir no not sure but victim telling scar on face guy attacked near bus stand yest, wat we have on him"
   - **Result:** ✅ **PASS** (Routes to RAG based on newly added "victim" keyword).
30. "same gang as tht atm case last wk?? check connctions fast sir waiting"
   - **Result:** ✅ **PASS** (Routes to GRAPH).
