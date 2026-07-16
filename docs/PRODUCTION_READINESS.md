# Docket v2 — production-readiness & compliance checklist

Honest status for a legal-document product. Engineering hardening is largely done
(below); the **legal, security, and data-protection items are NOT certified by this
build** — they require professionals. Do not go live with real client data until the
"Must-do before real client data" section is signed off.

## Done (this build)

- ✅ Staged-diff architecture: Viki never writes the live doc; every change is
  human-accepted, attributed, audited, reversible.
- ✅ Interactive Viki intake (chat-first drafting) + form-fill + batch generation.
- ✅ Token/usage metering per LLM call (cost/billing foundation).
- ✅ Durable Postgres-backed job queue (pg-boss) + worker for heavy fan-out; survives
  restarts, retries, bounded concurrency.
- ✅ LLM concurrency limiter + graceful "no API key" degradation.
- ✅ Persistent DB sessions, Secure/SameSite cookies in prod, rate limiting on auth +
  LLM endpoints, dev-header disabled in prod.
- ✅ Citation verification: deterministic registry (current statutory framework incl.
  2023 criminal codes) + fail-closed adversarial LLM grounding.
- ✅ Eval fixtures with defensible numbers (citation 100%, template coverage 100%).
- ✅ Server + web typecheck clean; 22 tests; verified live against Neon + Claude.

## Must-do before real client data (NOT done — needs professionals)

### Legal
- [ ] **Advocate review of every builtin template** and of the generation prompts.
      Outputs are DRAFTS; the product must display a clear "not legal advice — review
      by a qualified advocate required" disclaimer.
- [ ] **Bar Council of India rules** review (advertising/solicitation constraints for
      tools marketed to/through advocates).
- [ ] **Citation grounding against India Code** (indiacode.nic.in) for actual section
      TEXT, not model knowledge (port seam in `citationGrounding.ts`).

### Data protection (privileged client data)
- [ ] **DPDP Act, 2023 compliance**: lawful basis/consent, purpose limitation, data
      retention + deletion policy, breach notification process, Data Principal rights
      (access/correction/erasure), and processor agreements with Neon/Anthropic.
- [ ] **Encryption at rest** for document bodies + Yjs snapshots (Neon offers storage
      encryption; consider app-level encryption for privileged content).
- [ ] **Data residency**: confirm whether client data may leave India; Anthropic API
      calls send document text to the model — get client consent + document this.
- [ ] Confidentiality/privilege safeguards; per-firm tenant isolation review.

### Security
- [ ] Independent **security audit + penetration test**.
- [ ] Secrets management (rotate the API key pasted in chat; move off plaintext `.env`
      to a secrets manager; the Anthropic key used in dev should be rotated).
- [ ] HTTPS/TLS termination, HSTS, security headers (CSP), input-size limits on uploads.
- [ ] Dependency vulnerability audit (`npm audit`) in CI.
- [ ] Lock CORS to the real web origin in prod (currently permissive for dev).

### Ops / scale
- [ ] Rate limiter → shared store (Redis) for multi-instance (currently per-instance).
- [ ] Sessions → consider Redis if session volume is high; add periodic expired-session
      cleanup job.
- [ ] Standalone worker under a supervisor (PM2/systemd) with `WORKER_MODE=external`.
- [ ] Observability: structured logging (NEVER document content — invariant #7), error
      tracking (scrub content), metrics/alerts, and DB backups + a tested restore.
- [ ] Yjs persistence: y-leveldb is local-disk; for multi-instance move Yjs state to a
      shared/durable store or a single sync node.
- [ ] Load/soak test the realtime + agent paths at expected concurrency.
