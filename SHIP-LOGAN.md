# Logan / Lulox READY slice

**Prod:** https://mochiagents.vercel.app/  
**Repo:** https://github.com/luloxi/Mochi (push only to luloxi)  
**SHA:** `d7b3bea` (full: `d7b3beaf7def33983789f3fabf5cb5050fe2180e`)  
**Base:** `da7e246` (phone launcher + sheet) + character/launcher/agenda slice (`f198d5b`) + DeskAppId build fix  
**Vercel:** production READY on https://mochiagents.vercel.app/ (alias live)

## What shipped

1. **Character chats** — Distinct Mochi / Lulox help souls + reply vibe (ñam / miau). Nimbo soul more gold + playful productivity wins. Rioplatense, short lines.
2. **Launcher / tienda polish** — Phone sheet hierarchy (titles, emoji tiles), friendlier store rows (sumar / sacar / siempre), less raw chrome.
3. **Fun productivity** — Tomate win line, notas empty state sparkle, Nimbo +1 on listo / Dale. Seguí.
4. **Agenda (Google Calendar readonly)** — New installable miniapp `agenda`. GIS token with `calendar.readonly`, lists next ~3 days via `/api/companion/calendar`. Nimbo can `open_miniapp` → agenda.

## New / noted Vercel env vars

Already in use (no change required for login):

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (GIS web client for mochiagents.vercel.app)
- `COMPANION_SESSION_SECRET`
- `OPENAI_API_KEY`
- `TRELLO_*`

**Calendar MVP needs no new secret.** Same public GIS client. Ops checklist in GCP project `mochi-507219`:

1. Enable **Google Calendar API**
2. OAuth consent screen: add scope `https://www.googleapis.com/auth/calendar.readonly`
3. Keep authorized JS origins: `https://mochiagents.vercel.app` and `http://localhost:3000`

Optional (documented in `nextjs/.env.example`, not required):

- `NEXT_PUBLIC_GOOGLE_CALENDAR_SCOPE` (override readonly scope string)

Do **not** commit client secrets. Token client MVP does not need `GOOGLE_CLIENT_SECRET`.

## Monk test checklist (live PWA)

### Desktop
1. Open https://mochiagents.vercel.app/companion — Google login as Luciano (`lucianoolivabianco@gmail.com`).
2. Click **Lulox** (own pet) → help chat: short ninja vibe (miau / listo). Ask "agenda".
3. Click **Mochi** → human chat path (other person). Click **Nimbo** → ask "arrancá el tomate" / "qué hay" / "abrí agenda".
4. Dock → tienda: sumar **agenda**, open it, **conectar**, allow calendar, see upcoming events. Refrescar.

### Celu
1. Same login. Big **(+)** launcher: see "tus apps", casa tile, emoji apps, **+ agregá apps**.
2. Sumar agenda from tienda, open from launcher, conectar calendar.
3. Tomate: arrancar / wait or finish → win line. Notas: empty sparkle copy.

### Smoke voices
- Help (own pet) ≠ Nimbo ≠ generic bot.
- No inclusive language. Katho ella, Lulox él.

## Notes
- Grok Build CLI was not signed in on the box (`grok login --device-code` / `XAI_API_KEY` missing). Slice implemented with normal tooling on existing checkout.
- No contact with Katho. Deskbun / kathonejo untouched.
