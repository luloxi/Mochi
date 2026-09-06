import { NextRequest, NextResponse } from "next/server";
import { COMPANION_SESSION_COOKIE, restoreCompanionSession } from "@/lib/companion/auth";
import { helpSystemMessages, localHelpReply } from "@/lib/companion/chats";
import {
  cookSystemMessages,
  defaultKitchen,
  emptyProfile,
  localCookReply,
  parseCookMeals,
  parsePantryList,
  type ComidaProfile,
  type ComidaWho,
  type KitchenGear,
  type Recipe,
} from "@/lib/companion/comida";
import { completeLlmChat, completeLlmRound, pickLlmProvider, type LlmChatMessage } from "@/lib/companion/llm";
import { runNimboTurn } from "@/lib/companion/nimbo-agent";

export const runtime = "nodejs";

function sessionFrom(request: NextRequest) {
  return restoreCompanionSession(request.cookies.get(COMPANION_SESSION_COOKIE)?.value ?? null);
}

function asProfile(raw: unknown): ComidaProfile {
  const row = raw && typeof raw === "object" ? (raw as Partial<ComidaProfile>) : {};
  const base = emptyProfile(typeof row.name === "string" && row.name.trim() ? row.name.trim() : "vos");
  return {
    ...base,
    vegetarian: !!row.vegetarian,
    vegan: !!row.vegan,
    glutenFree: !!row.glutenFree,
    allergies: typeof row.allergies === "string" ? row.allergies : "",
    age: typeof row.age === "number" ? row.age : null,
    weightKg: typeof row.weightKg === "number" ? row.weightKg : null,
    heightCm: typeof row.heightCm === "number" ? row.heightCm : null,
  };
}

function asKitchen(raw: unknown): KitchenGear {
  const base = defaultKitchen();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Partial<KitchenGear>;
  return {
    burners: typeof row.burners === "number" && row.burners >= 0 ? Math.min(8, row.burners) : base.burners,
    oven: typeof row.oven === "boolean" ? row.oven : base.oven,
    electricOven: typeof row.electricOven === "boolean" ? row.electricOven : base.electricOven,
    electricSkillet: typeof row.electricSkillet === "boolean" ? row.electricSkillet : base.electricSkillet,
    airFryer: typeof row.airFryer === "boolean" ? row.airFryer : base.airFryer,
    extra: typeof row.extra === "string" ? row.extra : "",
  };
}

function cookHistory(raw: unknown): LlmChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as LlmChatMessage[])
    .filter((row) => row && (row.role === "user" || row.role === "assistant") && typeof row.content === "string")
    .slice(-8);
}

export async function POST(request: NextRequest) {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const text = typeof json?.text === "string" ? json.text.trim() : "";
  const kind = json?.kind === "help" ? "help" : json?.kind === "cook" ? "cook" : "nimbo";
  const image = typeof json?.image === "string" && json.image.startsWith("data:") ? json.image : "";
  if (!text && !(kind === "cook" && image)) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

  if (kind === "cook") {
    const ctx = json?.context && typeof json.context === "object" ? json.context : {};
    const profile = asProfile((ctx as { profile?: unknown }).profile);
    const kitchen = asKitchen((ctx as { kitchen?: unknown }).kitchen);
    const pantry = Array.isArray((ctx as { pantry?: unknown }).pantry)
      ? ((ctx as { pantry: unknown[] }).pantry).map((row) => String(row || "").trim()).filter(Boolean)
      : [];
    const recipe = ((ctx as { recipe?: Recipe | null }).recipe && typeof (ctx as { recipe?: unknown }).recipe === "object"
      ? (ctx as { recipe: Recipe }).recipe
      : null);
    const who: ComidaWho = (ctx as { who?: string }).who === "pareja" ? "pareja" : "vos";
    const job = json?.job === "pantry" || json?.job === "suggest" ? json.job : "chat";
    const history = cookHistory(json?.history);
    const pick = pickLlmProvider();
    let reply = localCookReply({
      text: text || "identificá ingredientes",
      profile,
      kitchen,
      recipe,
      assistantCount: history.filter((row) => row.role === "assistant").length,
    });
    let ingredients: string[] = [];
    let meals = parseCookMeals(reply, kitchen);

    if (pick.provider !== "none") {
      const userContent: LlmChatMessage["content"] = image
        ? [
            {
              type: "text",
              text:
                job === "pantry"
                  ? `${text || "Identificá los ingredientes de la foto."} Respondé JSON {"ingredients":["..."]}.`
                  : job === "suggest"
                    ? `${text || "Sugerí desayuno, almuerzo y cena."} JSON {"meals":[{"slot":"desayuno","title":"...","ingredients":["..."],"steps":["..."],"method":"hornalla","minutes":20}]}. Adaptá al equipo. Sin horno, no hornees.`
                    : text || "Ayudame a cocinar.",
            },
            { type: "image_url", image_url: { url: image } },
          ]
        : job === "suggest"
          ? `${text || "Sugerí desayuno, almuerzo y cena."} JSON {"meals":[{"slot":"desayuno","title":"...","ingredients":["..."],"steps":["..."],"method":"hornalla","minutes":20}]}. Adaptá al equipo. Sin horno, no hornees.`
          : job === "pantry"
            ? `${text || "Listá ingredientes."} JSON {"ingredients":["..."]}.`
            : text;
      const llm = await completeLlmRound(
        [
          ...cookSystemMessages({ who, profile, kitchen, pantry, recipe }),
          ...history,
          { role: "user", content: userContent },
        ],
        { maxTokens: 900, temperature: 0.5 },
      ).catch(() => ({ provider: pick.provider, text: "", toolCalls: [], rawMessage: null }));
      if (llm.text) reply = llm.text;
      if (job === "pantry") ingredients = parsePantryList(llm.text || text);
      if (job === "suggest") meals = parseCookMeals(llm.text || "", kitchen);
    } else if (job === "pantry") {
      ingredients = parsePantryList(text);
    }

    return NextResponse.json({
      reply,
      kind: "cook",
      did: job,
      provider: pick.provider,
      ingredients,
      meals,
    });
  }

  if (kind === "help") {
    let reply = localHelpReply(text, session.personId);
    const pick = pickLlmProvider();
    if (pick.provider !== "none") {
      const history = Array.isArray(json?.history)
        ? (json.history as LlmChatMessage[])
            .filter(
              (row) =>
                row &&
                (row.role === "user" || row.role === "assistant") &&
                typeof row.content === "string",
            )
            .slice(-8)
        : [];
      const llm = await completeLlmChat([
        ...helpSystemMessages(session.personId),
        ...history,
        { role: "user", content: text },
      ]).catch(() => ({ provider: pick.provider, text: "" as string }));
      if (llm.text) reply = llm.text;
    }
    return NextResponse.json({
      reply,
      kind: "help",
      did: "help",
      provider: pick.provider,
    });
  }

  const result = await runNimboTurn({
    text,
    history: Array.isArray(json?.history) ? json.history : [],
    seat: { token: session.trelloToken ?? null },
  });

  return NextResponse.json({
    reply: result.reply,
    board: result.board,
    did: result.did,
    intent: result.intent,
    provider: result.provider,
    openApp: result.openApp,
    usedTools: result.usedTools,
  });
}
