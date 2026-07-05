# English Companions Design

## Product Direction

Use the approved Hybrid Companion Studio direction. The MVP is a browser app where the user can create and manage multiple English-speaking AI companions. Each companion combines emotional chat with a configurable daily content curation habit.

This MVP is local-first and does not require API keys. It simulates companion replies and daily content pushes in the browser so the product experience can be reviewed before adding OpenAI, search APIs, authentication, and a backend.

## Core Requirements

- Create multiple companions with name, relationship type, personality/tone, avatar style, memory setting, push categories, and push schedule.
- Show companions in a left sidebar with last message and unread/daily-pick indicators.
- Show the selected companion's independent chat history in the center.
- Distinguish normal user/assistant messages from system daily push messages.
- Provide a right-side companion studio panel with settings, push preferences, memory status, and quick actions.
- Let the user send English daily-life messages and receive a personality-aware English response.
- Let the user generate a simulated Daily Pick based on the selected companion's content categories.
- Persist companions, selected companion, and message history in localStorage.
- Include helpful empty states and starter data so the app is understandable immediately.

## UX Structure

The first viewport is the app itself, not a marketing page.

- Left column: companion list, create companion button, compact product identity.
- Center column: active chat header, chat transcript, message composer.
- Right column: companion details, selected push categories, schedule, memory note, daily pick action.
- Creation panel: form with relationship, tone, content categories, schedule, avatar style, and memory toggle.

## Data Model

`Companion`

- id
- name
- relationshipType
- personality
- avatarStyle
- avatarColor
- pushCategories
- pushTime
- maxDaily
- memoryEnabled
- memorySummary
- createdAt

`Message`

- id
- companionId
- role: user, assistant, or system_push
- content
- createdAt
- metadata: optional category, title, url, and sourceLabel for daily pushes

## AI Simulation Strategy

The local MVP uses deterministic rule-based generation. It should feel like an English companion without pretending that real external APIs are connected.

- Chat replies reflect relationship and personality.
- Negative user emotions trigger a warmer supportive reply.
- Daily picks select a category from the companion's configured categories and generate a companion-style recommendation with a sample link.
- Memory summary updates from user messages when memory is enabled.

## Future Integration Notes

The UI should make room for later backend features:

- OpenAI or another LLM for real replies.
- Search/news/video APIs for actual daily picks.
- Authentication and encrypted cloud persistence.
- Push notifications and scheduled jobs.
- Vector memory and summarization.

## Verification

- Unit tests cover companion creation, chat reply behavior, daily push generation, and localStorage persistence.
- Manual browser verification confirms the app loads, the C-layout is visible, a companion can be created, chat works, and a Daily Pick appears.

