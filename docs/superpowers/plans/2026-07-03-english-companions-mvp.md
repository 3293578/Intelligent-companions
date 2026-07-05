# English Companions MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first English Companions web app using the approved Hybrid Companion Studio layout.

**Architecture:** Use a static HTML/CSS/JavaScript app so it runs without dependency installation or API keys. Keep pure product logic in `src/companionLogic.js`, browser state/UI orchestration in `src/app.js`, and unit tests in `tests/companionLogic.test.mjs`.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node.js built-in test runner.

---

## File Structure

- `index.html`: App shell and semantic containers.
- `styles.css`: Responsive Hybrid Companion Studio layout and component styling.
- `src/companionLogic.js`: Pure functions for data creation, seeded state, reply generation, daily push generation, and persistence helpers.
- `src/app.js`: Browser UI rendering, event handling, localStorage wiring.
- `tests/companionLogic.test.mjs`: Node unit tests for core behavior.
- `package.json`: Test and local preview scripts.

## Tasks

### Task 1: Core Product Logic

**Files:**
- Create: `src/companionLogic.js`
- Create: `tests/companionLogic.test.mjs`
- Create: `package.json`

- [ ] **Step 1: Write failing tests**

Create tests for default companions, custom companion creation, supportive replies, daily push messages, memory updates, and serialization.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/companionLogic.test.mjs`
Expected: fails because `src/companionLogic.js` does not exist.

- [ ] **Step 3: Implement minimal logic**

Export the functions used by the tests:

- `createSeedState()`
- `createCompanion(input)`
- `createUserMessage(companionId, content)`
- `createAssistantReply(companion, userMessage, priorMessages)`
- `createDailyPush(companion)`
- `updateMemory(companion, userMessage)`
- `serializeState(state)`
- `deserializeState(raw)`

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/companionLogic.test.mjs`
Expected: all tests pass.

### Task 2: Browser App Shell

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/app.js`

- [ ] **Step 1: Build semantic app shell**

Create a three-column layout: companion list, chat, and companion studio panel.

- [ ] **Step 2: Wire UI to product logic**

Load state from localStorage or seed state, render companions/messages/settings, handle companion selection, chat send, daily pick generation, and companion creation.

- [ ] **Step 3: Verify in browser**

Run a local static server and open the app. Confirm the layout loads and interactions work.

### Task 3: Final Verification

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run unit tests**

Run: `node --test tests/companionLogic.test.mjs`
Expected: all tests pass.

- [ ] **Step 2: Run app smoke check**

Serve the project locally and inspect the page with the in-app browser. Confirm text for `English Companions`, `My companions`, `Daily Pick`, and `Create companion` is visible.

- [ ] **Step 3: Report local URL**

Give the user the local preview URL and summarize what was implemented.

