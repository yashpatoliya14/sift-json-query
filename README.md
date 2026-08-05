# Data Weaver

# SIFT — JSON Field & Value Explorer

SIFT is a fast, all-in-the-browser tool for exploring, searching, and querying JSON data. Paste or upload a JSON file, browse it as an interactive tree, search across keys and values (including regex and MongoDB-style query syntax), and — when you need real analytical power — run raw SQL against it with an embedded DuckDB engine. Everything runs client-side; no data ever leaves your browser.

## ✨ Features

### 🌲 Interactive tree view
- Renders any JSON document as a collapsible, virtualized tree (powered by `react-window`), so even very large files stay smooth to scroll.
- Expand/collapse individual nodes or whole subtrees; containers (objects/arrays) show live key/item counts.
- Click any node to copy its JSON path (`$.foo.bar[2]`) to the clipboard.
- Syntax-aware highlighting distinguishes keys, strings, numbers, booleans, and `null`.

### 🔍 Powerful search
- Search across **keys**, **values**, or **both** at once.
- Toggle **case-sensitive** matching and **regular expression** mode.
- Matches are highlighted inline in the tree, with a match counter and **Next/Previous** navigation (`Enter` / `Shift+Enter`).
- Ancestor nodes of a match are auto-expanded so results are never hidden in a collapsed branch.
- A **Match Ledger** panel lists every match with its path, key, and value preview for quick scanning.
- Debounced input keeps the UI responsive while typing, even on large documents.
- Search is executed against an in-browser DuckDB engine, so results come back with a reported query time (e.g. `⚡ 3 ms`).

### 🗄️ MongoDB-style query syntax
- In addition to plain text/regex search, SIFT understands MongoDB-flavored query objects, e.g.:
  ```json
  { "age": { "$gt": 20 } }
  ```
  These are parsed and translated into an equivalent SQL `WHERE` clause under the hood.

### 🧮 SQL Console (DuckDB-Wasm)
- Spin up an embedded [DuckDB-Wasm](https://duckdb.org/docs/api/wasm/overview) analytical engine directly in the browser.
- Your loaded JSON is registered as a queryable table — write and run arbitrary `SELECT` statements against it.
- Results render in a scrollable, sticky-header table with per-cell type awareness (`null`, objects, primitives).
- Query execution time is displayed after every run.

### 📥 Flexible data input
- **Paste** JSON directly into an editor panel — processing kicks in instantly on paste, no extra step required.
- **Upload** a `.json` or `.txt` file from disk.
- **Load sample data** to try the tool immediately without your own file.
- **Apply** via button or `⌘/Ctrl + Enter`; **Clear** to reset.
- Friendly parse-error messages if the input isn't valid JSON.

### 📊 Live stats
- A stat strip shows node count, leaf count, container count, max depth, and file size — updated as you load or edit data.

### ⚡ Performance-minded architecture
- Tree flattening and stats run synchronously on the main thread via `useMemo` for instant feedback on typical documents.
- A dedicated JSON worker (`jsonWorker.ts`) offloads heavier parsing/search work off the main thread when needed, keeping the UI responsive.
- DuckDB-Wasm runs in its own Worker with same-origin `.wasm`/worker assets (avoiding CDN/CORS + COEP issues).

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Virtualization | `react-window` |
| Analytical engine | `@duckdb/duckdb-wasm` |
| Utilities | `clsx`, `tailwind-merge` |

## 📁 Project Structure

```
src/
├── App.tsx                    # Top-level app state & orchestration
├── main.tsx                   # React entry point
├── index.css                  # Global styles / Tailwind entry
├── components/
│   ├── Header.tsx              # Brand bar + live node/match counters
│   ├── SourceControls.tsx      # Paste / upload / sample / clear JSON input
│   ├── SearchControls.tsx      # Search bar, mode toggles, case/regex, nav
│   ├── SqlConsole.tsx          # DuckDB-Wasm SQL query console
│   ├── StatStrip.tsx           # Node/leaf/container/depth/size stats
│   ├── MatchLedger.tsx         # List of all current search matches
│   ├── TreePanel.tsx           # Virtualized JSON tree container
│   ├── VirtualRow.tsx          # Single virtualized tree row
│   ├── JsonNode.tsx            # Renders an individual JSON node
│   ├── Highlight.tsx           # Inline match-highlighting text renderer
│   ├── LightningZap.tsx        # UI flourish/animation component
│   └── icons.tsx               # Inline SVG icon set
├── lib/
│   ├── types.ts                 # Shared TypeScript types
│   ├── jsonTools.ts             # Path formatting, stats, search-range helpers
│   ├── flattenTree.ts           # Converts nested JSON into flat, virtualizable rows
│   ├── mongoSearch.ts           # MongoDB-style query parsing → SQL translation
│   ├── duckdb.ts                # DuckDB-Wasm init, file registration, querying
│   ├── jsonWorker.ts            # Web Worker for off-main-thread JSON processing
│   ├── useJsonWorker.ts         # React hook wrapping the JSON worker
│   └── sampleData.ts            # Built-in sample JSON document
└── utils/
    └── cn.ts                    # className merge helper (clsx + tailwind-merge)

public/
└── duckdb/                      # Same-origin DuckDB-Wasm binaries & workers
    ├── duckdb-mvp.wasm
    ├── duckdb-eh.wasm
    ├── duckdb-browser-mvp.worker.js
    └── duckdb-browser-eh.worker.js
```

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/), since a `bun.lock` is included)

### Installation

```bash
# with npm
npm install

# or with bun
bun install
```

### Development

```bash
npm run dev
# or
bun run dev
```

This starts the Vite dev server (default: `http://localhost:5173`) with hot module reloading.

### Build for production

```bash
npm run build
# or
bun run build
```

Outputs an optimized, single-file-friendly production build (via `vite-plugin-singlefile`) to `dist/`.

### Preview the production build

```bash
npm run preview
# or
bun run preview
```

## 🧭 Usage Guide

1. **Load data** — use the *Source* panel to paste JSON, upload a file, or click **Load sample** to try it out immediately.
2. **Browse** — explore the parsed structure in the *Tree* tab; click any node to expand/collapse it or copy its path.
3. **Search** — type a query into the search bar. Choose whether to match **Keys**, **Values**, or **Both**; toggle **Aa** for case-sensitivity and **.\*** for regex. Use the arrows (or `Enter` / `Shift+Enter`) to step through matches.
4. **Query with SQL** — switch to the *SQL* tab, click **Start SQL Engine** to boot DuckDB-Wasm, then write and run any `SELECT` statement against your loaded data.
5. **Inspect stats** — keep an eye on the stat strip and header badges for live node/match counts as you work.

## 🔒 Privacy

All parsing, searching, and querying happens locally in your browser (including the DuckDB analytical engine, which runs as WebAssembly). No JSON data you load into SIFT is uploaded to any server.

## 📄 License

No license file is included in this project. Add one (e.g. MIT) if you intend to distribute or open-source it.


use this below skill for UI
---

name: frontend-design

description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.

license: Complete terms in LICENSE.txt

---

# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This client has already rejected proposals that felt templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.

## Ground it in the subject

If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before – use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.

Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.

Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence - like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.

Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects; choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.

Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. Just like a human designer who's hired, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the human's design brief: create a compact token system with color, type, layout, and signature. Color: describe the palette as 4–6 named hex values. Type: the typefaces for 2+ roles (a characterful display face that's used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single unique element this page will be remembered by that embodies the brief in an appropriate way.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan exactly and deriving every color and type decision from it.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and a element-based selector like .cta). This can happen often with paddings/margins between sections.

Try to do a lot of this planning and iteration in your thinking, and only show ideas to the user when you have higher confidence it'll delight them.

## Restraint and self-critique

Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Not taking a risk can be a risk itself! Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected. Critique your own work as you build, taking screenshots if your environment supports it – a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creators have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand, and therefore easier to use. They are design material, not decoration. Bring the same intentionality to copy that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's side of the screen. Name things by what people control and recognize, never by how the system is built. A person manages notifications, not webhook config. Describe what something does in plain terms rather than selling it. Being specific is always better than being clever.

Use active voice as default. A control should say exactly what happens when it's used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the register conversational and tuned: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each element do exactly one job. A label labels, an example demonstrates, and nothing quietly does double duty.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8378bab4-1c75-4d06-a346-7f5671165394).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
