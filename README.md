# English Companions

English Companions is a local-first web app for creating multiple AI companion agents for daily English conversation, emotional support, and personalized content discovery.

The product idea is not to roleplay inside a chatbot shell. It is an actual companion app: users can create different English companions, give each one a relationship style and care profile, chat with them day to day, and let them proactively share interesting videos, news, jokes, learning resources, or custom topics.

## Product Vision

English Companions is designed around three ideas:

- **Companions as long-running relationships**: each character has independent settings, chat history, emotional tone, and lightweight memory.
- **English practice in daily life**: conversations can include natural phrases, gentle corrections, and different reply lengths based on the user's learning preference.
- **Useful proactive agents**: companions can send Daily Picks from configured categories such as news, videos, memes, jokes, learning material, and custom keywords.

## Current MVP Features

- Create, edit, and delete multiple companions
- Independent companion chats, unread counts, and read state
- Relationship type, personality, avatar, emotional closeness, support mode, and proactive care settings
- English practice settings for correction style, intensity, reply length, and natural phrase suggestions
- DeepSeek/OpenAI-compatible chat relay through the local backend
- Deterministic local fallback replies when no model key is configured
- Daily Picks based on selected content categories and providers
- External content retrieval through a local `/api/content` endpoint with proxy support
- Save useful Daily Picks for later
- Stop a specific Daily Pick category from message-level actions
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

The current test suite covers companion logic, chat proxy behavior, content adapters, model config, layout guarantees, memory storage, and API proxy helpers.

## Roadmap

- Production user accounts and cloud sync
- Optional vector memory for deeper long-term recall
- Real scheduled delivery and web push notifications
- Richer companion profiles and onboarding
- Better content ranking and source controls
- Mobile-first polish and deployable hosting setup
