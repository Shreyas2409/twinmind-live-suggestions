# TwinMind — Live Suggestions

A real-time AI meeting copilot that listens to live audio, transcribes it, and surfaces contextual suggestions — all powered by Groq's inference engine.

**Live Demo**: [deployed-url]
**Stack**: Next.js 16 · TypeScript · Tailwind CSS v4 · Zustand · Groq APIs

## Quick Start

```bash
git clone <repo-url>
cd TwinMind
npm install
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Settings** → paste your [Groq API key](https://console.groq.com)
3. Click the mic → start talking
4. Suggestions appear every ~30 seconds

---

## How I Improved on TwinMind

Before writing a single line of code, I downloaded TwinMind and used the live suggestions feature across multiple conversations to understand what it does well and where I saw room for improvement.

### What TwinMind Does Well
- **Structured summaries**: TwinMind produces clean, topic-grouped meeting summaries with speaker identification and action items
- **Section organization**: Groups related points by theme rather than chronologically, making it easy to scan
- **Analysis over restatement**: The best outputs add interpretation ("Early dynamic suggested a friendly, conversational setup") rather than just echoing what was said
- **Comprehensive coverage**: Captures key outcomes, decisions, and nuances from the conversation

### Where I Saw Opportunities

| TwinMind Behavior | My Improvement |
|---|---|
| Suggestions appear as a post-meeting summary | I surface suggestions **every 30 seconds** during the live conversation — when they're actually useful |
| All suggestions are the same format (summary bullets) | I created **5 distinct suggestion types** (question, answer, fact-check, talking point, action item) with specific trigger conditions for each |
| No awareness of conversation phase | I built **conversation phase detection** — introductions get substantive topics, deep discussion gets fact-checks, Q&A gets direct answers, wrap-up gets action items |
| Suggestions sometimes restate what was said | I added an **absolute anti-restatement rule** — every suggestion must add NEW information the user didn't already hear |
| Fact-checks triggered on opinions and intentions | I **scoped fact-checks** to only trigger on verifiable claims (numbers, dates, statistics) — never on statements of intent or preference |
| No deduplication across suggestion batches | I pass **previous batch titles** to the model with each request, preventing repetitive suggestions |
| Detail answers can be very long | I **capped detail answers at 400 tokens** (~150 words) and enforced 3-4 bullet points max — because the user is in a live meeting, not reading a report |
| No click-to-expand interaction | Clicking a suggestion **streams a detailed answer** in the chat panel with full transcript context, using a separate, deeper prompt |

### My Design Philosophy

TwinMind is optimized for post-meeting review. My implementation is optimized for **in-meeting action**. Every design decision — the 30-second refresh cycle, the suggestion type taxonomy, the aggressive brevity constraints, the anti-restatement rules — is driven by one question: *"Would this be useful to glance at while someone is talking to me?"*

If the answer is no, it doesn't belong on screen.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────┬──────────────────┬────────────────────────────────┤
│  Transcript │  Suggestions     │  Chat                          │
│  Panel      │  Panel           │  Panel                         │
│             │                  │                                │
│  MediaRec.  │  3 cards/batch   │  Streaming SSE                 │
│  15s chunks │  newest on top   │  Markdown render               │
├─────────────┴──────────────────┴────────────────────────────────┤
│                    Zustand State Layer                           │
│  ┌──────────────────┐  ┌──────────────────────────────────┐     │
│  │ useApiKeyStore   │  │ useSettingsStore (persist)        │     │
│  │ memory only      │  │ localStorage: prompts, prefs     │     │
│  └──────────────────┘  └──────────────────────────────────┘     │
└──────┬──────────────────────┬──────────────────┬────────────────┘
       │                      │                  │
       ▼                      ▼                  ▼
┌──────────────┐ ┌───────────────┐ ┌─────────────────┐
│/api/transcribe│ │/api/suggestions│ │  /api/chat       │
│              │ │               │ │                 │
│ Whisper      │ │ GPT-OSS 120B  │ │ GPT-OSS 120B    │
│ Large V3     │ │ temp=0.6      │ │ temp=0.5        │
│              │ │ max_tok=1024  │ │ max_tok=400     │
│              │ │ JSON mode     │ │ stream=true     │
└──────┬───────┘ └───────┬───────┘ └────────┬────────┘
       │                 │                   │
       └────────────┬────┴───────────────────┘
                    ▼
            Groq API (api.groq.com)
```

### Data Flow

1. **Audio Capture** → Browser MediaRecorder captures mic in webm/opus → every 15s, chunk is flushed
2. **Transcription** → Audio blob → `/api/transcribe` → Groq Whisper Large V3 → text chunk with timestamp
3. **Suggestions** → Transcript (windowed to last 8K chars) + previous batch titles → `/api/suggestions` → GPT-OSS 120B → 3 JSON suggestion cards
4. **Chat** → Clicked suggestion or typed question + transcript context (16K chars) + chat history → `/api/chat` → GPT-OSS 120B (streaming SSE) → rendered response

## Folder Structure

```
TwinMind/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Main 3-column layout, state management
│   │   ├── layout.tsx               # Root layout, fonts, dark theme
│   │   ├── globals.css              # Tailwind v4 global styles
│   │   └── api/
│   │       ├── transcribe/route.ts  # Whisper proxy + hallucination filter
│   │       ├── suggestions/route.ts # GPT-OSS 120B → 3 suggestions (JSON)
│   │       └── chat/route.ts        # GPT-OSS 120B → streaming SSE chat
│   ├── components/
│   │   ├── TranscriptPanel.tsx      # Mic control, transcript display, auto-scroll
│   │   ├── SuggestionsPanel.tsx     # Suggestion cards, batches, auto-refresh timer
│   │   ├── ChatPanel.tsx            # Chat UI, streaming parser, markdown render
│   │   ├── Settings.tsx             # API key + editable prompts modal
│   │   └── ExportButton.tsx         # Session export as timestamped JSON
│   ├── hooks/
│   │   └── useAudioCapture.ts       # MediaRecorder hook, 30s chunking, flush
│   └── lib/
│       ├── settings.ts              # Default prompts, types, constants
│       ├── store.ts                 # Zustand stores (API key in memory, settings persisted)
│       ├── groq.ts                  # Groq API client (shared)
│       ├── prompts.ts               # Context windowing, message builders
│       └── export.ts                # Session export logic
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## Prompt Engineering Strategy

This is where I spent the most time. The prompts went through multiple iterations based on real-world testing with live audio.

### The Core Problem

Most LLMs default to being helpful in a generic way — they summarize what was said, suggest vague follow-ups, or produce wall-of-text answers. In a live meeting, none of that is useful. The user already heard what was said. They need NEW information, RIGHT NOW, in a format they can glance at in 2 seconds.

### My Approach: Context-Aware Suggestion Taxonomy

I defined 5 suggestion types, each with specific trigger conditions:

| Type | When to Use | Example |
| --- | --- | --- |
| question | Conversation is shallow or a thread was dropped | "Ask what metric defines success for this launch" |
| answer | Someone just asked a question or expressed uncertainty | "Apple's 1997 market share was ~3.2%, confirming the claim" |
| fact_check | A specific number, date, or statistic was stated | "Verify: 40% growth — clarify if QoQ or YoY" |
| talking_point | Conversation losing focus or natural transition coming | "Pivot to margins: How does lower price maintain margins?" |
| action_item | Someone commits to something or a decision is made | "ACTION: Sarah to share Q3 numbers by Friday" |

### Key Prompt Decisions

**1. Anti-Restatement Rule**
The biggest quality issue I found was the model echoing what was just said. I added an absolute rule: "NEVER restate, echo, summarize, or paraphrase what the speaker just said. The user HEARD it — they need NEW information." This single rule dramatically improved suggestion quality.

**2. Conversation Phase Awareness**
I taught the model to detect what phase the conversation is in and adapt:

- **Introductions**: Skip fact-checks, suggest substantive topics instead
- **Deep discussion**: This is where fact-checks shine
- **Q&A**: Prioritize answers — if someone asks a question, the first suggestion MUST answer it
- **Wrapping up**: Suggest action items and key takeaways

**3. Fact-Check Scope Limitation**
Early testing showed the model fact-checking statements of intent ("Verify claim about not asking finance questions"). I added an explicit rule: only fact-check claims about the external world (statistics, dates, events), never opinions or intentions.

**4. Recency Weighting**
I instruct the model to focus on the last 2-3 sentences. In a live meeting, what was said 5 minutes ago is less relevant than what was said 10 seconds ago. The transcript also includes timestamps so the model can gauge timing.

**5. Previous Batch Deduplication**
Each suggestion request includes the titles of the previous batch, with an instruction to not repeat those topics. This prevents the same suggestions from appearing across batches.

**6. Few-Shot Examples (Good vs. Bad)**
For each suggestion type, I provide explicit good and bad examples. This is more effective than abstract instructions:

```
Good: "Ask what metric defines success for this launch"
Bad:  "Consider asking a follow-up question"
```

### Detail Answer Prompt

When a user clicks a suggestion, they need depth — but not a wall of text. I optimized for:

- **First sentence = key insight** (no preamble, no "Great question")
- **Max 4 bullet points** — selective, not exhaustive
- **Concrete examples** — every bullet includes a data point, not just a label
- **Actionable ending** — always ends with a specific next step
- **Hard cap**: 400 tokens (~150 words) enforced at the API level

### Chat Prompt

For free-form questions during a meeting:

- **Under 100 words** unless explicitly asked for detail
- **Topic-based summaries** (not chronological) when asked to summarize
- **Speaker attribution** — quotes the transcript with speaker names
- **No filler** — never starts with "Great question" or "Sure!"

### Context Windowing

- **Suggestions**: Last 8,000 characters (~4-5 minutes of speech). Enough context to understand the topic, small enough for low latency.
- **Chat**: Last 16,000 characters (~10 minutes). Chat answers benefit from more context since the user is asking a specific question.
- Both are configurable in Settings for experimentation.

## Error Handling & Robustness

### Whisper Hallucination Filter

Whisper hallucinates on silence — it produces gibberish in random languages (Russian, Portuguese, Korean mixed together). I built an ASCII-ratio filter: if < 60% of characters are English, the chunk is silently discarded. Also catches common hallucination patterns like repeated filler words.

### Multi-Strategy JSON Parser

GPT-OSS 120B doesn't always return clean JSON. My parser has 5 fallback strategies:

1. Direct JSON.parse
2. Strip markdown code fences (`json ... `)
3. Find `[...]` array anywhere in the response
4. Unwrap container objects (`{"suggestions": [...]}`)
5. Regex salvage — extract individual JSON objects from mangled text

### Type Validation & Mapping

The model sometimes invents its own types ("summary", "analogy", "observation"). I map these to valid types server-side:

- "summary", "overview", "insight" → talking_point
- "example", "analogy" → clarification
- "verify", "check" → fact_check

### Type Variety Enforcement

Even with strong prompts, the model sometimes returns 3 suggestions of the same type. Post-processing guarantees all 3 are different types — if duplicates exist, one is reassigned.

### Graceful Degradation

- Empty audio chunks (< 1KB) are skipped silently
- Invalid JSON triggers fallback parsing, not an error
- Missing API key shows a clear error message
- Network failures show user-friendly error states

## Technical Decisions & Tradeoffs

| Decision | Why | Tradeoff |
| --- | --- | --- |
| Next.js API routes as proxy | API key held in React state (memory only) — never persisted to localStorage. User re-enters on page reload. Sent via headers to server-side API routes that proxy to Groq. | Extra hop, but avoids CORS and keeps keys out of browser network tab for Groq calls |
| 15s chunk interval | Balances responsiveness with API efficiency. Users get transcript updates every 15s instead of waiting 30s. | More API calls, but perceived latency is much lower |
| webm/opus audio format | Native MediaRecorder format in Chrome/Edge. No transcoding needed. Groq accepts it directly. | Firefox falls back to ogg/opus; Safari may need mp4 |
| Zustand for state management | Lightweight (1.1kB) store separates API key (memory-only) from settings (localStorage). Survives hot reloads during development. | Adds one dependency, but eliminates stale closure bugs and module-variable hacks |
| Dual Zustand stores | `useSettingsStore` persists prompts/preferences via Zustand's `persist` middleware. `useApiKeyStore` holds the API key in memory only — never written to localStorage. | User re-enters API key on reload; acceptable tradeoff for a session-based tool |
| Streaming SSE for chat | Tokens appear as they arrive. Perceived latency drops from ~3s to ~200ms for first token. | More complex client-side parsing |
| Temperature 0.6 for suggestions, 0.5 for chat | Suggestions need some creativity for variety. Chat needs precision and conciseness. | Could be tuned per use case |
| 400 max_tokens for chat | Physically enforces brevity. The model was ignoring "under 200 words" at higher limits. | May truncate complex answers |

## Models

| Purpose | Model | Why |
| --- | --- | --- |
| Transcription | Whisper Large V3 | Best accuracy for English speech, handles accents well, fast on Groq |
| Suggestions | GPT-OSS 120B | Required by assignment spec. Good at structured JSON output with proper prompting |
| Chat | GPT-OSS 120B | Same model for consistency. Streaming support on Groq is excellent |

## Export Format

The export button downloads a JSON file with the complete session:

```json
{
  "exportedAt": "2026-04-21T19:30:00.000Z",
  "session": {
    "transcript": [
      { "text": "...", "timestamp": 1713729000000 }
    ],
    "suggestions": [
      {
        "batch": [
          { "type": "question", "title": "...", "preview": "..." },
          { "type": "fact_check", "title": "...", "preview": "..." },
          { "type": "talking_point", "title": "...", "preview": "..." }
        ],
        "timestamp": 1713729030000
      }
    ],
    "chat": [
      { "role": "user", "content": "...", "timestamp": 1713729045000 },
      { "role": "assistant", "content": "...", "timestamp": 1713729047000 }
    ]
  }
}
```

## Running Locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # Production build
npm run start   # Production server
```

### Requirements

- Node.js 18+
- Modern browser (Chrome, Edge, Firefox) with mic access
- [Groq API key](https://console.groq.com) (free tier works)

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Or connect the GitHub repo to Vercel for auto-deploy on push.