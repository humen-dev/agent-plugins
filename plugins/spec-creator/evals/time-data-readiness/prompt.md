---
runs: 2
max_turns: 10
allowed_tools: [Agent, Read, Glob, Grep]
plugins: ["../.."]
tags: [spec-creator, lens-f, time-and-data-readiness]
---

Use the spec-creator:spec-creator agent to start a spec for this feature.

- Feature: "Every morning at 06:00, email the finance team a digest of the
  invoices that went overdue yesterday."
- Mode: create
- Design sources: text brief only, no designs. Facts about the existing system:
  - Invoices and their payment status are imported from the billing provider
    by a batch job that runs once a day at 09:00 server time.
  - Until that import finishes, the stored invoices reflect the state of the
    previous day's 09:00 import.
  - The team works 08:00–17:00 in the same time zone as the server.

Relay the agent's reply to me verbatim. Do not answer its questions yourself and
do not invoke it a second time.
