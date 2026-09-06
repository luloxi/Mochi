"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  COMIDA_WHOS,
  MEAL_SLOTS,
  METHOD_LABEL,
  SLOT_LABEL,
  b12Tip,
  bannerId,
  buildPlan,
  dayKey,
  dietLine,
  emptyComida,
  ensureTodaySuggestions,
  kitchenLine,
  loadComida,
  logEaten,
  mealHourMatch,
  mealsFromPantry,
  nutrientTips,
  parsePantryList,
  roughKcal,
  saveComida,
  saveToLibrary,
  setFavorite,
  suggestDay,
  uid,
  type ComidaState,
  type ComidaWho,
  type CookMsg,
  type MealSlot,
  type Recipe,
  type StarRating,
} from "@/lib/companion/comida";

type TabId =
  | "hoy"
  | "perfiles"
  | "cocina"
  | "heladera"
  | "cocinar"
  | "favoritos"
  | "historial"
  | "biblioteca"
  | "plan"
  | "tips";

const TABS: { id: TabId; label: string }[] = [
  { id: "hoy", label: "hoy" },
  { id: "perfiles", label: "perfiles" },
  { id: "cocina", label: "cocina" },
  { id: "heladera", label: "heladera" },
  { id: "cocinar", label: "cocinar" },
  { id: "favoritos", label: "favoritos" },
  { id: "historial", label: "historial" },
  { id: "biblioteca", label: "biblioteca" },
  { id: "plan", label: "plan" },
  { id: "tips", label: "tips" },
];

function Stars({
  value,
  onPick,
}: {
  value: StarRating | null;
  onPick: (n: StarRating) => void;
}) {
  return (
    <span className="comida-stars" role="group" aria-label="estrellas">
      {([1, 2, 3, 4, 5] as StarRating[]).map((n) => (
        <button
          key={n}
          type="button"
          className={value && value >= n ? "is-on" : ""}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          data-star={n}
          onClick={() => onPick(n)}
        >
          {value && value >= n ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

function RecipeCard({
  recipe,
  who,
  onCook,
  onFav,
  onLib,
  onEat,
  stars,
}: {
  recipe: Recipe;
  who: ComidaWho;
  onCook: () => void;
  onFav: (n: StarRating) => void;
  onLib: () => void;
  onEat: (n: StarRating | null) => void;
  stars: StarRating | null;
}) {
  return (
    <article className="comida-card" data-comida-recipe={recipe.id} data-slot={recipe.slot}>
      <header>
        <strong>{recipe.title}</strong>
        <span>
          {SLOT_LABEL[recipe.slot]} · {METHOD_LABEL[recipe.method]} · {recipe.minutes} min · {who}
        </span>
      </header>
      <p className="comida-k">ingredientes</p>
      <ul className="miniapp-list">
        {recipe.ingredients.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <p className="comida-k">receta</p>
      <ol className="comida-steps">
        {recipe.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="miniapp-row wrap">
        <button type="button" onClick={onCook}>
          cocinar
        </button>
        <button type="button" onClick={onLib}>
          guardar
        </button>
        <button type="button" onClick={() => onEat(stars)}>
          comí esto
        </button>
      </div>
      <Stars value={stars} onPick={onFav} />
    </article>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 768;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

type CookPayload = {
  reply?: string;
  ingredients?: string[];
  meals?: { slot: MealSlot; recipe: Recipe }[];
  provider?: string;
};

async function cookRequest(body: Record<string, unknown>): Promise<CookPayload | null> {
  try {
    const res = await fetch("/api/companion/agent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "cook", ...body }),
    });
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object") return null;
    return json as CookPayload;
  } catch {
    return null;
  }
}

export function ComidaPane() {
  const [state, setState] = useState<ComidaState>(() => ensureTodaySuggestions(emptyComida()));
  const [tab, setTab] = useState<TabId>("hoy");
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState("");
  const [pantryDraft, setPantryDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loaded = ensureTodaySuggestions(loadComida());
    saveComida(loaded);
    setState(loaded);
    setPantryDraft(loaded.pantry.join(", "));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.cookChat, tab]);

  const profile = state.profiles[state.who];
  const hourSlot = state.bannerOn ? mealHourMatch(state.hours, now) : null;
  const bannerKey = hourSlot ? bannerId(dayKey(now), hourSlot) : null;
  const showBanner = !!(hourSlot && bannerKey && state.dismissedBanner !== bannerKey);
  const favStars = (id: string) => state.favorites.find((row) => row.recipeId === id)?.stars ?? null;
  const tips = useMemo(() => nutrientTips(profile, state.history), [profile, state.history]);

  function patch(partial: Partial<ComidaState> | ((prev: ComidaState) => ComidaState)) {
    setState((prev) => {
      const next = typeof partial === "function" ? partial(prev) : { ...prev, ...partial };
      saveComida(next);
      return next;
    });
  }

  function setWho(who: ComidaWho) {
    patch((prev) =>
      ensureTodaySuggestions({
        ...prev,
        who,
        suggestionsDay: "",
      }),
    );
  }

  function regen(slot?: MealSlot) {
    patch((prev) => {
      const nonce = prev.suggestNonce + 1;
      const today = dayKey();
      const meals = suggestDay({
        profile: prev.profiles[prev.who],
        kitchen: prev.kitchen,
        day: today,
        nonce,
        pantry: prev.pantry,
      });
      const suggestions = slot
        ? prev.suggestions.map((row) => (row.slot === slot ? meals.find((m) => m.slot === slot) || row : row))
        : meals;
      return { ...prev, suggestNonce: nonce, suggestions, suggestionsDay: today };
    });
    void (async () => {
      const json = await cookRequest({
        job: "suggest",
        text: slot ? `regenerá ${slot}` : "sugerí el día",
        context: contextPayload(state),
      });
      if (!json?.meals?.length) return;
      patch((prev) => {
        const incoming = json.meals as { slot: MealSlot; recipe: Recipe }[];
        const suggestions = slot
          ? prev.suggestions.map((row) => incoming.find((m) => m.slot === slot) || row)
          : MEAL_SLOTS.map((s) => incoming.find((m) => m.slot === s) || prev.suggestions.find((m) => m.slot === s)).filter(
              Boolean,
            ) as { slot: MealSlot; recipe: Recipe }[];
        return { ...prev, suggestions, suggestionsDay: dayKey() };
      });
    })();
  }

  function openCook(recipe: Recipe) {
    patch({ activeRecipe: recipe });
    setTab("cocinar");
  }

  async function sendCook(text: string, image?: string) {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    const userLine = trimmed || (image ? "identificá lo de la foto" : "");
    const history = state.cookChat.slice(-8).map((row) => ({
      role: row.role === "user" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }));
    const mine: CookMsg = { id: uid("me"), role: "user", content: userLine };
    patch((prev) => ({ ...prev, cookChat: [...prev.cookChat, mine].slice(-40) }));
    setDraft("");
    setBusy(true);
    const json = await cookRequest({
      job: image ? "pantry" : "chat",
      text: userLine,
      image,
      history,
      context: contextPayload({ ...state, activeRecipe: state.activeRecipe }),
    });
    const reply =
      (typeof json?.reply === "string" && json.reply.trim()) ||
      "Después. Mientras tanto mirá los pasos de la receta.";
    const them: CookMsg = { id: uid("them"), role: "cook", content: reply };
    patch((prev) => {
      let pantry = prev.pantry;
      let pantryUpdatedAt = prev.pantryUpdatedAt;
      if (Array.isArray(json?.ingredients) && json.ingredients.length) {
        pantry = json.ingredients.map((row) => String(row)).filter(Boolean);
        pantryUpdatedAt = new Date().toISOString();
        setPantryDraft(pantry.join(", "));
      }
      return { ...prev, cookChat: [...prev.cookChat, them].slice(-40), pantry, pantryUpdatedAt };
    });
    setBusy(false);
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setNote("mirando la foto…");
    try {
      const data = await fileToDataUrl(file);
      setPreview(data);
      const json = await cookRequest({
        job: "pantry",
        text: "identificá ingredientes de la foto. JSON {\"ingredients\":[...]}",
        image: data,
        context: contextPayload(state),
      });
      const list =
        Array.isArray(json?.ingredients) && json.ingredients.length
          ? json.ingredients.map((row) => String(row)).filter(Boolean)
          : parsePantryList(typeof json?.reply === "string" ? json.reply : "");
      if (list.length) {
        setPantryDraft(list.join(", "));
        patch({ pantry: list, pantryUpdatedAt: new Date().toISOString() });
        setNote(`vi ${list.length} cosas`);
      } else {
        setNote("no pude leer la foto. Anotá a mano.");
      }
    } catch {
      setNote("no pude leer la foto. Anotá a mano.");
    }
    setBusy(false);
  }

  function savePantry() {
    const list = parsePantryList(pantryDraft);
    patch({ pantry: list, pantryUpdatedAt: new Date().toISOString() });
    setNote(list.length ? "heladera guardada" : "heladera vacía");
  }

  const pantryMeals = mealsFromPantry(profile, state.kitchen, state.pantry, 6);

  return (
    <div className="miniapp-body comida-pane" data-miniapp="comida">
      <p className="miniapp-kicker">comida</p>
      {showBanner && hourSlot ? (
        <div className="comida-banner" data-comida-banner={hourSlot} role="status">
          <span>
            Es la hora del {SLOT_LABEL[hourSlot]}. {state.suggestions.find((m) => m.slot === hourSlot)?.recipe.title || "¿Cocinamos?"}
          </span>
          <button
            type="button"
            onClick={() => patch({ dismissedBanner: bannerKey })}
          >
            ok
          </button>
        </div>
      ) : null}
      <div className="miniapp-row wrap comida-who" data-comida-who>
        {COMIDA_WHOS.map((who) => (
          <button key={who} type="button" className={state.who === who ? "is-on" : ""} onClick={() => setWho(who)}>
            {state.profiles[who].name}
          </button>
        ))}
      </div>
      <nav className="comida-tabs miniapp-row wrap" data-comida-tabs>
        {TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            className={tab === row.id ? "is-on" : ""}
            data-comida-tab={row.id}
            onClick={() => setTab(row.id)}
          >
            {row.label}
          </button>
        ))}
      </nav>

      {tab === "hoy" ? (
        <section data-comida-panel="hoy">
          <p className="talk-empty">
            {dietLine(profile)} · {kitchenLine(state.kitchen)}
          </p>
          <div className="miniapp-row wrap">
            <button type="button" onClick={() => regen()}>
              regenerar
            </button>
          </div>
          {MEAL_SLOTS.map((slot) => (
            <label key={slot} className="ra-field">
              hora {SLOT_LABEL[slot]}
              <input
                type="number"
                min={0}
                max={23}
                value={state.hours[slot]}
                aria-label={`hora ${slot}`}
                onChange={(event) =>
                  patch({
                    hours: { ...state.hours, [slot]: Math.min(23, Math.max(0, Number(event.target.value) || 0)) },
                  })
                }
              />
            </label>
          ))}
          <label className="comida-check">
            <input
              type="checkbox"
              checked={state.bannerOn}
              onChange={(event) => patch({ bannerOn: event.target.checked })}
            />
            banner a la hora (si está abierta)
          </label>
          {state.suggestions.map((meal) => (
            <div key={meal.slot}>
              <div className="miniapp-row wrap">
                <button type="button" onClick={() => regen(meal.slot)}>
                  regenerar {SLOT_LABEL[meal.slot]}
                </button>
              </div>
              <RecipeCard
                recipe={meal.recipe}
                who={state.who}
                stars={favStars(meal.recipe.id)}
                onCook={() => openCook(meal.recipe)}
                onFav={(n) => patch((prev) => setFavorite(prev, meal.recipe, n))}
                onLib={() => patch((prev) => saveToLibrary(prev, meal.recipe))}
                onEat={(n) => patch((prev) => logEaten(prev, meal.recipe, prev.who, n))}
              />
            </div>
          ))}
        </section>
      ) : null}

      {tab === "perfiles" ? (
        <section data-comida-panel="perfiles">
          {COMIDA_WHOS.map((who) => {
            const p = state.profiles[who];
            return (
              <div key={who} className="comida-card">
                <strong>{who}</strong>
                <label className="ra-field">
                  nombre
                  <input
                    value={p.name}
                    aria-label={`nombre ${who}`}
                    onChange={(event) =>
                      patch({
                        profiles: { ...state.profiles, [who]: { ...p, name: event.target.value } },
                      })
                    }
                  />
                </label>
                <label className="comida-check">
                  <input
                    type="checkbox"
                    checked={p.vegetarian}
                    onChange={(event) =>
                      patch((prev) => {
                        const nextP = { ...prev.profiles[who], vegetarian: event.target.checked, vegan: event.target.checked ? prev.profiles[who].vegan : false };
                        if (!event.target.checked) nextP.vegan = false;
                        return ensureTodaySuggestions({ ...prev, profiles: { ...prev.profiles, [who]: nextP }, suggestionsDay: "" });
                      })
                    }
                  />
                  vegetariano
                </label>
                <label className="comida-check">
                  <input
                    type="checkbox"
                    checked={p.vegan}
                    onChange={(event) =>
                      patch((prev) => {
                        const nextP = {
                          ...prev.profiles[who],
                          vegan: event.target.checked,
                          vegetarian: event.target.checked ? true : prev.profiles[who].vegetarian,
                        };
                        return ensureTodaySuggestions({ ...prev, profiles: { ...prev.profiles, [who]: nextP }, suggestionsDay: "" });
                      })
                    }
                  />
                  vegano
                </label>
                <label className="comida-check">
                  <input
                    type="checkbox"
                    checked={p.glutenFree}
                    onChange={(event) =>
                      patch((prev) =>
                        ensureTodaySuggestions({
                          ...prev,
                          profiles: { ...prev.profiles, [who]: { ...prev.profiles[who], glutenFree: event.target.checked } },
                          suggestionsDay: "",
                        }),
                      )
                    }
                  />
                  sin gluten
                </label>
                <label className="ra-field">
                  alergias
                  <input
                    value={p.allergies}
                    placeholder="maní, lácteos…"
                    aria-label={`alergias ${who}`}
                    onChange={(event) =>
                      patch((prev) =>
                        ensureTodaySuggestions({
                          ...prev,
                          profiles: {
                            ...prev.profiles,
                            [who]: { ...prev.profiles[who], allergies: event.target.value },
                          },
                          suggestionsDay: "",
                        }),
                      )
                    }
                  />
                </label>
                <div className="miniapp-row wrap">
                  <label className="ra-field">
                    edad
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={p.age ?? ""}
                      aria-label={`edad ${who}`}
                      onChange={(event) =>
                        patch({
                          profiles: {
                            ...state.profiles,
                            [who]: { ...p, age: event.target.value === "" ? null : Number(event.target.value) },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="ra-field">
                    peso kg
                    <input
                      type="number"
                      min={20}
                      max={250}
                      value={p.weightKg ?? ""}
                      aria-label={`peso ${who}`}
                      onChange={(event) =>
                        patch({
                          profiles: {
                            ...state.profiles,
                            [who]: { ...p, weightKg: event.target.value === "" ? null : Number(event.target.value) },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="ra-field">
                    altura cm
                    <input
                      type="number"
                      min={80}
                      max={230}
                      value={p.heightCm ?? ""}
                      aria-label={`altura ${who}`}
                      onChange={(event) =>
                        patch({
                          profiles: {
                            ...state.profiles,
                            [who]: { ...p, heightCm: event.target.value === "" ? null : Number(event.target.value) },
                          },
                        })
                      }
                    />
                  </label>
                </div>
                {b12Tip(p) ? <p className="talk-empty">{b12Tip(p)}</p> : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {tab === "cocina" ? (
        <section data-comida-panel="cocina">
          <p className="talk-empty">Las recetas se adaptan a lo que hay. Sin horno, no horneamos.</p>
          <label className="ra-field">
            hornallas
            <input
              type="number"
              min={0}
              max={8}
              value={state.kitchen.burners}
              aria-label="hornallas"
              onChange={(event) =>
                patch((prev) =>
                  ensureTodaySuggestions({
                    ...prev,
                    kitchen: { ...prev.kitchen, burners: Math.min(8, Math.max(0, Number(event.target.value) || 0)) },
                    suggestionsDay: "",
                  }),
                )
              }
            />
          </label>
          {(
            [
              ["oven", "horno"],
              ["electricOven", "horno eléctrico"],
              ["electricSkillet", "sartén eléctrica"],
              ["airFryer", "freidora de aire"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="comida-check">
              <input
                type="checkbox"
                checked={!!state.kitchen[key]}
                onChange={(event) =>
                  patch((prev) =>
                    ensureTodaySuggestions({
                      ...prev,
                      kitchen: { ...prev.kitchen, [key]: event.target.checked },
                      suggestionsDay: "",
                    }),
                  )
                }
              />
              {label}
            </label>
          ))}
          <label className="ra-field">
            extra
            <input
              value={state.kitchen.extra}
              placeholder="microondas, olla…"
              aria-label="equipo extra"
              onChange={(event) => patch({ kitchen: { ...state.kitchen, extra: event.target.value } })}
            />
          </label>
          <p className="talk-empty">{kitchenLine(state.kitchen)}</p>
        </section>
      ) : null}

      {tab === "heladera" ? (
        <section data-comida-panel="heladera">
          <p className="talk-empty">Foto de la heladera o del súper, o anotálos.</p>
          <label className="comida-file">
            foto
            <input type="file" accept="image/*" capture="environment" aria-label="foto heladera" onChange={onPhoto} />
          </label>
          {preview ? <img className="comida-preview" src={preview} alt="heladera" /> : null}
          <label className="ra-field">
            lo que hay
            <textarea
              rows={4}
              value={pantryDraft}
              aria-label="inventario heladera"
              onChange={(event) => setPantryDraft(event.target.value)}
            />
          </label>
          <div className="miniapp-row wrap">
            <button type="button" onClick={savePantry} disabled={busy}>
              guardar
            </button>
          </div>
          {note ? <p className="talk-empty">{note}</p> : null}
          {state.pantryUpdatedAt ? (
            <p className="talk-empty">última lista {state.pantryUpdatedAt.slice(0, 16).replace("T", " ")}</p>
          ) : null}
          {pantryMeals.length ? (
            <>
              <p className="comida-k">con esto podés</p>
              {pantryMeals.map((recipe) => (
                <RecipeCard
                  key={`${recipe.id}-${recipe.slot}`}
                  recipe={recipe}
                  who={state.who}
                  stars={favStars(recipe.id)}
                  onCook={() => openCook(recipe)}
                  onFav={(n) => patch((prev) => setFavorite(prev, recipe, n))}
                  onLib={() => patch((prev) => saveToLibrary(prev, recipe))}
                  onEat={(n) => patch((prev) => logEaten(prev, recipe, prev.who, n))}
                />
              ))}
            </>
          ) : (
            <p className="talk-empty">guardá ingredientes y te armo platos.</p>
          )}
        </section>
      ) : null}

      {tab === "cocinar" ? (
        <section className="comida-cook" data-comida-panel="cocinar">
          {state.activeRecipe ? (
            <p className="talk-empty">
              {state.activeRecipe.title} · {METHOD_LABEL[state.activeRecipe.method]}
            </p>
          ) : (
            <p className="talk-empty">Elegí un plato de hoy o preguntá.</p>
          )}
          <div className="talk-log comida-log" ref={logRef} data-comida-chat>
            {state.cookChat.length === 0 ? <p className="talk-empty">¿En qué paso estás?</p> : null}
            {state.cookChat.map((row) => (
              <p key={row.id} className={`talk-line ${row.role === "user" ? "from-me" : "from-them"}`}>
                {row.content}
              </p>
            ))}
            {busy ? <p className="talk-empty">cocinando la respuesta…</p> : null}
          </div>
          <form
            className="miniapp-add"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCook(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="preguntale…"
              aria-label="mensaje cocina"
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              ok
            </button>
          </form>
        </section>
      ) : null}

      {tab === "favoritos" ? (
        <section data-comida-panel="favoritos">
          {state.favorites.length === 0 ? <p className="talk-empty">nada todavía. Poné estrellas en un plato.</p> : null}
          <ul className="miniapp-list">
            {state.favorites.map((row) => (
              <li key={row.recipeId}>
                {row.title} {"★".repeat(row.stars)}
                <Stars
                  value={row.stars}
                  onPick={(n) =>
                    patch((prev) => setFavorite(prev, { id: row.recipeId, title: row.title }, n))
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "historial" ? (
        <section data-comida-panel="historial">
          {state.history.length === 0 ? <p className="talk-empty">cuando marques “comí esto”, aparece acá.</p> : null}
          <ul className="miniapp-list">
            {state.history.map((row) => (
              <li key={row.id} data-comida-history={row.id}>
                {row.at.slice(0, 10)} · {row.title} · {row.who}
                {row.rating ? ` · ${"★".repeat(row.rating)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "biblioteca" ? (
        <section data-comida-panel="biblioteca">
          {state.library.length === 0 ? <p className="talk-empty">guardá los que te gustaron para repetirlos.</p> : null}
          {state.library.map((row) => (
            <RecipeCard
              key={row.id}
              recipe={row.recipe}
              who={state.who}
              stars={favStars(row.recipe.id)}
              onCook={() => openCook(row.recipe)}
              onFav={(n) => patch((prev) => setFavorite(prev, row.recipe, n))}
              onLib={() => {}}
              onEat={(n) => patch((prev) => logEaten(prev, row.recipe, prev.who, n))}
            />
          ))}
        </section>
      ) : null}

      {tab === "plan" ? (
        <section data-comida-panel="plan">
          <p className="talk-empty">
            Plan para {profile.name}. {dietLine(profile)}
            {roughKcal(profile) ? ` · ~${roughKcal(profile)} kcal/día (estimación, no es receta médica)` : ""}
          </p>
          <div className="miniapp-row wrap">
            <button
              type="button"
              onClick={() => patch({ plan: buildPlan({ profile, kitchen: state.kitchen, who: state.who, start: dayKey(), days: 3 }) })}
            >
              3 días
            </button>
            <button
              type="button"
              onClick={() => patch({ plan: buildPlan({ profile, kitchen: state.kitchen, who: state.who, start: dayKey(), days: 7 }) })}
            >
              7 días
            </button>
          </div>
          {state.plan.map((day) => (
            <div key={day.date} className="comida-card">
              <strong>{day.date}</strong>
              {day.meals.map((meal) => (
                <p key={meal.slot} className="talk-empty">
                  {SLOT_LABEL[meal.slot]}: {meal.recipe.title} ({METHOD_LABEL[meal.recipe.method]})
                </p>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {tab === "tips" ? (
        <section data-comida-panel="tips">
          <ul className="miniapp-list">
            {tips.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function contextPayload(state: ComidaState) {
  return {
    who: state.who,
    profile: state.profiles[state.who],
    kitchen: state.kitchen,
    pantry: state.pantry,
    recipe: state.activeRecipe,
  };
}
