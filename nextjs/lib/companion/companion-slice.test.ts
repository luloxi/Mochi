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
  RA_APPS,
  COMPANION_OPEN_APP,
  resolveMiniappId,
  startPomodoro,
  tickCompanionDue,
} from "./companion-core";
import { encodeRoomTicket, restoreRoomTicket } from "./room-ticket";
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
  launchTargetFor,
  localHelpReply,
  nimboCanDrive,
  parseAppAgentIntent,
  parseNimboIntent,
  roleForPetClick,
  toggleOpenChat,
} from "./chats";
import {
  BUBBLE_PLACEMENT,
  BUBBLE_PLACEMENT_BY_EDGE,
  DESK_CHARACTERS,
  bubbleAboveHead,
  firstPaintViolations,
  togglePetBubble,
} from "./desk";
import {
  companionSyncApi,
  createMemorySyncStore,
  handleCompanionSyncRequest,
  TYPING_FRESH_MS,
} from "./sync";
import {
  TOGETHER_ACTIONS,
  deskZones,
  leaveSignalText,
  nextTogetherTick,
  presenceDot,
  presenceHoverText,
  presenceStateLabel,
  statusFromHeartbeat,
  zonesAreApart,
} from "./presence";
import { FEEL_COLOR_IDS, FEEL_COLORS, boardLegendLine } from "./boards";
import {
  ARCHIVE_SHORTCUT,
  HOUSE_COLOR_LABELS,
  HOUSE_COLOR_ORDER,
  TOP_ARCHIVE_Y,
  assigneeLine,
  dragHitsArchive,
  formatHouseDue,
  parseHouseShortcut,
  personFromMemberName,
} from "./house";
import {
  NIMBO_NAME,
  NIMBO_SOUL,
  buildLlmRequest,
  extractLlmText,
  extractLlmToolCalls,
  isOnlyCannedRaGreeting,
  localNimboReply,
  pickLlmProvider,
} from "./llm";
import { NIMBO_TOOLS, executeNimboTool, nimboToolChoiceFor, runNimboTurn } from "./nimbo-agent";
import {
  RA_CONNECT_JARGON,
  RA_MISSING_LINE,
  applyRaIntent,
  assignCardOnBoard,
  checkItemOnBoard,
  colorCardOnBoard,
  describeCardOnBoard,
  dueCardOnBoard,
  emptyRaBoard,
  feelFromLabels,
  insertPos,
  linkCardOnBoard,
  mapRaCard,
  moveCardOnBoard,
  parseAddCardFromChat,
  parseRaIntent,
  readTrelloTokenFromCallback,
  sortedOpenCards,
  trelloAuthorizeUrl,
  trelloConfigured,
  wizardCopyText,
  type RaBoard,
} from "./trello";
import {
  NIMBO_SPRITE_BASE,
  PHYSICS,
  State,
  createMascot,
  endDrag,
  promoteDrag,
  spriteUrl,
  talkBalloonBoxStyle,
  throwKind,
  tickShimeji,
  keepOffChrome,
  DESK_CHROME_TOP,
  DESK_CHROME_SALIR,
} from "./shimeji-engine";
import { handleCompanionTrelloRequest } from "./trello-api";
import {
  WINDOW_Z_CAP,
  clickDockApp,
  maximizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  openWindow,
  resizeWindow,
  windowIsMinimized,
  windowIsOpen,
  windowIsVisible,
} from "./windows";

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres)\b/i;

describe("room ticket", () => {
  it("signs a short ticket the worker can trust", () => {
    const session = createCompanionSession("kathonejo@gmail.com");
    assert.ok(session);
    const ticket = encodeRoomTicket(session, 1_000, "unit-secret");
    const restored = restoreRoomTicket(ticket, "unit-secret", 1_000);
    assert.equal(restored?.personId, "katho");
    assert.equal(restoreRoomTicket(ticket, "other", 1_000), null);
    assert.equal(restoreRoomTicket(ticket, "unit-secret", 1_000 + 13 * 60 * 60 * 1000), null);
  });
});

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
    assert.equal(none.line, RA_MISSING_LINE);
    assert.doesNotMatch(none.line, /anoté/);
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
    assert.match(login, /initTokenClient/);
    assert.match(login, /requestAccessToken/);
    assert.match(login, /prompt:\s*"select_account"/);
    assert.doesNotMatch(login, /use_fedcm_for_prompt/);
    assert.doesNotMatch(login, /google\.accounts\.id\.prompt/);
    assert.match(css, /\.companion-login-card[\s\S]*z-index:\s*200/);
  });

  it("old poll URLs are dead static files; live desk uses the room socket", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const nextConfig = readFileSync(join(here, "../../next.config.mjs"), "utf8");
    assert.match(surface, /openCompanionRoom/);
    assert.doesNotMatch(surface, /\/api\/companion\/sync/);
    assert.doesNotMatch(surface, /\/api\/companion\/trello/);
    assert.match(surface, /\/api\/companion\/ra/);
    assert.match(nextConfig, /companion-gone\.json/);
    assert.match(nextConfig, /\/api\/companion\/sync/);
    assert.match(nextConfig, /s-maxage=31536000/);
    assert.ok(existsSync(join(here, "../../public/companion-gone.json")));
    assert.ok(!existsSync(join(here, "../../app/api/companion/sync/route.ts")));
    assert.ok(!existsSync(join(here, "../../app/api/companion/trello/route.ts")));
    const proxy = readFileSync(join(here, "../../proxy.ts"), "utf8");
    assert.match(proxy, /api\//);
    assert.match(proxy, /sprites\//);
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
  const deskWin = readFileSync(join(here, "../../components/companion/companion-window.tsx"), "utf8");
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
    const trelloRoute = readFileSync(join(here, "../../app/api/companion/ra/route.ts"), "utf8");
    const blob = `${trelloSrc}\n${authSrc}\n${trelloRoute}\n${surface}\n${apps}`;
    assert.doesNotMatch(blob, /TRELLO_TOKEN\s*=\s*["'][^"']+["']/);
    assert.doesNotMatch(blob, /<iframe[^>]+trello/i);
    assert.doesNotMatch(trelloSrc, /from ["']\.\/auth["']/);
    assert.doesNotMatch(trelloSrc, /node:crypto/);
    assert.doesNotMatch(apps, /trello-api/);
    assert.doesNotMatch(surface, /trello-api/);
    assert.match(surface, /data-desk-faces/);
    assert.match(surface, /data-ra-launcher|CompanionApps/);
    assert.match(`${surface}\n${deskWin}`, /data-talk-never-hide/);
    assert.match(apps, /data-app-dock/);
    assert.match(`${apps}\n${deskWin}`, /miniapp-full/);
    assert.match(`${apps}\n${deskWin}`, /miniapp-window/);
    assert.match(css, /\.miniapp-full[\s\S]*100dvh/);
    assert.match(css, /\.app-dock[\s\S]*bottom:/);
    assert.match(css, /\.app-dock[\s\S]*left:\s*50%/);
    assert.match(apps, /data-win-resize|DeskWindow/);
    assert.match(surface, /data-win-close|closeTalk/);
  });

  it("bubbles sit above mascot heads, not a giant form", () => {
    assert.equal(BUBBLE_PLACEMENT, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.floor, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.left, "beside-right");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.right, "beside-left");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.ceiling, "below-feet");
    assert.match(pet, /data-bubble-placement=\{bubblePlacementForEdge\(m.edge, box.top\)\}/);
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
    assert.match(`${surface}\n${deskWin}`, /talk-window/);
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
    assert.match(surface, /data-presence-tip|presenceHoverText/);
    assert.match(pet, /bias=\{null\}/);
    assert.match(pet, /bias=\{zones \?/);
    const hereSprites = join(dirname(fileURLToPath(import.meta.url)), "../../public/sprites");
    assert.equal(existsSync(join(hereSprites, "nimbo/stand-neutral.png")), true);
    assert.equal(existsSync(join(hereSprites, "mochi/stand-neutral.png")), true);
    assert.equal(existsSync(join(hereSprites, "lulox/stand-neutral.png")), true);
  });
});


describe("mini app store + maximize", () => {
  it("keeps tareas core and installs the rest", async () => {
    const { CORE_INSTALLED_APPS, installApp, uninstallApp, normalizeInstalledApps, isAppInstalled } = await import("./companion-core");
    assert.deepEqual(CORE_INSTALLED_APPS, ["boards"]);
    const base = normalizeInstalledApps([]);
    assert.deepEqual(base, ["boards"]);
    assert.equal(isAppInstalled(base, "boards"), true);
    const withPomo = installApp(base, "pomo");
    assert.equal(isAppInstalled(withPomo, "pomo"), true);
    assert.deepEqual(uninstallApp(withPomo, "boards"), withPomo); // cannot remove core
    assert.deepEqual(uninstallApp(withPomo, "pomo"), ["boards"]);
  });

  it("desktop maximize restores previous geometry", () => {
    let wins = openWindow([], "notas", { x: 40, y: 50, w: 280, h: 320 });
    wins = maximizeWindow(wins, "notas");
    assert.equal(wins[0].maximized, true);
    assert.deepEqual(wins[0].preMax, { x: 40, y: 50, w: 280, h: 320 });
    wins = toggleMaximizeWindow(wins, "notas");
    assert.equal(wins[0].maximized, false);
    assert.equal(wins[0].x, 40);
    assert.equal(wins[0].y, 50);
    assert.equal(wins[0].w, 280);
    assert.equal(wins[0].h, 320);
  });

  it("ships store + phone control center wiring", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const win = readFileSync(join(here, "../../components/companion/companion-window.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(apps, /data-app-store/);
    assert.match(apps, /data-store-install/);
    assert.match(apps, /data-phone-center/);
    assert.match(apps, /data-phone-control-center/);
    assert.match(apps, /loadInstalledApps/);
    assert.match(win, /data-win-max/);
    assert.match(win, /data-win-min/);
    assert.match(css, /\.phone-control-center/);
    assert.match(css, /\.miniapp-window\.is-maximized/);
  });
});

describe("dock launches apps, Nimbo click is chat", () => {
  it("clicking Nimbo/Ra is chat, not an app launch", () => {
    assert.equal(roleForPetClick("katho", "nimbo"), "nimbo");
    assert.equal(roleForPetClick("lulox", "nimbo"), "nimbo");
    assert.deepEqual(launchTargetFor("nimbo"), { kind: "chat", chat: "nimbo" });
    assert.deepEqual(launchTargetFor("ra-pet"), { kind: "chat", chat: "nimbo" });
    assert.deepEqual(launchTargetFor("dock", "pomo"), { kind: "app", app: "pomo" });
    const here = dirname(fileURLToPath(import.meta.url));
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    const clickNimbo = surface.slice(surface.indexOf("function clickNimbo"), surface.indexOf("function closeTalk"));
    assert.match(clickNimbo, /toggleOpenChat\(cur, "nimbo"\)/);
    assert.doesNotMatch(clickNimbo, /COMPANION_OPEN_RA|pick\(|setOrder|data-dock-app/);
    assert.match(apps, /data-app-dock/);
    assert.match(apps, /data-dock-app/);
    assert.doesNotMatch(apps, /className="ra-launcher"/);
    assert.doesNotMatch(surface, /data-ra-status/);
    assert.match(css, /\.app-dock[\s\S]*bottom:/);
    assert.match(css, /\.app-dock[\s\S]*left:\s*50%/);
  });
});

describe("windows close for real + resize", () => {
  it("close removes the window instead of hiding it behind", () => {
    let wins = openWindow([], "pomo");
    wins = openWindow(wins, "notas");
    assert.equal(windowIsOpen(wins, "pomo"), true);
    assert.equal(windowIsOpen(wins, "notas"), true);
    wins = closeWindow(wins, "pomo");
    assert.equal(windowIsOpen(wins, "pomo"), false);
    assert.equal(wins.some((win) => win.id === "pomo"), false);
    assert.equal(windowIsOpen(wins, "notas"), true);
    const sized = resizeWindow(wins, "notas", { w: 120, h: 80 });
    assert.ok(sized[0].w >= 200);
    assert.ok(sized[0].h >= 140);
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const win = readFileSync(join(here, "../../components/companion/companion-window.tsx"), "utf8");
    assert.match(apps, /closeWindow\(prev, id\)/);
    assert.match(win, /data-win-close/);
    assert.match(win, /data-win-resize/);
    assert.match(win, /stopPropagation/);
    assert.match(win, /onClose\(\)/);
  });

  it("dock click on an open pane minimizes it and keeps it mounted so media keeps playing", () => {
    const opened = clickDockApp([], "video");
    assert.equal(opened.action, "open");
    assert.equal(windowIsOpen(opened.windows, "video"), true);
    assert.equal(windowIsVisible(opened.windows, "video"), true);
    const minimized = clickDockApp(opened.windows, "video");
    assert.equal(minimized.action, "minimize");
    assert.equal(windowIsOpen(minimized.windows, "video"), true);
    assert.equal(windowIsMinimized(minimized.windows, "video"), true);
    assert.equal(windowIsVisible(minimized.windows, "video"), false);
    const restored = clickDockApp(minimized.windows, "video");
    assert.equal(restored.action, "restore");
    assert.equal(windowIsVisible(restored.windows, "video"), true);
    assert.ok(restored.windows[0].z <= WINDOW_Z_CAP);
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    assert.match(apps, /clickDockApp/);
    assert.match(apps, /minimized=\{minimized\}/);
    assert.match(css, /\.miniapp-window\.is-minimized[\s\S]*translate\(-200vw/);
    assert.match(css, /\.companion-overlay[\s\S]*z-index:\s*160/);
    assert.match(css, /\.app-dock[\s\S]*z-index:\s*80/);
    assert.equal(WINDOW_Z_CAP, 80);
    assert.ok(WINDOW_Z_CAP < 160);
    assert.equal(RA_APPS.find((app) => app.id === "boards")?.label, "tareas");
    assert.match(apps, /miniapp-kicker">tareas/);
    assert.doesNotMatch(surface, /showMochi=\{!phoneFoco\}/);
    assert.doesNotMatch(surface, /showLulox=\{!phoneFoco\}/);
  });
});

describe("tareas list order", () => {
  it("inserts cards between neighbors with Trello-style pos", () => {
    assert.equal(insertPos([], 0), 65535);
    assert.equal(insertPos([65535], 0), 65535 / 2);
    assert.equal(insertPos([65535], 1), 65535 + 65535);
    assert.equal(insertPos([100, 200], 1), 150);
    const board: RaBoard = {
      ...emptyRaBoard(),
      configured: true,
      lists: [{ id: "l1", name: "Hoy", pos: 1 }],
      cards: [
        mapRaCard({ id: "a", name: "uno", idList: "l1", pos: 100 }),
        mapRaCard({ id: "b", name: "dos", idList: "l1", pos: 200 }),
      ],
    };
    assert.deepEqual(
      sortedOpenCards(board, "l1").map((card) => card.id),
      ["a", "b"],
    );
    const moved = moveCardOnBoard(board, "b", "l1", 50);
    assert.equal(moved.cards.find((card) => card.id === "b")?.pos, 50);
  });
});

describe("presence hover copy", () => {
  it("dots only; hover names the character, who it belongs to, and the state", () => {
    assert.equal(presenceStateLabel("present"), "presente");
    assert.equal(presenceStateLabel("idle-away"), "idle");
    assert.equal(presenceStateLabel("logout"), "desconectado");
    assert.equal(presenceStateLabel("close"), "desconectado");
    assert.equal(
      presenceHoverText({ character: "Mochi", owner: "Katho", pronoun: "ella", status: "present" }),
      "Mochi, de Katho (ella). presente.",
    );
    assert.equal(
      presenceHoverText({ character: "Lulox", owner: "Lulox", pronoun: "él", status: "idle-away" }),
      "Lulox, de Lulox (él). idle.",
    );
    assert.equal(
      presenceHoverText({ character: "Mochi", owner: "Katho", pronoun: "ella", status: "close" }),
      "Mochi, de Katho (ella). desconectado.",
    );
    assert.equal(INCLUSIVE.test(presenceHoverText({ character: "Mochi", owner: "Katho", pronoun: "ella", status: "present" })), false);
    const here = dirname(fileURLToPath(import.meta.url));
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(surface, /presenceHoverText/);
    assert.match(surface, /data-presence-tip/);
    assert.match(surface, /owner="Katho"/);
    assert.match(surface, /owner="Lulox"/);
    assert.match(surface, /pronoun="ella"/);
    assert.match(surface, /pronoun="él"/);
    assert.doesNotMatch(surface, />K</);
    assert.doesNotMatch(surface, />L</);
    assert.match(css, /\.desk-face[\s\S]*font-size:\s*0/);
  });
});

describe("throw slow vs fast", () => {
  it("slow throw grabs a wall or ceiling and keeps walking; fast throw falls and bounces", () => {
    assert.equal(throwKind(2), "slow");
    assert.equal(throwKind(PHYSICS.throwFastSpeed), "fast");
    const bounds = { width: 400, height: 300 };
    const scale = 1;

    const slow = createMascot(bounds, scale);
    slow.x = 20;
    slow.y = 220;
    promoteDrag(slow);
    slow.smoothedVelocityX = 2;
    slow.smoothedVelocityY = 1;
    assert.equal(endDrag(slow, bounds, scale), "grab");
    assert.equal(slow.state, State.WALKING);
    assert.ok(slow.edge === "left" || slow.edge === "right" || slow.edge === "ceiling");
    assert.notEqual(slow.state, State.FALLING);

    const fast = createMascot(bounds, scale);
    fast.x = 80;
    fast.y = 230;
    promoteDrag(fast);
    fast.smoothedVelocityX = -22;
    fast.smoothedVelocityY = -6;
    assert.equal(endDrag(fast, bounds, scale), "throw");
    assert.equal(fast.state, State.FALLING);
    assert.equal(fast.throwMode, "bounce");
    const vy0 = fast.velocityY;
    const y0 = fast.y;
    tickShimeji(fast, bounds, scale, null, null);
    assert.ok(fast.velocityY > vy0, "gravity pulls down");
    for (let i = 0; i < 10; i++) tickShimeji(fast, bounds, scale, null, null);
    assert.ok(fast.velocityY > 0 || fast.y > y0, "they fall");
    fast.state = State.FALLING;
    fast.throwMode = "bounce";
    fast.y = 230;
    fast.x = 0;
    fast.velocityX = -16;
    tickShimeji(fast, bounds, scale, null, null);
    assert.ok(fast.velocityX > 0, "fast throw bounces off the wall");
    assert.equal(fast.state, State.FALLING);

    const hold = createMascot(bounds, scale);
    hold.state = State.FALLING;
    hold.throwMode = "bounce";
    hold.y = 160;
    promoteDrag(hold);
    assert.equal(hold.isDragging, true);
    assert.equal(hold.state, State.DRAGGED);
    tickShimeji(hold, bounds, scale, null, null);
    assert.equal(hold.isDragging, true);
    assert.equal(hold.state, State.DRAGGED);
  });
});

describe("house colors + archive shortcut + drag top", () => {
  it("Tano color order is azul, violeta, rojo, naranja, amarillo, verde; one color per card", () => {
    assert.deepEqual(HOUSE_COLOR_ORDER, ["blue", "purple", "red", "orange", "yellow", "green"]);
    assert.deepEqual(FEEL_COLOR_IDS, HOUSE_COLOR_ORDER);
    assert.deepEqual(HOUSE_COLOR_LABELS, ["azul", "violeta", "rojo", "naranja", "amarillo", "verde"]);
    assert.equal(FEEL_COLORS.blue.label, "azul");
    assert.equal(FEEL_COLORS.purple.label, "violeta");
    const mixed = feelFromLabels([
      { id: "r", name: "rojo", color: "red" },
      { id: "b", name: "azul", color: "blue" },
    ]);
    assert.equal(mixed, "blue");
    const board: RaBoard = {
      ...emptyRaBoard(),
      configured: true,
      lists: [{ id: "l1", name: "Hoy", pos: 1 }],
      cards: [
        mapRaCard({
          id: "c1",
          name: "pan",
          idList: "l1",
          labels: [
            { id: "r", name: "rojo", color: "red" },
            { id: "g", name: "verde", color: "green" },
          ],
        }),
      ],
    };
    const painted = colorCardOnBoard(board, "c1", "purple");
    assert.equal(painted.cards[0].feel, "purple");
    assert.equal(painted.cards[0].labels.length, 1);
    assert.equal(painted.cards[0].labels[0].color, "purple");
  });

  it("drag to the very top archives; desktop e archives and 1-6 paint Tano colors", () => {
    assert.equal(dragHitsArchive(10), true);
    assert.equal(dragHitsArchive(TOP_ARCHIVE_Y - 1), true);
    assert.equal(dragHitsArchive(TOP_ARCHIVE_Y), false);
    assert.equal(dragHitsArchive(200), false);
    assert.equal(ARCHIVE_SHORTCUT, "e");
    assert.equal(parseHouseShortcut({ key: "e" }).type, "archive");
    assert.equal(parseHouseShortcut({ key: "E" }).type, "archive");
    assert.deepEqual(parseHouseShortcut({ key: "1" }), { type: "color", color: "blue" });
    assert.deepEqual(parseHouseShortcut({ key: "2" }), { type: "color", color: "purple" });
    assert.deepEqual(parseHouseShortcut({ key: "3" }), { type: "color", color: "red" });
    assert.deepEqual(parseHouseShortcut({ key: "4" }), { type: "color", color: "orange" });
    assert.deepEqual(parseHouseShortcut({ key: "5" }), { type: "color", color: "yellow" });
    assert.deepEqual(parseHouseShortcut({ key: "6" }), { type: "color", color: "green" });
    assert.equal(parseHouseShortcut({ key: "e", target: { tagName: "INPUT" } }).type, "none");
    assert.equal(parseHouseShortcut({ key: "1", target: { tagName: "TEXTAREA" } }).type, "none");
    assert.equal(parseHouseShortcut({ key: "e", metaKey: true }).type, "none");
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    assert.match(apps, /parseHouseShortcut/);
    assert.match(apps, /dragHitsArchive/);
    assert.match(apps, /data-house-shortcut/);
    assert.match(apps, /data-ra-archive/);
    assert.match(apps, /HOUSE_COLOR_ORDER/);
    assert.doesNotMatch(apps, /trello\.com\/embed/i);
    assert.doesNotMatch(apps, /<iframe[^>]+trello/i);
  });
});

describe("house card details", () => {
  it("maps description, links, dates and responsable Katho/Lulox", () => {
    const card = mapRaCard({
      id: "c1",
      name: "turno",
      idList: "l1",
      desc: "llevar DNI",
      due: "2026-09-02T12:00:00.000Z",
      idMembers: ["m-katho"],
      members: [{ id: "m-katho", fullName: "Kathonejo", username: "kathonejo" }],
      attachments: [{ id: "a1", name: "nota", url: "https://example.com/nota" }],
    });
    assert.equal(card.desc, "llevar DNI");
    assert.equal(formatHouseDue(card.due), "2026-09-02");
    assert.equal(card.links[0].url, "https://example.com/nota");
    assert.equal(personFromMemberName("Kathonejo", "kathonejo"), "katho");
    assert.equal(personFromMemberName("Luciano Oliva", "luloxi"), "lulox");
    assert.equal(assigneeLine(card.members[0]), "Katho");
    let board: RaBoard = {
      ...emptyRaBoard(),
      configured: true,
      members: [
        { id: "m-katho", fullName: "Kathonejo", username: "kathonejo" },
        { id: "m-lulox", fullName: "Lulox", username: "luloxi" },
      ],
      cards: [card],
    };
    board = describeCardOnBoard(board, "c1", "otra cosa");
    board = dueCardOnBoard(board, "c1", "2026-09-10T12:00:00.000Z");
    board = assignCardOnBoard(board, "c1", "m-lulox");
    board = linkCardOnBoard(board, "c1", { id: "a2", name: "doc", url: "https://example.com/doc" });
    assert.equal(board.cards[0].desc, "otra cosa");
    assert.equal(formatHouseDue(board.cards[0].due), "2026-09-10");
    assert.equal(assigneeLine(board.cards[0].members[0]), "Lulox");
    assert.ok(board.cards[0].links.some((row) => row.url === "https://example.com/doc"));
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(apps, /data-ra-detail/);
    assert.match(apps, /aria-label="descripción"/);
    assert.match(apps, /aria-label="fecha"/);
    assert.match(apps, /aria-label="responsable"/);
    assert.match(apps, /aria-label="link"/);
    assert.match(apps, /parseHouseShortcut/);
    assert.match(apps, /createPortal\([\s\S]*<RaCardModal[\s\S]*document\.body/);
    assert.match(apps, /data-ra-card-modal/);
    assert.match(apps, /data-ra-detail-backdrop/);
    const afterBoardMini = apps.split(/className="board-mini" data-board-scroll/)[1] || "";
    const afterBoardFlow = afterBoardMini.replace(/createPortal\([\s\S]*?,\s*document\.body\s*\)/g, "");
    assert.doesNotMatch(afterBoardFlow, /data-ra-detail/);
    assert.doesNotMatch(afterBoardFlow, /ra-card-sheet/);
    assert.match(css, /\.ra-card-modal[\s\S]*position:\s*fixed/);
    assert.match(css, /\.ra-card-modal[\s\S]*inset:\s*0/);
    assert.match(css, /\.ra-card-backdrop[\s\S]*rgba\(/);
    assert.doesNotMatch(css, /\.ra-card-sheet[\s\S]{0,120}position:\s*absolute/);
    assert.doesNotMatch(css, /\.ra-card-sheet[\s\S]{0,120}inset:\s*8px/);
    assert.doesNotMatch(css, /\.ra-card-sheet[\s\S]{0,80}margin-top:\s*10px/);
    assert.match(apps, /data-tareas-pane/);
    assert.match(apps, /placeholder="tirá una…"/);
    assert.match(apps, /<form[\s\S]*placeholder="tirá una…"[\s\S]*<\/form>\s*<\/div>/);
    const checked = checkItemOnBoard(
      {
        ...emptyRaBoard(),
        cards: [
          mapRaCard({
            id: "c1",
            name: "turno",
            idList: "l1",
            checklists: [
              {
                id: "cl1",
                name: "pasos",
                checkItems: [{ id: "i1", name: "DNI", state: "incomplete", pos: 1 }],
              },
            ],
          }),
        ],
      },
      "c1",
      "i1",
      true,
    );
    assert.equal(checked.cards[0].checklists[0].items[0].complete, true);
  });

  it("tareas pane ends at the add-card row; detail is not a sheet under the lists", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const pane = apps.slice(apps.indexOf("function RaPane"), apps.indexOf("export function CompanionApps"));
    assert.match(pane, /data-tareas-pane/);
    assert.match(pane, /className="board-mini"/);
    assert.match(pane, /placeholder="tirá una…"/);
    assert.match(pane, /createPortal\([\s\S]*<RaCardModal[\s\S]*document\.body/);
    const afterBoard = pane.slice(pane.indexOf('className="board-mini"'));
    const flow = afterBoard.replace(/createPortal\([\s\S]*?,\s*document\.body\s*\)/g, "");
    assert.doesNotMatch(flow, /data-ra-detail/);
    assert.doesNotMatch(flow, /ra-card-sheet/);
    assert.ok(pane.indexOf('placeholder="tirá una…"') > pane.indexOf('className="board-mini"'));
    assert.match(pane, /placeholder="tirá una…"[\s\S]*<\/form>\s*<\/div>\s*\)\)\}/);
  });

  it("connected seat can color, archive, describe, date, assign and link", async () => {
    const lists = [
      { id: "l1", name: "Hacer", pos: 1 },
      { id: "l2", name: "Listo", pos: 2 },
    ];
    const members = [
      { id: "m-katho", fullName: "Kathonejo", username: "kathonejo" },
      { id: "m-lulox", fullName: "Lulox", username: "luloxi" },
    ];
    const cards: Array<Record<string, unknown>> = [
      {
        id: "c1",
        name: "pan",
        idList: "l1",
        closed: false,
        pos: 1,
        due: null,
        desc: "",
        idMembers: [],
        labels: [],
        members: [],
        attachments: [],
      },
    ];
    const labels: Array<{ id: string; name: string; color: string | null }> = [];
    const urls: string[] = [];
    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/members/me")) return new Response(JSON.stringify({ id: "me" }), { status: 200 });
      if (url.includes("/members?")) return new Response(JSON.stringify(members), { status: 200 });
      if (url.includes("/lists")) return new Response(JSON.stringify(lists), { status: 200 });
      if (url.includes("/labels") && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify(labels), { status: 200 });
      }
      if (url.includes("/labels") && init?.method === "POST") {
        const u = new URL(url);
        const row = { id: `lab-${labels.length + 1}`, name: u.searchParams.get("name") || "", color: u.searchParams.get("color") };
        labels.push(row);
        return new Response(JSON.stringify(row), { status: 200 });
      }
      if (url.includes("/attachments") && init?.method === "POST") {
        const u = new URL(url);
        const href = u.searchParams.get("url") || "";
        const card = cards[0] as { attachments: Array<{ id: string; name: string; url: string }> };
        card.attachments.push({ id: "a1", name: href, url: href });
        return new Response(JSON.stringify({ id: "a1", url: href, name: href }), { status: 200 });
      }
      if (url.includes("/cards?") && url.includes("filter=open") && (!init || !init.method || init.method === "GET")) {
        return new Response(JSON.stringify(cards), { status: 200 });
      }
      if (url.includes("/cards/") && init?.method === "PUT") {
        const id = url.split("/cards/")[1].split("?")[0].split("/")[0];
        const u = new URL(url);
        const card = cards.find((c) => c.id === id) as Record<string, unknown> | undefined;
        if (card && u.searchParams.get("idList")) card.idList = u.searchParams.get("idList");
        if (card && u.searchParams.get("closed") === "true") card.closed = true;
        if (card && u.searchParams.has("desc")) card.desc = u.searchParams.get("desc");
        if (card && u.searchParams.has("due")) card.due = u.searchParams.get("due") || null;
        if (card && u.searchParams.has("idMembers")) {
          const mid = u.searchParams.get("idMembers") || "";
          card.idMembers = mid ? [mid] : [];
          card.members = mid ? members.filter((m) => m.id === mid) : [];
        }
        if (card && u.searchParams.has("idLabels")) {
          const lid = u.searchParams.get("idLabels");
          const lab = labels.find((row) => row.id === lid);
          card.labels = lab ? [lab] : [];
        }
        return new Response(JSON.stringify(card || {}), { status: 200 });
      }
      return new Response("no", { status: 404 });
    }) as typeof fetch;

    const env = { TRELLO_API_KEY: "k", TRELLO_TOKEN: "ENV_SECRET" };
    const userToken = "e".repeat(64);
    const connected = withTrelloToken(createCompanionSession(KATHO_GOOGLE_EMAIL)!, userToken);
    const origin = "https://mochiagents.vercel.app";

    const colored = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "color", cardId: "c1", color: "azul" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(colored.body.did, "color");
    const board = colored.body.board as RaBoard;
    assert.equal(board.cards[0].feel, "blue");
    assert.equal(board.cards[0].labels.length, 1);

    const described = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "desc", cardId: "c1", desc: "comprar pan integral" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(described.body.did, "desc");
    assert.equal((described.body.board as RaBoard).cards[0].desc, "comprar pan integral");

    const dated = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "due", cardId: "c1", due: "2026-09-02T12:00:00.000Z" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(dated.body.did, "due");
    assert.equal(formatHouseDue((dated.body.board as RaBoard).cards[0].due), "2026-09-02");

    const assigned = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "assign", cardId: "c1", memberId: "m-lulox" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(assigned.body.did, "assign");
    assert.equal(assigneeLine((assigned.body.board as RaBoard).cards[0].members[0]), "Lulox");

    const linked = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "link", cardId: "c1", url: "https://example.com/pan" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(linked.body.did, "link");
    assert.ok((linked.body.board as RaBoard).cards[0].links.some((row) => row.url === "https://example.com/pan"));

    const archived = await handleCompanionTrelloRequest({
      session: connected,
      method: "POST",
      body: { action: "archive", cardId: "c1" },
      origin,
      env,
      fetchImpl,
    });
    assert.equal(archived.body.did, "archive");
    assert.ok(urls.every((url) => !url.includes("ENV_SECRET")));
    assert.ok(urls.some((url) => url.includes(`token=${userToken}`)));
  });
});

describe("chat sits above the pets and behaves", () => {
  it("talk window outranks the pet overlay on desktop and phone", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const pet = readFileSync(join(here, "../../components/companion/companion-pet.tsx"), "utf8");
    const overlay = /\.companion-overlay\s*\{[^}]*z-index:\s*(\d+)/.exec(css);
    const follow = /\.companion-overlay:has\(\.mascot-talk\)\s*\{[^}]*z-index:\s*(\d+)/.exec(css);
    assert.ok(overlay && follow);
    assert.ok(Number(follow![1]) > Number(overlay![1]));
    assert.match(pet, /talkBalloonBoxStyle/);
    assert.match(pet, /className="mascot-talk"/);
    assert.match(surface, /toggleOpenChat/);
    assert.equal(toggleOpenChat("nimbo", "nimbo"), null);
    assert.equal(toggleOpenChat(null, "nimbo"), "nimbo");
    const above = talkBalloonBoxStyle("above-head", { left: 100, top: 200, size: 80 }, { width: 390, height: 844 });
    assert.equal(above.transform, "none");
    assert.ok(above.top >= 8);
    assert.ok(above.left >= 8);
    const clipped = talkBalloonBoxStyle("beside-left", { left: 2, top: 80, size: 80 }, { width: 390, height: 844 });
    assert.ok(clipped.left >= 8, `balloon stayed on-screen, left=${clipped.left}`);
    assert.ok(clipped.left + clipped.width <= 390);
    const walker = createMascot({ width: 390, height: 844 }, 0.6);
    walker.x = 300;
    walker.y = 40;
    keepOffChrome(walker, { width: 390, height: 844 }, 0.6);
    assert.ok(walker.y - 128 * 0.6 >= DESK_CHROME_TOP - 1);
    assert.ok(walker.x + 128 * 0.6 <= 390 - 8 || walker.y - 128 * 0.6 >= DESK_CHROME_TOP);
    assert.ok(DESK_CHROME_SALIR >= 100);
  });

  it("composer autofocuses, log scrolls to the last line, and fills the window", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(surface, /data-talk-input/);
    assert.match(surface, /autoFocus/);
    assert.match(surface, /inputRef\.current\?\.focus/);
    assert.match(surface, /clickNimbo/);
    assert.match(surface, /clickLulox/);
    assert.match(surface, /log\.scrollTop = log\.scrollHeight/);
    assert.match(css, /\.talk-log\s*\{[^}]*flex:\s*1 1 auto/);
    assert.doesNotMatch(css, /\.talk-log\s*\{[^}]*max-height:\s*18vh/);
  });

  it("a fresh keystroke from the other seat is what lights the dots", () => {
    const store = createMemorySyncStore();
    const now = 1_000_000;
    const typed = handleCompanionSyncRequest({
      store,
      session: createCompanionSession(KATHO_GOOGLE_EMAIL, now)!,
      method: "POST",
      body: { type: "typing" },
      now,
    });
    assert.equal(typed.status, 200);
    assert.deepEqual((typed.body as { typing: unknown }).typing, { katho: true, lulox: false });
    const later = handleCompanionSyncRequest({
      store,
      session: createCompanionSession(LULOX_GOOGLE_EMAIL, now)!,
      method: "GET",
      now: now + TYPING_FRESH_MS + 1,
    });
    assert.deepEqual((later.body as { typing: unknown }).typing, { katho: false, lulox: false });
  });
});

const FLORES_PROMPT =
  "Hola amigo, vos podes agregar tarjetas al tablero? Agrega a Traer una tarjeta en naranja que diga Flores";

function fakeRaWorld() {
  const lists = [
    { id: "l-traer", name: "Traer", pos: 1 },
    { id: "l-hacer", name: "Hacer", pos: 2 },
  ];
  const cards: Array<Record<string, unknown>> = [];
  const labels: Array<{ id: string; name: string; color: string | null }> = [];
  const urls: string[] = [];
  const trelloFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/members")) return new Response(JSON.stringify([]), { status: 200 });
    if (url.includes("/lists")) return new Response(JSON.stringify(lists), { status: 200 });
    if (url.includes("/labels") && (!init || !init.method || init.method === "GET")) {
      return new Response(JSON.stringify(labels), { status: 200 });
    }
    if (url.includes("/labels") && init?.method === "POST") {
      const u = new URL(url);
      const row = {
        id: `lab-${labels.length + 1}`,
        name: u.searchParams.get("name") || "",
        color: u.searchParams.get("color"),
      };
      labels.push(row);
      return new Response(JSON.stringify(row), { status: 200 });
    }
    if (url.includes("/cards?") && url.includes("filter=open") && (!init || !init.method || init.method === "GET")) {
      return new Response(JSON.stringify(cards), { status: 200 });
    }
    if (url.includes("/cards?") && init?.method === "POST") {
      const name = new URL(url).searchParams.get("name") || "x";
      const idList = new URL(url).searchParams.get("idList") || "l-traer";
      const card = { id: `c${cards.length + 1}`, name, idList, closed: false, pos: cards.length, labels: [] as typeof labels };
      cards.push(card);
      return new Response(JSON.stringify(card), { status: 200 });
    }
    if (url.includes("/cards/") && init?.method === "PUT") {
      const id = url.split("/cards/")[1].split("?")[0].split("/")[0];
      const u = new URL(url);
      const card = cards.find((c) => c.id === id) as Record<string, unknown> | undefined;
      if (card && u.searchParams.has("idLabels")) {
        const lid = u.searchParams.get("idLabels");
        const lab = labels.find((row) => row.id === lid);
        card.labels = lab ? [lab] : [];
      }
      return new Response(JSON.stringify(card || {}), { status: 200 });
    }
    return new Response("no", { status: 404 });
  }) as typeof fetch;
  return { lists, cards, labels, urls, trelloFetch };
}

describe("nimbo tools + pet bubble toggle", () => {
  it("parses add-card-to-list with Tano color and ships add_ra_card tool", () => {
    const parsed = parseAddCardFromChat(FLORES_PROMPT);
    assert.ok(parsed);
    assert.match(parsed!.title, /Flores/i);
    assert.match(parsed!.listHint || "", /Traer/i);
    assert.match(parsed!.color || "", /naranja/i);
    const names = NIMBO_TOOLS.map((row) => row.function.name);
    assert.deepEqual(names, ["add_ra_card", "list_ra_board", "open_miniapp"]);
    assert.equal(nimboToolChoiceFor(FLORES_PROMPT), "required");
    const openai = pickLlmProvider({ OPENAI_API_KEY: "sk-test" });
    assert.equal(openai.model, "gpt-4o-mini");
    const req = buildLlmRequest({
      pick: openai,
      messages: [{ role: "user", content: FLORES_PROMPT }],
      tools: NIMBO_TOOLS,
      toolChoice: nimboToolChoiceFor(FLORES_PROMPT),
    });
    assert.ok(req);
    assert.equal(req!.body.tool_choice, "required");
    assert.ok(Array.isArray(req!.body.tools));
    const calls = extractLlmToolCalls({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "add_ra_card",
                  arguments: JSON.stringify({ title: "Flores", list: "Traer", color: "naranja" }),
                },
              },
            ],
          },
        },
      ],
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "add_ra_card");
    assert.equal(calls[0].arguments.title, "Flores");
    assert.equal(calls[0].arguments.list, "Traer");
    assert.equal(calls[0].arguments.color, "naranja");
    assert.equal(resolveMiniappId("tomate"), "pomo");
    assert.equal(resolveMiniappId("tareas"), "boards");
    assert.equal(resolveMiniappId("ruido"), "radio");
  });

  it("Nimbo tool-call adds Flores to Traer in naranja and does not answer only Ra está acá", async () => {
    const world = fakeRaWorld();
    const env = { TRELLO_API_KEY: "k", OPENAI_API_KEY: "sk-test" };
    const seat = { token: "user-seat-token", env };
    let llmRounds = 0;
    const llmFetch: typeof fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      llmRounds += 1;
      const body = JSON.parse(String(init?.body || "{}")) as { messages?: Array<{ role?: string }> };
      const hasTool = (body.messages || []).some((row) => row.role === "tool");
      if (!hasTool) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_add",
                      type: "function",
                      function: {
                        name: "add_ra_card",
                        arguments: JSON.stringify({ title: "Flores", list: "Traer", color: "naranja" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Listo. Flores en Traer, naranja." } }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const executed = await executeNimboTool(
      { id: "call_add", name: "add_ra_card", arguments: { title: "Flores", list: "Traer", color: "naranja" } },
      seat,
      world.trelloFetch,
    );
    assert.match(executed.line, /Flores/);
    assert.match(executed.line, /Traer/);
    assert.match(executed.line, /naranja/);
    assert.equal(executed.board?.cards[0]?.name, "Flores");
    assert.equal(executed.board?.cards[0]?.idList, "l-traer");
    assert.equal(executed.board?.cards[0]?.feel, "orange");

    const world2 = fakeRaWorld();
    const turn = await runNimboTurn({
      text: FLORES_PROMPT,
      seat,
      env,
      fetchImpl: world2.trelloFetch,
      llmFetch,
    });
    assert.ok(turn.usedTools.includes("add_ra_card"));
    assert.equal(turn.did, "add");
    assert.ok(llmRounds >= 1);
    assert.equal(isOnlyCannedRaGreeting(turn.reply), false);
    assert.notEqual(turn.reply.trim(), "Hola. Ra está acá.");
    assert.match(turn.reply, /Flores|Traer|naranja|Anoté/i);
    assert.equal(turn.board.cards.some((c) => c.name === "Flores" && c.idList === "l-traer"), true);
    assert.equal(turn.board.cards.find((c) => c.name === "Flores")?.feel, "orange");
    assert.equal(localNimboReply(FLORES_PROMPT, "Hacer: pan").trim() === "Hola. Ra está acá.", false);
  });

  it("if the model only greets, Nimbo still adds the card instead of Ra está acá", async () => {
    const world = fakeRaWorld();
    const env = { TRELLO_API_KEY: "k", OPENAI_API_KEY: "sk-test" };
    const seat = { token: "user-seat-token", env };
    const llmFetch: typeof fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "Hola. Ra está acá." } }] }), {
        status: 200,
      })) as typeof fetch;
    const turn = await runNimboTurn({
      text: FLORES_PROMPT,
      seat,
      env,
      fetchImpl: world.trelloFetch,
      llmFetch,
    });
    assert.ok(turn.usedTools.includes("add_ra_card"));
    assert.equal(isOnlyCannedRaGreeting(turn.reply), false);
    assert.notEqual(turn.reply.trim(), "Hola. Ra está acá.");
    assert.match(turn.reply, /Flores/);
    assert.equal(turn.board.cards[0]?.feel, "orange");
  });

  it("house TRELLO_TOKEN still adds Flores when the cookie has no seat token", async () => {
    const world = fakeRaWorld();
    const env = { TRELLO_API_KEY: "k", TRELLO_TOKEN: "ENV_SECRET", OPENAI_API_KEY: "sk-test" };
    const llmFetch: typeof fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "Hola. Ra está acá." } }] }), {
        status: 200,
      })) as typeof fetch;
    const turn = await runNimboTurn({
      text: FLORES_PROMPT,
      seat: { token: null, env },
      env,
      fetchImpl: world.trelloFetch,
      llmFetch,
    });
    assert.ok(turn.usedTools.includes("add_ra_card"));
    assert.equal(turn.did, "add");
    assert.match(turn.reply, /Flores/);
    assert.doesNotMatch(turn.reply, /anoté/);
    assert.equal(turn.board.cards.some((c) => /Flores/i.test(c.name)), true);
  });

  it("unconnected Ra says so instead of pretending", async () => {
    const turn = await runNimboTurn({
      text: FLORES_PROMPT,
      seat: { token: null, env: { TRELLO_API_KEY: "k" } },
      env: { TRELLO_API_KEY: "k" },
    });
    assert.match(turn.reply, /Ra no está/);
    assert.equal(turn.board.configured, false);
    assert.equal(turn.did, "need-trello");
  });

  it("open_miniapp maps tomate notas video ruido tareas", async () => {
    const tomate = await executeNimboTool({ id: "c1", name: "open_miniapp", arguments: { id: "tomate" } }, {}, fetch);
    assert.equal(tomate.openApp, "pomo");
    const tareas = await executeNimboTool({ id: "c2", name: "open_miniapp", arguments: { id: "tareas" } }, {}, fetch);
    assert.equal(tareas.openApp, "boards");
    const ruido = await executeNimboTool({ id: "c3", name: "open_miniapp", arguments: { id: "ruido" } }, {}, fetch);
    assert.equal(ruido.openApp, "radio");
    const notas = await executeNimboTool({ id: "c4", name: "open_miniapp", arguments: { id: "notas" } }, {}, fetch);
    assert.equal(notas.openApp, "notas");
    const video = await executeNimboTool({ id: "c5", name: "open_miniapp", arguments: { id: "video" } }, {}, fetch);
    assert.equal(video.openApp, "video");
  });

  it("pet click toggles the bubble; placement stays horizontal and near the pet", () => {
    assert.equal(togglePetBubble(true), false);
    assert.equal(togglePetBubble(false), true);
    const here = dirname(fileURLToPath(import.meta.url));
    const pet = readFileSync(join(here, "../../components/companion/companion-pet.tsx"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const surface = readFileSync(join(here, "../../components/companion/companion-surface.tsx"), "utf8");
    const agentRoute = readFileSync(join(here, "../../app/api/companion/agent/route.ts"), "utf8");
    assert.match(pet, /setBubbleOpen/);
    assert.match(pet, /data-pet-globo/);
    assert.match(pet, /data-phone-tap-opens-chat/);
    assert.match(pet, /phone \? 28 : 5/);
    assert.match(pet, /onClick\?\.\(\)/);
    assert.match(pet, /className="mascot-talk"/);
    assert.match(pet, /talkBalloonBoxStyle/);
    assert.match(css, /\.mascot-bubble[\s\S]*pointer-events:\s*auto/);
    assert.match(css, /\.mascot-talk/);
    assert.match(pet, /data-bubble-open/);
    assert.match(pet, /bubble && bubbleOpen && !talk/);
    assert.match(pet, /data-bubble-placement=\{bubblePlacementForEdge\(m.edge, box.top/);
    assert.match(css, /writing-mode:\s*horizontal-tb/);
    assert.match(css, /width:\s*max-content/);
    assert.match(css, /white-space:\s*nowrap/);
    assert.match(css, /bottom:\s*calc\(100%/);
    assert.match(css, /data-bubble-placement="beside-left"/);
    assert.match(css, /data-bubble-placement="beside-right"/);
    assert.match(css, /data-bubble-placement="below-feet"/);
    assert.match(css, /data-bubble-placement="above-head"/);
    assert.match(css, /\.companion-overlay[\s\S]*overflow:\s*visible/);
    assert.equal(COMPANION_OPEN_APP, "mochi-companion-open-app");
    assert.match(apps, /COMPANION_OPEN_APP/);
    assert.match(surface, /COMPANION_OPEN_APP/);
    assert.match(agentRoute, /runNimboTurn/);
    assert.equal(BUBBLE_PLACEMENT, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.floor, "above-head");
    assert.equal(BUBBLE_PLACEMENT_BY_EDGE.ceiling, "below-feet");
  });
});
