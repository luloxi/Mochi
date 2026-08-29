import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  COMPANION_SOUL,
  PEOPLE,
  PERSONAS,
  localMochiReply,
  nextMascotAlert,
  parseCompanionIntent,
} from "./companion-core";
import {
  COMPANION_GOOGLE_CLIENT_ID,
  KATHO_GOOGLE_EMAIL,
  LULOX_GOOGLE_EMAIL,
  acceptGoogleSignIn,
  createCompanionSession,
  googleClientId,
  persistSessionThroughReload,
  seatFromGoogleEmail,
} from "./auth";
import {
  CHAT_WINDOWS,
  appAgentCanDrive,
  chatWindowList,
  parseAppAgentIntent,
} from "./chats";
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
import {
  FEEL_COLOR_IDS,
  addBoard,
  addCard,
  addColumn,
  applyBoardAction,
  boardLegendLine,
  boardsMentionSuenos,
  sampleSuenosBoard,
} from "./boards";

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

describe("three chats + app agent intents", () => {
  it("ships three chat identities with pink / cyan / gold-gray", () => {
    const list = chatWindowList();
    assert.equal(list.length, 3);
    assert.equal(CHAT_WINDOWS.mochi.colorName, "pink");
    assert.equal(CHAT_WINDOWS.lulox.colorName, "cyan");
    assert.equal(CHAT_WINDOWS["app-agent"].colorName, "gold-gray");
    assert.match(CHAT_WINDOWS.mochi.hex, /#ff8fcf/i);
    assert.match(CHAT_WINDOWS.lulox.hex, /#7ad7ff/i);
    assert.match(CHAT_WINDOWS["app-agent"].hex, /#c9b37a/i);
  });

  it("App-agent intents can start pomodoro, play YouTube, and act on boards", () => {
    const pomo = parseAppAgentIntent("arrancá el pomodoro 25 min");
    assert.equal(pomo.type, "pomodoro");
    if (pomo.type === "pomodoro") assert.equal(pomo.action, "start");
    assert.equal(appAgentCanDrive(pomo), true);

    const yt = parseAppAgentIntent("poné https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(yt.type, "video");
    assert.equal(appAgentCanDrive(yt), true);

    const openBoard = parseAppAgentIntent("abrí el tablero");
    assert.equal(openBoard.type, "board");
    if (openBoard.type === "board") assert.equal(openBoard.action, "open");
    const col = parseAppAgentIntent("agregá una columna Esta semana");
    assert.equal(col.type, "board");
    if (col.type === "board") assert.equal(col.action, "add-column");
    const card = parseAppAgentIntent("nueva tarjeta coordinar Neuralink");
    assert.equal(card.type, "board");
    if (card.type === "board") {
      assert.equal(card.action, "add-card");
      assert.equal(card.color, "blue");
    }
    assert.equal(appAgentCanDrive(openBoard), true);
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

describe("boards + legend + Sueños + copy", () => {
  it("add board, add column, place a card; six feels and the legend phrases", () => {
    let boards = [] as ReturnType<typeof sampleSuenosBoard>[];
    boards = addBoard(boards, "Pasos de hoy").boards;
    boards = boards.map((b) => addColumn(b, "Clínica"));
    const clinic = boards[0].columns.find((c) => c.title === "Clínica");
    assert.ok(clinic);
    boards = boards.map((b) => addCard(b, clinic!.id, "Llamar", "orange"));
    assert.equal(boards[0].columns.at(-1)?.cards[0]?.color, "orange");
    const viaIntent = applyBoardAction(boards, { action: "add-card", title: "papel", color: "purple" });
    assert.ok(viaIntent[0].columns.some((c) => c.cards.some((card) => card.color === "purple")));
    const legend = boardLegendLine();
    assert.match(legend, /se pudre/);
    assert.match(legend, /hay que hacerlo/);
    assert.match(legend, /idea\/someday/);
    assert.match(legend, /parked/);
    assert.match(legend, /coordinar/);
    assert.match(legend, /trámite/);
    assert.deepEqual(FEEL_COLOR_IDS, ["red", "orange", "yellow", "green", "blue", "purple"]);
  });

  it("sample board mentions concrete Sueños work", () => {
    const sample = sampleSuenosBoard();
    assert.equal(boardsMentionSuenos([sample]), true);
    const blob = JSON.stringify(sample).toLowerCase();
    assert.match(blob, /pierna/);
    assert.match(blob, /neuralink/);
    assert.match(blob, /elon|spacex/);
  });

  it("Katho pronoun ella, Lulox él; soul/copy forbids inclusive Spanish", () => {
    assert.equal(PEOPLE.katho.pronoun, "ella");
    assert.equal(PEOPLE.lulox.pronoun, "él");
    assert.equal(PERSONAS.katho.pronoun, "ella");
    assert.equal(PERSONAS.lulox.pronoun, "él");
    const soul = `${COMPANION_SOUL}\n${PERSONAS.katho.soul}\n${PERSONAS.lulox.soul}\n${boardLegendLine()}`;
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
    const login = readFileSync(join(here, "../../components/companion/companion-login.tsx"), "utf8");
    assert.match(login, /accounts\.google\.com\/gsi\/client/);
    assert.match(login, /642702167525-avdsu91g38fhspaapmn9heiie72tpkh4\.apps\.googleusercontent\.com/);
  });
});
