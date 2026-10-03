## What changes and why?

<!-- Use a Conventional Commit title (feat:/fix:/refactor:/test:/docs:/chore:).
     Explain the WHY here — the diff already shows the what. -->

## How did you test it?

<!-- Concrete steps and the exact commands you ran. -->

---

## Checklist

- [ ] Tests cover all new logic (no tests = no merge)
- [ ] `npm run check` and `npm test` pass
- [ ] Layering respected: features use `context.web`; `shared/` never reads `process.env` (enforced by `test/architecture.test.js`)
- [ ] No new traffic or DNS outside Tor, and no new logging of bodies, cookies or session ids
- [ ] `README.md` and `CHANGELOG.md` updated if tools or configuration changed
