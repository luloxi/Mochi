"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CompanionPair } from "@/components/companion/companion-pet";
import { CompanionLogin } from "@/components/companion/companion-login";
import { CompanionApps } from "@/components/companion/companion-apps";
import { DeskWindow, usePhone } from "@/components/companion/companion-window";
import {
  COMPANION_DUE_EVENT,
  addTodoItem,
  applyNimboClock,
  dueLine,
  loadPomo,
  nextMascotAlert,
  otherPerson,
  saveRaSnapshot,
  startCompanionRuntime,
  uid,
  type DueFire,
  type PrivateMsg,
} from "@/lib/companion/companion-core";
import { type CompanionAuthSession } from "@/lib/companion/auth";
import { CHAT_WINDOWS, localHelpReply, parseNimboIntent, roleForPetClick } from "@/lib/companion/chats";
import {
  RA_MISSING_LINE,
  archiveCardOnBoard,
  assignCardOnBoard,
  colorCardOnBoard,
  describeCardOnBoard,
  dueCardOnBoard,
  linkCardOnBoard,
  moveCardOnBoard,
  readTrelloTokenFromCallback,
  type RaBoard,
} from "@/lib/companion/trello";
import type { FeelColor } from "@/lib/companion/boards";
import {
  DEFAULT_TOGETHER_CHANCE,
  DEFAULT_TOGETHER_COOLDOWN_MS,
  leaveSignalText,
  nextTogetherTick,
  presenceDot,
  presenceHoverText,
  type PresenceStatus,
  type PresenceView,
} from "@/lib/companion/presence";
import { bubbleAboveHead } from "@/lib/companion/desk";
import { moveWindow, resizeWindow, type LiveWindow } from "@/lib/companion/windows";

type TalkMsg = { id: string; from: "me" | "them"; content: string };
type OpenChat = "human" | "nimbo" | "help" | null;

const EMPTY_BOARD: RaBoard = { id: "UjFhgg3n", name: "Ra", lists: [], cards: [], members: [], configured: false };
const TALK_SEED: LiveWindow = { id: "talk", x: 72, y: 56, w: 280, h: 360, z: 55 };

function PresenceFace({
  face,
  character,
  owner,
  pronoun,
  status,
}: {
  face: "katho" | "lulox";
  character: string;
  owner: string;
  pronoun: "ella" | "él";
  status: PresenceStatus;
}) {
  const [tip, setTip] = useState(false);
  const hold = useRef<number | null>(null);
  const text = presenceHoverText({ character, owner, pronoun, status });
  function clearHold() {
    if (hold.current != null) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }
  return (
    <span
      className="desk-face"
      data-face={face}
      data-presence={status}
      data-dot={presenceDot(status)}
      data-tip={text}
      aria-label={text}
      onPointerEnter={() => setTip(true)}
      onPointerLeave={() => {
        clearHold();
        setTip(false);
      }}
      onPointerDown={() => {
        clearHold();
        hold.current = window.setTimeout(() => setTip(true), 450);
      }}
      onPointerUp={clearHold}
      onPointerCancel={() => {
        clearHold();
        setTip(false);
      }}
    >
      {tip ? (
        <span className="desk-tip" data-presence-tip role="tooltip">
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function CompanionSurface() {
  const [auth, setAuth] = useState<CompanionAuthSession | null | undefined>(undefined);
  const seat = auth?.personId ?? null;
  const [openChat, setOpenChat] = useState<OpenChat>(null);
  const [draft, setDraft] = useState("");
  const [pairPresence, setPairPresence] = useState<{ katho: PresenceStatus; lulox: PresenceStatus }>({
    katho: "close",
    lulox: "close",
  });
  const [togetherView, setTogetherView] = useState<PresenceView>({
    pair: "both-away",
    mode: "separate",
    action: "separate",
    lastTogetherAt: null,
    left: "both",
  });
  const lastTogetherAt = useRef<number | null>(null);
  const [privateChat, setPrivateChat] = useState<PrivateMsg[]>([]);
  const [nimboLines, setNimboLines] = useState<string[]>([]);
  const [nimboLog, setNimboLog] = useState<TalkMsg[]>([]);
  const [helpLog, setHelpLog] = useState<TalkMsg[]>([]);
  const [board, setBoard] = useState<RaBoard>(EMPTY_BOARD);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [mascotAlert, setMascotAlert] = useState<string | null>(null);
  const [pomoOn, setPomoOn] = useState(false);
  const [phoneFoco, setPhoneFoco] = useState(false);
  const [talkPos, setTalkPos] = useState<LiveWindow>(TALK_SEED);
  const phone = usePhone();
  const seenDmRef = useRef<string | null>(null);

  useEffect(() => {
    startCompanionRuntime();
    setPomoOn(loadPomo().running);
    const onDue = (event: Event) => {
      const fire = (event as CustomEvent<DueFire>).detail;
      if (!fire?.kind) return;
      if (fire.kind === "pomodoro") setPomoOn(false);
      const line = dueLine(fire);
      setNimboLines((prev) => [...prev, line].slice(-12));
      setNimboLog((prev) => [...prev, { id: uid("due"), from: "them" as const, content: line }].slice(-20));
    };
    window.addEventListener(COMPANION_DUE_EVENT, onDue);
    return () => window.removeEventListener(COMPANION_DUE_EVENT, onDue);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/companion/auth/session", { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!cancelled) setAuth(json?.session ?? null);
      } catch {
        if (!cancelled) setAuth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/companion/sync", { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (cancelled || !json) return;
        if (Array.isArray(json.dms)) setPrivateChat(json.dms);
        if (json.presence) setPairPresence(json.presence);
      } catch {
        // keep last snapshot
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [auth]);

  const pullBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/companion/trello", { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!json) return;
      const next: RaBoard = {
        ...EMPTY_BOARD,
        ...(json.board || {}),
        configured: json.configured === true || json.board?.configured === true,
      };
      setBoard(next);
      setAuthorizeUrl(typeof json.authorizeUrl === "string" ? json.authorizeUrl : null);
      saveRaSnapshot(next.cards || []);
      if (!next.configured) {
        setNimboLines((prev) => (prev.length ? prev : [RA_MISSING_LINE]));
      }
    } catch {
      // keep last
    }
  }, []);

  const connectingRef = useRef(false);
  useEffect(() => {
    if (!auth) return;
    const token = readTrelloTokenFromCallback({
      hash: window.location.hash,
      search: window.location.search,
    });
    if (!token || connectingRef.current) return;
    connectingRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/companion/trello", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "connect", token }),
        });
        const json = await res.json().catch(() => null);
        if (json?.board) {
          const next: RaBoard = {
            ...EMPTY_BOARD,
            ...(json.board || {}),
            configured: json.configured === true || json.board?.configured === true,
          };
          setBoard(next);
          saveRaSnapshot(next.cards || []);
        } else {
          void pullBoard();
        }
        if (typeof json?.authorizeUrl === "string") setAuthorizeUrl(json.authorizeUrl);
        else setAuthorizeUrl(null);
      } finally {
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("token");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }
    })();
  }, [auth, pullBoard]);

  useEffect(() => {
    if (!auth) return;
    void pullBoard();
    const id = window.setInterval(() => void pullBoard(), 8000);
    return () => window.clearInterval(id);
  }, [auth, pullBoard]);

  useEffect(() => {
    if (!auth) return;
    const beat = (status: PresenceStatus) => {
      void fetch("/api/companion/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "presence", status }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json?.presence) setPairPresence(json.presence);
        })
        .catch(() => {});
    };
    beat("present");
    const id = window.setInterval(() => {
      beat(document.visibilityState === "visible" ? "present" : "idle-away");
    }, 8000);
    const onVis = () => beat(document.visibilityState === "visible" ? "present" : "idle-away");
    const onLeave = () => beat("close");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      beat("close");
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [auth]);

  useEffect(() => {
    const tick = () => {
      const view = nextTogetherTick({
        katho: pairPresence.katho,
        lulox: pairPresence.lulox,
        now: Date.now(),
        lastTogetherAt: lastTogetherAt.current,
        rng: Math.random,
        cooldownMs: DEFAULT_TOGETHER_COOLDOWN_MS,
        chance: DEFAULT_TOGETHER_CHANCE,
      });
      lastTogetherAt.current = view.lastTogetherAt;
      setTogetherView(view);
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [pairPresence]);

  useEffect(() => {
    const result = nextMascotAlert({
      messages: privateChat,
      seat,
      lastSeenId: seenDmRef.current,
    });
    if (result.kind === "alert") {
      setMascotAlert("te escribió");
      window.setTimeout(() => setMascotAlert(null), 4000);
    }
    if (privateChat.length) {
      seenDmRef.current = privateChat[privateChat.length - 1].id;
    }
  }, [privateChat, seat]);

  async function logout() {
    try {
      await fetch("/api/companion/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "presence", status: "logout" }),
      });
    } catch {
      // still leave
    }
    await fetch("/api/companion/auth/logout", { method: "POST", credentials: "include" });
    setAuth(null);
    setOpenChat(null);
    setPhoneFoco(false);
  }

  function sendDm(text: string) {
    if (!seat) return;
    void fetch("/api/companion/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "dm", content: text }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json?.dms)) setPrivateChat(json.dms);
      })
      .catch(() => {});
  }

  async function sendHelp(text: string) {
    if (!seat) return;
    const history = helpLog.map((row) => ({
      role: row.from === "me" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }));
    let reply = localHelpReply(text, seat);
    try {
      const res = await fetch("/api/companion/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, kind: "help" }),
      });
      const json = await res.json().catch(() => null);
      if (typeof json?.reply === "string" && json.reply.trim()) reply = json.reply.trim();
    } catch {
      // local line already set
    }
    setHelpLog((prev) =>
      [
        ...prev,
        { id: uid("me"), from: "me" as const, content: text },
        { id: uid("them"), from: "them" as const, content: reply },
      ].slice(-20),
    );
  }

  async function sendNimbo(text: string) {
    const intent = parseNimboIntent(text);
    if (intent.type === "pomodoro") {
      applyNimboClock(intent.action, intent.minutes);
      setPomoOn(intent.action === "start");
    }
    if (intent.type === "todo") addTodoItem(intent.text);
    const history = nimboLog.map((row) => ({
      role: row.from === "me" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }));
    try {
      const res = await fetch("/api/companion/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history }),
      });
      const json = await res.json().catch(() => null);
      const reply = typeof json?.reply === "string" && json.reply.trim() ? json.reply.trim() : "Dale.";
      if (json?.did === "need-trello" && intent.type === "add") addTodoItem(intent.title);
      setNimboLines((prev) => [...prev, reply].slice(-12));
      setNimboLog((prev) =>
        [
          ...prev,
          { id: uid("me"), from: "me" as const, content: text },
          { id: uid("them"), from: "them" as const, content: reply },
        ].slice(-20),
      );
      if (json?.board) {
        const next = { ...EMPTY_BOARD, ...json.board };
        setBoard(next);
        saveRaSnapshot(next.cards || []);
      } else void pullBoard();
    } catch {
      if (intent.type === "add") addTodoItem(intent.title);
      const reply = intent.type === "pomodoro" || intent.type === "todo" || intent.type === "add" ? "Dale." : "Después.";
      setNimboLines((prev) => [...prev, reply].slice(-12));
      setNimboLog((prev) =>
        [
          ...prev,
          { id: uid("me"), from: "me" as const, content: text },
          { id: uid("them"), from: "them" as const, content: reply },
        ].slice(-20),
      );
    }
  }

  function handleSend(kind: OpenChat) {
    const text = draft.trim();
    if (!text || !kind) return;
    setDraft("");
    if (kind === "nimbo") {
      void sendNimbo(text);
      return;
    }
    if (kind === "help") {
      void sendHelp(text);
      return;
    }
    if (!seat) return;
    sendDm(text);
  }

  const mochiBubble = bubbleAboveHead({ character: "mochi", dms: privateChat });
  const luloxBubble = bubbleAboveHead({ character: "lulox", dms: privateChat });
  const nimboBubble = bubbleAboveHead({ character: "nimbo", dms: privateChat, nimboLines });
  const leave = leaveSignalText(togetherView);
  const pairLog = privateChat.slice(-12);
  const other = seat ? otherPerson(seat) : null;
  const otherTint = other === "katho" ? CHAT_WINDOWS.mochi : CHAT_WINDOWS.lulox;
  const nimboTint = CHAT_WINDOWS.nimbo;

  function clickMochi() {
    if (!seat) return;
    setOpenChat(roleForPetClick(seat, "mochi"));
    setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }));
  }
  function clickLulox() {
    if (!seat) return;
    setOpenChat(roleForPetClick(seat, "lulox"));
    setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }));
  }
  function clickNimbo() {
    if (!seat) return;
    setOpenChat("nimbo");
    setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }));
  }
  function closeTalk() {
    setOpenChat(null);
  }

  const ownTint = seat === "katho" ? CHAT_WINDOWS.mochi : CHAT_WINDOWS.lulox;
  const deskMode = phoneFoco ? "foco" : "desk";

  useEffect(() => {
    if (phoneFoco && (openChat === "human" || openChat === "help")) {
      setOpenChat("nimbo");
    }
  }, [phoneFoco, openChat]);

  return (
    <div
      className="companion-root companion-desk"
      data-companion-surface
      data-companion-desk
      data-desk-mode={deskMode}
    >
      {auth ? (
        <div className="desk-faces" data-desk-faces>
          <PresenceFace
            face="katho"
            character="Mochi"
            owner="Katho"
            pronoun="ella"
            status={pairPresence.katho}
          />
          <PresenceFace
            face="lulox"
            character="Lulox"
            owner="Lulox"
            pronoun="él"
            status={pairPresence.lulox}
          />
        </div>
      ) : null}

      <CompanionPair
        view={togetherView}
        mochiWorking={false}
        luloxWorking={false}
        nimboWorking={openChat === "nimbo" || pomoOn}
        mochiAlert={seat === "lulox" ? mascotAlert : null}
        luloxAlert={seat === "katho" ? mascotAlert : null}
        mochiBubble={mochiBubble}
        luloxBubble={luloxBubble}
        nimboBubble={nimboBubble}
        onMochiClick={clickMochi}
        onLuloxClick={clickLulox}
        onNimboClick={clickNimbo}
        scale={0.6}
        showMochi={!phoneFoco}
        showLulox={!phoneFoco}
        showNimbo
      />

      {leave ? (
        <p className="leave-signal" data-leave-signal>
          {leave}
        </p>
      ) : null}

      {auth ? (
        <button type="button" className="companion-logout" onClick={() => void logout()}>
          Salir
        </button>
      ) : null}

      {auth ? (
        <CompanionApps
          board={board}
          seat={auth.personId}
          authorizeUrl={authorizeUrl}
          onRaAdd={(title, listId) => {
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "add", title, listId }),
            })
              .then((res) => res.json())
              .then((json) => {
                if (json?.did === "need-trello") addTodoItem(title);
                if (json?.board) {
                  const next = { ...EMPTY_BOARD, ...json.board };
                  setBoard(next);
                  saveRaSnapshot(next.cards || []);
                } else void pullBoard();
              })
              .catch(() => addTodoItem(title));
          }}
          onRaMove={(cardId, listId) => {
            setBoard((prev) => moveCardOnBoard(prev, cardId, listId));
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "move", cardId, listId }),
            })
              .then((res) => res.json())
              .then((json) => {
                if (json?.board) {
                  const next = { ...EMPTY_BOARD, ...json.board };
                  setBoard(next);
                  saveRaSnapshot(next.cards || []);
                }
              })
              .catch(() => void pullBoard());
          }}
          onRaDone={(cardId) => {
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "done", cardId }),
            })
              .then((res) => res.json())
              .then((json) => {
                if (json?.board) {
                  const next = { ...EMPTY_BOARD, ...json.board };
                  setBoard(next);
                  saveRaSnapshot(next.cards || []);
                } else void pullBoard();
              })
              .catch(() => void pullBoard());
          }}
          onRaColor={(cardId, color: FeelColor) => {
            setBoard((prev) => colorCardOnBoard(prev, cardId, color));
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "color", cardId, color }),
            }).catch(() => void pullBoard());
          }}
          onRaArchive={(cardId) => {
            setBoard((prev) => archiveCardOnBoard(prev, cardId));
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "archive", cardId }),
            })
              .then((res) => res.json())
              .then((json) => {
                if (json?.board) {
                  const next = { ...EMPTY_BOARD, ...json.board };
                  setBoard(next);
                  saveRaSnapshot(next.cards || []);
                }
              })
              .catch(() => void pullBoard());
          }}
          onRaHouse={(patch) => {
            setBoard((prev) => {
              if (patch.action === "desc") return describeCardOnBoard(prev, patch.cardId, patch.desc);
              if (patch.action === "due") return dueCardOnBoard(prev, patch.cardId, patch.due);
              if (patch.action === "assign") return assignCardOnBoard(prev, patch.cardId, patch.memberId);
              return linkCardOnBoard(prev, patch.cardId, {
                id: patch.url,
                name: patch.url,
                url: patch.url,
              });
            });
            const body =
              patch.action === "desc"
                ? { action: "desc", cardId: patch.cardId, desc: patch.desc }
                : patch.action === "due"
                  ? { action: "due", cardId: patch.cardId, due: patch.due }
                  : patch.action === "assign"
                    ? { action: "assign", cardId: patch.cardId, memberId: patch.memberId }
                    : { action: "link", cardId: patch.cardId, url: patch.url };
            void fetch("/api/companion/trello", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
              .then((res) => res.json())
              .then((json) => {
                if (json?.board) {
                  const next = { ...EMPTY_BOARD, ...json.board };
                  setBoard(next);
                  saveRaSnapshot(next.cards || []);
                }
              })
              .catch(() => void pullBoard());
          }}
          onFoco={setPhoneFoco}
        />
      ) : null}

      {auth === null ? <CompanionLogin onSession={setAuth} /> : null}

      {openChat === "human" && other && seat ? (
        <DeskWindow
          id="human"
          title={otherTint.label}
          phone={phone}
          pos={{ ...talkPos, id: "human" }}
          variant="talk"
          className={`tint-${otherTint.colorName}`}
          tint={otherTint.colorName}
          onClose={closeTalk}
          onFocus={() => setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }))}
          onMove={(x, y) => setTalkPos((prev) => moveWindow([prev], prev.id, x, y)[0] || { ...prev, x, y })}
          onResize={(next) => setTalkPos((prev) => resizeWindow([prev], prev.id, next)[0] || { ...prev, ...next })}
        >
          <div className="talk-body">
            <div className="talk-log">
              {pairLog.length === 0 ? (
                <p className="talk-empty">…</p>
              ) : (
                pairLog.map((row) => (
                  <p key={row.id} className={`talk-line from-${row.from === seat ? "me" : "them"}`}>
                    {row.content}
                  </p>
                ))
              )}
            </div>
            <form
              className="talk-composer"
              onSubmit={(event) => {
                event.preventDefault();
                handleSend("human");
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="…"
                aria-label={`Mensaje para ${otherTint.label}`}
                autoComplete="off"
              />
              <button type="submit" disabled={!draft.trim()}>
                ok
              </button>
            </form>
          </div>
        </DeskWindow>
      ) : null}

      {openChat === "nimbo" ? (
        <DeskWindow
          id="nimbo"
          title={nimboTint.label}
          phone={phone}
          pos={{ ...talkPos, id: "nimbo" }}
          variant="talk"
          className="tint-gold"
          tint="gold"
          onClose={closeTalk}
          onFocus={() => setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }))}
          onMove={(x, y) => setTalkPos((prev) => moveWindow([{ ...prev, id: "talk" }], "talk", x, y)[0] || { ...prev, x, y })}
          onResize={(next) =>
            setTalkPos((prev) => resizeWindow([{ ...prev, id: "talk" }], "talk", next)[0] || { ...prev, ...next })
          }
        >
          <div className="talk-body">
            <div className="talk-log">
              {nimboLog.length === 0 ? (
                <p className="talk-empty">{board.configured ? "Ra." : RA_MISSING_LINE}</p>
              ) : (
                nimboLog.map((row) => (
                  <p key={row.id} className={`talk-line from-${row.from}`}>
                    {row.content}
                  </p>
                ))
              )}
            </div>
            <form
              className="talk-composer"
              onSubmit={(event) => {
                event.preventDefault();
                handleSend("nimbo");
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="…"
                aria-label="Mensaje para Nimbo"
                autoComplete="off"
              />
              <button type="submit" disabled={!draft.trim()}>
                ok
              </button>
            </form>
          </div>
        </DeskWindow>
      ) : null}

      {openChat === "help" && seat ? (
        <DeskWindow
          id="help"
          title="ayuda"
          phone={phone}
          pos={{ ...talkPos, id: "help" }}
          variant="talk"
          className={`tint-${ownTint.colorName}`}
          tint={ownTint.colorName}
          onClose={closeTalk}
          onFocus={() => setTalkPos((prev) => ({ ...prev, z: prev.z + 1 }))}
          onMove={(x, y) => setTalkPos((prev) => ({ ...prev, x: Math.max(8, x), y: Math.max(8, y) }))}
          onResize={(next) => setTalkPos((prev) => ({ ...prev, ...next }))}
        >
          <div className="talk-body">
            <div className="talk-log">
              {helpLog.length === 0 ? (
                <p className="talk-empty">{localHelpReply("hola", seat)}</p>
              ) : (
                helpLog.map((row) => (
                  <p key={row.id} className={`talk-line from-${row.from}`}>
                    {row.content}
                  </p>
                ))
              )}
            </div>
            <form
              className="talk-composer"
              onSubmit={(event) => {
                event.preventDefault();
                handleSend("help");
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="…"
                aria-label="Pregunta de ayuda"
                autoComplete="off"
              />
              <button type="submit" disabled={!draft.trim()}>
                ok
              </button>
            </form>
          </div>
        </DeskWindow>
      ) : null}
    </div>
  );
}
