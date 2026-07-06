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
- DeepSeek/OpenAI-compatible chat relay through the local backend
- Deterministic local fallback replies when no model key is configured
- Daily Picks based on selected content categories and providers
- External content retrieval through a local `/api/content` endpoint with proxy support
- Save useful Daily Picks for later
- Stop a specific Daily Pick category from message-level actions
- Select-to-translate: highlight any word or phrase in the chat to get an LLM translation card with pronunciation, explanation, and bilingual examples; translation direction follows the companion's language
- Word book: save translated words locally, review recent ones in the studio, and delete entries one by one
- Automatic scheduled Daily Picks: the local scheduler checks each companion's push time every minute, fetches external content only for companions that are actually due, and catches up missed pushes when the app opens
- Optional browser notifications for scheduled pushes and care check-ins (permission is requested when notifications are turned on)
- Bounded backend memory layer for compact facts, preferences, emotional patterns, and recent events
- Local privacy defaults: API keys stay on the Node server, and local memory data is ignored by Git

## Tech Stack

- Vanilla HTML/CSS/JavaScript frontend
- Node.js HTTP server
- Node built-in test runner
- Local browser persistence with `localStorage`
- Bounded backend memory stored under `.local-data/`
- DeepSeek/OpenAI-compatible API adapter

## Run

```powershell
cd "D:\Intelligent AI Agent"
.\start.ps1
```

Open `http://127.0.0.1:5173`.

`start.ps1` reads `.env.local` if it exists, then starts the local server. If no API key is configured, it prompts for a DeepSeek key for the current PowerShell session.

## Optional DeepSeek Chat

Without an API key, chat uses a deterministic local fallback. To avoid typing the key every time, copy `.env.local.example` to `.env.local` and put your local values there:

```powershell
copy .env.local.example .env.local
notepad .env.local
.\start.ps1
```

The API key stays on the local Node server. The browser calls `/api/chat`, not DeepSeek directly.

This project defaults to the DeepSeek OpenAI-compatible base URL `https://api.deepseek.com`.
To use another compatible endpoint, set:

```powershell
$env:DEEPSEEK_BASE_URL="https://your-compatible-endpoint.example"
```

The older `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL` names still work for OpenAI-compatible relays.

## Practice Languages

Each companion has its own practice language, chosen when you create or edit it. The current chat header shows the active language, and the studio panel lists it under "Companion setup". Supported languages: English, Japanese, Korean, French, Spanish, German, and Italian.

The language drives two things:

- **Chat**: the companion's system prompt tells the model to speak and gently correct in that language.
- **Select-to-translate**: selecting foreign text explains it in Chinese (the learner's native language); selecting Chinese text translates it into the companion's language.

## Model Switching

Use the right-side `Model` card in the app to switch between DeepSeek, OpenAI, or an OpenAI-compatible endpoint. Saving the model only updates the server runtime model config for future chat calls. Companions, role settings, local chat history, daily-push settings, and memory stay unchanged.

For compatible relay services, set `LLM_API_KEY` in `.env.local`, choose `OpenAI-compatible`, and set the base URL/model shown by that service.

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

Note: the proxy above only applies to external content retrieval (YouTube, news, Reddit, web search). LLM chat and translation requests go directly to the model endpoint by default, because DeepSeek and most relays are reachable without a VPN and a dead local proxy would silently break chat. If your model endpoint really needs a proxy, set `LLM_PROXY` to a proxy URL, or `LLM_USE_PROXY=1` to reuse the content proxy.

If chat keeps showing "Local fallback", check the `Model` card in the app: it now shows the last LLM error message (for example a wrong model name, an invalid key, or a network failure).

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
src/chatProxy.js      /api/chat handler (LLM + local fallback)
src/translateProxy.js /api/translate handler (select-to-translate)
src/vocabBook.js      Word book storage helpers
src/contentAdapters.js / contentProxy.js  External content retrieval
src/memoryStore.js / memoryProxy.js       Bounded backend memory
src/modelConfig.js    Provider presets and model selection
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
