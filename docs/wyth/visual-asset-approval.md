# Wyth Visual Asset Approval

All visual candidates must be previewed and explicitly approved before they are copied into `assets/wyth/` or referenced by application code.

| ID | Purpose | Required visual direction | Candidate | Status | Final file |
| --- | --- | --- | --- | --- | --- |
| brand-wordmark | Wyth wordmark | Restrained, warm, mature, legible at small UI size | Contact sheet A | Direction approved 2026-07-12; SVG redraw pending preview | `assets/wyth/brand/wyth-wordmark.svg` |
| scene-friend | 知心朋友 | Lived-in window room at dawn or dusk | Approved 2026-07-12 | Approved | `assets/wyth/scenes/friend-room-base.webp` |
| scene-listener | 安静倾听者 | Quiet rain-night room, lamp, generous negative space | Approved 2026-07-12 | Approved | `assets/wyth/scenes/listener-rain-base.webp` |
| scene-traveler | 旅行伙伴 | Train window or early station, gentle movement cues | Approved 2026-07-12 | Approved | `assets/wyth/scenes/traveler-train-base.webp` |
| scene-workmate | 职场搭档 | Personal desk, city dusk, non-corporate | Approved 2026-07-12 | Approved | `assets/wyth/scenes/workmate-desk-base.webp` |
| scene-coach | 温柔语言教练 | Sunlit study and reading table | Approved 2026-07-12 | Approved | `assets/wyth/scenes/coach-study-base.webp` |
| motif-thread | Continuity motif | One warm line of light connecting every scene | Pending | Pending | `assets/wyth/scenes/shared-warm-thread.webp` |
| avatar-set | Five default avatars | Abstract scene-object marks, no full people, recognizable at 40px | Approved 2026-07-12 | Approved | `assets/wyth/avatars/*.svg` |

## Shared Scene Rules

- Quiet cinematic realism with restrained surreal details.
- No visible full person.
- Low-saturation natural palette and credible lived-in materials.
- Generous negative space for readable chat.
- Consistent lens, grain, contrast, and warm-thread continuity motif.
- No embedded UI, text, purple AI gradients, glowing orbs, or stock-photo styling.

## Approved Motion Direction

Scene changes use a stable Wyth interface frame with a continuous camera-like world behind it. The previous scene eases back and drifts slightly away while the next scene enters from its implied spatial direction; the shared warm thread bridges the overlap. Use a 720ms interruptible transition with `cubic-bezier(.22,.8,.24,1)`. When reduced motion is active, use only a 160ms opacity transition.
