# Design brief — Caller ID Lookup (copy/paste to your design agent)

> Copy everything from the line below into a design agent (v0, Lovable, Figma AI,
> ChatGPT/Claude, etc.). Ask it to return a **implementation-ready design spec** that
> the coding agent can build directly in the existing Next.js app.

---

## 1. Product context

Design a **client-only Next.js web app** called **Caller ID Lookup**. It looks up a
phone number's caller name, spam status, and name history using reverse-engineered
public-app endpoints. It is deployed on **Vercel** (Root Directory = `app`).

The current version is a functional but plain, inline-styled form. We want a polished,
trustworthy, modern interface — the visual quality of a good consumer utility app, not
a developer tool. Think: clean, calm, confident, privacy-conscious.

**Critical architecture constraints (must be respected in the design):**
- Pure **client-side**. There are **no server/API routes**. All requests go from the
  browser straight to the provider.
- Users **paste their own credentials** (currently an Eyecon "CID") into the UI.
  Settings are stored in `localStorage` only. Never design a login/signup, account,
  database, or server-secret flow.
- Browser `fetch` to the provider is normally blocked by CORS, so the UI has an
  **optional "CORS proxy" advanced field**. This must be discoverable but not scary —
  most users will need it, and it has privacy implications.
- Provider switcher: **Eyecon** (live-verified) and **TrueCaller** (implemented from static
  analysis, request shape not yet live-verified). Both are selectable and both need the
  user's own token. For TrueCaller the UI should subtly flag that the API shape is
  "experimental / unverified" rather than disabling it.

## 2. Users & jobs to be done

1. **Primary:** a person in Bangladesh who wants to identify an unknown number
   (e.g. `01632-027018`) quickly, see whether it is spam, and see all known names.
2. **Secondary:** a technical user who has their own CID/token and wants to paste it,
   verify the derived auth checksum, and inspect the raw request/response for debugging.
3. Both users care about **privacy**: they are handing a phone number and a secret to
   the app. The design must make data handling obvious and reassuring.

## 3. Screens / states to design

Design **one main screen** plus all of its states:

1. **Empty / default state** — form only, results area shows a friendly empty prompt.
2. **Filling state** — CID (or Bearer token) entered; for Eyecon, live checksum preview updates.
3. **Loading state** — "Looking up…" with a spinner/skeleton in the result area.
4. **Success — Caller ID mode** — one name, "Not flagged" status.
5. **Success — Search / name history mode** — multiple names, table of entries.
6. **Error — 401 invalid CID** — clear recovery guidance ("use the clientId from your
   own signed-in Eyecon app"), not a raw stack trace.
7. **Error — CORS blocked / network failed** — guides the user to the Advanced proxy field.
8. **Advanced proxy panel expanded** — including the privacy warning.
9. **TrueCaller selected** — token field plus host / search-type / Accept fields; a small
   "unverified API shape" note; submit enabled once a token is pasted.
10. **Mobile layout (~375px)** — all of the above stacked, no horizontal scroll.

## 4. Current information architecture (redesign this)

```
Header: "Caller ID lookup" + short explainer

Card 1 — "1. Provider"
  Provider select: [Eyecon ▾] / [TrueCaller]
  Small "experimental / unverified" note when TrueCaller is selected

Card 2 — "2. Number"
  Country code select (Bangladesh +880 default, ~10 countries + "Custom / full number")
  Mobile number text input (inputMode=tel)
  Radio: ( ) Caller ID   ( ) Search / name history

Card 3 — "3. Credentials"   (fields change with the selected provider)
  Eyecon: "Client ID (e-auth / CID)" input + helper + live "Computed e-auth-c checksum: 38"
  TrueCaller: "Bearer token" input (required) + "Search host" (search5 / search5-eu /
    search5-noneu) + "Search type" (2 = caller ID) + "Accept header" (application/json)

<details> "Advanced — CORS proxy"
  Explanation that api.eyecon-app.com sends no CORS headers and the custom e-auth-*
  headers trigger a 401 preflight.
  Proxy URL template input. Placeholder: https://corsproxy.io/?url={url}&{headers}
  Token help: {url}, {rawUrl}, {headers}. Privacy warning: proxy sees CID + number.

Primary button: "Look up" / "Looking up…"

Result card (after submit)
  Number: 8801632027018
  Status: HTTP 200 — Not flagged (via proxy)
  Names: TAS IF?
  Entries table: Name | Type | Suspicious spam
  Collapsible "Request URL" and "Raw response" <pre> blocks
```

Keep this **task order** (provider → number → credentials → advanced → action → result),
but you may restructure the visual hierarchy, grouping, and styling freely.

## 5. Real content for mockups (use this, not lorem ipsum)

- Default CID: `976f3b43-253a-48fa-a49a-d76be98e3d88` (checksum preview: **38**)
- Default country: Bangladesh `+880`; test number: `01632-027018`
- Normalized CLI shown in result: `8801632027018`
- Caller ID result: names `["TAS IF?"]`, spam text `Not flagged`
- Search result names: `TAS IF?`, `Fahmid Tasif`, `Mejho Aunty`, `TASIF 🇦🇷`
- Example entry row: `TAS IF?` | `(empty type)` | `no`
- Example upstream URL (truncate gracefully in the UI):
  `https://api.eyecon-app.com/app/getnames.jsp?cli=8801632027018&lang=en&is_callerid=true&is_ic=false&apsversion=vc_785_vn_4.2026.08.27.2228_a&requestApi=okHttp&source=callerid-web`
- Error copy for 401: "Eyecon rejected the CID (401). Use the clientId from your own
  signed-in Eyecon app."
- Error copy for CORS: "Request blocked or failed: … Eyecon does not send CORS headers,
  so direct browser requests usually fail — configure a CORS proxy below."

## 6. Visual direction

- **Quality bar:** a modern consumer utility — clean whitespace, strong typography,
  subtle depth, intentional states. Avoid default browser styling and dense dev-tool looks.
- **Personality:** trustworthy, calm, slightly technical but friendly. This is a tool
  people use when an unknown number calls them — it should feel reassuring, not alarming.
- **Color:** pick a restrained palette with one clear primary action color. Include
  semantic colors for success (not flagged), warning (spam / suspicious), danger (401),
  and info (proxy/privacy notes). Define everything as CSS custom properties with
  light **and** dark theme values.
- **Typography:** one modern system-ui-style stack; clear type scale for h1, section
  labels, body, helper text, code/mono (CID, URL, raw response).
- **Components:** cards/sections, inputs with visible focus rings, segmented radio
  control for mode, disabled state, spinner/skeleton loading, badges for spam status,
  a data table for entries, disclosure/collapsible for advanced + raw data.
- **Icons:** minimal, optional, inline SVG only. No external icon library or image assets.
- **Spacing/radii:** define a consistent scale (e.g. 4/8/12/16/24px) and a small radius
  system. Add subtle borders/shadows — no heavy glassmorphism or gradients unless
  there's a clear reason.
- **Responsive:** comfortable desktop width (~880px content column) and a flawless
  375px mobile stack. Touch targets ≥ 44px.

## 7. Accessibility & trust requirements

- Every input has a visible `<label>`; helper text is associated and readable.
- Visible keyboard focus on all interactive elements; sensible tab order.
- Radio group behaves as a single control (arrow keys).
- Error messages are announced (e.g. `role="alert"`) and never rely on color alone.
- Status badges include text, not just color.
- Respect `prefers-reduced-motion`.
- Keep the privacy message near the credentials and proxy fields — users should
  understand that the CID is a secret and that a third-party proxy sees the number.

## 8. What to return (deliverables for the coding agent)

Please return a **single, self-contained design handoff** containing:

1. **Design rationale** — 3–5 sentences on the chosen direction.
2. **Design tokens table** — CSS custom properties for colors (light + dark), spacing,
   radii, typography, shadows, with exact values.
3. **Component/state spec** — for each component and each of the 10 states above,
   describe layout, content, and behavior precisely enough to implement without guessing.
4. **A single self-contained HTML + CSS mockup file** (inline CSS, no JS framework, no
   external assets) showing the default, success (both modes), error, and mobile layouts.
   Use the real sample content from section 5.
5. **Copy deck** — final wording for all labels, helper text, empty state, loading,
   success, error, and privacy messages.
6. **Handoff notes** — class names / component names you recommend, plus any behavior
   that needs clarification.

## 9. Implementation constraints for the coding agent (do not design around these)

- Stack is **Next.js 15 App Router + React 19 + plain JavaScript** (no TypeScript).
- Implementation uses **plain CSS / CSS Modules with CSS variables**. Do **not**
  introduce Tailwind, a component library, or new npm dependencies.
- The app is **client-only** (`'use client'` page). No server routes, no backend.
- All settings persist in `localStorage` under key `callerid-lookup:settings:v1`.
- Do not hardcode any real user's secret beyond the documented convenience default CID;
  it must remain user-editable.
- Out of scope: social/photo endpoints, messaging, accounts, login, analytics.

## 10. Explicitly avoid

- Fake "verified", "official", or security badges we cannot substantiate.
- Suggesting the app stores data on a server.
- Asking users to share their CID with us or a third party by default.
- Over-engineered visuals (ornate gradients, 3D, mascot illustrations, animations for
  their own sake). The polish should come from typography, spacing, and state clarity.
