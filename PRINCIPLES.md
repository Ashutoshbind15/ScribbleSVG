# Principles

How we write and review changes. Short on purpose.

## Building

- Prove it in the running editor. A change isn't done until you've watched it
  work in the playground or site. A clean typecheck or a careful read is not
  proof.
- Subtract before adding. Before writing code, look for what you can delete,
  reuse or extend. Every dependency and every kilobyte ships to someone else's
  page.
- Find the shape first. For non-trivial work, sketch the types, signatures and
  where the code lives (pure logic in core or a plain module, React only where
  it has to be) before filling it in.
- Keep boundaries clean. Validate at the edges (loaded documents, paste, image
  sources, host props) and trust the types inside. Give each piece of state one
  owner.
- Build in steps you can check, and commit at those steps.
- Fail loudly. No silent fallbacks or swallowed errors; skip bad input visibly
  instead of patching it.
- Do what was asked. Don't widen the scope or refactor along the way; list
  follow-ups instead.

## Reviewing

- Read the change commit by commit. Each commit should tell one step of the
  story.
- Check the claim: rerun the e2e path, or ask how it was verified.
- Look for behaviour nobody exercised, scope creep, duplicated state or logic,
  new dependencies, code that could be deleted, and swallowed errors.
- Separate must-fix (bugs, broken interactions) from suggestions. Don't block
  on taste.

## Showing your work

Write down the decisions you made and the alternatives you rejected, in the PR
description or your final reply, so a reviewer can follow why without
rerunning your search.
