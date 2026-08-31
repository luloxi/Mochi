/**
 * Trello-like boards toward sacred Sueños.
 * Column = where; color = how it feels (Luciano scale).
 */

export type FeelColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export const FEEL_COLORS: Record<
  FeelColor,
  { hex: string; phrase: string; scale: "priority" | "off-scale"; label: string }
> = {
  red: { hex: "#e85d4c", phrase: "se pudre", scale: "priority", label: "rojo" },
  orange: { hex: "#f4a24c", phrase: "hay que hacerlo", scale: "priority", label: "naranja" },
  yellow: { hex: "#f2d35b", phrase: "idea/someday", scale: "priority", label: "amarillo" },
  green: { hex: "#6fbf73", phrase: "parked", scale: "priority", label: "verde" },
  blue: { hex: "#4c8ddb", phrase: "coordinar", scale: "off-scale", label: "azul" },
  purple: { hex: "#8a5cc8", phrase: "trámite", scale: "off-scale", label: "violeta" },
};

export const FEEL_COLOR_IDS: FeelColor[] = ["blue", "purple", "red", "orange", "yellow", "green"];

export function boardLegendLine(): string {
  return "rojo se pudre · naranja hay que hacerlo · amarillo idea/someday · verde parked · azul coordinar · violeta trámite";
}

export type BoardCard = {
  id: string;
  title: string;
  color: FeelColor;
  createdAt: string;
};

export type BoardColumn = {
  id: string;
  title: string;
  cards: BoardCard[];
};

export type Board = {
  id: string;
  title: string;
  columns: BoardColumn[];
};

function bid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function iso(now?: string): string {
  return now || new Date().toISOString();
}

export function emptyBoard(title: string): Board {
  return {
    id: bid("board"),
    title: title.trim() || "Sin nombre",
    columns: [
      { id: bid("col"), title: "Hoy", cards: [] },
      { id: bid("col"), title: "Esta semana", cards: [] },
    ],
  };
}

export function addBoard(boards: Board[], title: string): { boards: Board[]; board: Board } {
  const board = emptyBoard(title);
  return { boards: [...boards, board], board };
}

export function addColumn(board: Board, title: string): Board {
  const column: BoardColumn = {
    id: bid("col"),
    title: title.trim() || "Dónde",
    cards: [],
  };
  return { ...board, columns: [...board.columns, column] };
}

export function addCard(
  board: Board,
  columnId: string,
  title: string,
  color: FeelColor = "yellow",
): Board {
  const card: BoardCard = {
    id: bid("card"),
    title: title.trim() || "Sin título",
    color: FEEL_COLOR_IDS.includes(color) ? color : "yellow",
    createdAt: iso(),
  };
  return {
    ...board,
    columns: board.columns.map((col) =>
      col.id === columnId ? { ...col, cards: [...col.cards, card] } : col,
    ),
  };
}

export function parseFeelColor(raw: string | null | undefined): FeelColor | null {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "red" || t.includes("rojo") || t.includes("pudre")) return "red";
  if (t === "orange" || t.includes("naranja") || t.includes("hay que")) return "orange";
  if (t === "yellow" || t.includes("amarillo") || t.includes("someday") || t.includes("idea")) {
    return "yellow";
  }
  if (t === "green" || t.includes("verde") || t.includes("parked") || t.includes("park")) return "green";
  if (t === "blue" || t.includes("azul") || t.includes("coordinar")) return "blue";
  if (t === "purple" || t.includes("violeta") || t.includes("lila") || t.includes("trámite") || t.includes("tramite")) {
    return "purple";
  }
  return null;
}

/** Concrete work toward sacred Sueños — not a replacement for them. */
export function sampleSuenosBoard(): Board {
  return {
    id: "suenos-sample",
    title: "Hacia los Sueños",
    columns: [
      {
        id: "suenos-hoy",
        title: "Hoy",
        cards: [
          {
            id: "suenos-card-leg",
            title: "Turno / seguimiento de la pierna biónica izquierda",
            color: "red",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
        ],
      },
      {
        id: "suenos-semana",
        title: "Esta semana",
        cards: [
          {
            id: "suenos-card-coord",
            title: "Coordinar un mail claro (Elon / SpaceX), sin apuro feo",
            color: "blue",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "suenos-card-tramite",
            title: "Trámite del certificado para el camino de la pierna",
            color: "purple",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
        ],
      },
      {
        id: "suenos-someday",
        title: "Someday",
        cards: [
          {
            id: "suenos-card-neuralink",
            title: "Leer con calma sobre Neuralink — un paso, no el sueño entero",
            color: "yellow",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
        ],
      },
      {
        id: "suenos-parked",
        title: "Parked",
        cards: [
          {
            id: "suenos-card-park",
            title: "La maqueta de la pierna biónica: parked hasta que toque",
            color: "green",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
        ],
      },
    ],
  };
}

export function boardsMentionSuenos(boards: Board[]): boolean {
  const blob = boards
    .map((b) => `${b.title} ${b.columns.map((c) => c.cards.map((card) => card.title).join(" ")).join(" ")}`)
    .join(" ")
    .toLowerCase();
  const leg = blob.includes("pierna") && (blob.includes("bión") || blob.includes("bion"));
  const neuralink = blob.includes("neuralink");
  const spacex = blob.includes("spacex") || blob.includes("elon");
  return leg && neuralink && spacex;
}

export function applyBoardAction(
  boards: Board[],
  action: {
    action: "add-board" | "add-column" | "add-card" | "open";
    title?: string;
    color?: FeelColor;
    boardId?: string;
    columnId?: string;
  },
): Board[] {
  if (action.action === "open") return boards.length ? boards : [sampleSuenosBoard()];
  if (action.action === "add-board") {
    return addBoard(boards, action.title || "Tablero nuevo").boards;
  }
  const targetId = action.boardId || boards[0]?.id;
  if (!targetId) {
    const created = addBoard(boards, "Hacia los Sueños");
    return applyBoardAction(created.boards, { ...action, boardId: created.board.id });
  }
  return boards.map((board) => {
    if (board.id !== targetId) return board;
    if (action.action === "add-column") return addColumn(board, action.title || "Dónde");
    const columnId = action.columnId || board.columns[0]?.id;
    if (!columnId) return addColumn(board, "Hoy");
    return addCard(board, columnId, action.title || "Paso", action.color || "yellow");
  });
}
