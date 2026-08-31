"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  COMPANION_OPEN_RA,
  RA_APPS,
  addTodoItem,
  applyNimboClock,
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
import { FEEL_COLOR_IDS, type FeelColor } from "@/lib/companion/boards";
import { RADIO_STATIONS, radioStationById, type RadioStationId } from "@/lib/companion/radio";
import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/companion/youtube";
import { emptyRaBoard, raConnectWizard, type RaBoard } from "@/lib/companion/trello";

type WinPos = { id: RaAppId; x: number; y: number; z: number };

function formatRemain(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const read = () => setPhone(window.innerWidth <= 699);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return phone;
}

function RaNav({
  open,
  active,
  onToggle,
  onPick,
  switchOnly,
}: {
  open: boolean;
  active: RaAppId | null;
  onToggle: () => void;
  onPick: (id: RaAppId) => void;
  switchOnly?: boolean;
}) {
  return (
    <div className="ra-dock" data-ra-dock>
      <button type="button" className="ra-launcher" data-ra-launcher onClick={onToggle} aria-expanded={open}>
        Ra
      </button>
      {open ? (
        <nav className="ra-nav" data-ra-nav aria-label="Ra">
          {RA_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className={`ra-nav-btn${active === app.id ? " is-on" : ""}`}
              data-ra-app={app.id}
              onClick={() => onPick(app.id)}
            >
              {app.label}
            </button>
          ))}
        </nav>
      ) : null}
      {switchOnly && !open && active ? (
        <button
          type="button"
          className="ra-switch"
          data-ra-switch
          onClick={onToggle}
        >
          cambiar
        </button>
      ) : null}
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

function RaPane({
  board,
  seat,
  authorizeUrl,
  onAdd,
  onMove,
  onDone,
  onColor,
  onArchive,
}: {
  board: RaBoard;
  seat: PersonId;
  authorizeUrl: string | null;
  onAdd: (title: string, listId?: string) => void;
  onMove: (cardId: string, listId: string) => void;
  onDone: (cardId: string) => void;
  onColor: (cardId: string, color: FeelColor) => void;
  onArchive: (cardId: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<RaDrag | null>(null);
  const colRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<RaDrag | null>(null);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

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
    if ((event.target as HTMLElement).closest("button, .feel-dots")) return;
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
      overArchive: event.clientY < 72,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onCardMove(event: PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    const overArchive = event.clientY < 72;
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
    if (current.overArchive) {
      onArchive(current.cardId);
      return;
    }
    if (moved && current.overListId) {
      onMove(current.cardId, current.overListId);
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
    <div className="miniapp-body ra-game" data-miniapp="boards" data-ra-game>
      <p className="miniapp-kicker">Ra</p>
      <p className="ra-game-hint">tirá las tarjetas. arriba se archivan.</p>
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
              .map((card) => (
                <div
                  key={card.id}
                  className={`board-feel board-feel-${card.feel || "gold"}`}
                  data-ra-card={card.id}
                  onPointerDown={(event) => onCardDown(event, { id: card.id, name: card.name, feel: card.feel })}
                  onPointerMove={onCardMove}
                  onPointerUp={onCardUp}
                  onPointerCancel={onCardUp}
                >
                  {card.name}
                  <div className="feel-dots" role="group" aria-label="color">
                    {FEEL_COLOR_IDS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`feel-dot board-feel-${color}${card.feel === color ? " is-on" : ""}`}
                        aria-label={color}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => onColor(card.id, color)}
                      />
                    ))}
                  </div>
                  <div className="board-card-ops">
                    <button type="button" className="board-mini-btn" onClick={() => onDone(card.id)}>
                      listo
                    </button>
                  </div>
                </div>
              ))}
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
      {portal}
    </div>
  );
}

function MiniappChrome({
  id,
  phone,
  pos,
  onClose,
  onFocus,
  onMove,
  children,
}: {
  id: RaAppId;
  phone: boolean;
  pos: WinPos;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const label = RA_APPS.find((app) => app.id === id)?.label || id;

  function down(event: PointerEvent<HTMLElement>) {
    if (phone) return;
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: pos.x, top: pos.y };
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    onMove(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y);
  }
  function up(event: PointerEvent<HTMLElement>) {
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  return (
    <section
      className={phone ? "miniapp-full" : "miniapp-window"}
      data-miniapp-window={id}
      data-phone-full={phone ? "true" : "false"}
      style={phone ? undefined : { left: pos.x, top: pos.y, zIndex: pos.z }}
      onPointerDown={onFocus}
    >
      <header
        className="miniapp-chrome"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span>{label}</span>
        <button type="button" className="talk-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </header>
      {children}
    </section>
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
  onFoco: (foco: boolean) => void;
}) {
  const phone = usePhone();
  const [navOpen, setNavOpen] = useState(false);
  const [order, setOrder] = useState<RaAppId[]>([]);
  const [wins, setWins] = useState<WinPos[]>([]);
  const zRef = useRef(30);

  useEffect(() => {
    const saved = loadOpenApps().filter((id): id is RaAppId => RA_APPS.some((app) => app.id === id));
    setOrder(saved);
    setWins(
      saved.map((id, i) => ({
        id,
        x: 48 + i * 28,
        y: 72 + i * 24,
        z: 30 + i,
      })),
    );
    zRef.current = 30 + saved.length;
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
    setWins((prev) => {
      const rest = prev.filter((row) => row.id !== id);
      zRef.current += 1;
      const found = prev.find((row) => row.id === id);
      return [
        ...rest,
        found
          ? { ...found, z: zRef.current }
          : { id, x: 56 + rest.length * 24, y: 80 + rest.length * 20, z: zRef.current },
      ];
    });
    setNavOpen(false);
  }

  useEffect(() => {
    const openHouse = () => pick("boards");
    window.addEventListener(COMPANION_OPEN_RA, openHouse);
    return () => window.removeEventListener(COMPANION_OPEN_RA, openHouse);
  }, []);

  function close(id: RaAppId) {
    setOrder((prev) => prev.filter((row) => row !== id));
    setWins((prev) => prev.filter((row) => row.id !== id));
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
        onAdd={onRaAdd}
        onMove={onRaMove}
        onDone={onRaDone}
        onColor={onRaColor}
        onArchive={onRaArchive}
      />
    );
  }

  const positions = useMemo(() => {
    const map = new Map(wins.map((w) => [w.id, w]));
    return map;
  }, [wins]);

  return (
    <>
      <RaNav
        open={navOpen}
        active={active}
        onToggle={() => setNavOpen((v) => !v)}
        onPick={pick}
        switchOnly={phone && order.length > 0}
      />
      {visible.map((id) => {
        const pos = positions.get(id) || { id, x: 64, y: 88, z: 40 };
        return (
          <MiniappChrome
            key={id}
            id={id}
            phone={phone}
            pos={pos}
            onClose={() => close(id)}
            onFocus={() => pick(id)}
            onMove={(x, y) =>
              setWins((prev) => prev.map((row) => (row.id === id ? { ...row, x: Math.max(8, x), y: Math.max(8, y) } : row)))
            }
          >
            {pane(id)}
          </MiniappChrome>
        );
      })}
    </>
  );
}
