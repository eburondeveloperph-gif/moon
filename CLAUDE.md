# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vite + React + TypeScript voice interface app powered by Google's Gemini Live API. Users talk to an AI assistant ("Beatrice") through a streaming console with audio, video (webcam), and function-calling capabilities.

## Key Commands

```
npm install         # Install dependencies
npm run dev        # Start dev server on http://0.0.0.0:3000
npm run build      # Production build to dist/
npm run preview    # Serve the built bundle locally
```

Requires `.env.local` with `GEMINI_API_KEY=...` before running.

## Architecture

### Client Connection
`GenAILiveClient` (`lib/genai-live-client.ts`) wraps `@google/genai`'s `GoogleGenAI.live.connect()`. It uses an `EventEmitter` pattern for events: `audio`, `content`, `toolcall`, `turncomplete`, `interrupted`, `setupcomplete`, `log`, `open`, `close`, `error`, `inputTranscription`, `outputTranscription`.

### State Management
Zustand stores in `lib/state.ts`:
- `useSettings` — system prompt, model, voice
- `useUI` — sidebar, mic level, camera state, task results
- `useTools` — active toolset (template-driven), tool enable/toggle/add/remove
- `useLogStore` — conversation turns with tool calls and grounding chunks

### Tools System
Tools are defined per-template under `lib/tools/`. Each module exports an array of `FunctionCall` objects (name, description, parameters, scheduling). Templates in `useTools` (`state.ts:13-18`) map to these toolsets:
- `customer-support`, `personal-assistant`, `navigation-system`, `beatrice`

When `setTemplate` is called, it updates both the active tools AND the system prompt via `useSettings.setSystemPrompt()`.

### LiveAPIContext
`contexts/LiveAPIContext.tsx` provides the `GenAILiveClient` instance down the tree. Components consume via `useLiveAPI()` hook (`hooks/media/use-live-api.ts`).

### Audio Pipeline
`lib/audio-streamer.ts` handles PCM audio playback. `lib/audio-recorder.ts` captures from microphone. `lib/worklets/` contains AudioWorklet processors for volume metering and general audio processing.

### Prompts
`lib/prompts/` and `lib/prompts.ts` define system prompts and prompt utilities. The Beatrice template uses a specific persona prompt stored in `state.ts:24-42`.

## Code Conventions

- React components: `PascalCase` in `components/`
- Utilities/hooks: `camelCase` in `lib/`, `hooks/`
- `@/` alias maps to project root (configured in `tsconfig.json` and `vite.config.ts`)
- Functional components, explicit imports
- Zustand stores use `create<StoreInterface>(...)` with typed setters
- `useLiveAPI()` from `hooks/media/use-live-api.ts` — not from context directly
- `dist/` is generated output, never edited manually

## Reference

See `AGENTS.md` for full project conventions (naming, testing, PR guidelines, security).
