# Logan / Lulox READY slice

**Prod:** https://mochiagents.vercel.app/  
**Repo:** https://github.com/luloxi/Mochi (push only to luloxi)  
**SHA:** (see latest main after hotfix)  
**Base:** Monk FAIL hotfix on top of `d7b3bea` / `14f850c`

## Hotfix (Monk FAIL)

1. **Agenda in tienda** — `agenda` stays in `RA_APPS` (listed before comida). Taller store window + hint that Agenda is Google Calendar.
2. **Calendar ≠ Ra** — `guessOpenMiniapp` + Nimbo local reply open agenda for abrí agenda / calendario. Never fall through to "Ra no está." for calendar. `parseRaIntent` list ignores agenda words. Agenda pane shows conectar Google (calendar.readonly), not Ra/Trello.
3. **Nimbo opens the window** — After tools (or with no LLM), `runNimboTurn` sets `openApp: "agenda"` so the client dispatches `COMPANION_OPEN_APP` and launches the miniapp (auto-install like other opens).
4. **Launcher copy** — Phone sheet title / aria: "tus apps".

## Monk retest

### Desktop
1. Tienda: see **agenda** (with tomate/notas/video/ruido/tareas/comida). Sumar agenda.
2. Open agenda: see "Google Calendar (solo lectura)" + **conectar Google**. Not "Ra no está."
3. Nimbo: "abrí agenda" → reply about opening + agenda window opens.

### Celu
1. Launcher (+) title **tus apps** + "+ agregá apps".
2. Same agenda connect + Nimbo open.

## Notes
- No Katho contact. Deskbun untouched. No em dashes in UI copy.
