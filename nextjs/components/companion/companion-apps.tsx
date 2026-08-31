"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  COMPANION_OPEN_RA,
  RA_APPS,
  addTodoItem,
  applyNimboClock,
  extractHttpUrl,
  loadOpenApps,
  loadPomo,
  loadTodos,
  loadVideoUrl,
  saveOpenApps,
  saveTodos,
  saveVideoUrl,
  type PersonId,
  type RaAppId,
  type TodoItem,
} from "@/lib/companion/companion-core";
import { FEEL_COLORS, type FeelColor } from "@/lib/companion/boards";
import {
  HOUSE_COLOR_ORDER,
  TOP_ARCHIVE_Y,
  assigneeLine,
  dragHitsArchive,
  formatHouseDue,
  parseHouseShortcut,
  type HouseCardPatch,
} from "@/lib/companion/house";
import { RADIO_STATIONS, radioStationById, type RadioStationId } from "@/lib/companion/radio";
import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/companion/youtube";
import { emptyRaBoard, raConnectWizard, type RaBoard } from "@/lib/companion/trello";
import {
  closeWindow,
  focusWindow,
  moveWindow,
  openWindow,
  resizeWindow,
  type LiveWindow,
} from "@/lib/companion/windows";
import { DeskWindow, usePhone } from "@/components/companion/companion-window";

const APP_SEED: Record<RaAppId, { w: number; h: number }> = {
  pomo: { w: 260, h: 220 },
  notas: { w: 280, h: 320 },
  video: { w: 360, h: 320 },
  radio: { w: 300, h: 240 },
  boards: { w: 640, h: 480 },
};

function formatRemain(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function AppDock({
  choosing,
  active,
  phone,
  hasOpen,
  onPick,
  onSwitch,
}: {
  choosing: boolean;
  active: RaAppId | null;
  phone: boolean;
  hasOpen: boolean;
  onPick: (id: RaAppId) => void;
  onSwitch: () => void;
}) {
  const switchOnly = phone && hasOpen && !choosing;
  return (
    <div className="app-dock" data-app-dock data-ra-dock>
      {switchOnly ? (
        <button type="button" className="ra-switch" data-ra-switch onClick={onSwitch}>
          cambiar
        </button>
      ) : (
        <nav className="app-dock-nav" data-ra-nav aria-label="Apps">
          {RA_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className={`dock-btn${active === app.id ? " is-on" : ""}`}
              data-ra-app={app.id}
              data-dock-app={app.id}
              onClick={() => onPick(app.id)}
            >
              {app.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function TomatePane() {
  const [clock, setClock] = useState(loadPomo);
  useEffect(() => {
    const tick = () => setClock(loadPomo());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="miniapp-body" data-miniapp="pomo">
      <p className="miniapp-kicker">tomate</p>
      <p className="miniapp-clock">{formatRemain(clock.remaining || clock.duration)}</p>
      <div className="miniapp-row">
        <button
          type="button"
          onClick={() => {
            applyNimboClock("start", 25);
            setClock(loadPomo());
          }}
        >
          {clock.running ? "seguir" : "arrancar"}
        </button>
        <button
          type="button"
          onClick={() => {
            applyNimboClock("stop");
            setClock(loadPomo());
          }}
        >
          parar
        </button>
      </div>
    </div>
  );
}

function NotasPane() {
  const [rows, setRows] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => setRows(loadTodos()), []);
  return (
    <div className="miniapp-body" data-miniapp="notas">
      <p className="miniapp-kicker">notas</p>
      <ul className="miniapp-list">
        {rows.length === 0 ? <li>vacío</li> : null}
        {rows.map((row) => (
          <li key={row.id}>
            <label>
              <input
                type="checkbox"
                checked={row.done}
                onChange={() => {
                  const next = rows.map((item) => (item.id === row.id ? { ...item, done: !item.done } : item));
                  saveTodos(next);
                  setRows(next);
                }}
              />
              {row.text}
            </label>
          </li>
        ))}
      </ul>
      <form
        className="miniapp-add"
        onSubmit={(event) => {
          event.preventDefault();
          const next = addTodoItem(draft, rows);
          setRows(next);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="anotá…" aria-label="Nueva nota" />
        <button type="submit" disabled={!draft.trim()}>
          ok
        </button>
      </form>
    </div>
  );
}

function VideoPane() {
  const [url, setUrl] = useState("");
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    const saved = loadVideoUrl();
    setUrl(saved);
    setClip(extractYouTubeId(saved));
  }, []);
  const id = extractYouTubeId(url) || clip;
  return (
    <div className="miniapp-body" data-miniapp="video">
      <p className="miniapp-kicker">video</p>
      <form
        className="miniapp-add"
        onSubmit={(event) => {
          event.preventDefault();
          saveVideoUrl(url);
          setClip(extractYouTubeId(url));
        }}
      >
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="pegá un link" aria-label="Link de video" />
        <button type="submit">ok</button>
      </form>
      {id ? (
        <iframe
          className="miniapp-video"
          title="video"
          src={youtubeEmbedUrl(id)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <p className="talk-empty">pegá un link</p>
      )}
    </div>
  );
}

function RuidoPane() {
  const [station, setStation] = useState<RadioStationId>("silencio");
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioBufferSourceNode | OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      nodeRef.current?.disconnect();
      gainRef.current?.disconnect();
      void ctxRef.current?.close();
    };
  }, []);

  function play(id: RadioStationId) {
    setStation(id);
    const spec = radioStationById(id);
    nodeRef.current?.stop?.();
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    if (spec.kind === "off") {
      gainRef.current?.disconnect();
      gainRef.current = null;
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctxRef.current || ctxRef.current.state === "closed") ctxRef.current = new AudioCtx();
    const ctx = ctxRef.current;
    void ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    if (spec.kind === "brown") {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 48;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 180;
      osc.connect(filter);
      filter.connect(gain);
      osc.start();
      nodeRef.current = osc;
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = spec.kind === "wave" ? "sine" : "triangle";
    osc.frequency.value = spec.kind === "wave" ? 110 : 220;
    osc.connect(gain);
    osc.start();
    nodeRef.current = osc;
  }

  return (
    <div className="miniapp-body" data-miniapp="radio">
      <p className="miniapp-kicker">ruido</p>
      <div className="miniapp-row wrap">
        {RADIO_STATIONS.map((row) => (
          <button key={row.id} type="button" className={station === row.id ? "is-on" : ""} onClick={() => play(row.id)}>
            {row.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type RaDrag = {
  cardId: string;
  name: string;
  feel: string;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  overListId: string | null;
  overArchive: boolean;
};

function RaWizard({
  seat,
  authorizeUrl,
}: {
  seat: PersonId;
  authorizeUrl: string | null;
}) {
  const copy = raConnectWizard(seat);
  return (
    <div className="ra-wizard" data-ra-wizard>
      <p className="miniapp-kicker">Ra</p>
      <ol className="ra-wizard-steps">
        {copy.steps.map((step) => (
          <li key={step.n} data-ra-step={step.n}>
            <span className="ra-wizard-n">{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
              {step.n === 2 ? (
                authorizeUrl ? (
                  <a className="ra-connect" data-ra-connect href={authorizeUrl}>
                    {copy.connectLabel}
                  </a>
                ) : (
                  <button type="button" className="ra-connect" data-ra-connect disabled>
                    {copy.connectLabel}
                  </button>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ColorDots({
  current,
  onPick,
}: {
  current: FeelColor | null;
  onPick: (color: FeelColor) => void;
}) {
  return (
    <div className="feel-dots" role="group" aria-label="color" data-house-colors={HOUSE_COLOR_ORDER.join(",")}>
      {HOUSE_COLOR_ORDER.map((color, i) => (
        <button
          key={color}
          type="button"
          className={`feel-dot board-feel-${color}${current === color ? " is-on" : ""}`}
          aria-label={`${i + 1} ${FEEL_COLORS[color].label}`}
          data-house-color={color}
          title={`${i + 1} ${FEEL_COLORS[color].label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
}

function RaPane({
  board,
  seat,
  authorizeUrl,
  phone,
  onAdd,
  onMove,
  onDone,
  onColor,
  onArchive,
  onHouse,
}: {
  board: RaBoard;
  seat: PersonId;
  authorizeUrl: string | null;
  phone: boolean;
  onAdd: (title: string, listId?: string) => void;
  onMove: (cardId: string, listId: string) => void;
  onDone: (cardId: string) => void;
  onColor: (cardId: string, color: FeelColor) => void;
  onArchive: (cardId: string) => void;
  onHouse: (patch: HouseCardPatch) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<RaDrag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const colRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<RaDrag | null>(null);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const openCard = board.cards.find((card) => card.id === openId && !card.closed) || null;

  useEffect(() => {
    setDescDraft(openCard?.desc || "");
    setLinkDraft("");
  }, [openCard?.id, openCard?.desc]);

  useEffect(() => {
    if (phone) return;
    function onKey(event: KeyboardEvent) {
      const action = parseHouseShortcut(event);
      if (action.type === "none" || !selectedId) return;
      event.preventDefault();
      if (action.type === "archive") onArchive(selectedId);
      if (action.type === "color") onColor(selectedId, action.color);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone, selectedId, onArchive, onColor]);

  if (!board.configured) {
    return (
      <div className="miniapp-body" data-miniapp="boards">
        <RaWizard seat={seat} authorizeUrl={authorizeUrl} />
      </div>
    );
  }

  function hitList(x: number, y: number): string | null {
    for (const [id, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  function onCardDown(event: PointerEvent<HTMLElement>, card: { id: string; name: string; feel: string | null }) {
    if ((event.target as HTMLElement).closest("button, .feel-dots, a, input, textarea, select")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: RaDrag = {
      cardId: card.id,
      name: card.name,
      feel: card.feel || "gold",
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX,
      grabY: event.clientY,
      overListId: null,
      overArchive: dragHitsArchive(event.clientY),
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onCardMove(event: PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    const overArchive = dragHitsArchive(event.clientY);
    const next: RaDrag = {
      ...dragRef.current,
      x: event.clientX,
      y: event.clientY,
      overListId: overArchive ? null : hitList(event.clientX, event.clientY),
      overArchive,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onCardUp(event: PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (!current) return;
    const moved = Math.hypot(event.clientX - current.grabX, event.clientY - current.grabY) > 8;
    if (moved && current.overArchive) {
      onArchive(current.cardId);
      setOpenId((id) => (id === current.cardId ? null : id));
      setSelectedId((id) => (id === current.cardId ? null : id));
      return;
    }
    if (moved && current.overListId) {
      onMove(current.cardId, current.overListId);
      return;
    }
    if (!moved) {
      setSelectedId(current.cardId);
      setOpenId(current.cardId);
    }
  }

  const portal =
    typeof document !== "undefined" && drag
      ? createPortal(
          <>
            <div className={`ra-sky${drag.overArchive ? " is-hot" : ""}`} data-ra-archive>
              soltá para archivar
            </div>
            <div
              className={`board-feel board-feel-${drag.feel} ra-drag-card`}
              data-ra-dragging
              style={{ left: drag.x - 56, top: drag.y - 18 }}
            >
              {drag.name}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div
      className="miniapp-body ra-game"
      data-miniapp="boards"
      data-ra-game
      data-house-shortcut="e,1-6"
      data-archive-y={TOP_ARCHIVE_Y}
    >
      <p className="miniapp-kicker">Ra</p>
      <p className="ra-game-hint">
        {phone ? "tirá las tarjetas. arriba se archivan." : "tirá las tarjetas. arriba se archivan. E archiva · 1–6 color."}
      </p>
      <div className="board-mini">
        {board.lists.map((list) => (
          <div
            key={list.id}
            className={`board-column${drag?.overListId === list.id ? " is-drop" : ""}`}
            data-ra-list={list.id}
            ref={(el) => {
              if (el) colRefs.current.set(list.id, el);
              else colRefs.current.delete(list.id);
            }}
          >
            <span className="board-col-title">{list.name}</span>
            {board.cards
              .filter((card) => card.idList === list.id && !card.closed && card.id !== drag?.cardId)
              .map((card) => {
                const who = assigneeLine(card.members[0]);
                const when = formatHouseDue(card.due);
                return (
                  <div
                    key={card.id}
                    className={`board-feel board-feel-${card.feel || "gold"}${selectedId === card.id ? " is-on" : ""}`}
                    data-ra-card={card.id}
                    data-house-card={card.id}
                    data-selected={selectedId === card.id ? "true" : "false"}
                    onPointerDown={(event) => onCardDown(event, { id: card.id, name: card.name, feel: card.feel })}
                    onPointerMove={onCardMove}
                    onPointerUp={onCardUp}
                    onPointerCancel={onCardUp}
                  >
                    <span className="board-card-title">{card.name}</span>
                    {who || when ? (
                      <span className="board-card-meta">
                        {who}
                        {who && when ? " · " : ""}
                        {when}
                      </span>
                    ) : null}
                    <ColorDots current={card.feel} onPick={(color) => onColor(card.id, color)} />
                    <div className="board-card-ops">
                      <button type="button" className="board-mini-btn" onClick={() => onDone(card.id)}>
                        listo
                      </button>
                    </div>
                  </div>
                );
              })}
            <form
              className="miniapp-add"
              onSubmit={(event) => {
                event.preventDefault();
                const title = (drafts[list.id] || "").trim();
                if (!title) return;
                setDrafts((prev) => ({ ...prev, [list.id]: "" }));
                onAdd(title, list.id);
              }}
            >
              <input
                value={drafts[list.id] || ""}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [list.id]: event.target.value }))}
                placeholder="tirá una…"
                aria-label={`Nueva en ${list.name}`}
              />
              <button type="submit" disabled={!(drafts[list.id] || "").trim()}>
                ok
              </button>
            </form>
          </div>
        ))}
      </div>
      {openCard ? (
        <div className="ra-card-sheet" data-ra-detail data-house-detail>
          <header className="ra-card-sheet-head">
            <strong>{openCard.name}</strong>
            <button type="button" className="board-mini-btn" onClick={() => setOpenId(null)}>
              cerrar
            </button>
          </header>
          <ColorDots current={openCard.feel} onPick={(color) => onColor(openCard.id, color)} />
          <label className="ra-field">
            qué es
            <textarea
              value={descDraft}
              onChange={(event) => setDescDraft(event.target.value)}
              onBlur={() => {
                if (descDraft !== (openCard.desc || "")) onHouse({ action: "desc", cardId: openCard.id, desc: descDraft });
              }}
              rows={4}
              aria-label="descripción"
            />
          </label>
          <label className="ra-field">
            fecha
            <input
              type="date"
              value={formatHouseDue(openCard.due)}
              aria-label="fecha"
              onChange={(event) => {
                const value = event.target.value;
                onHouse({ action: "due", cardId: openCard.id, due: value ? `${value}T12:00:00.000Z` : null });
              }}
            />
          </label>
          <label className="ra-field">
            quién
            <select
              value={openCard.idMembers[0] || ""}
              aria-label="responsable"
              onChange={(event) =>
                onHouse({ action: "assign", cardId: openCard.id, memberId: event.target.value || null })
              }
            >
              <option value="">nadie</option>
              {board.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {assigneeLine(member) || member.fullName || member.username}
                </option>
              ))}
            </select>
          </label>
          <ul className="ra-links" data-house-links>
            {openCard.links.length === 0 ? <li>sin links</li> : null}
            {openCard.links.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
          <form
            className="miniapp-add"
            onSubmit={(event) => {
              event.preventDefault();
              const url = extractHttpUrl(linkDraft) || linkDraft.trim();
              if (!url) return;
              onHouse({ action: "link", cardId: openCard.id, url });
              setLinkDraft("");
            }}
          >
            <input
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              placeholder="pegá un link"
              aria-label="link"
            />
            <button type="submit" disabled={!linkDraft.trim()}>
              ok
            </button>
          </form>
          <div className="board-card-ops">
            <button type="button" className="board-mini-btn" data-house-archive onClick={() => onArchive(openCard.id)}>
              archivar
            </button>
            <button type="button" className="board-mini-btn" onClick={() => onDone(openCard.id)}>
              listo
            </button>
          </div>
        </div>
      ) : null}
      {portal}
    </div>
  );
}

export function CompanionApps({
  board = emptyRaBoard(),
  seat = "katho",
  authorizeUrl = null,
  onRaAdd,
  onRaMove,
  onRaDone,
  onRaColor,
  onRaArchive,
  onRaHouse,
  onFoco,
}: {
  board?: RaBoard;
  seat?: PersonId;
  authorizeUrl?: string | null;
  onRaAdd: (title: string, listId?: string) => void;
  onRaMove: (cardId: string, listId: string) => void;
  onRaDone: (cardId: string) => void;
  onRaColor: (cardId: string, color: FeelColor) => void;
  onRaArchive: (cardId: string) => void;
  onRaHouse: (patch: HouseCardPatch) => void;
  onFoco: (foco: boolean) => void;
}) {
  const phone = usePhone();
  const [navOpen, setNavOpen] = useState(false);
  const [order, setOrder] = useState<RaAppId[]>([]);
  const [wins, setWins] = useState<LiveWindow[]>([]);

  useEffect(() => {
    const saved = loadOpenApps().filter((id): id is RaAppId => RA_APPS.some((app) => app.id === id));
    setOrder(saved);
    let next: LiveWindow[] = [];
    for (const id of saved) {
      next = openWindow(next, id, { ...APP_SEED[id], x: 48 + next.length * 28, y: 72 + next.length * 24 });
    }
    setWins(next);
  }, []);

  useEffect(() => {
    saveOpenApps(order);
    onFoco(phone && order.length > 0);
  }, [order, phone, onFoco]);

  const active = order[order.length - 1] || null;
  const visible = phone ? (active ? [active] : []) : order;

  function pick(id: RaAppId) {
    setOrder((prev) => {
      const next = prev.filter((row) => row !== id);
      next.push(id);
      return next;
    });
    setWins((prev) => openWindow(prev, id, APP_SEED[id]));
    setNavOpen(false);
  }

  useEffect(() => {
    const openHouse = () => pick("boards");
    window.addEventListener(COMPANION_OPEN_RA, openHouse);
    return () => window.removeEventListener(COMPANION_OPEN_RA, openHouse);
  }, []);

  function close(id: RaAppId) {
    setOrder((prev) => prev.filter((row) => row !== id));
    setWins((prev) => closeWindow(prev, id));
  }

  function pane(id: RaAppId) {
    if (id === "pomo") return <TomatePane />;
    if (id === "notas") return <NotasPane />;
    if (id === "video") return <VideoPane />;
    if (id === "radio") return <RuidoPane />;
    return (
      <RaPane
        board={board}
        seat={seat}
        authorizeUrl={authorizeUrl}
        phone={phone}
        onAdd={onRaAdd}
        onMove={onRaMove}
        onDone={onRaDone}
        onColor={onRaColor}
        onArchive={onRaArchive}
        onHouse={onRaHouse}
      />
    );
  }

  const positions = useMemo(() => {
    const map = new Map(wins.map((w) => [w.id, w]));
    return map;
  }, [wins]);

  return (
    <>
      <AppDock
        choosing={navOpen}
        active={active}
        phone={phone}
        hasOpen={order.length > 0}
        onPick={pick}
        onSwitch={() => setNavOpen(true)}
      />
      {visible.map((id) => {
        const pos = positions.get(id) || {
          id,
          x: 64,
          y: 88,
          z: 40,
          w: APP_SEED[id].w,
          h: APP_SEED[id].h,
        };
        const label = RA_APPS.find((app) => app.id === id)?.label || id;
        return (
          <DeskWindow
            key={id}
            id={id}
            title={label}
            phone={phone}
            pos={pos}
            variant="app"
            onClose={() => close(id)}
            onFocus={() => setWins((prev) => focusWindow(prev, id))}
            onMove={(x, y) => setWins((prev) => moveWindow(prev, id, x, y))}
            onResize={(next) => setWins((prev) => resizeWindow(prev, id, next))}
          >
            {pane(id)}
          </DeskWindow>
        );
      })}
    </>
  );
}
