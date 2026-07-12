# Wyth Cinematic UI Redesign

**Date:** 2026-07-12  
**Status:** Approved design, pending written-spec review  
**Product:** Wyth (software full name: Intelligent agents)

## 1. Purpose

Redesign the existing English Companions frontend into Wyth: a warm, immersive companion-chat experience where language learning happens only when the user asks for it.

The current three-column application shell looks and behaves like a generic administration template. The redesign must make the active conversation the primary experience, hide secondary controls until needed, and give every companion a distinct but connected cinematic environment.

The product priority is:

- 90% emotional companionship and conversation.
- 10% optional language learning.
- Desktop-first immersive presentation, with a complete lightweight mobile experience.

## 2. Product Principles

1. **Conversation is the interface.** The default screen contains the active scene, conversation, role rail, composer, and restrained utility entry points.
2. **Companionship precedes correction.** Wyth never interrupts a conversation with unsolicited language corrections.
3. **Every companion has a place.** A companion is expressed through environment, light, personal objects, voice, and avatar rather than a full-body character.
4. **Scenes belong to one world.** Shared visual motifs and continuous camera transitions connect the environments.
5. **Effects support attention.** Motion creates presence and continuity without competing with reading or long conversations.
6. **Secondary controls stay secondary.** Settings, model configuration, vocabulary, profile, and creation tools remain hidden until requested.
7. **Local-first behavior remains intact.** User-created data, including uploaded avatars, follows the existing local-first privacy model.

## 3. Brand System

### 3.1 Name and meaning

The user-facing product name is **Wyth**, derived from **with warmth**.

- The startup experience presents the Wyth wordmark with the small line `with warmth`.
- The daily chat interface shows only a small Wyth mark in the upper-left corner.
- `Intelligent agents` appears only in About, legal, or software-registration information.
- The old English Companions name is removed from normal user-facing brand surfaces.

### 3.2 Brand expression

The wordmark should feel warm, restrained, and mature. It must not resemble a loud technology logo or a playful children's product. The final wordmark and all visual assets require user preview and approval before integration.

## 4. Experience Architecture

### 4.1 Desktop shell

The active companion scene fills the viewport. The permanent three-column layout is removed.

The default desktop shell contains:

- A narrow vertical companion rail on the left.
- The small Wyth mark at the upper-left.
- The active companion's scene across the main viewport.
- Conversation messages integrated into the scene.
- A stable composer near the bottom center.
- A visually quiet utility dock along the bottom.
- A right-side drawer that appears only when a utility is opened.

### 4.2 Companion rail

Companion avatars remain vertically arranged on the left.

- The active companion is clear and visually anchored.
- Inactive companions fade after a conversation becomes active.
- Hovering or focusing an inactive avatar restores its clarity and reveals the companion name and short relationship description.
- Selecting a companion initiates a continuous scene transition and switches to that companion's conversation history.
- The rail includes an accessible create-companion action.

Opacity must not be the only indication of active state. Focus rings, accessible labels, and a persistent active marker are required.

### 4.3 Chat presentation

The normal chat state uses messages that visually float within the scene rather than a permanent opaque panel.

When the user scrolls away from the latest messages to review a longer history:

- The environment loses some contrast and saturation.
- Nonessential scene motion slows or pauses.
- The message region gains a restrained translucent reading surface.
- Text contrast remains stable and meets accessibility requirements.

Returning to the newest message automatically restores the immersive scene state. The user does not manually switch between chat and reading modes.

### 4.4 Utility dock and drawer

The bottom utility dock is subdued until hovered, focused, or opened. It provides access to:

- Create companion.
- Vocabulary book.
- Local profile.
- Model configuration and runtime status.
- Companion settings and memory controls.
- General settings, including reduced motion.

Selecting an item opens the corresponding content in a right-side drawer. Only one drawer section is active at a time. Closing the drawer returns focus to the control that opened it and restores the full scene.

The drawer must not replace or destroy the active conversation state.

## 5. First-Use Experience

When no companions exist, Wyth opens on a quiet, lightly animated empty environment with the prompt:

> 今天想和谁说说话？

Five preset companions then appear as linked environmental glimpses:

1. **知心朋友** - a warm conversational friend.
2. **安静倾听者** - receives the user's expression before offering advice and avoids unnecessary interrogation.
3. **旅行伙伴** - companionship through travel, curiosity, and everyday discovery.
4. **职场搭档** - supportive professional conversation without becoming a productivity dashboard.
5. **温柔语言教练** - gentle language help while preserving the companionship-first model.

The user can start immediately with a preset or choose to create a custom companion. Presets are editable after selection.

## 6. Scene System

### 6.1 Visual direction

The primary style is quiet cinematic realism with a small amount of dreamlike surrealism.

Use:

- Low-saturation natural color.
- Credible materials and lived-in spaces.
- Soft directional light and atmospheric depth.
- Restrained negative space around conversation content.
- One or two slightly impossible details per scene, such as suspended paper, an unusual cloud movement, or a distant luminous path.

Avoid:

- Generic purple AI gradients.
- Repeated glass-card layouts.
- Decorative glowing spheres.
- Continuous high-energy motion.
- Unrelated stock images presented as independent slides.

### 6.2 Preset environments

- **知心朋友:** a living-room window at morning or dusk.
- **安静倾听者:** a quiet room at night with rain, a soft lamp, and generous empty space.
- **旅行伙伴:** a moving train window or early-morning station.
- **职场搭档:** a personal work desk with visible daily-life details and a city at dusk.
- **温柔语言教练:** a sunlit study or reading table.

These are art-direction anchors rather than rigid final compositions. Every generated or sourced image must be previewed for the user before it is integrated.

### 6.3 Continuity motif

All scenes share a recurring visual motif, selected during asset production. Candidate motifs include:

- A warm moving line of light.
- Paper with a consistent material and movement language.
- A distant path or horizon that continues between environments.

Only one primary motif should be used in the final set. It drives transitions and makes the environments feel like regions of a shared world.

### 6.4 Layered implementation

The recommended implementation is a cinematic layered scene, not a continuously rendered full 3D world.

Each scene may contain:

- A compressed base image.
- Optional foreground and midground cutout layers.
- A light or color overlay.
- Lightweight weather, dust, paper, or reflection effects.
- A shared transition layer used between companions.

CSS transforms and opacity handle most motion. Canvas or lightweight WebGL is reserved for effects that materially improve the transition or atmosphere.

## 7. Companion Switching

Switching companions must feel like a camera moving through a connected environment rather than a page replacement.

Transition sequence:

1. Current messages soften and recede.
2. The shared continuity motif becomes more visible.
3. The current scene shifts in depth, position, or focus.
4. The next scene enters along a related visual path.
5. The selected avatar and companion identity resolve.
6. The new conversation appears after the scene establishes itself.

Transitions should be brief enough for frequent use. They must be interruptible: selecting another companion or enabling reduced motion cannot leave the interface in an intermediate state.

## 8. Ambient and Emotional Motion

Default motion is moderate but calm.

### 8.1 Idle motion

Examples include:

- Slow light changes.
- Rain or distant weather.
- Curtain or paper movement.
- Sparse dust or atmospheric particles.
- Subtle movement outside a window.

### 8.2 Reply feedback

Companion replies can trigger one restrained local scene response, such as:

- A lamp warming slightly.
- Rain softening.
- A small light appearing in the distance.
- A page shifting.
- A reflection changing.

Emotion feedback must remain ambiguous and atmospheric. The interface must not claim certainty about a user's emotional state or use aggressive color coding.

### 8.3 Reduced motion

Wyth provides a visible Reduce motion setting and automatically respects `prefers-reduced-motion`.

Reduced-motion behavior removes:

- Camera travel.
- Parallax.
- Particle systems.
- Emotion-triggered environmental animation.
- Large spatial drawer transitions.

Fast fades and necessary state changes remain. Functionality and information must be identical in both modes.

## 9. Companion Creation and Editing

Creation occurs in the right-side drawer as a short progressive flow:

1. Name, relationship, and personality.
2. Conversation language and companionship preferences.
3. System-recommended scene with preview and alternative selection.
4. Avatar upload or default avatar.
5. Final preview and start conversation.

The scene recommendation is based on the existing companion relationship and personality fields. The user can always replace the recommendation with another curated scene.

Existing companions can be edited through the same drawer without losing messages or memory.

## 10. Avatar Upload

Users can upload, replace, or remove an avatar for a custom companion during creation or later editing.

Requirements:

- The source image remains local and is not sent to Wyth's backend or an external service.
- The browser validates the selected file as a supported image.
- The image is center-cropped to a square, resized, and compressed before storage.
- The UI communicates file rejection or storage-capacity errors without discarding the previous avatar.
- Removing an uploaded avatar restores a default scene-compatible avatar.
- Existing companions without avatar data continue to work.

The exact output dimensions, encoding format, and storage cap will be set in the implementation plan after checking browser-storage constraints in the current data model.

## 11. Optional Language Tools

Wyth does not proactively correct the user.

Language assistance appears only after an explicit action on selected text or a message. Available actions are:

- Translate.
- Help me say this more naturally.
- Read aloud.
- Save to vocabulary.

The existing translation, text-to-speech, and vocabulary behavior remains available but moves into this contextual action model and the utility drawer. A correction result should appear as a temporary contextual surface, not as an unsolicited chat message.

## 12. Data and State Changes

The redesign preserves the existing local-first and backend-memory boundaries.

New UI state includes:

- Active drawer section.
- Immersive or history-reading presentation state.
- Companion transition state.
- Reduced-motion preference.

New companion data includes:

- Scene identifier.
- Optional custom avatar payload and metadata.

Old serialized companion data remains valid. On load:

- Missing scene identifiers receive a deterministic recommended default.
- Missing avatars use the default avatar system.
- Missing motion preferences follow the operating-system preference, then the Wyth default.

Transient animation and drawer state must not be persisted as companion data.

## 13. Responsive Behavior

### 13.1 Desktop

Desktop is the primary visual target. It supports the full layered scene, left companion rail, bottom dock, right drawer, and continuous companion transitions.

### 13.2 Mobile and narrow screens

The mobile experience preserves all functionality while reducing visual complexity:

- The left rail becomes a horizontal avatar strip near the top.
- The right drawer becomes a bottom sheet.
- Scene depth and particle density are reduced.
- Messages receive stronger contrast protection.
- The composer remains reachable when the virtual keyboard opens.
- Scene transitions use shorter movement or fades.

Mobile is not required to reproduce every desktop cinematic effect.

## 14. Performance Strategy

- Prefer AVIF or WebP scene assets with responsive fallbacks where needed.
- Preload only the active scene and the most likely adjacent scenes.
- Pause inactive scene animation.
- Avoid permanent full-screen WebGL rendering.
- Use transform and opacity animations that do not force repeated layout.
- Reduce effects on low-capability devices based on measured performance, not user-agent strings alone.
- Resize and compress uploaded avatars before persistence.
- Preserve a usable interface while scene assets load or fail.

If a scene asset fails, Wyth shows a deliberate gradient-and-light fallback derived from that scene's palette; chat remains fully usable.

## 15. Accessibility

- All avatar and utility controls are keyboard accessible and have explicit accessible names.
- Hover-only companion information is also exposed on keyboard focus.
- Active companion state is conveyed by more than opacity or color.
- Drawer focus is contained while open and restored on close.
- Chat messages maintain readable contrast over every scene and transition state.
- Motion is optional and respects system preferences.
- Uploaded-avatar previews include clear replacement and removal controls.
- Touch targets remain usable on mobile.
- Screen-reader announcements cover companion changes, drawer changes, upload errors, and reply-loading state without narrating decorative animation.

## 16. Error Handling

- **Scene load failure:** use the scene palette fallback and allow chat to continue.
- **Avatar file invalid:** explain the supported input and preserve the prior avatar.
- **Avatar storage full:** explain that the image could not be saved and offer removal or a smaller file.
- **Interrupted transition:** resolve immediately to one valid companion state.
- **Drawer content error:** show the error inside the drawer without obscuring the conversation.
- **Existing API or model failure:** preserve the current deterministic fallback and runtime-status behavior.

## 17. Testing and Verification

### 17.1 Automated tests

The complete existing `npm test` suite must continue to pass. Add focused coverage for:

- Companion serialization and migration with scene and avatar fields.
- Avatar validation, resize/compression boundaries where testable, replacement, removal, and failure preservation.
- Scene recommendation logic.
- Drawer state and focus restoration helpers.
- Immersive-to-history-reading state rules.
- Reduced-motion preference resolution.
- Companion-switch state transitions and interruption rules.
- Layout and accessibility contracts that can be asserted without a browser.

### 17.2 Browser verification

Verify:

- Desktop layouts at representative wide and medium viewport sizes.
- Mobile core functionality and virtual-keyboard behavior.
- Keyboard-only navigation.
- Reduced-motion mode.
- Long-conversation history mode.
- Companion switching during loading and animation.
- Scene and avatar failure fallbacks.
- No regressions to chat, translation, text-to-speech, vocabulary, model settings, scheduler, or memory controls.

### 17.3 Asset approval gate

Before any visual asset is integrated into the application, present it to the user for preview. This gate applies to:

- The Wyth wordmark.
- Each preset scene.
- The final shared continuity motif.
- Default companion avatar artwork.
- Any additional decorative image or generated visual used in the shipped interface.

Assets may be revised or regenerated after feedback. Approval of the design document does not imply approval of unseen assets.

## 18. Implementation Boundaries

In scope:

- Frontend information-architecture redesign.
- Wyth rebranding on user-facing surfaces.
- Layered companion scenes and transitions.
- Preset first-use experience.
- Utility dock and responsive drawer/bottom sheet.
- Custom avatar upload and local persistence.
- Curated scene recommendation and selection.
- Contextual, user-invoked language actions.
- Accessibility, performance fallbacks, responsive behavior, and tests.

Out of scope for this redesign:

- Replacing the LLM provider architecture.
- Cloud accounts or cross-device synchronization.
- Uploading avatars or private user data to external services.
- A persistent full-3D world or game engine.
- Automatic emotional diagnosis.
- Unsolicited language correction.
- A mobile experience with desktop-equivalent visual complexity.

## 19. Success Criteria

The redesign succeeds when:

1. A new user understands that Wyth is a warm companion-chat product before seeing settings or learning tools.
2. The default screen feels designed around the active companion rather than a generic application template.
3. Switching companions feels continuous while each companion remains visually distinct.
4. Long conversations remain comfortable to read.
5. Language tools are easy to invoke but never interrupt companionship.
6. Existing product capabilities and stored data continue to work.
7. Motion can be reduced without loss of functionality.
8. All shipped visual assets have been explicitly previewed and approved by the user.

