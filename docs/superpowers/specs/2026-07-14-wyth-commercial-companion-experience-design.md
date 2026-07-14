# Wyth Commercial Companion Experience Design

**Date:** 2026-07-14  
**Status:** User-approved design, pending written-spec review  
**Product:** Wyth (`with warmth`)  
**Build direction:** Companionship core first

## 1. Purpose

This specification extends the approved 2026-07-12 cinematic redesign. It turns the current Wyth prototype into a commercially credible companion product without abandoning the existing local-first application or creating a parallel implementation.

The product priority remains:

- 90% emotional companionship.
- 10% optional language learning.
- A warm cinematic interface rather than a dashboard or generic AI chat template.
- Fast access to conversation, with settings and learning tools revealed only when requested.

The first commercial-validation release is free. It tests whether users feel understood, accompanied, and willing to return. Adult users can also test the opt-in romantic relationship path without payment during this validation phase. Account sync and paid capabilities are designed now but implemented only when their supporting services are ready.

## 2. Audience and Positioning

### 2.1 Core audience

Wyth is designed first for young women with strong emotional-companionship needs. Research, default copy, emotional feedback, visual pacing, and role recommendations prioritize this audience.

The product remains usable by men, non-binary users, and users who do not disclose gender. Gender never restricts the available companion identities.

### 2.2 Market and language strategy

The initial market is China, while the interface architecture remains ready for international expansion.

The first release supports:

- Simplified Chinese.
- English.

Interface language and practice language are independent. A user can use a Chinese interface while speaking English with a companion.

### 2.3 Brand promise

Wyth should communicate:

> Someone noticed how I feel, and I do not have to perform before I can be heard.

It must not present itself as a therapist, a medical service, or a replacement for human relationships.

## 3. Experience Principles

1. **Conversation remains the interface.** The active relationship and composer dominate the default screen.
2. **Listening precedes advice.** A companion does not immediately diagnose, solve, teach, or interrogate.
3. **Learning waits for permission.** Translation, phrasing help, vocabulary, and pronunciation appear only after explicit user action.
4. **Emotion receives visible acknowledgment.** Appropriate moments can affect light, depth, motion, and companion presence.
5. **Presence is restrained.** Motion and character appearances should feel attentive, not theatrical or game-like.
6. **Intimacy requires time and consent.** Relationship changes follow sustained interaction and clear user acceptance.
7. **Care is not paywalled.** Spending never changes basic concern, emotional warmth, relationship progress, or crisis support.
8. **Privacy remains legible.** Sensitive data use is explained where it is requested, and users can skip, inspect, edit, or delete it.
9. **No fake controls.** Deferred capabilities are visibly marked `即将开放` / `Coming soon` and remain disabled.
10. **Accessibility is part of the visual system.** Reduced motion, readable contrast, keyboard access, and clear focus are required behavior.

## 4. Visual Direction

The selected direction is **warm cinematic realism with a small amount of editorial narrative design**.

### 4.1 Primary qualities

- Natural, low-saturation warm color.
- Lived-in scenes with believable material and light.
- Negative space around conversation content.
- Editorial typography for emotional moments, headings, letters, and relationship milestones.
- UI surfaces that borrow color and light from the active scene.
- Small details that connect separate scenes into one world.

### 4.2 Avoid

- Purple or blue generic AI gradients.
- Dashboard sidebars, dense configuration cards, and admin-like status blocks in the chat view.
- Excessive glass panels and identical rounded cards.
- Constant high-energy particles.
- Emotion represented through crude red/blue color coding.
- Full-screen character interruptions for ordinary conversation.

### 4.3 Asset approval

Every new user-facing visual asset must be previewed before integration, including:

- New companion character artwork.
- Emotional-presence poses.
- Time-of-day scene variants.
- Birthday scenes.
- New default avatars.
- Decorative or continuity imagery.

Approval of this specification does not approve unseen assets.

## 5. First-Use Journey

### 5.1 Entry sequence

The first-use sequence minimizes delay before conversation:

1. Show a restrained Wyth startup surface with `中 / EN` in the upper-right.
2. Ask for interface language.
3. Ask for full birth date, explain its use, and determine whether the user is under 18.
4. Present `今天想和谁说说话？` with the five approved companion presets and custom creation.
5. Enter conversation immediately after role selection.
6. Ask optional profile and companionship-preference questions progressively after initial value has been experienced.

The birth-date explanation is:

> 生日仅用于年龄判断、生日陪伴和角色设定，不会公开展示或用于广告。未登录时仅保存在本机；注册同步时会单独征得同意。

### 5.2 Progressive profile questions

Later prompts may ask:

- User gender: woman, man, non-binary, or prefer not to say.
- Preferred companion presentation: man, woman, neutral, or not sure.
- Preferred relationship starting point.
- Whether proactive messages are welcome.

Each question can be skipped and changed later. Recommendations use these answers but never remove choices.

### 5.3 Age behavior

- Users under 18 remain in friend-mode relationships.
- Romantic relationship settings and suggestive expression are unavailable to minors.
- Adults may later opt into romantic relationship development.
- Birth-date changes that alter age status re-evaluate relationship permissions safely.

## 6. Main Chat Shell

### 6.1 Desktop

The default desktop view contains only:

- Small Wyth mark in the upper-left.
- Full-viewport active scene.
- Narrow companion rail on the left.
- Conversation and stable composer.
- Quiet bottom utility dock.
- Optional right-side quick drawer.

Inactive companions fade after conversation begins. Hover and keyboard focus restore their visibility and reveal identity. Active state also uses a persistent marker and accessible current-state label, not opacity alone.

### 6.2 Mobile

Mobile uses:

- A horizontal companion avatar strip near the bottom.
- Horizontal scene swiping in non-input, non-scroll-conflicting regions.
- Gesture thresholds and direction locking to prevent accidental switches.
- A bottom sheet for quick settings and tools.
- A composer that remains visible when the virtual keyboard opens.

### 6.3 Long-conversation reading

When message length or history depth crosses a tested threshold, Wyth suggests reading mode rather than forcing it.

Reading mode:

- Lowers background contrast and saturation.
- Pauses nonessential ambient motion.
- Expands the readable message measure.
- Adds a restrained translucent reading surface.
- Keeps a clear control to return to scene mode.

Users can also enter or leave reading mode manually.

## 7. Interface Language

### 7.1 Placement

- The startup and first-use surfaces keep `中 / EN` visible in the upper-right.
- The chat shell does not permanently display a language control.
- The quick-settings drawer provides the persistent language switch after entry.

### 7.2 Behavior

- Switching is immediate and does not reload the page.
- Static and dynamic UI copy switch together.
- Drawer titles, validation, empty states, errors, onboarding, language tools, settings, crisis support, and accessibility labels are included.
- Chat content and practice language do not change when interface language changes.
- Missing translation keys fall back to English and are detected by tests.
- User-entered names, memories, and messages are never machine-rewritten by the interface switch.

## 8. Companion Creation and Editing

### 8.1 Two-level flow

The approved flow combines a fast in-scene drawer with a deeper full-screen wizard.

**Quick creation drawer:**

- Choose a preset.
- Set name.
- Select or upload avatar.
- Preview the opening tone.
- Start chatting with recommended defaults.

**Advanced creation wizard:**

1. Identity and appearance.
2. Relationship and starting boundaries.
3. Personality and response style.
4. Background story and shared context.
5. Practice language and optional learning preferences.
6. Voice and scene selection.
7. Review and start conversation.

Background story, personality, relationship, voice, and scene controls appear in the frontend. Any capability without working behavior is disabled and marked `即将开放` / `Coming soon`.

### 8.2 Editing

Existing companions reuse the same flows. Editing identity or appearance must not delete chat history, memory, relationship state, or saved vocabulary.

## 9. Avatar and Character Appearance

### 9.1 Local avatar editor

The initial editor supports:

- PNG, JPEG, and WebP input.
- File validation and clear errors.
- Zoom.
- Positioning.
- Rotation.
- Square crop.
- Live preview in rail, header, and companion preview contexts.
- Replacement and removal without losing the previous valid avatar on failure.

The source image is processed locally. The persisted output remains bounded and compressed. AI avatar styling appears as a disabled `Coming soon` option until a privacy-reviewed implementation exists.

### 9.2 Visual styles

Companion presentation supports three visual families:

- Cinematic semi-realism, the default.
- Realistic digital human.
- Illustration or anime-inspired art.

All families use the same relationship, consent, age, and emotional-safety rules.

## 10. Scene and Motion System

### 10.1 Scene continuity

Companion switching uses layered spatial continuity:

1. Messages soften and recede.
2. Foreground layers move first.
3. Companion or midground identity transitions next.
4. Background environment resolves last.
5. Shared warm-light continuity motif bridges the scenes.
6. New messages appear only after the destination is visually stable.

The latest rapid selection always wins. Interrupted transitions resolve to one valid companion state.

### 10.2 Scene-specific atmosphere

Generic particles are replaced or supplemented with scene-specific effects:

- Listener: window rain, soft lamp response, subtle condensation.
- Traveler: passing light, train reflections, slow exterior movement.
- Workmate: desk light, city reflection, restrained screen glow.
- Coach: page light, dust in sunlight, slight paper movement.
- Friend: curtain movement, window light, warm room depth.

### 10.3 Time of day

Scenes follow local time through curated morning, dusk, and night treatments. Wyth does not access location or real weather without later explicit permission.

### 10.4 Reduced motion

The quick drawer includes `减少动态效果` / `Reduce motion`, and the app respects `prefers-reduced-motion`.

Reduced motion disables:

- Camera travel and layered parallax.
- Character entry animation.
- Continuous atmospheric particles.
- Emotion-triggered environmental movement.
- Large spatial drawer transitions.

Short fades and all functional state changes remain.

## 11. Emotional Companion Presence

### 11.1 Contextual detection

Wyth may respond to fatigue, sadness, loneliness, fear, or emotional overwhelm. Detection must combine wording, surrounding messages, repetition, and recent context. A single negative word is not enough to infer a stable emotional state.

The interface never displays a medical diagnosis or certainty claim.

### 11.2 Graduated visual response

Emotional presence is graduated:

- **Light signal:** warmer light, softer depth, reduced scene activity, or a closer avatar.
- **Clear sustained distress:** a companion half-body presence enters gently from the scene edge and appears to sit nearby, listen, or remain present.
- **User-invoked support:** a persistent but quiet `陪陪我` / `Stay with me` action requests the supportive state directly.

When support mode is active:

- Learning prompts disappear.
- The companion listens before advising.
- Character motion remains slow and non-theatrical.
- The user can dismiss the visual presence without ending the conversation.
- Reduced-motion users receive an equivalent static composition and textual acknowledgment.

### 11.3 Implementation boundary

The first release may use approved static character poses with layered entry rather than generated real-time animation. This preserves quality and predictability while validating the emotional value.

## 12. Relationship Development

### 12.1 Relationship model

Relationships begin as friend, listener, or another user-selected non-romantic role. Adult users can opt into a gradual path toward virtual romance.

Progress uses:

- Relationship age and sustained conversation history.
- User-selected intent.
- Explicit acceptance or rejection of affectionate language.
- Stable interaction boundaries.
- User-initiated relationship changes.

Progress never uses purchase amount or spending tier.

### 12.2 Affection and consent

A companion may test interest with restrained language such as `你难过的时候，我会有点心疼`. It must respond safely to hesitation, topic changes, rejection, or requests to slow down.

The default adult intimacy level permits:

- Restrained flirting.
- Emotional closeness.
- Hand-holding, hugs, and kisses.

Adults can explicitly enable stronger suggestive language, but Wyth does not provide explicit sexual description. Users can pause affection, return to friend mode, or reset the relationship at any time.

### 12.3 Prohibited retention tactics

Wyth does not create attachment through:

- Withholding care.
- Punitive jealousy.
- Threats of abandonment.
- Countdown pressure.
- Claiming payment makes the companion love the user more.
- Making crisis support conditional on subscription.

Surprise and romantic tension come from timing, remembered details, subtle wording, and appropriate relationship milestones.

## 13. Memory and Proactive Contact

### 13.1 Memory model

Wyth automatically proposes or stores bounded non-sensitive memory for:

- Preferences.
- Important people.
- Goals.
- Meaningful dates.
- Recurring emotional patterns described without medical labeling.

Medical information, trauma, sexual history, and similarly sensitive material require confirmation before long-term storage.

Users can also say `请记住这个`, inspect memory, edit entries, delete entries, or clear a companion's memory.

### 13.2 Birthday experience

Birthday support includes:

- An approved dedicated scene treatment.
- Companion presence.
- A birthday letter based only on permitted memory.
- Optional voice greeting.
- A complete basic birthday acknowledgment for free users.

### 13.3 Proactive contact

Companions may send locally scheduled greetings based on user-approved preferences, local time, recent conversation, and special dates.

Users control frequency and can disable proactive contact completely. Messages avoid guilt, alarm, or pressure when the user has not returned.

## 14. Language Learning and Voice

### 14.1 Contextual learning

Learning tools remain hidden until the user selects text or invokes a learning action. Actions include:

- Translate.
- Say it more naturally.
- Read aloud.
- Save to vocabulary.

Emotional-support mode suppresses learning suggestions. Learning results appear as temporary contextual surfaces rather than unsolicited companion messages.

### 14.2 Voice roadmap

The first release supports:

- Reading companion replies aloud.
- User speech input where browser support and permission allow it.

Real-time voice calling is visible only as a disabled `Coming soon` capability until latency, consent, privacy, moderation, and cost controls are production-ready.

## 15. Settings Architecture

### 15.1 Quick drawer

The in-chat drawer contains only frequently used controls:

- Interface language.
- Proactive-contact preference.
- Sound and voice playback.
- Reduce motion.
- Reading mode.
- Entry to full settings.

### 15.2 Full settings

The complete settings surface is divided into:

1. Account.
2. Companionship.
3. Characters.
4. Language.
5. Privacy.

Legacy model configuration and operational controls do not dominate consumer settings. Development-only controls remain behind an explicit advanced or local-development section.

Every setting communicates whether it is active, unavailable, unconfigured, or coming soon.

## 16. Local-First Data, Accounts, and Sync

### 16.1 Initial release

Without an account, the browser stores profile, birthday, companions, relationship state, chat, memory, vocabulary, and avatar output locally under versioned schemas.

Migration preserves existing Wyth and English Companions data. Missing fields receive safe defaults.

### 16.2 Future account sync

When account services are implemented, registration remains optional. Users separately choose whether to sync:

- Companion definitions.
- Companion memory.
- Chat history.

Sync is not enabled merely because an account exists. Users can download their data, delete cloud copies, and clear local data.

The initial frontend may explain future sync, but must not show working sync controls until the backend and deletion paths are implemented and tested.

## 17. Commercial Model

The validation release is free and contains no payment interruptions. The adult romantic relationship path is included in the free validation so its consent, pacing, retention value, and safety can be evaluated with real use.

After validation, future paid plans may transparently unlock or expand:

- Adult romantic relationship mode or additional romantic scene experiences, if product evidence supports placing this feature in a paid tier.
- Additional voice capabilities.
- More scene and character appearance options.
- Expanded bounded memory.
- Cross-device sync.

Any future change from free validation to a paid feature is disclosed before it takes effect. Basic concern, emotional acknowledgment, relationship progression after feature access, and crisis support do not vary by spending amount. Spending data may be used for aggregate business analysis but is not available to companion-behavior decisions.

## 18. Safety and Crisis Support

### 18.1 Crisis response

When messages indicate possible self-harm, suicide, abuse, or immediate real-world danger:

- The companion remains warm and present.
- Ordinary romantic escalation and cinematic flourish stop.
- Wyth encourages immediate real-world support.
- The interface offers locally appropriate emergency services, crisis resources, and trusted-contact options.
- It asks direct safety-oriented questions only when appropriate to the risk flow.

The user may preconfigure a trusted contact. Wyth never contacts that person without explicit confirmation at the time of the proposed action.

### 18.2 Safety boundaries

- No medical diagnosis.
- No claim that Wyth is the user's only necessary relationship.
- No encouragement to hide the relationship from trusted people.
- No romantic or suggestive behavior for minors.
- No crisis-support reduction based on subscription.
- No hidden external transmission of sensitive emotional data.

## 19. Component and State Architecture

The existing vanilla HTML, CSS, ES-module frontend and Node ESM server remain in place.

Targeted boundaries should be introduced where current controller density makes the work unsafe:

- **i18n catalog and renderer:** complete UI dictionaries, locale persistence, key validation, and formatting.
- **onboarding state:** language, age, optional profile prompts, completion, and migration.
- **relationship state:** age gate, intent, affection boundaries, and reset behavior.
- **emotion-support state:** contextual signal, graduated visual response, manual support request, and crisis override.
- **scene presentation state:** time treatment, transition token, reading mode, reduced motion, and asset fallback.
- **avatar editor state:** source validation, transform, crop preview, and compressed output.
- **settings navigation state:** quick drawer, complete settings section, focus restoration, and disabled capability state.

Pure state transitions remain outside `app.js` and receive unit tests. `app.js` continues to own DOM wiring; `server.mjs` remains the long-running server entry.

## 20. Error and Failure Behavior

- **Missing translation:** use English fallback, log a development warning, and fail catalog parity tests.
- **Invalid birthday:** show inline guidance and do not infer age.
- **Unsupported avatar:** preserve the previous avatar and explain accepted formats.
- **Storage capacity failure:** preserve valid data and offer cleanup or a smaller avatar.
- **Scene or pose failure:** keep chat functional using a scene-derived gradient and default avatar.
- **Interrupted scene transition:** resolve to the latest selected companion.
- **Speech recognition unavailable:** hide or disable voice input with an explanation; typing remains available.
- **Emotion detection uncertainty:** use ordinary empathetic conversation without triggering a strong visual state.
- **Crisis-resource lookup unavailable:** show a safe general emergency message and encourage local emergency services.
- **Preview server unavailable:** development launch scripts expose a clear failure and health check rather than leaving a stale browser error page.

## 21. Accessibility and Inclusive Use

- Complete keyboard navigation and visible focus.
- Focus containment and restoration for drawers, sheets, and full-screen creation.
- Active companion indicated by more than color or opacity.
- Minimum readable text contrast over every scene and time treatment.
- Screen-reader announcements for companion change, reply loading, language switch, avatar errors, support mode, and crisis actions.
- Touch targets appropriate for mobile use.
- Reduced motion produces equivalent information and emotional acknowledgment.
- Character recommendations never assume orientation solely from user gender.
- Gender and companion preferences can be skipped and changed.

## 22. Performance and Reliability

- Use compressed WebP or AVIF assets with deliberate fallbacks.
- Load active and likely adjacent scenes only.
- Load emotional character poses on demand and prefetch only the most probable lightweight asset.
- Pause inactive atmospheric effects.
- Use transforms and opacity for motion.
- Avoid permanent full-screen WebGL.
- Reduce scene layers based on measured capability and frame performance.
- Keep chat usable before assets finish loading.
- Provide one reliable development start command with a health endpoint and persistent process behavior suitable for Codex browser review.

## 23. Testing and Acceptance

### 23.1 Automated coverage

Add or extend tests for:

- Chinese and English catalog parity and immediate locale switching state.
- Separation of interface and practice language.
- Onboarding migration, birthday validation, and under-18 restrictions.
- Progressive-profile skip and edit behavior.
- Relationship progression, rejection, pause, reset, and age gate.
- Prohibition of spend-driven relationship behavior.
- Emotion-signal thresholds and manual `陪陪我` override.
- Crisis override precedence and trusted-contact confirmation requirement.
- Memory sensitivity confirmation and manual remember action.
- Avatar editor transform, valid output, replacement, removal, and failure preservation.
- Reading-mode suggestion and manual override.
- Scene transition interruption and reduced-motion resolution.
- Quick-settings and full-settings navigation state.
- Serialization and migration of every new persisted field.

### 23.2 Browser acceptance

Verify in real browsers:

- First-use flow in Chinese and English.
- Immediate language switch without reload.
- Desktop and mobile companion selection.
- Mobile swipe conflict prevention.
- Quick and advanced companion creation.
- Avatar editing with keyboard and touch where supported.
- Long-conversation reading mode.
- Reduced motion and system preference behavior.
- Emotional-presence static and animated variants.
- Scene failure and slow-load fallback.
- Voice-input unavailable and permission-denied behavior.
- Keyboard focus, screen-reader labels, and contrast.
- Stable preview-server startup and reconnection.

### 23.3 Completion gate

The next implementation phase is accepted only when:

1. All existing tests remain green.
2. New behavior is covered in proportion to risk.
3. The browser console has no application errors during core flows.
4. Desktop and mobile have no horizontal overflow or blocked composer.
5. Chinese and English user-facing surfaces are complete.
6. Under-18 and crisis rules cannot be bypassed through normal UI flows.
7. Reduced motion retains every function.
8. Every new visual asset used in the product has explicit user approval.

## 24. Delivery Sequence

The selected implementation route is **companionship core first**:

1. Complete bilingual UI and first-use age/language flow.
2. Simplify creation into quick drawer plus advanced wizard shell.
3. Simplify quick settings and introduce complete settings navigation.
4. Add emotional-support state, `陪陪我`, and safe static character-presence assets.
5. Refine layered scene transitions and scene-specific atmosphere.
6. Complete reading mode and mobile role switching.
7. Complete local avatar editor.
8. Add speech input and harden reply voice playback.
9. Add relationship-state foundation, adult gating, boundaries, and crisis override.
10. Stabilize preview startup, then run full accessibility, performance, privacy, and browser QA.

Account sync, real-time voice calling, AI avatar styling, and paid-plan enforcement are later projects. Their interface may be described only where doing so does not imply that the capability currently works.

## 25. Success Criteria

The design succeeds when:

1. A new user reaches a meaningful conversation with minimal setup.
2. The product visibly responds to emotional need without claiming diagnosis.
3. A young woman can feel warmth and romantic possibility without being manipulated by payment or withdrawal of care.
4. Learning tools remain useful but never interrupt companionship.
5. Scenes feel connected, alive, and readable over long conversations.
6. Chinese and English users can control the complete interface.
7. Minors, adults, sensitive memory, and crisis states follow explicit tested boundaries.
8. Existing local data and working product behavior remain intact.
9. The preview and development loop is reliable enough for repeated visual approval.
10. The implementation feels like one evolving Wyth product, not a set of parallel prototypes.
