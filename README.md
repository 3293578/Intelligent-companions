# English Companions

English Companions is a local-first web app for creating multiple AI companion agents for daily language conversation, emotional support, and personalized content discovery. It ships with English by default and each companion can be set to a different practice language.

The product idea is not to roleplay inside a chatbot shell. It is an actual companion app: users can create different language companions, give each one a relationship style and care profile, chat with them day to day, and let them proactively share interesting videos, news, jokes, learning resources, or custom topics.

## Product Vision

English Companions is designed around three ideas:

- **Companions as long-running relationships**: each character has independent settings, chat history, emotional tone, and lightweight memory.
- **Language practice in daily life**: conversations can include natural phrases, gentle corrections, and different reply lengths based on the user's learning preference, in the companion's chosen language.
- **Useful proactive agents**: companions can send Daily Picks from configured categories such as news, videos, memes, jokes, learning material, and custom keywords.

## Current MVP Features

- Create, edit, and delete multiple companions
- Per-companion practice language (English, Japanese, Korean, French, Spanish, German, Italian) — the companion chats and corrects in that language
- Independent companion chats, unread counts, and read state
- Relationship type, personality, avatar, emotional closeness, support mode, and proactive care settings
- Language practice settings for correction style, intensity, reply length, and natural phrase suggestions
- User-supplied OpenAI-compatible model URL, model name, and API key
- Secure server relay for chat, translation, and natural-phrasing requests
- Daily Picks based on selected content categories and providers
- External content retrieval through a local `/api/content` endpoint with proxy support
- Save useful Daily Picks for later
- Stop a specific Daily Pick category from message-level actions
- Select-to-translate: highlight any word or phrase in the chat to get an LLM translation card with pronunciation, explanation, and bilingual examples; translation direction follows the companion's language
- Word book: save translated words locally, review recent ones in the studio, and delete entries one by one
- Automatic scheduled Daily Picks: the local scheduler checks each companion's push time every minute, fetches external content only for companions that are actually due, and catches up missed pushes when the app opens
- Optional browser notifications for scheduled pushes and care check-ins (permission is requested when notifications are turned on)
- Bounded backend memory layer for compact facts, preferences, emotional patterns, and recent events
- Local privacy defaults: model keys stay only in the current browser tab's memory and local memory data is ignored by Git

## Tech Stack

- Vanilla HTML/CSS/JavaScript frontend
- Node.js HTTP server
- Node built-in test runner
- Local browser persistence with `localStorage`
- Bounded backend memory stored under `.local-data/`
- OpenAI-compatible BYOK adapter with SSRF and DNS-rebinding protection

## Run

```powershell
cd "D:\Intelligent AI Agent"
.\start.ps1
```

Open `http://127.0.0.1:5173`.

`start.ps1` reads `.env.local` for account infrastructure only, then starts the server. Wyth has no operator model key and no paid plan.

## Bring Your Own Model

Open `Settings -> Full settings -> Account`, then enter an OpenAI-compatible HTTPS base URL, model name, API mode, and your provider key. Wyth tests the connection before using it. The key is held only in current-tab JavaScript memory: it is not placed in `localStorage`, cookies, logs, or server storage, and reload, tab close, or sign-out clears it.

The browser sends each model request to Wyth's authenticated relay. The relay resolves and pins a public IPv4 destination, rejects private or reserved networks and redirects, bounds request and response sizes, limits concurrency, and never falls back to an operator key or proxy. Your selected model provider still receives the key and conversation content needed to answer, under that provider's own terms.

## Practice Languages

Each companion has its own practice language, chosen when you create or edit it. The current chat header shows the active language, and the studio panel lists it under "Companion setup". Supported languages: English, Japanese, Korean, French, Spanish, German, and Italian.

The language drives two things:

- **Chat**: the companion's system prompt tells the model to speak and gently correct in that language.
- **Select-to-translate**: selecting foreign text explains it in Chinese (the learner's native language); selecting Chinese text translates it into the companion's language.

## Model Switching

Update and re-test the settings in the Account page. A failed replacement restores the last verified in-memory configuration. Companions, role settings, local chat history, Daily Pick settings, and memory remain unchanged.

## External Content Proxy

The server uses these proxy settings in order:

1. `HTTPS_PROXY`
2. `HTTP_PROXY`
3. `ALL_PROXY`
4. `http://127.0.0.1:7890` as a local fallback

With iKuuuVPN system proxy enabled, the detected local fallback usually works. To disable the local fallback:

```powershell
$env:NO_LOCAL_PROXY_FALLBACK="1"
npm run dev
```

The proxy above applies only to public content retrieval. User-selected model traffic uses the hardened Wyth relay directly so a shared system proxy cannot observe model credentials or redirect them to another destination.

## Memory Design

The app does not store every message forever in backend memory. Instead, it extracts compact memory items and keeps each category bounded, similar to a lightweight profile:

- facts
- preferences
- emotional patterns
- recent events

This keeps storage small while still letting a companion feel more continuous over time. Local backend memory is stored in `.local-data/`, which is excluded from Git.

## Tests

```powershell
npm test
```

The current test suite covers companion logic, chat proxy behavior, content adapters, model config, layout guarantees, memory storage, API proxy helpers, the translate proxy, the word book, and the push scheduler.

## Project Structure

```
index.html            App shell (three-column layout, dialogs)
styles.css            All styles
server.mjs            Node HTTP server: static files + /api/* endpoints
src/app.js            Frontend logic, rendering, and event wiring
src/companionLogic.js Companion model, prompts, daily picks, scheduling
src/chatProxy.js      /api/chat handler
src/translateProxy.js /api/translate handler (select-to-translate)
src/vocabBook.js      Word book storage helpers
src/contentAdapters.js / contentProxy.js  External content retrieval
src/memoryStore.js / memoryProxy.js       Bounded backend memory
src/byok.js           Secure request-scoped model relay
src/byokSession.js    Volatile browser credential session
src/openaiClient.js   OpenAI-compatible / chat-completions client
tests/*.test.mjs      Node built-in test runner suites
```

## License

Released under the MIT License. See [LICENSE](LICENSE).

## Roadmap

- Production user accounts and cloud sync
- Optional vector memory for deeper long-term recall
- Server-side scheduled delivery and web push while the browser is closed
- Word book review mode (spaced repetition, export)
- Richer companion profiles and onboarding
- Better content ranking and source controls
- Mobile-first polish and deployable hosting setup (PWA, then Capacitor packaging)
