# Docket v2

Agentic collaborative legal-document platform for Indian lawyers and CAs. Real-time
multiplayer editing (Yjs + Tiptap) of contracts, opinions, filings and compliance memos,
with an AI agent (**Viki**) drafting and revising alongside humans — every AI change
staged as a reviewable, diffable, reversible proposal.

See [`claude.md`](./claude.md) for invariants, architecture, and commands, and
[`docs/`](./docs) for the PRD contract, phase findings, the concurrency playbook, and the
pilot script.

## Quick start

```bash
cp .env.example .env      # fill DATABASE_URL (Neon), ANTHROPIC_API_KEY
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev               # API :4000, Yjs WS :4001, web :5173
```

Open two browser tabs on http://localhost:5173, sign in as different seeded users, open the
same document, and watch edits, cursors, and staged Viki proposals sync live.

## Layout

```
packages/shared/   shared TypeScript contract (types, roles, events)
server/            Express API + Yjs WS + Prisma + Viki agent
web/               React + Vite + Tiptap client
docs/              PRD contract, phase findings, playbooks
```
