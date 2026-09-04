"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  COMPANION_OPEN_APP,
  COMPANION_OPEN_RA,
  CORE_INSTALLED_APPS,
  RA_APPS,
  addTodoItem,
  applyNimboClock,
  extractHttpUrl,
  installApp,
  isAppInstalled,
  loadInstalledApps,
  loadOpenApps,
  loadPomo,
  loadTodos,
  loadVideoUrl,
  saveInstalledApps,
  saveOpenApps,
  saveTodos,
  saveVideoUrl,
  uninstallApp,
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
import { emptyRaBoard, insertPos, raConnectWizard, sortedOpenCards, type RaBoard, type RaCard } from "@/lib/companion/trello";
import {
  clickDockApp,
  closeWindow,
  focusWindow,
  minimizeWindow,
  moveWindow,
  openWindow,
  resizeWindow,
  toggleMaximizeWindow,
  windowIsVisible,
  type LiveWindow,
} from "@/lib/companion/windows";
import { DeskWindow, usePhone } from "@/components/companion/companion-window";

const APP_SEED: Record<RaAppId, { w: number; h: number }> = {
  pomo: { w: 260, h: 220 },
  notas: { w: 280, h: 320 },
  video: { w: 360, h: 320 },
  radio: { w: 300, h: 240 },
  boards: { w: 960, h: 680 },
};

function formatRemain(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const APP_BLURBS: Record<RaAppId, string> = {
  pomo: "timer de foco",
  notas: "lista corta local",
  video: "youtube embebido",
  radio: "ruido de fondo",
  boards: "tareas en Ra (Trello)",
};

function AppStorePane({
  installed,
  onInstall,
  onUninstall,
}: {
  installed: RaAppId[];
  onInstall: (id: RaAppId) => void;
  onUninstall: (id: RaAppId) => void;
}) {
  return (
    <div className="miniapp-body app-store" data-miniapp="tienda" data-app-store>
      <p className="miniapp-kicker">tienda</p>
      <p className="app-store-hint">Instalá para que aparezcan en el dock. Tareas queda siempre.</p>
      <ul className="app-store-list">
        {RA_APPS.map((app) => {
          const on = isAppInstalled(installed, app.id);
          const core = CORE_INSTALLED_APPS.includes(app.id);
          return (
            <li key={app.id} className="app-store-row" data-store-app={app.id} data-installed={on ? "true" : "false"}>
              <div>
                <strong>{app.label}</strong>
                <span>{APP_BLURBS[app.id]}</span>
              </div>
              {core ? (
                <button type="button" className="dock-btn is-on" disabled data-store-core>
                  core
                </button>
              ) : on ? (
                <button type="button" className="dock-btn" data-store-uninstall={app.id} onClick={() => onUninstall(app.id)}>
                  desinstalar
                </button>
              ) : (
                <button type="button" className="dock-btn is-on" data-store-install={app.id} onClick={() => onInstall(app.id)}>
                  instalar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AppDock({
  installedIds,
  visibleIds,
  phone,
  launcherOpen,
  onPick,
  onOpenStore,
  onToggleLauncher,
  onToggleSwitcher,
}: {
  installedIds: RaAppId[];
  visibleIds: RaAppId[];
  phone: boolean;
  launcherOpen: boolean;
  onPick: (id: RaAppId) => void;
  onOpenStore: () => void;
  onToggleLauncher: () => void;
  onToggleSwitcher: () => void;
}) {
  const hasOpen = visibleIds.length > 0;
  const dockApps = RA_APPS.filter((app) => installedIds.includes(app.id));
  return (
    <div className="app-dock" data-app-dock data-ra-dock data-phone-dock={phone ? "true" : "false"}>
      {phone ? (
        <button
          type="button"
          className={`dock-btn ra-switch${launcherOpen ? " is-on" : ""}`}
          data-phone-center
          data-ra-switch
          aria-label={hasOpen ? "App switcher" : "Control center"}
          onClick={() => (hasOpen ? onToggleSwitcher() : onToggleLauncher())}
        >
          {hasOpen ? "apps" : "casa"}
        </button>
      ) : null}
      <nav className="app-dock-nav" data-ra-nav aria-label="Apps">
        {dockApps.map((app) => {
          const open = visibleIds.includes(app.id);
          return (
            <button
              key={app.id}
              type="button"
              className={`dock-btn${open ? " is-on" : ""}`}
              data-ra-app={app.id}
              data-dock-app={app.id}
              data-dock-open={open ? "true" : "false"}
              aria-pressed={open}
              onClick={() => onPick(app.id)}
            >
              {app.label}
            </button>
          );
        })}
        <button type="button" className="dock-btn" data-dock-store data-ra-app="tienda" onClick={onOpenStore}>
          tienda
        </button>
      </nav>
    </div>
  );
}

function PhoneLauncher({
  installedIds,
  visibleIds,
  mode,
  onPick,
  onOpenStore,
  onClose,
}: {
  installedIds: RaAppId[];
  visibleIds: RaAppId[];
  mode: "launcher" | "switcher";
  onPick: (id: RaAppId) => void;
  onOpenStore: () => void;
  onClose: () => void;
}) {
  const apps =
    mode === "switcher"
      ? RA_APPS.filter((app) => visibleIds.includes(app.id))
      : RA_APPS.filter((app) => installedIds.includes(app.id));
  return (
    <div className="phone-control-center" data-phone-control-center data-mode={mode} role="dialog" aria-label={mode === "switcher" ? "App switcher" : "Control center"}>
      <header className="phone-cc-chrome">
        <span>{mode === "switcher" ? "cambiar app" : "launcher"}</span>
        <button type="button" className="talk-close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="phone-cc-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            className={`dock-btn${visibleIds.includes(app.id) ? " is-on" : ""}`}
            data-cc-app={app.id}
            onClick={() => {
              onPick(app.id);
              onClose();
            }}
          >
            {app.label}
          </button>
        ))}
        {mode === "launcher" ? (
          <button
            type="button"
            className="dock-btn"
            data-cc-store
            onClick={() => {
              onOpenStore();
              onClose();
            }}
          >
            tienda
          </button>
        ) : null}
      </div>
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
  overIndex: number | null;
  overPos: number | null;
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

function RaCardModal({
  card,
  board,
  descDraft,
  linkDraft,
  setDescDraft,
  setLinkDraft,
  onClose,
  onColor,
  onHouse,
  onArchive,
  onDone,
}: {
  card: RaCard;
  board: RaBoard;
  descDraft: string;
  linkDraft: string;
  setDescDraft: (value: string) => void;
  setLinkDraft: (value: string) => void;
  onClose: () => void;
  onColor: (cardId: string, color: FeelColor) => void;
  onHouse: (patch: HouseCardPatch) => void;
  onArchive: (cardId: string) => void;
  onDone: (cardId: string) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ra-card-modal" data-ra-card-modal>
      <button type="button" className="ra-card-backdrop" aria-label="cerrar" data-ra-detail-backdrop onClick={onClose} />
      <div className="ra-card-sheet" data-ra-detail data-house-detail role="dialog" aria-modal="true" aria-labelledby="ra-card-title">
        <header className="ra-card-sheet-head">
          <strong id="ra-card-title">{card.name}</strong>
          <button type="button" className="board-mini-btn" onClick={onClose}>
            cerrar
          </button>
        </header>
        <ColorDots current={card.feel} onPick={(color) => onColor(card.id, color)} />
        {(card.checklists || []).map((list) => (
          <div key={list.id} className="ra-checklist" data-ra-checklist={list.id}>
            <strong>{list.name}</strong>
            <ul>
              {list.items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.complete}
                      aria-label={item.name}
                      onChange={() =>
                        onHouse({
                          action: "check",
                          cardId: card.id,
                          itemId: item.id,
                          complete: !item.complete,
                        })
                      }
                    />
                    {item.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <label className="ra-field">
          qué es
          <textarea
            value={descDraft}
            onChange={(event) => setDescDraft(event.target.value)}
            onBlur={() => {
              if (descDraft !== (card.desc || "")) onHouse({ action: "desc", cardId: card.id, desc: descDraft });
            }}
            rows={4}
            aria-label="descripción"
          />
        </label>
        <label className="ra-field">
          fecha
          <input
            type="date"
            value={formatHouseDue(card.due)}
            aria-label="fecha"
            onChange={(event) => {
              const value = event.target.value;
              onHouse({ action: "due", cardId: card.id, due: value ? `${value}T12:00:00.000Z` : null });
            }}
          />
        </label>
        <label className="ra-field">
          quién
          <select
            value={card.idMembers[0] || ""}
            aria-label="responsable"
            onChange={(event) => onHouse({ action: "assign", cardId: card.id, memberId: event.target.value || null })}
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
          {card.links.length === 0 ? <li>sin links</li> : null}
          {card.links.map((link) => (
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
            onHouse({ action: "link", cardId: card.id, url });
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
          <button type="button" className="board-mini-btn" data-house-archive onClick={() => onArchive(card.id)}>
            archivar
          </button>
          <button type="button" className="board-mini-btn" onClick={() => onDone(card.id)}>
            listo
          </button>
        </div>
      </div>
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
  onMove: (cardId: string, listId: string, pos?: number) => void;
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
      if (action.type === "archive") {
        onArchive(selectedId);
        setOpenId((id) => (id === selectedId ? null : id));
      }
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

  function hitSlot(x: number, y: number, draggedId: string): { listId: string; index: number; pos: number } | null {
    for (const [id, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const nodes = [...el.querySelectorAll<HTMLElement>("[data-ra-card]")];
      let index = nodes.length;
      for (let i = 0; i < nodes.length; i++) {
        const cr = nodes[i].getBoundingClientRect();
        if (y < cr.top + cr.height / 2) {
          index = i;
          break;
        }
      }
      const rest = sortedOpenCards(board, id, draggedId);
      return { listId: id, index, pos: insertPos(rest.map((card) => card.pos), index) };
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
      overIndex: null,
      overPos: null,
      overArchive: dragHitsArchive(event.clientY),
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onCardMove(event: PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    const overArchive = dragHitsArchive(event.clientY);
    const slot = overArchive ? null : hitSlot(event.clientX, event.clientY, dragRef.current.cardId);
    const next: RaDrag = {
      ...dragRef.current,
      x: event.clientX,
      y: event.clientY,
      overListId: slot?.listId ?? null,
      overIndex: slot?.index ?? null,
      overPos: slot?.pos ?? null,
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
      onMove(current.cardId, current.overListId, current.overPos ?? undefined);
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
      data-tareas-pane
    >
      <p className="miniapp-kicker">tareas</p>
      <p className="ra-game-hint">
        {phone ? "click abre. arrastrá para mover." : "click abre. arrastrá para mover. E archiva · 1–6 color."}
      </p>
      <div className="board-mini" data-board-scroll>
        {board.lists.map((list) => (
          <div
            key={list.id}
            className={`board-column${drag?.overListId === list.id ? " is-drop" : ""}`}
            data-ra-list={list.id}
            data-drop-index={drag?.overListId === list.id ? String(drag.overIndex ?? "") : undefined}
            ref={(el) => {
              if (el) colRefs.current.set(list.id, el);
              else colRefs.current.delete(list.id);
            }}
          >
            <span className="board-col-title">{list.name}</span>
            <div className="board-cards">
              {sortedOpenCards(board, list.id, drag?.cardId).map((card) => {
                const who = assigneeLine(card.members[0]);
                const when = formatHouseDue(card.due);
                const checks = (card.checklists || []).reduce(
                  (sum, list) => sum + list.items.filter((item) => item.complete).length,
                  0,
                );
                const totalChecks = (card.checklists || []).reduce((sum, list) => sum + list.items.length, 0);
                return (
                  <div
                    key={card.id}
                    className={`board-card${selectedId === card.id ? " is-on" : ""}`}
                    data-ra-card={card.id}
                    data-house-card={card.id}
                    data-selected={selectedId === card.id ? "true" : "false"}
                    onPointerDown={(event) => onCardDown(event, { id: card.id, name: card.name, feel: card.feel })}
                    onPointerMove={onCardMove}
                    onPointerUp={onCardUp}
                    onPointerCancel={onCardUp}
                  >
                    {card.feel ? (
                      <span className={`board-card-label board-feel-${card.feel}`} data-house-color-bar={card.feel} />
                    ) : null}
                    <span className="board-card-title">{card.name}</span>
                    {who || when || totalChecks ? (
                      <span className="board-card-meta">
                        {who}
                        {who && when ? " · " : ""}
                        {when}
                        {totalChecks ? `${who || when ? " · " : ""}${checks}/${totalChecks}` : ""}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
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
      {openCard && typeof document !== "undefined"
        ? createPortal(
            <RaCardModal
              card={openCard}
              board={board}
              descDraft={descDraft}
              linkDraft={linkDraft}
              setDescDraft={setDescDraft}
              setLinkDraft={setLinkDraft}
              onClose={() => setOpenId(null)}
              onColor={onColor}
              onHouse={onHouse}
              onArchive={(cardId) => {
                onArchive(cardId);
                setOpenId(null);
              }}
              onDone={(cardId) => {
                onDone(cardId);
                setOpenId(null);
              }}
            />,
            document.body,
          )
        : null}
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
  onRaMove: (cardId: string, listId: string, pos?: number) => void;
  onRaDone: (cardId: string) => void;
  onRaColor: (cardId: string, color: FeelColor) => void;
  onRaArchive: (cardId: string) => void;
  onRaHouse: (patch: HouseCardPatch) => void;
  onFoco: (foco: boolean) => void;
}) {
  const phone = usePhone();
  const [order, setOrder] = useState<RaAppId[]>([]);
  const [wins, setWins] = useState<LiveWindow[]>([]);
  const [installed, setInstalled] = useState<RaAppId[]>(CORE_INSTALLED_APPS);
  const [storeOpen, setStoreOpen] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState<"launcher" | "switcher" | null>(null);

  useEffect(() => {
    const got = loadInstalledApps();
    setInstalled(got);
    const saved = loadOpenApps().filter(
      (id): id is RaAppId => RA_APPS.some((app) => app.id === id) && got.includes(id as RaAppId),
    );
    setOrder(saved);
    let next: LiveWindow[] = [];
    for (const id of saved) {
      next = openWindow(next, id, { ...APP_SEED[id], x: 48 + next.length * 28, y: 72 + next.length * 24 });
    }
    setWins(next);
  }, []);

  useEffect(() => {
    saveOpenApps(order);
    const visible = wins.some((win) => order.includes(win.id as RaAppId) && !win.minimized);
    onFoco(phone && visible);
  }, [order, wins, phone, onFoco]);

  useEffect(() => {
    saveInstalledApps(installed);
  }, [installed]);

  const visibleIds = order.filter((id) => windowIsVisible(wins, id));
  const active = [...visibleIds].reverse()[0] || null;

  function pick(id: RaAppId) {
    if (!isAppInstalled(installed, id)) {
      setStoreOpen(true);
      return;
    }
    const { windows, action } = clickDockApp(wins, id, APP_SEED[id]);
    setWins(windows);
    if (action === "minimize") return;
    setOrder((prev) => {
      const next = prev.filter((row) => row !== id);
      next.push(id);
      return next;
    });
  }

  useEffect(() => {
    const launch = (id: RaAppId) => {
      setInstalled((prev) => {
        const next = installApp(prev, id);
        return next;
      });
      setWins((prev) => openWindow(prev, id, APP_SEED[id]));
      setOrder((prev) => {
        const next: RaAppId[] = prev.filter((row) => row !== id);
        next.push(id);
        return next;
      });
    };
    const openHouse = () => launch("boards");
    const onOpenApp = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id && RA_APPS.some((app) => app.id === id)) launch(id as RaAppId);
    };
    window.addEventListener(COMPANION_OPEN_RA, openHouse);
    window.addEventListener(COMPANION_OPEN_APP, onOpenApp);
    return () => {
      window.removeEventListener(COMPANION_OPEN_RA, openHouse);
      window.removeEventListener(COMPANION_OPEN_APP, onOpenApp);
    };
  }, []);

  function close(id: RaAppId) {
    setOrder((prev) => prev.filter((row) => row !== id));
    setWins((prev) => closeWindow(prev, id));
  }

  function doInstall(id: RaAppId) {
    setInstalled((prev) => installApp(prev, id));
  }

  function doUninstall(id: RaAppId) {
    setInstalled((prev) => uninstallApp(prev, id));
    close(id);
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

  const storePos: LiveWindow = {
    id: "tienda",
    x: 72,
    y: 96,
    z: 55,
    w: 320,
    h: 420,
    minimized: false,
  };

  return (
    <>
      <AppDock
        installedIds={installed}
        visibleIds={visibleIds}
        phone={phone}
        launcherOpen={phoneSheet !== null}
        onPick={pick}
        onOpenStore={() => setStoreOpen(true)}
        onToggleLauncher={() => setPhoneSheet((cur) => (cur === "launcher" ? null : "launcher"))}
        onToggleSwitcher={() => setPhoneSheet((cur) => (cur === "switcher" ? null : "switcher"))}
      />
      {phone && phoneSheet ? (
        <PhoneLauncher
          installedIds={installed}
          visibleIds={visibleIds}
          mode={phoneSheet}
          onPick={pick}
          onOpenStore={() => setStoreOpen(true)}
          onClose={() => setPhoneSheet(null)}
        />
      ) : null}
      {storeOpen ? (
        <DeskWindow
          id="tienda"
          title="tienda"
          phone={phone}
          pos={storePos}
          variant="app"
          minimized={false}
          onClose={() => setStoreOpen(false)}
          onFocus={() => {}}
          onMove={() => {}}
          onResize={() => {}}
        >
          <AppStorePane installed={installed} onInstall={doInstall} onUninstall={doUninstall} />
        </DeskWindow>
      ) : null}
      {order.map((id) => {
        if (!isAppInstalled(installed, id)) return null;
        const pos = positions.get(id) || {
          id,
          x: 64,
          y: 88,
          z: 40,
          w: APP_SEED[id].w,
          h: APP_SEED[id].h,
        };
        const label = RA_APPS.find((app) => app.id === id)?.label || id;
        const minimized = !!pos.minimized || (phone && active !== id);
        return (
          <DeskWindow
            key={id}
            id={id}
            title={label}
            phone={phone}
            pos={pos}
            variant="app"
            minimized={minimized}
            onClose={() => close(id)}
            onFocus={() => setWins((prev) => focusWindow(prev, id))}
            onMove={(x, y) => setWins((prev) => moveWindow(prev, id, x, y))}
            onResize={(next) => setWins((prev) => resizeWindow(prev, id, next))}
            onMinimize={phone ? undefined : () => setWins((prev) => minimizeWindow(prev, id))}
            onMaximize={phone ? undefined : () => setWins((prev) => toggleMaximizeWindow(prev, id))}
          >
            {pane(id)}
          </DeskWindow>
        );
      })}
    </>
  );
}
