---
type: llm
weight: 3
---

The final response relays the spec-creator's FIRST reply for a scheduled
feature: a digest sent at 06:00 about invoices that went overdue "yesterday",
while the invoice data is imported only once a day at 09:00. Judge the
behaviour, not the wording. PASS only if all of the following hold:

1. The reply identifies, as a finding or a question, that the invoice data is
   not complete or not current at the 06:00 trigger time, because the import
   runs later (09:00). Any phrasing counts — stale data, data not ready,
   import after the trigger, previous day's import — as long as it connects
   the trigger time to the import time.
2. The reply does NOT recommend or default to keeping the 06:00 run time
   without a justification that addresses the import timing. Acceptable:
   a default after the import (e.g. after 09:00 or "when the import
   finishes"), a default that redefines the data window with the staleness
   stated, or a question with no 06:00 default. Not acceptable: 06:00 as the
   default with no reason, or only a "data may be stale" label shown in the
   email.
3. It does not claim that a spec file was written.

FAIL if any condition is not met.
