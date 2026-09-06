import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CORE_INSTALLED_APPS,
  RA_APPS,
  installApp,
  isAppInstalled,
  resolveMiniappId,
  uninstallApp,
} from "./companion-core";
import {
  COOK_SOUL,
  RECIPE_BANK,
  adaptRecipe,
  b12Tip,
  buildPlan,
  cookShouldTipB12,
  defaultKitchen,
  dietOk,
  emptyProfile,
  extractJsonObject,
  kitchenLine,
  localCookReply,
  mealHourMatch,
  methodAvailable,
  nutrientTips,
  parsePantryList,
  recipesFor,
  suggestDay,
} from "./comida";

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres|invitade|invitades)\b/i;

describe("comida helpers", () => {
  it("installs from tienda and is not core", () => {
    assert.equal(RA_APPS.some((app) => app.id === "comida"), true);
    assert.equal(CORE_INSTALLED_APPS.includes("comida"), false);
    const installed = installApp(["boards"], "comida");
    assert.equal(isAppInstalled(installed, "comida"), true);
    assert.deepEqual(uninstallApp(installed, "comida"), ["boards"]);
    assert.equal(resolveMiniappId("recetas"), "comida");
  });

  it("drops oven recipes when there is no oven and respects vegan diet", () => {
    const vegan = { ...emptyProfile("vos"), vegan: true, vegetarian: true };
    const noOven = { ...defaultKitchen(), oven: false, electricOven: false };
    assert.equal(methodAvailable("horno", noOven), false);
    const lunch = recipesFor(vegan, noOven, "almuerzo");
    assert.ok(lunch.length > 0);
    assert.equal(lunch.every((row) => row.vegan), true);
    assert.equal(lunch.every((row) => row.method !== "horno"), true);
    assert.equal(
      lunch.some((row) => /milanesa|pollo|pescado|huevo|queso|yogur/i.test(row.title + row.ingredients.join(" "))),
      false,
    );
    const milanesa = RECIPE_BANK.find((row) => row.id === "milanesa-horno");
    assert.ok(milanesa);
    assert.equal(dietOk(milanesa!, vegan), false);
    const pizza = RECIPE_BANK.find((row) => row.id === "pizza-sarten");
    assert.ok(pizza);
    const adapted = adaptRecipe(pizza!, noOven, "cena");
    assert.ok(adapted);
    assert.notEqual(adapted!.method, "horno");
    assert.match(kitchenLine(noOven), /sin horno/);
  });

  it("tips B12 for veggie/vegan once, never as diagnosis", () => {
    const vegan = { ...emptyProfile("vos"), vegan: true, vegetarian: true };
    const omni = emptyProfile("pareja");
    assert.match(b12Tip(vegan) || "", /B12/);
    assert.equal(b12Tip(omni), null);
    assert.equal(cookShouldTipB12(vegan, 0, "hola"), true);
    assert.equal(cookShouldTipB12(vegan, 2, "¿sal?"), false);
    assert.equal(cookShouldTipB12(vegan, 4, "estoy cansado, vitamina?"), true);
    assert.equal(cookShouldTipB12(omni, 0, "hola"), false);
    const tips = nutrientTips(vegan, []);
    assert.ok(tips.some((row) => /B12/.test(row)));
    assert.ok(tips.some((row) => /no un diagnóstico médico/.test(row)));
    assert.equal(INCLUSIVE.test(COOK_SOUL), false);
    assert.equal(INCLUSIVE.test(tips.join(" ")), false);
    const reply = localCookReply({
      text: "hola",
      profile: vegan,
      kitchen: defaultKitchen(),
      recipe: null,
      assistantCount: 0,
    });
    assert.match(reply, /B12|cocinando|paso|Hola/i);
    assert.equal(INCLUSIVE.test(reply), false);
  });

  it("builds a multi-day plan and pantry list, and matches meal hour", () => {
    const profile = { ...emptyProfile("vos"), vegetarian: true, age: 30, weightKg: 70, heightCm: 170 };
    const plan = buildPlan({ profile, kitchen: defaultKitchen(), who: "vos", start: "2026-09-06", days: 3 });
    assert.equal(plan.length, 3);
    assert.equal(plan[0].meals.length, 3);
    assert.ok(plan.every((day) => day.meals.every((meal) => meal.recipe.vegetarian)));
    const day = suggestDay({ profile, kitchen: defaultKitchen(), day: "2026-09-06", nonce: 1 });
    assert.equal(day.length, 3);
    assert.deepEqual(
      parsePantryList('{"ingredients":["tomate","huevo","cebolla"]}'),
      ["tomate", "huevo", "cebolla"],
    );
    assert.ok(extractJsonObject("bla {\"ingredients\":[\"a\"]}"));
    const atEight = mealHourMatch({ desayuno: 8, almuerzo: 13, cena: 21 }, new Date(2026, 8, 6, 8, 15, 0));
    assert.equal(atEight, "desayuno");
    const quiet = mealHourMatch({ desayuno: 8, almuerzo: 13, cena: 21 }, new Date(2026, 8, 6, 11, 0, 0));
    assert.equal(quiet, null);
  });

  it("ships comida pane, store blurb and cook agent path", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const apps = readFileSync(join(here, "../../components/companion/companion-apps.tsx"), "utf8");
    const pane = readFileSync(join(here, "../../components/companion/comida-pane.tsx"), "utf8");
    const agent = readFileSync(join(here, "../../app/api/companion/agent/route.ts"), "utf8");
    const css = readFileSync(join(here, "../../app/companion/companion.css"), "utf8");
    assert.match(apps, /comida: \{ w: 360, h: 520 \}/);
    assert.match(apps, /recetas y cocina de a dos/);
    assert.match(apps, /<ComidaPane/);
    assert.match(pane, /data-miniapp="comida"/);
    assert.match(pane, /data-comida-tab=\{row.id\}/);
    assert.match(pane, /data-comida-banner/);
    assert.match(pane, /kind: "cook"/);
    assert.match(agent, /kind === "cook"/);
    assert.match(agent, /completeLlmRound/);
    assert.match(css, /\.comida-pane/);
    assert.doesNotMatch(pane, INCLUSIVE);
    assert.doesNotMatch(pane, /grok\.com/);
  });
});
