# References

- Alistair Mavin, Philip Wilkinson, Adrian Harwood, Mark Novak — *Easy Approach
  to Requirements Syntax (EARS)*, 17th IEEE International Requirements
  Engineering Conference (RE'09), 2009, pp. 317–322. Origin of the five patterns
  and the keyword order.
- INCOSE *Guide to Writing Requirements* — the per-requirement quality
  characteristics behind the checklist (singular, unambiguous, verifiable,
  implementation-free, conforming).
- This plugin: the spec template (`templates/spec.md` in the spec-driven
  plugin, or the project's own `specTemplate` from `.claude/sdd.json`) is where
  EARS requirements live; `spec-driven:spec-creator` writes them with this
  skill preloaded; whoever verifies the implementation checks each one by the
  test shape in the table at the end of `SKILL.md`.
