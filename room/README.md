# Cuarto de Mochi (Durable Object + WebSocket)

El desk ya no pregunta cada 2 segundos a Vercel. Se conecta acá y se queda.

```bash
cd room
npx wrangler login
npx wrangler deploy
npx wrangler secret put COMPANION_SESSION_SECRET   # el mismo que en Vercel
```

Copiá la URL `wss://….workers.dev` a la env de Vercel:

- `COMPANION_ROOM_URL`

Después recargá https://mochiagents.vercel.app

Hibernar (dormir en RAM) no borra el cuarto. Igual hay un ping cada ~6 días
desde Cloudflare, no desde Vercel.
