---
name: reviewer
description: Reviews things.
model: opus
tools: Read, Grep
disallowedTools:
  - Write
  # a comment inside the list
  - Edit
skills:
  - fixture-full:alpha
maxTurns: 7
---

# Reviewer

Reads only.
