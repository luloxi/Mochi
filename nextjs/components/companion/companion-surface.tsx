"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CompanionPair } from "@/components/companion/companion-pet";
import { CompanionLogin } from "@/components/companion/companion-login";
import { nextMascotAlert, otherPerson, uid, type PrivateMsg } from "@/lib/companion/companion-core";
import { type CompanionAuthSession } from "@/lib/companion/auth";
import { CHAT_WINDOWS } from "@/lib/companion/chats";
import {
  DEFAULT_TOGETHER_CHANCE,
  DEFAULT_TOGETHER_COOLDOWN_MS,
  leaveSignalText,
  nextTogetherTick,
  type PresenceStatus,
  type PresenceView,
} from "@/lib/companion/presence";
import { bubbleAboveHead } from "@/lib/companion/desk";
import { cardsInList, type RaBoard, type RaCard, type RaList } from "@/lib/companion/trello";

type TalkMsg = { id: string; from: "me" | "them"; content: string };
type OpenChat = "human" | "nimbo" | null;

const EMPTY_BOARD: RaBoard = { id: "UjFhgg3n", name: "Ra", lists: [], cards: [], configured: false };

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
  const [board, setBoard] = useState<RaBoard>(EMPTY_BOARD);
  const [mascotAlert, setMascotAlert] = useState<string | null>(null);
  const seenDmRef = useRef<string | null>(null);

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
      if (json?.board) setBoard({ ...EMPTY_BOARD, ...json.board, configured: json.configured !== false });
    } catch {
      // keep last
    }
  }, []);

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

  async function sendNimbo(text: string) {
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
      setNimboLines((prev) => [...prev, reply].slice(-12));
      setNimboLog((prev) =>
        [
          ...prev,
          { id: uid("me"), from: "me" as const, content: text },
          { id: uid("them"), from: "them" as const, content: reply },
        ].slice(-20),
      );
      if (json?.board) setBoard({ ...EMPTY_BOARD, ...json.board });
      else void pullBoard();
    } catch {
      const reply = "Después.";
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
    if (!seat) return;
    sendDm(text);
  }

  async function trelloAction(body: Record<string, string>) {
    try {
      const res = await fetch("/api/companion/trello", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (json?.board) setBoard({ ...EMPTY_BOARD, ...json.board, configured: json.configured !== false });
    } catch {
      // keep last
    }
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
    if (seat === "lulox") setOpenChat("human");
  }
  function clickLulox() {
    if (!seat) return;
    if (seat === "katho") setOpenChat("human");
  }
  function clickNimbo() {
    if (!seat) return;
    setOpenChat("nimbo");
  }

  return (
    <div className="companion-root companion-desk" data-companion-surface data-companion-desk>
      <CompanionPair
        view={togetherView}
        mochiWorking={false}
        luloxWorking={false}
        mochiAlert={seat === "lulox" ? mascotAlert : null}
        luloxAlert={seat === "katho" ? mascotAlert : null}
        mochiBubble={mochiBubble}
        luloxBubble={luloxBubble}
        nimboBubble={nimboBubble}
        onMochiClick={clickMochi}
        onLuloxClick={clickLulox}
        onNimboClick={clickNimbo}
        scale={0.6}
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

      {auth === null ? <CompanionLogin onSession={setAuth} /> : null}

      {openChat === "human" && other && seat ? (
        <section
          className={`talk-window tint-${otherTint.colorName}`}
          data-talk-window="human"
          data-tint={otherTint.colorName}
          role="dialog"
          aria-label={otherTint.label}
          style={{ borderColor: otherTint.hex }}
        >
          <header className="talk-chrome" style={{ background: otherTint.chrome }}>
            <span>{otherTint.label}</span>
            <button type="button" className="talk-close" onClick={() => setOpenChat(null)} aria-label="Cerrar">
              ×
            </button>
          </header>
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
        </section>
      ) : null}

      {openChat === "nimbo" ? (
        <section
          className="talk-window tint-gold"
          data-talk-window="nimbo"
          data-tint="gold"
          role="dialog"
          aria-label={nimboTint.label}
          style={{ borderColor: nimboTint.hex }}
        >
          <header className="talk-chrome" style={{ background: nimboTint.chrome }}>
            <span>{nimboTint.label}</span>
            <button type="button" className="talk-close" onClick={() => setOpenChat(null)} aria-label="Cerrar">
              ×
            </button>
          </header>
          <div className="talk-body">
            <div className="talk-log">
              {nimboLog.length === 0 ? (
                <p className="talk-empty">Ra.</p>
              ) : (
                nimboLog.map((row) => (
                  <p key={row.id} className={`talk-line from-${row.from}`}>
                    {row.content}
                  </p>
                ))
              )}
            </div>
            <div className="board-mini" data-ra-board>
              {board.lists.length === 0 ? (
                <p className="talk-empty">{board.configured ? "—" : "Ra todavía no."}</p>
              ) : (
                board.lists.map((col) => (
                  <RaColumn
                    key={col.id}
                    col={col}
                    cards={cardsInList(board, col.id)}
                    lists={board.lists}
                    onAdd={(title) => void trelloAction({ action: "add", title, listId: col.id })}
                    onMove={(cardId, listId) => void trelloAction({ action: "move", cardId, listId })}
                    onDone={(cardId) => void trelloAction({ action: "done", cardId })}
                  />
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
        </section>
      ) : null}
    </div>
  );
}

function RaColumn({
  col,
  cards,
  lists,
  onAdd,
  onMove,
  onDone,
}: {
  col: RaList;
  cards: RaCard[];
  lists: RaList[];
  onAdd: (title: string) => void;
  onMove: (cardId: string, listId: string) => void;
  onDone: (cardId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="board-column">
      <span className="board-col-title">{col.name}</span>
      {cards.map((card) => (
        <div key={card.id} className="board-feel board-feel-gold">
          <span>{card.name}</span>
          <span className="board-card-ops">
            {lists
              .filter((list) => list.id !== col.id)
              .slice(0, 3)
              .map((list) => (
                <button
                  key={list.id}
                  type="button"
                  className="board-mini-btn"
                  onClick={() => onMove(card.id, list.id)}
                >
                  {list.name.slice(0, 8)}
                </button>
              ))}
            <button type="button" className="board-mini-btn" onClick={() => onDone(card.id)}>
              listo
            </button>
          </span>
        </div>
      ))}
      <form
        className="board-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onAdd(draft.trim());
          setDraft("");
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="+" aria-label="Nueva tarea" />
      </form>
    </div>
  );
}
