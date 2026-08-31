import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  COMPANION_SOUL,
  PEOPLE,
  PERSONAS,
  applyNimboClock,
  dueLine,
  emptyPomo,
  localMochiReply,
  nextMascotAlert,
  parseCompanionIntent,
  startPomodoro,
  tickCompanionDue,
} from "./companion-core";
import {
  COMPANION_GOOGLE_CLIENT_ID,
  KATHO_GOOGLE_EMAIL,
  LULOX_GOOGLE_EMAIL,
  acceptGoogleSignIn,
  createCompanionSession,
  googleClientId,
  persistSessionThroughReload,
  publicCompanionSession,
  seatFromGoogleEmail,
  withTrelloToken,
} from "./auth";
import {
  CHAT_WINDOWS,
  HELP_SOUL,
  appAgentCanDrive,
  chatWindowList,
  localHelpReply,
  nimboCanDrive,
  parseAppAgentIntent,
  parseNimboIntent,
  roleForPetClick,
} from "./chats";
import {
  BUBBLE_PLACEMENT,
  BUBBLE_PLACEMENT_BY_EDGE,
  DESK_CHARACTERS,
  bubbleAboveHead,
  firstPaintViolations,
} from "./desk";
import { leaveSignalText, presenceDot } from "./presence";
import {
  companionSyncApi,
  createMemorySyncStore,
  handleCompanionSyncRequest,
} from "./sync";
import {
  TOGETHER_ACTIONS,
  deskZones,
  nextTogetherTick,
  statusFromHeartbeat,
  zonesAreApart,
} from "./presence";
import { boardLegendLine } from "./boards";
import { NIMBO_NAME, NIMBO_SOUL, extractLlmText, localNimboReply, pickLlmProvider } from "./llm";
import {
  RA_CONNECT_JARGON,
  RA_MISSING_LINE,
  applyRaIntent,
  parseRaIntent,
  readTrelloTokenFromCallback,
  trelloAuthorizeUrl,
  trelloConfigured,
  wizardCopyText,
  type RaBoard,
} from "./trello";
import { NIMBO_SPRITE_BASE, spriteUrl } from "./shimeji-engine";
import { handleCompanionTrelloRequest } from "./trello-api";

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres)\b/i;

describe("google allowlist + session", () => {
  it("maps the two emails to Katho/Mochi and Lulox ninja-cat; a third is denied", () => {
    const katho = seatFromGoogleEmail(KATHO_GOOGLE_EMAIL);
    assert.equal(katho.ok, true);
    if (katho.ok) {
      assert.equal(katho.personId, "katho");
      assert.equal(katho.mascot, "mochi");
      assert.equal(katho.kind, "rabbit");
      assert.equal(katho.pronoun, "ella");
    }
    const lulox = seatFromGoogleEmail("  LucianoOlivaBianco@gmail.com ");
    assert.equal(lulox.ok, true);
    if (lulox.ok) {
      assert.equal(lulox.personId, "lulox");
      assert.equal(lulox.mascot, "lulox");
      assert.equal(lulox.kind, "ninja-cat");
      assert.equal(lulox.pronoun, "él");
    }
    const other = seatFromGoogleEmail("someone.else@gmail.com");
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.reason, "denied");
    const denied = acceptGoogleSignIn({ email: "random@gmail.com", email_verified: true });
    assert.equal(denied.ok, false);
  });

  it("session restore after a simulated reload still returns the same allowlisted seat", () => {
    const created = createCompanionSession(KATHO_GOOGLE_EMAIL);
    assert.ok(created);
    const { restored } = persistSessionThroughReload(created!);
    assert.ok(restored);
    assert.equal(restored!.email, KATHO_GOOGLE_EMAIL);
    assert.equal(restored!.personId, "katho");
    const lulox = createCompanionSession(LULOX_GOOGLE_EMAIL)!;
    const again = persistSessionThroughReload(lulox);
    assert.equal(again.restored?.personId, "lulox");
    assert.equal(again.restored?.kind, "ninja-cat");
  });

  it("per-seat house token stays on the cookie and never in the public session", () => {
    const token = "b".repeat(64);
    const created = withTrelloToken(createCompanionSession(KATHO_GOOGLE_EMAIL)!, token);
    const { restored } = persistSessionThroughReload(created);
    assert.equal(restored?.trelloToken, token);
    const pub = publicCompanionSession(restored!);
    assert.equal(pub.trelloConnected, true);
    assert.equal("trelloToken" in pub, false);
    assert.doesNotMatch(JSON.stringify(pub), new RegExp(token));
    const naked = persistSessionThroughReload(createCompanionSession(LULOX_GOOGLE_EMAIL)!);
    assert.equal(naked.restored?.trelloToken, undefined);
    assert.equal(publicCompanionSession(naked.restored!).trelloConnected, false);
  });

  it("unverified Google email is refused", () => {
    const result = acceptGoogleSignIn({ email: KATHO_GOOGLE_EMAIL, email_verified: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unverified");
  });

  it("ships a GIS web client id for the companion login", () => {
    assert.match(COMPANION_GOOGLE_CLIENT_ID, /\.apps\.googleusercontent\.com$/);
    assert.equal(googleClientId(), COMPANION_GOOGLE_CLIENT_ID);
  });
});

describe("three chats + nimbo Ra intents", () => {
  it("ships three character identities with pink / cyan / gold", () => {
    const list = chatWindowList();
    assert.equal(list.length, 3);
    assert.equal(CHAT_WINDOWS.mochi.colorName, "pink");
    assert.equal(CHAT_WINDOWS.lulox.colorName, "cyan");
    assert.equal(CHAT_WINDOWS.nimbo.colorName, "gold");
    assert.match(CHAT_WINDOWS.mochi.hex, /#ff8fcf/i);
    assert.match(CHAT_WINDOWS.lulox.hex, /#7ad7ff/i);
    assert.match(CHAT_WINDOWS.nimbo.hex, /#d4a017/i);
    assert.notEqual(CHAT_WINDOWS.nimbo.colorName, "pink");
    assert.notEqual(CHAT_WINDOWS.nimbo.colorName, "cyan");
    assert.equal(DESK_CHARACTERS.length, 3);
    assert.equal(DESK_CHARACTERS[0].id, "mochi");
    assert.equal(DESK_CHARACTERS[1].id, "lulox");
    assert.equal(DESK_CHARACTERS[2].id, "nimbo");
    assert.equal(DESK_CHARACTERS[2].name, NIMBO_NAME);
    assert.notEqual(NIMBO_NAME.toLowerCase(), "grok");
    assert.notEqual(NIMBO_NAME.toLowerCase(), "chano");
  });

  it("nimbo intents act on Ra", () => {
    const openBoard = parseNimboIntent("abrí el tablero");
    assert.equal(openBoard.type, "list");
    assert.equal(nimboCanDrive(openBoard), true);
    assert.equal(appAgentCanDrive(openBoard), true);
    const add = parseNimboIntent("agregá comprar pan");
    assert.equal(add.type, "add");
    if (add.type === "add") assert.match(add.title, /comprar pan/i);
    const done = parseRaIntent("listo comprar pan");
    assert.equal(done.type, "done");
    assert.equal(parseAppAgentIntent("qué hay en ra").type, "list");
  });

  it("nimbo also starts and stops the tomato", () => {
    const start = parseNimboIntent("arrancá el tomate");
    assert.equal(start.type, "pomodoro");
    if (start.type === "pomodoro") assert.equal(start.action, "start");
    const mins = parseNimboIntent("pomodoro 15 minutos");
    assert.equal(mins.type, "pomodoro");
    if (mins.type === "pomodoro") assert.equal(mins.minutes, 15);
    const stop = parseNimboIntent("pará el tomate");
    assert.equal(stop.type, "pomodoro");
    if (stop.type === "pomodoro") assert.equal(stop.action, "stop");
    const clock = applyNimboClock("start", 10, 1_000);
    assert.equal(clock.running, true);
    assert.equal(clock.duration, 600);
    assert.equal(applyNimboClock("stop").running, false);
  });
});

describe("two-device DM sync + mascot alert", () => {
  it("a DM written from one device is visible to the other after the real sync/load path", () => {
    const store = createMemorySyncStore();
    const kathoSession = createCompanionSession(KATHO_GOOGLE_EMAIL)!;
    const luloxSession = createCompanionSession(LULOX_GOOGLE_EMAIL)!;
    const deviceA = handleCompanionSyncRequest({
      store,
      session: luloxSession,
      method: "POST",
      body: { type: "dm", content: "Katho, te dejo un recado desde el otro celu" },
    });
    assert.equal(deviceA.status, 200);
    const deviceB = handleCompanionSyncRequest({
      store,
      session: kathoSession,
      method: "GET",
    });
    assert.equal(deviceB.status, 200);
    const dms = (deviceB.body as { dms: { from: string; content: string; id: string }[] }).dms;
    assert.equal(dms.length, 1);
    assert.equal(dms[0].from, "lulox");
    assert.match(dms[0].content, /otro celu/);
    const alert = nextMascotAlert({
      messages: companionSyncApi(store).loadDms(),
      seat: "katho",
      lastSeenId: null,
    });
    assert.equal(alert.kind, "alert");
    const quiet = nextMascotAlert({
      messages: companionSyncApi(store).loadDms(),
      seat: "katho",
      lastSeenId: dms[0].id,
    });
    assert.equal(quiet.kind, "none");
  });
});

describe("together / apart presence", () => {
  it("both-present can emit a together action and is not every tick", () => {
    const first = nextTogetherTick({
      katho: "present",
      lulox: "present",
      now: 1_000,
      lastTogetherAt: null,
      rng: () => 0,
      cooldownMs: 8_000,
      chance: 0.25,
    });
    assert.equal(first.mode, "together");
    assert.equal(first.pair, "both-present");
    assert.ok(TOGETHER_ACTIONS.includes(first.action as (typeof TOGETHER_ACTIONS)[number]));

    const duringCooldown = nextTogetherTick({
      katho: "present",
      lulox: "present",
      now: 1_000 + 200,
      lastTogetherAt: first.lastTogetherAt,
      rng: () => 0,
      cooldownMs: 8_000,
      chance: 1,
    });
    assert.equal(duringCooldown.mode, "together");
    assert.equal(duringCooldown.action, "idle");

    const noChance = nextTogetherTick({
      katho: "present",
      lulox: "present",
      now: 20_000,
      lastTogetherAt: null,
      rng: () => 0.99,
      chance: 0.2,
    });
    assert.equal(noChance.mode, "together");
    assert.equal(noChance.action, "idle");
  });

  it("one-away (logout, close, or idle-away) yields separate; return is together-capable", () => {
    for (const leave of ["logout", "close", "idle-away"] as const) {
      const away = nextTogetherTick({
        katho: "present",
        lulox: leave,
        now: 50_000,
        lastTogetherAt: 1_000,
        rng: () => 0,
      });
      assert.equal(away.mode, "separate");
      assert.equal(away.action, "separate");
      assert.equal(away.pair, "one-away");
      const zones = deskZones(away.mode, away.action, 1000);
      assert.equal(zonesAreApart(zones), true);
    }
    const stale = statusFromHeartbeat({ status: "present", at: 0 }, 40_000, 25_000);
    assert.equal(stale, "idle-away");
    const back = nextTogetherTick({
      katho: "present",
      lulox: "present",
      now: 80_000,
      lastTogetherAt: null,
      rng: () => 0,
      chance: 1,
    });
    assert.equal(back.mode, "together");
    assert.ok(TOGETHER_ACTIONS.includes(back.action as (typeof TOGETHER_ACTIONS)[number]));
  });
});

describe("copy + llm + trello", () => {
  it("Katho pronoun ella, Lulox él; soul/copy forbids inclusive Spanish", () => {
    assert.equal(PEOPLE.katho.pronoun, "ella");
    assert.equal(PEOPLE.lulox.pronoun, "él");
    assert.equal(PERSONAS.katho.pronoun, "ella");
    assert.equal(PERSONAS.lulox.pronoun, "él");
    const soul = `${COMPANION_SOUL}\n${PERSONAS.katho.soul}\n${PERSONAS.lulox.soul}\n${NIMBO_SOUL}\n${HELP_SOUL}\n${boardLegendLine()}`;
    assert.equal(INCLUSIVE.test(soul), false);
    assert.match(soul, /ella/);
    assert.match(soul, /él/);
    assert.match(soul, /los dos/);
    const reply = localMochiReply({
      intent: parseCompanionIntent("hola"),
      userText: "hola",
      seat: "katho",
      todos: [],
    });
    assert.equal(INCLUSIVE.test(reply), false);
    assert.equal(INCLUSIVE.test(localNimboReply("hola")), false);
    assert.equal(INCLUSIVE.test(localHelpReply("hola", "katho")), false);
    assert.equal(INCLUSIVE.test(HELP_SOUL), false);
  });

  it("OPENAI first, then xAI, else none — vibes still work", () => {
    assert.equal(pickLlmProvider({}).provider, "none");
    assert.equal(pickLlmProvider({ OPENAI_API_KEY: "sk-test" }).provider, "openai");
    assert.equal(pickLlmProvider({ OPENAI_API_KEY: "sk-test", XAI_API_KEY: "xai-test" }).provider, "openai");
    assert.equal(pickLlmProvider({ GROK_API_KEY: "xai-test" }).provider, "xai");
    assert.equal(pickLlmProvider({ XAI_API_KEY: "xai-test" }).provider, "xai");
    const openai = pickLlmProvider({ OPENAI_API_KEY: "sk-test" });
    assert.match(openai.url || "", /api\.openai\.com/);
    const xai = pickLlmProvider({ XAI_API_KEY: "xai-test" });
    assert.match(xai.url || "", /api\.x\.ai/);
    assert.doesNotMatch(xai.url || "", /grok\.com/);
    assert.equal(extractLlmText({ choices: [{ message: { content: " Dale. " } }] }), "Dale.");
    assert.equal(localNimboReply("hola"), "Hola. Ra no está.");
    assert.equal(localNimboReply("hola", "Hacer: pan"), "Hola. Ra está acá.");
    assert.equal(localNimboReply("arrancá el tomate", RA_MISSING_LINE), "Arranqué el tomate.");
  });

  it("Trello Ra add/move/done against a fake board", async () => {
    assert.equal(trelloConfigured({}), false);
    assert.equal(trelloConfigured(null, { TRELLO_API_KEY: "k", TRELLO_TOKEN: "ENV_SECRET" }), false);
    const none = await applyRaIntent({ type: "add", title: "pan" }, {});
    assert.equal(none.did, "need-trello");
    assert.equal(none.line, `${RA_MISSING_LINE} Te lo anoté en la lista.`);
    const missingChat = await applyRaIntent({ type: "chat" }, {});
    assert.equal(missingChat.line, RA_MISSING_LINE);

    const lists = [
      { id: "l1", name: "Hacer", pos: 1 },
      { id: "l2", name: "Listo", pos: 2 },
    ];
    const cards: Array<{ id: string; name: string; idList: string; closed: boolean; pos: number }> = [];
    const urls: string[] = [];
    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/lists")) {
        return new Response(JSON.stringify(lists), { status: 200 });
      }
      if (url.includes("/cards?") && url.includes("filter=open") && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify(cards), { status: 200 });
      }
      if (url.includes("/cards?") && init?.method === "POST") {
        const name = new URL(url).searchParams.get("name") || "x";
        const idList = new URL(url).searchParams.get("idList") || "l1";
        const card = { id: `c${cards.length + 1}`, name, idList, closed: false, pos: cards.length };
        cards.push(card);
        return new Response(JSON.stringify(card), { status: 200 });
      }
      if (url.includes("/cards/") && init?.method === "PUT") {
        const id = url.split("/cards/")[1].split("?")[0];
        const u = new URL(url);
        const card = cards.find((c) => c.id === id);
        if (card && u.searchParams.get("idList")) card.idList = u.searchParams.get("idList")!;
        if (card && u.searchParams.get("closed") === "true") card.closed = true;
        return new Response(JSON.stringify(card || {}), { status: 200 });
      }
      return new Response("no", { status: 404 });
    }) as typeof fetch;

    const seat = { token: "user-seat-token", env: { TRELLO_API_KEY: "k", TRELLO_TOKEN: "ENV_SECRET" } };
    const added = await applyRaIntent({ type: "add", title: "comprar pan" }, seat, fetchImpl);
    assert.equal(added.did, "add");
    assert.equal(added.board.configured, true);
    assert.ok(added.board.cards.some((c) => c.name === "comprar pan"));
    const moved = await applyRaIntent({ type: "move", title: "comprar pan", listHint: "Listo" }, seat, fetchImpl);
    assert.equal(moved.did, "move");
    const done = await applyRaIntent({ type: "done", title: "comprar pan" }, seat, fetchImpl);
    assert.equal(done.did, "done");
    const board: RaBoard = added.board;
    assert.equal(board.id, "UjFhgg3n");
    assert.ok(urls.every((url) => url.includes("token=user-seat-token")));
    assert.ok(urls.every((url) => !url.includes("ENV_SECRET")));
  });

  it("wizard copy is 3 pasos rioplatense, no jargon, ella/él/los dos", () => {
    const katho = wizardCopyText("katho");
    const lulox = wizardCopyText("lulox");
    assert.equal(RA_CONNECT_JARGON.test(katho), false);
    assert.equal(RA_CONNECT_JARGON.test(lulox), false);
    assert.equal(INCLUSIVE.test(katho), false);
    assert.equal(INCLUSIVE.test(lulox), false);
    assert.match(katho, /Esta es tu casa/);
    assert.match(katho, /conectar/);
    assert.match(katho, /Listo, ya está/);
    assert.match(katho, /ella/);
    assert.match(lulox, /él/);
    assert.match(katho, /los dos/);
    assert.match(lulox, /los dos/);
    assert.doesNotMatch(katho, /pega la clave/i);
    assert.doesNotMatch(lulox, /pega la clave/i);
  });

  it("authorize URL uses the public key and a fragment callback", () => {
    const url = trelloAuthorizeUrl({
      key: "publickey",
      returnUrl: "https://mochiagents.vercel.app/",
    });
    assert.match(url, /^https:\/\/trello\.com\/1\/authorize\?/);
    assert.match(url, /callback_method=fragment/);
    assert.match(url, /response_type=token/);
    assert.match(url, /return_url=/);
    assert.match(url, /key=publickey/);
    const back = readTrelloTokenFromCallback({ hash: `#token=${"c".repeat(64)}` });
    assert.equal(back, "c".repeat(64));
    assert.equal(readTrelloTokenFromCallback({ hash: "#nope" }), null);
  });

  it("unconnected seat cannot write even if env has Luciano's token; connected seat can add/move", async () => {
    const lists = [
      { id: "l1", name: "Hacer", pos: 1 },
      { id: "l2", name: "Listo", pos: 2 },
    ];
    const cards: Array<{
      id: string;
      name: string;
      idList: string;
      closed: boolean;
      pos: number;
      labels?: Array<{ id: string; name: string; color: string | null }>;
    }> = [];
    const urls: string[] = [];
    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/members/me")) {
        return new Response(JSON.stringify({ id: "me" }), { status: 200 });
      }
      if (url.includes("/lists")) return new Response(JSON.stringify(lists), { status: 200 });
      if (url.includes("/labels") && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/cards?") && url.includes("filter=open") && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify(cards), { status: 200 });
      }
      if (url.includes("/cards?") && init?.method === "POST") {
        const name = new URL(url).searchParams.get("name") || "x";
        const idList = new URL(url).searchParams.get("idList") || "l1";
        const card = { id: `c${cards.length + 1}`, name, idList, closed: false, pos: cards.length, labels: [] };
        cards.push(card);
        return new Response(JSON.stringify(card), { status: 200 });
      }
      if (url.includes("/cards/") && init?.method === "PUT") {
        const id = url.split("/cards/")[1].split("?")[0];
        const u = new URL(url);
        const card = cards.find((c) => c.id === id);
        if (card && u.searchParams.get("idList")) card.idList = u.searchParams.get("idList")!;
        return new Response(JSON.stringify(card || {}), { status: 200 });
      }
      return new Response("no", { status: 404 });
    }) as typeof fetch;

    const env = { TRELLO_API_KEY: "k", TRELLO_TOKEN: "ENV_SECRET" };
    const katho = createCompanionSession(KATHO_GOOGLE_EMAIL)!;
    const blocked = await handleCompanionTrelloRequest({
      session: katho,
      method: "POST",
      body: { action: "add", title: "pan" },
      origin: "https://mochiagents.vercel.app",
      env,
      fetchImpl,
    });
    assert.equal(blocked.body.did, "need-trello");
    assert.equal(blocked.body.configured, false);
    assert.equal(urls.length, 0);

    const userToken = "d".repeat(64);
    const connected = withTrelloToken(katho, userToken);
    const added = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "add", title: "pan" },
      origin: "https://mochiagents.vercel.app",
      env,
      fetchImpl,
    });
    assert.equal(added.body.did, "add");
    assert.equal(added.body.configured, true);
    const moved = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "move", cardId: "c1", listId: "l2" },
      origin: "https://mochiagents.vercel.app",
      env,
      fetchImpl,
    });
    assert.equal(moved.body.did, "move");
    assert.ok(urls.every((url) => !url.includes("ENV_SECRET")));
    assert.ok(urls.some((url) => url.includes(`token=${userToken}`)));
    assert.doesNotMatch(JSON.stringify(added.body), /trelloToken/);
    assert.doesNotMatch(JSON.stringify(added.body), new RegExp(userToken));
  });
});

describe("fullscreen companion surface", () => {
  it("layout marks the surface and CSS forbids document scroll", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const layout = readFileSync(join(here, "../../app/companion/layout.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(layout, /data-companion-surface/);
    assert.match(layout, /companion-root/);
    assert.match(css, /html:has\(\[data-companion-surface\]\)/);
    assert.match(css, /overflow:\s*hidden/);
    assert.match(css, /100dvh/);
    const home = readFileSync(join(here, "../../app/page.tsx"), "utf8");
    const companionPage = readFileSync(join(here, "../../app/companion/page.tsx"), "utf8");
    assert.match(home, /CompanionSurface/);
    assert.match(home, /data-companion-surface/);
    assert.match(companionPage, /redirect\(\"\/\"\)/);
    const login = readFileSync(join(here, "../../components/companion/companion-login.tsx"), "utf8");
    assert.match(login, /accounts\.google\.com\/gsi\/client/);
    assert.match(login, /253648842852-crcqh36v7bogroqae76f4mchit37nl4i\.apps\.googleusercontent\.com/);
    assert.match(login, /Authorized JavaScript origin https:\/\/mochiagents\.vercel\.app/);
  });
});

describe("in-browser due cron", () => {
  it("startCompanionRuntime is a tab setInterval, not a server worker", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const core = readFileSync(join(here, "companion-core.ts"), "utf8");
    assert.match(core, /export function startCompanionRuntime/);
    assert.match(core, /runtimeTicker = window\.setInterval/);
    assert.match(core, /tickCompanionDue/);
    assert.doesNotMatch(core, /new Worker/);
  });

  it("tickCompanionDue fires ended tomato and due Ra cards once", () => {
    const pomo = startPomodoro(emptyPomo(), 1, 1_000);
    const dueAt = new Date(5_000).toISOString();
    const first = tickCompanionDue({
      now: 61_000,
      pomo,
      raCards: [{ id: "c1", name: "pan", due: dueAt, dueComplete: false }],
      firedIds: [],
    });
    assert.equal(first.pomo.running, false);
    assert.equal(first.fires.length, 2);
    assert.ok(first.fires.some((fire) => fire.kind === "pomodoro"));
    assert.ok(first.fires.some((fire) => fire.kind === "ra" && fire.title === "pan"));
    assert.equal(dueLine({ kind: "pomodoro", id: "x", title: "tomate", at: 1 }), "Se acabó el tomate.");
    const again = tickCompanionDue({
      now: 62_000,
      pomo: first.pomo,
      raCards: [{ id: "c1", name: "pan", due: dueAt, dueComplete: false }],
      firedIds: first.firedIds,
    });
    assert.equal(again.fires.length, 0);
  });
});

describe("first paint desk + bubbles + in-app llm", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
  const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
  const login = readFileSync(join(here, "../../components/companion/companion-login.tsx"), "utf8");
  const pet = readFileSync(join(here, "../../components/companion/companion-pet.tsx"), "utf8");
  const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
  const grokRoute = readFileSync(join(here, "../../app/api/companion/grok/route.ts"), "utf8");
  const agentRoute = readFileSync(join(here, "../../app/api/companion/agent/route.ts"), "utf8");

  it("first-paint markup has no settings dump, no grok.com, no lecture", () => {
    const paint = `${surface}\n${css}\n${login}`;
    assert.deepEqual(firstPaintViolations(paint), []);
    assert.doesNotMatch(paint, /console\.x\.ai/);
    assert.doesNotMatch(paint, /grok\.com/);
    assert.doesNotMatch(paint, /Chano/);
    assert.doesNotMatch(surface, /placeholder=["']xai/);
    assert.doesNotMatch(surface, /Pomodoro|YouTube|Radio|Miniapps/);
    assert.doesNotMatch(login, /Entrá con Google\. Así sabemos/);
    assert.match(surface, /data-companion-desk/);
    assert.match(css, /--c-ink:\s*#140c18/);
    assert.match(surface, /startCompanionRuntime/);
    assert.match(surface, /RA_MISSING_LINE/);
    assert.match(surface, /nimboWorking/);
    assert.doesNotMatch(surface, /<iframe/i);
    assert.doesNotMatch(surface, /trello\.com\/b/);
    assert.doesNotMatch(surface, /data-ra-board/);
    assert.doesNotMatch(apps, /trello\.com\/b/);
    assert.doesNotMatch(apps, /trello\.com\/embed/i);
    assert.doesNotMatch(apps, /<iframe[^>]+trello/i);
    assert.match(apps, /data-ra-wizard/);
    assert.match(apps, /data-ra-connect/);
    assert.match(apps, /data-ra-card/);
    assert.match(apps, /data-ra-archive/);
    assert.match(apps, /onPointerDown/);
    assert.match(surface, /readTrelloTokenFromCallback/);
    assert.match(surface, /replaceState/);
    assert.match(surface, /action: "connect"/);
    assert.match(surface, /action: "move"/);
    assert.doesNotMatch(`${surface}\n${apps}`, /pega la clave/i);
    const trelloSrc = readFileSync(join(here, "trello.ts"), "utf8");
    const authSrc = readFileSync(join(here, "auth.ts"), "utf8");
    const trelloRoute = readFileSync(join(here, "../../app/api/companion/trello/route.ts"), "utf8");
    const blob = `${trelloSrc}\n${authSrc}\n${trelloRoute}\n${surface}\n${apps}`;
    assert.doesNotMatch(blob, /TRELLO_TOKEN\s*=\s*["'][^"']+["']/);
    assert.doesNotMatch(blob, /<iframe[^>]+trello/i);
    assert.doesNotMatch(trelloSrc, /from ["']\.\/auth["']/);
    assert.doesNotMatch(trelloSrc, /node:crypto/);
    assert.doesNotMatch(apps, /trello-api/);
    assert.doesNotMatch(surface, /trello-api/);
    assert.match(surface, /data-desk-faces/);
    assert.match(surface, /data-ra-launcher|CompanionApps/);
    assert.match(surface, /data-talk-never-hide/);
    assert.match(apps, /data-ra-launcher/);
    assert.match(apps, /miniapp-full/);
    assert.match(apps, /miniapp-window/);
    assert.match(css, /\.miniapp-full[\s\S]*100dvh/);
  });

  it("bubbles sit above mascot heads, not a giant form", () => {
    assert.equal(BUBBLE_PLACEMENT, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.floor, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.left, "beside-right");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.right, "beside-left");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.ceiling, "below-feet");
    assert.match(pet, /data-bubble-placement=\{bubblePlacementForEdge\(m\.edge\)\}/);
    assert.match(pet, /spriteOrientTransform\(m\.edge\)/);
    assert.match(pet, /mascotDrawTransform\(\)/);
    assert.match(pet, /data-no-flip="true"/);
    assert.match(pet, /className="mascot-bubble"/);
    assert.match(css, /\.mascot-bubble/);
    assert.match(css, /width:\s*max-content/);
    assert.match(css, /white-space:\s*nowrap/);
    assert.match(css, /writing-mode:\s*horizontal-tb/);
    assert.match(css, /bottom:\s*calc\(100%/);
    assert.match(css, /\.companion-mascot[\s\S]*overflow:\s*visible/);
    assert.match(surface, /talk-window/);
    assert.doesNotMatch(surface, /companion-composer/);
    const incoming = {
      id: "dm-1",
      from: "lulox" as const,
      content: "Katho, te dejo un recado desde el otro celu",
      createdAt: "2026-08-30T00:00:00.000Z",
    };
    const bubbled = bubbleAboveHead({ character: "lulox", dms: [incoming] });
    assert.match(bubbled, /otro celu/);
    assert.match(bubbled, /Katho, te dejo un recado/);
    assert.equal(bubbleAboveHead({ character: "mochi", dms: [] }), "hola");
    assert.equal(bubbleAboveHead({ character: "nimbo", dms: [], nimboLines: ["dale"] }), "dale");
  });

  it("LLM is in-app and never opens grok.com as the chat", () => {
    assert.match(agentRoute, /completeLlmChat|pickLlmProvider/);
    assert.doesNotMatch(agentRoute, /grok\.com/);
    assert.doesNotMatch(surface, /grok\.com/);
    assert.doesNotMatch(surface, /buildGrokConnectUrl/);
    assert.match(grokRoute, /GONE|\/api\/companion\/agent/);
    assert.match(spriteUrl("stand-neutral", "nimbo"), new RegExp(NIMBO_SPRITE_BASE.replace(/\//g, "\\/")));
  });

  it("one-away leave signal is visible and short; click other pet is human chat", () => {
    const away = leaveSignalText({
      pair: "one-away",
      mode: "separate",
      action: "separate",
      lastTogetherAt: null,
      left: "lulox",
    });
    assert.equal(away, "Lulox se fue");
    const kathoLeft = leaveSignalText({
      pair: "one-away",
      mode: "separate",
      action: "separate",
      lastTogetherAt: null,
      left: "katho",
    });
    assert.equal(kathoLeft, "Katho se fue");
    assert.equal(
      leaveSignalText({
        pair: "both-present",
        mode: "together",
        action: "kiss",
        lastTogetherAt: 1,
      }),
      null,
    );
    assert.match(surface, /data-leave-signal/);
    assert.match(pet, /onNimboClick/);
    assert.match(pet, /pack="nimbo"/);
    assert.match(surface, /clickLulox|roleForPetClick\(seat, "lulox"\)/);
    assert.match(surface, /clickMochi|roleForPetClick\(seat, "mochi"\)/);
    assert.equal(roleForPetClick("lulox", "mochi"), "human");
    assert.equal(roleForPetClick("lulox", "lulox"), "help");
    assert.equal(roleForPetClick("lulox", "nimbo"), "nimbo");
    assert.equal(roleForPetClick("katho", "lulox"), "human");
    assert.equal(roleForPetClick("katho", "mochi"), "help");
    assert.equal(roleForPetClick("katho", "nimbo"), "nimbo");
    assert.match(localHelpReply("hola", "lulox"), /Lulox|ayuda|Nimbo/i);
    assert.match(localHelpReply("hola", "katho"), /Mochi|ayuda|Nimbo/i);
    assert.equal(presenceDot("present"), "green");
    assert.equal(presenceDot("idle-away"), "yellow");
    assert.equal(presenceDot("logout"), "red");
    assert.equal(presenceDot("close"), "red");
    assert.match(pet, /bias=\{null\}/);
    assert.match(pet, /bias=\{zones \?/);
    const hereSprites = join(dirname(fileURLToPath(import.meta.url)), "../../public/sprites");
    assert.equal(existsSync(join(hereSprites, "nimbo/stand-neutral.png")), true);
    assert.equal(existsSync(join(hereSprites, "mochi/stand-neutral.png")), true);
    assert.equal(existsSync(join(hereSprites, "lulox/stand-neutral.png")), true);
  });
});
