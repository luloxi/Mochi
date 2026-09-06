/**
 * Comida miniapp: diets, kitchen gear, daily meals, cook chat.
 * Local-first (localStorage). LLM is optional via /api/companion/agent.
 */

import { COMPANION_STORAGE } from "./companion-core";

export const COMIDA_STORAGE = COMPANION_STORAGE.comida;

export type ComidaWho = "vos" | "pareja";
export type MealSlot = "desayuno" | "almuerzo" | "cena";
export type CookMethod = "hornalla" | "horno" | "sarten-electrica" | "freidora" | "crudo";
export type StarRating = 1 | 2 | 3 | 4 | 5;

export type ComidaProfile = {
  name: string;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  allergies: string;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
};

export type KitchenGear = {
  burners: number;
  oven: boolean;
  electricOven: boolean;
  electricSkillet: boolean;
  airFryer: boolean;
  extra: string;
};

export type RecipeVariant = {
  method: CookMethod;
  steps: string[];
};

export type RecipeSeed = {
  id: string;
  title: string;
  slots: MealSlot[];
  ingredients: string[];
  variants: RecipeVariant[];
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  minutes: number;
  kcal: number;
};

export type Recipe = {
  id: string;
  title: string;
  slot: MealSlot;
  ingredients: string[];
  steps: string[];
  method: CookMethod;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  minutes: number;
  kcal: number;
};

export type DayMeal = {
  slot: MealSlot;
  recipe: Recipe;
};

export type Favorite = {
  recipeId: string;
  title: string;
  stars: StarRating;
  savedAt: string;
};

export type HistoryEntry = {
  id: string;
  at: string;
  title: string;
  rating: StarRating | null;
  who: ComidaWho;
  recipeId?: string;
};

export type LibraryEntry = {
  id: string;
  recipe: Recipe;
  savedAt: string;
};

export type PlanDay = {
  date: string;
  who: ComidaWho;
  meals: DayMeal[];
};

export type CookMsg = {
  id: string;
  role: "user" | "cook";
  content: string;
};

export type ComidaState = {
  profiles: Record<ComidaWho, ComidaProfile>;
  kitchen: KitchenGear;
  hours: Record<MealSlot, number>;
  bannerOn: boolean;
  dismissedBanner: string | null;
  who: ComidaWho;
  suggestNonce: number;
  suggestions: DayMeal[];
  suggestionsDay: string;
  pantry: string[];
  pantryUpdatedAt: string | null;
  favorites: Favorite[];
  history: HistoryEntry[];
  library: LibraryEntry[];
  plan: PlanDay[];
  cookChat: CookMsg[];
  activeRecipe: Recipe | null;
};

export const MEAL_SLOTS: MealSlot[] = ["desayuno", "almuerzo", "cena"];
export const COMIDA_WHOS: ComidaWho[] = ["vos", "pareja"];

export const METHOD_LABEL: Record<CookMethod, string> = {
  hornalla: "hornalla",
  horno: "horno",
  "sarten-electrica": "sartén eléctrica",
  freidora: "freidora de aire",
  crudo: "sin fuego",
};

export const SLOT_LABEL: Record<MealSlot, string> = {
  desayuno: "desayuno",
  almuerzo: "almuerzo",
  cena: "cena",
};

export const COOK_SOUL = `Sos el ayudante de cocina de Comida, miniapp de Compañera.
Hablás en español rioplatense (vos, che, dale). Pasos cortos y claros.
No uses lenguaje inclusivo. Nada de esas formas raras.
Katho es ella. Lulox es él. Los dos.
Ayudá a cocinar: orden, tiempos, sustituciones. Adaptá al equipo que hay (hornallas, horno, horno eléctrico, sartén eléctrica, freidora de aire).
Si no hay horno, no pidas hornear. Si no hay hornallas, usá sartén eléctrica, freidora o crudo.
Si la persona es vegetariana o vegana, un tip suave de B12 solo cuando venga al caso (cansancio, dieta, primera charla). No en cada mensaje.
Los tips de nutrientes son tips de cocina, no un diagnóstico médico.
No digas que sos Grok ni Chano. No mandes a nadie a otro sitio.`;

const INCLUSIVE = /\b(todes|todxs|ellxs|elles|amigues|nosotres|invitade|invitades)\b/i;

export function emptyProfile(name: string): ComidaProfile {
  return {
    name,
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    allergies: "",
    age: null,
    weightKg: null,
    heightCm: null,
  };
}

export function defaultKitchen(): KitchenGear {
  return {
    burners: 4,
    oven: true,
    electricOven: false,
    electricSkillet: false,
    airFryer: false,
    extra: "",
  };
}

export function defaultHours(): Record<MealSlot, number> {
  return { desayuno: 8, almuerzo: 13, cena: 21 };
}

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function uid(prefix = "c"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function methodAvailable(method: CookMethod, kitchen: KitchenGear): boolean {
  if (method === "crudo") return true;
  if (method === "hornalla") return kitchen.burners > 0;
  if (method === "horno") return kitchen.oven || kitchen.electricOven;
  if (method === "sarten-electrica") return kitchen.electricSkillet;
  if (method === "freidora") return kitchen.airFryer;
  return false;
}

export function kitchenLine(kitchen: KitchenGear): string {
  const bits: string[] = [];
  bits.push(`${kitchen.burners} hornalla${kitchen.burners === 1 ? "" : "s"}`);
  if (kitchen.oven) bits.push("horno");
  if (kitchen.electricOven) bits.push("horno eléctrico");
  if (kitchen.electricSkillet) bits.push("sartén eléctrica");
  if (kitchen.airFryer) bits.push("freidora de aire");
  if (kitchen.extra.trim()) bits.push(kitchen.extra.trim());
  if (!kitchen.oven && !kitchen.electricOven) bits.push("sin horno");
  if (kitchen.burners <= 0) bits.push("sin hornallas");
  return bits.join(", ");
}

function allergyHits(ingredients: string[], allergies: string): boolean {
  const tokens = allergies
    .toLowerCase()
    .split(/[,;/]+/)
    .map((row) => row.trim())
    .filter((row) => row.length > 2);
  if (!tokens.length) return false;
  const blob = ingredients.join(" ").toLowerCase();
  return tokens.some((token) => blob.includes(token));
}

export function dietOk(seed: Pick<RecipeSeed, "vegetarian" | "vegan" | "glutenFree" | "ingredients">, profile: ComidaProfile): boolean {
  if (profile.vegan && !seed.vegan) return false;
  if (profile.vegetarian && !profile.vegan && !seed.vegetarian) return false;
  if (profile.glutenFree && !seed.glutenFree) return false;
  if (allergyHits(seed.ingredients, profile.allergies)) return false;
  return true;
}

export function adaptRecipe(seed: RecipeSeed, kitchen: KitchenGear, slot: MealSlot): Recipe | null {
  if (!seed.slots.includes(slot)) return null;
  const variant = seed.variants.find((row) => methodAvailable(row.method, kitchen));
  if (!variant) return null;
  return {
    id: seed.id,
    title: seed.title,
    slot,
    ingredients: [...seed.ingredients],
    steps: [...variant.steps],
    method: variant.method,
    vegetarian: seed.vegetarian,
    vegan: seed.vegan,
    glutenFree: seed.glutenFree,
    minutes: seed.minutes,
    kcal: seed.kcal,
  };
}

export function b12Tip(profile: ComidaProfile): string | null {
  if (!profile.vegan && !profile.vegetarian) return null;
  const who = profile.name.trim() || "esta dieta";
  return `Tip suave para ${who}: en dieta veggie o vegana, un poco de B12 (fortificados o suplemento) viene bien. Es un tip de cocina, no un diagnóstico médico.`;
}

export function cookShouldTipB12(profile: ComidaProfile, assistantCount: number, userText: string): boolean {
  if (!profile.vegetarian && !profile.vegan) return false;
  if (/\b(b12|b 12|vitamina|cansad|energ[ií]a|anem)\b/i.test(userText)) return true;
  return assistantCount === 0;
}

export function roughKcal(profile: ComidaProfile): number | null {
  if (profile.age == null || profile.weightKg == null || profile.heightCm == null) return null;
  if (profile.age <= 0 || profile.weightKg <= 0 || profile.heightCm <= 0) return null;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 78;
  return Math.max(1200, Math.round(bmr * 1.4));
}

export const RECIPE_BANK: RecipeSeed[] = [
  {
    id: "avena-fruta",
    title: "Avena con fruta",
    slots: ["desayuno"],
    ingredients: ["avena", "leche o bebida vegetal", "banana", "semillas"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 8,
    kcal: 380,
    variants: [
      {
        method: "crudo",
        steps: [
          "Mezclá avena con bebida vegetal fría.",
          "Dejá 5 minutos hidratar.",
          "Sumá banana en rodajas y semillas.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Calentá avena con bebida vegetal a fuego bajo 5 minutos.",
          "Revolvé para que no se pegue.",
          "Serví con banana y semillas.",
        ],
      },
    ],
  },
  {
    id: "smoothie-banana",
    title: "Smoothie de banana",
    slots: ["desayuno"],
    ingredients: ["banana", "avena", "bebida vegetal", "mantequilla de maní"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 5,
    kcal: 340,
    variants: [
      {
        method: "crudo",
        steps: [
          "Tirás banana, avena y bebida vegetal a la licuadora.",
          "Sumá una cucharada de mantequilla de maní.",
          "Licuá y listo.",
        ],
      },
    ],
  },
  {
    id: "huevos-revueltos",
    title: "Huevos revueltos",
    slots: ["desayuno", "cena"],
    ingredients: ["huevos", "sal", "aceite o manteca", "pan opcional"],
    vegetarian: true,
    vegan: false,
    glutenFree: true,
    minutes: 10,
    kcal: 320,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Batí los huevos con una pizca de sal.",
          "Calentá una sartén con un chorrito de aceite.",
          "Revolvé a fuego medio hasta que estén cremosos.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Batí los huevos.",
          "Sartén eléctrica al medio, un poco de aceite.",
          "Revolvé hasta que cuajen.",
        ],
      },
    ],
  },
  {
    id: "yogur-granola",
    title: "Yogur con fruta",
    slots: ["desayuno"],
    ingredients: ["yogur", "fruta", "semillas", "miel opcional"],
    vegetarian: true,
    vegan: false,
    glutenFree: true,
    minutes: 5,
    kcal: 300,
    variants: [
      {
        method: "crudo",
        steps: [
          "Poné yogur en un bowl.",
          "Sumá fruta picada y semillas.",
          "Un chorrito de miel si te copa.",
        ],
      },
    ],
  },
  {
    id: "tostadas-palta",
    title: "Tostadas con palta",
    slots: ["desayuno", "almuerzo"],
    ingredients: ["pan", "palta", "limón", "sal", "semillas"],
    vegetarian: true,
    vegan: true,
    glutenFree: false,
    minutes: 8,
    kcal: 360,
    variants: [
      {
        method: "crudo",
        steps: [
          "Machacá la palta con limón y sal.",
          "Untá el pan.",
          "Semillas arriba.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Tostá el pan en la sartén.",
          "Machacá palta con limón y sal.",
          "Untá y listo.",
        ],
      },
    ],
  },
  {
    id: "ensalada-garbanzos",
    title: "Ensalada de garbanzos",
    slots: ["almuerzo"],
    ingredients: ["garbanzos", "tomate", "cebolla", "limón", "aceite de oliva", "perejil"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 12,
    kcal: 420,
    variants: [
      {
        method: "crudo",
        steps: [
          "Escurrí los garbanzos.",
          "Picá tomate y cebolla.",
          "Aliñá con limón, aceite y perejil.",
        ],
      },
    ],
  },
  {
    id: "guiso-lentejas",
    title: "Guiso de lentejas",
    slots: ["almuerzo", "cena"],
    ingredients: ["lentejas", "cebolla", "zanahoria", "ajo", "tomate", "comino", "agua"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 40,
    kcal: 480,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Rehogá cebolla, ajo y zanahoria 5 minutos.",
          "Sumá lentejas, tomate, comino y agua.",
          "Fuego bajo 30 minutos hasta que estén tiernas.",
        ],
      },
    ],
  },
  {
    id: "arroz-verduras",
    title: "Arroz salteado de verduras",
    slots: ["almuerzo", "cena"],
    ingredients: ["arroz", "zanahoria", "morrón", "cebolla", "soja o sal", "aceite"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 25,
    kcal: 450,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Cociná el arroz.",
          "Salteá verduras en la sartén.",
          "Mezclá todo con un chorrito de soja o sal.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Usá arroz ya cocido si lo tenés.",
          "Sartén eléctrica bien caliente, verduras primero.",
          "Sumá el arroz y mezclá.",
        ],
      },
    ],
  },
  {
    id: "pasta-pesto",
    title: "Pasta al pesto",
    slots: ["almuerzo", "cena"],
    ingredients: ["pasta", "albahaca o pesto", "ajo", "aceite", "queso opcional"],
    vegetarian: true,
    vegan: false,
    glutenFree: false,
    minutes: 20,
    kcal: 520,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Herví la pasta al dente.",
          "Mezclá con pesto o albahaca, ajo y aceite.",
          "Queso arriba si te gusta.",
        ],
      },
    ],
  },
  {
    id: "tacos-porotos",
    title: "Tacos de porotos",
    slots: ["almuerzo", "cena"],
    ingredients: ["tortillas de maíz", "porotos", "cebolla", "tomate", "cilantro o perejil", "limón"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 20,
    kcal: 470,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Calentá los porotos con cebolla.",
          "Calentá las tortillas.",
          "Armá con tomate, verdeo y limón.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Calentá porotos y tortillas en la sartén eléctrica.",
          "Armá los tacos con tomate y limón.",
        ],
      },
    ],
  },
  {
    id: "tofu-salteado",
    title: "Tofu salteado",
    slots: ["almuerzo", "cena"],
    ingredients: ["tofu", "brócoli", "ajo", "soja", "aceite de sésamo o común", "arroz"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 25,
    kcal: 430,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Secá el tofu y cortalo en cubos.",
          "Dorá en sartén, sumá ajo y brócoli.",
          "Un chorrito de soja. Serví con arroz.",
        ],
      },
      {
        method: "freidora",
        steps: [
          "Tofu en cubos a la freidora 10 minutos.",
          "Salteá brócoli aparte o también en la freidora.",
          "Mezclá con soja y arroz.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Dorá tofu en la sartén eléctrica.",
          "Sumá verdura y soja.",
        ],
      },
    ],
  },
  {
    id: "milanesa-horno",
    title: "Milanesa al horno",
    slots: ["almuerzo", "cena"],
    ingredients: ["milanesa de carne o pollo", "pan rallado", "huevo", "limón", "ensalada"],
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    minutes: 30,
    kcal: 560,
    variants: [
      {
        method: "horno",
        steps: [
          "Horno a 200. Milanesas en placa con un chorrito de aceite.",
          "20 minutos, dadas vuelta a la mitad.",
          "Limón y ensalada.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Sartén con un poco de aceite, fuego medio.",
          "3–4 minutos por lado.",
          "Escurrí y serví con limón.",
        ],
      },
      {
        method: "freidora",
        steps: [
          "Freidora 180, 12 minutos, dadas vuelta.",
          "Limón al final.",
        ],
      },
    ],
  },
  {
    id: "pizza-sarten",
    title: "Pizza rápida",
    slots: ["cena"],
    ingredients: ["base de pizza o pan pita", "salsa de tomate", "queso", "orégano"],
    vegetarian: true,
    vegan: false,
    glutenFree: false,
    minutes: 18,
    kcal: 540,
    variants: [
      {
        method: "horno",
        steps: [
          "Horno fuerte. Base con salsa y queso.",
          "8–12 minutos hasta que gratine.",
          "Orégano al salir.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Base en la sartén eléctrica con tapa.",
          "Salsa y queso. Fuego medio hasta que funda.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Sartén con tapa. Base, salsa, queso.",
          "Fuego bajo 8 minutos.",
        ],
      },
    ],
  },
  {
    id: "sopa-verduras",
    title: "Sopa de verduras",
    slots: ["cena"],
    ingredients: ["papa", "zanahoria", "cebolla", "zapallo o calabaza", "caldo", "sal"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 35,
    kcal: 280,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Rehogá cebolla.",
          "Sumá verduras en cubos y caldo.",
          "20–25 minutos. Machacá un poco si la querés cremosa.",
        ],
      },
    ],
  },
  {
    id: "tortilla-papas",
    title: "Tortilla de papas",
    slots: ["almuerzo", "cena"],
    ingredients: ["papas", "huevos", "cebolla", "aceite", "sal"],
    vegetarian: true,
    vegan: false,
    glutenFree: true,
    minutes: 35,
    kcal: 490,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Freí o salteá papas y cebolla hasta que estén blandas.",
          "Mezclá con huevos batidos.",
          "Cuajá de los dos lados a fuego medio.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Papas y cebolla en la sartén eléctrica.",
          "Huevos, tapa, y das vuelta con un plato.",
        ],
      },
    ],
  },
  {
    id: "frittata-verduras",
    title: "Frittata de verduras",
    slots: ["cena"],
    ingredients: ["huevos", "espinaca", "cebolla", "queso opcional", "sal"],
    vegetarian: true,
    vegan: false,
    glutenFree: true,
    minutes: 25,
    kcal: 380,
    variants: [
      {
        method: "horno",
        steps: [
          "Rehogá verduras. Mezclá con huevos.",
          "Horno 180, 15 minutos.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Verduras en sartén, huevos arriba, tapa.",
          "Fuego bajo 10 minutos. No hace falta horno.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Misma idea en sartén eléctrica con tapa.",
        ],
      },
    ],
  },
  {
    id: "bowl-quinoa",
    title: "Bowl de quinoa",
    slots: ["almuerzo"],
    ingredients: ["quinoa", "garbanzos", "palta", "tomate", "limón", "hojas verdes"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 25,
    kcal: 460,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Herví la quinoa 15 minutos.",
          "Armá el bowl con garbanzos, palta y tomate.",
          "Limón y listo.",
        ],
      },
    ],
  },
  {
    id: "hamburguesa-lentejas",
    title: "Hamburguesa de lentejas",
    slots: ["almuerzo", "cena"],
    ingredients: ["lentejas cocidas", "avena", "cebolla", "comino", "pan o lechuga"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 25,
    kcal: 440,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Machacá lentejas con avena, cebolla y comino.",
          "Formá medallones y dorá 4 minutos por lado.",
          "Pan o lechuga para armar.",
        ],
      },
      {
        method: "freidora",
        steps: [
          "Armá medallones.",
          "Freidora 180, 10 minutos.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Dorá los medallones en la sartén eléctrica.",
        ],
      },
    ],
  },
  {
    id: "wrap-hummus",
    title: "Wrap de hummus",
    slots: ["almuerzo"],
    ingredients: ["tortilla", "hummus", "pepino", "tomate", "hojas verdes"],
    vegetarian: true,
    vegan: true,
    glutenFree: false,
    minutes: 10,
    kcal: 390,
    variants: [
      {
        method: "crudo",
        steps: [
          "Untá hummus en la tortilla.",
          "Sumá pepino, tomate y hojas.",
          "Enrollá y cortá al medio.",
        ],
      },
    ],
  },
  {
    id: "pollo-limon",
    title: "Pollo al limón",
    slots: ["almuerzo", "cena"],
    ingredients: ["pollo", "limón", "ajo", "orégano", "aceite", "sal"],
    vegetarian: false,
    vegan: false,
    glutenFree: true,
    minutes: 30,
    kcal: 430,
    variants: [
      {
        method: "horno",
        steps: [
          "Pollo con limón, ajo y orégano.",
          "Horno 200, 25 minutos.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Dorá el pollo en sartén.",
          "Tapá 15 minutos a fuego medio con limón y ajo.",
        ],
      },
      {
        method: "freidora",
        steps: [
          "Freidora 190, 18 minutos.",
          "Limón al final.",
        ],
      },
    ],
  },
  {
    id: "pescado-simple",
    title: "Pescado a la plancha",
    slots: ["cena"],
    ingredients: ["filet de pescado", "limón", "ajo", "aceite", "sal", "ensalada"],
    vegetarian: false,
    vegan: false,
    glutenFree: true,
    minutes: 18,
    kcal: 360,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Sartén caliente con un poco de aceite.",
          "3–4 minutos por lado.",
          "Limón y ensalada.",
        ],
      },
      {
        method: "horno",
        steps: [
          "Horno 200, 12–15 minutos con limón y ajo.",
        ],
      },
      {
        method: "freidora",
        steps: [
          "Freidora 190, 10 minutos.",
        ],
      },
    ],
  },
  {
    id: "revuelto-tomate",
    title: "Huevo con tomate",
    slots: ["desayuno", "cena"],
    ingredients: ["huevos", "tomate", "aceite", "sal", "orégano"],
    vegetarian: true,
    vegan: false,
    glutenFree: true,
    minutes: 12,
    kcal: 280,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Salteá tomate 3 minutos.",
          "Sumá huevos y revolvé.",
          "Orégano al final.",
        ],
      },
      {
        method: "sarten-electrica",
        steps: [
          "Tomate primero, después huevos.",
        ],
      },
    ],
  },
  {
    id: "porotos-arroz",
    title: "Porotos con arroz",
    slots: ["almuerzo", "cena"],
    ingredients: ["porotos", "arroz", "cebolla", "ají o pimentón", "aceite"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 30,
    kcal: 500,
    variants: [
      {
        method: "hornalla",
        steps: [
          "Cociná el arroz.",
          "Rehogá cebolla y ají, sumá porotos.",
          "Serví junto. Hierro y proteína de una.",
        ],
      },
    ],
  },
  {
    id: "ensalada-noche",
    title: "Ensalada de la noche",
    slots: ["cena"],
    ingredients: ["hojas verdes", "tomate", "pepino", "garbanzos o porotos", "limón", "aceite de oliva"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 10,
    kcal: 320,
    variants: [
      {
        method: "crudo",
        steps: [
          "Lavá las hojas.",
          "Picá tomate y pepino, sumá garbanzos.",
          "Aliñá con limón y aceite.",
        ],
      },
    ],
  },
  {
    id: "papas-freidora",
    title: "Papas y verduras crocantes",
    slots: ["cena", "almuerzo"],
    ingredients: ["papa", "zapallo", "aceite", "sal", "pimentón"],
    vegetarian: true,
    vegan: true,
    glutenFree: true,
    minutes: 22,
    kcal: 350,
    variants: [
      {
        method: "freidora",
        steps: [
          "Cubos de papa y zapallo con aceite y pimentón.",
          "Freidora 190, 18 minutos, agitá a la mitad.",
        ],
      },
      {
        method: "horno",
        steps: [
          "Misma idea al horno 200, 25 minutos.",
        ],
      },
      {
        method: "hornalla",
        steps: [
          "Salteá cubos en sartén con tapa, 15 minutos.",
        ],
      },
    ],
  },
];

export function recipesFor(profile: ComidaProfile, kitchen: KitchenGear, slot: MealSlot): Recipe[] {
  const out: Recipe[] = [];
  for (const seed of RECIPE_BANK) {
    if (!dietOk(seed, profile)) continue;
    const adapted = adaptRecipe(seed, kitchen, slot);
    if (adapted) out.push(adapted);
  }
  return out;
}

export function pickRecipe(pool: Recipe[], key: string): Recipe | null {
  if (!pool.length) return null;
  return pool[hashSeed(key) % pool.length] || null;
}

export function suggestDay(args: {
  profile: ComidaProfile;
  kitchen: KitchenGear;
  day: string;
  nonce: number;
  pantry?: string[];
}): DayMeal[] {
  const meals: DayMeal[] = [];
  for (const slot of MEAL_SLOTS) {
    let pool = recipesFor(args.profile, args.kitchen, slot);
    if (args.pantry && args.pantry.length) {
      const scored = scoreByPantry(pool, args.pantry);
      if (scored.some((row) => row.score > 0)) {
        pool = scored.filter((row) => row.score > 0).map((row) => row.recipe);
      }
    }
    const recipe = pickRecipe(pool, `${args.day}:${slot}:${args.nonce}:${args.profile.name}`);
    if (recipe) meals.push({ slot, recipe });
  }
  return meals;
}

export function scoreByPantry(recipes: Recipe[], pantry: string[]): { recipe: Recipe; score: number }[] {
  const names = pantry.map((row) => row.toLowerCase().trim()).filter(Boolean);
  return recipes.map((recipe) => {
    const score = recipe.ingredients.filter((ing) => {
      const low = ing.toLowerCase();
      return names.some((name) => low.includes(name) || name.includes(low.split(" ")[0] || low));
    }).length;
    return { recipe, score };
  });
}

export function mealsFromPantry(profile: ComidaProfile, kitchen: KitchenGear, pantry: string[], limit = 6): Recipe[] {
  const all: Recipe[] = [];
  for (const slot of MEAL_SLOTS) {
    for (const recipe of recipesFor(profile, kitchen, slot)) {
      if (!all.some((row) => row.id === recipe.id && row.slot === recipe.slot)) all.push(recipe);
    }
  }
  return scoreByPantry(all, pantry)
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.recipe);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + n);
  return dayKey(dt);
}

export function buildPlan(args: {
  profile: ComidaProfile;
  kitchen: KitchenGear;
  who: ComidaWho;
  start: string;
  days: number;
}): PlanDay[] {
  const out: PlanDay[] = [];
  for (let i = 0; i < args.days; i += 1) {
    const date = addDays(args.start, i);
    out.push({
      date,
      who: args.who,
      meals: suggestDay({ profile: args.profile, kitchen: args.kitchen, day: date, nonce: i + 1 }),
    });
  }
  return out;
}

export function nutrientTips(profile: ComidaProfile, history: HistoryEntry[]): string[] {
  const tips: string[] = [];
  if (profile.vegan) {
    tips.push("Dieta vegana: B12 (fortificados o suplemento). Hierro en lentejas, garbanzos y hojas, con algo de vitamina C (limón, tomate).");
    tips.push("Proteína: porotos, tofu, quinoa, frutos secos. Combiná cereales con legumbres.");
  } else if (profile.vegetarian) {
    tips.push("Dieta vegetariana: huevos y lácteos cubren bastante B12; si no los usás, un extra viene bien.");
    tips.push("Hierro: lentejas, garbanzos y hojas verdes. Proteína: huevo, yogur, porotos.");
  }
  if (profile.glutenFree) {
    tips.push("Sin gluten: arroz, quinoa, papas, maíz. Chequeá salsas y caldo.");
  }
  const recent = history.slice(0, 16).map((row) => row.title.toLowerCase()).join(" ");
  if (recent && /pasta|fideos|pan|pizza|arroz/.test(recent) && !/lenteja|garbanzo|huevo|tofu|pollo|pescado|poroto|quinoa/.test(recent)) {
    tips.push("Últimamente hay bastante harina o arroz. Un plato con proteína (huevo, lentejas, tofu) equilibra.");
  }
  if (history.length < 3) {
    tips.push("Anotá lo que comés en el historial y te tiro tips más finos de hierro, proteína y B12.");
  }
  const kcal = roughKcal(profile);
  if (kcal) {
    tips.push(`Con edad, peso y altura, una estimación liviana ronda ${kcal} kcal al día. Es una guía de cocina, no un plan médico.`);
  }
  if (!tips.length) tips.push("Comé variado: verdura, algo de proteína, y agua. Si hace falta, regenerá el plan.");
  tips.push("Son tips de cocina, no un diagnóstico médico.");
  return tips;
}

export function mealHourMatch(hours: Record<MealSlot, number>, now = new Date()): MealSlot | null {
  const hour = now.getHours();
  for (const slot of MEAL_SLOTS) {
    if (hours[slot] === hour) return slot;
  }
  return null;
}

export function bannerId(day: string, slot: MealSlot): string {
  return `${day}:${slot}`;
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function parsePantryList(text: string): string[] {
  const json = extractJsonObject(text);
  const fromJson = json?.ingredients;
  if (Array.isArray(fromJson)) {
    return fromJson.map((row) => String(row || "").trim()).filter(Boolean).slice(0, 40);
  }
  return String(text || "")
    .split(/[\n,;]+/)
    .map((row) => row.replace(/^[-*•\d.\s]+/, "").trim())
    .filter((row) => row.length > 1 && row.length < 48)
    .slice(0, 40);
}

export function recipeFromUnknown(raw: unknown, slot: MealSlot, kitchen: KitchenGear): Recipe | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = String(row.title || "").trim();
  const ingredients = Array.isArray(row.ingredients)
    ? row.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const steps = Array.isArray(row.steps) ? row.steps.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!title || ingredients.length < 2 || steps.length < 2) return null;
  const methodRaw = String(row.method || "").trim() as CookMethod;
  const method: CookMethod = methodAvailable(methodRaw, kitchen) ? methodRaw : firstAvailableMethod(kitchen);
  if (method === "horno" && !methodAvailable("horno", kitchen)) return null;
  return {
    id: `llm-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    title,
    slot,
    ingredients,
    steps,
    method,
    vegetarian: row.vegetarian !== false,
    vegan: !!row.vegan,
    glutenFree: row.glutenFree !== false,
    minutes: Number(row.minutes) > 0 ? Math.min(120, Number(row.minutes)) : 20,
    kcal: Number(row.kcal) > 0 ? Math.min(1200, Number(row.kcal)) : 400,
  };
}

export function firstAvailableMethod(kitchen: KitchenGear): CookMethod {
  const order: CookMethod[] = ["hornalla", "sarten-electrica", "freidora", "horno", "crudo"];
  return order.find((method) => methodAvailable(method, kitchen)) || "crudo";
}

export function parseCookMeals(text: string, kitchen: KitchenGear): DayMeal[] {
  const json = extractJsonObject(text);
  const meals = json?.meals;
  if (!Array.isArray(meals)) return [];
  const out: DayMeal[] = [];
  for (const row of meals) {
    const slotRaw = row && typeof row === "object" ? String((row as { slot?: unknown }).slot || "") : "";
    const slot = MEAL_SLOTS.includes(slotRaw as MealSlot) ? (slotRaw as MealSlot) : null;
    if (!slot) continue;
    const recipe = recipeFromUnknown(row, slot, kitchen);
    if (recipe) out.push({ slot, recipe });
  }
  return out;
}

export function cookContextLine(args: {
  who: ComidaWho;
  profile: ComidaProfile;
  kitchen: KitchenGear;
  pantry: string[];
  recipe: Recipe | null;
}): string {
  const p = args.profile;
  const diet: string[] = [];
  if (p.vegan) diet.push("vegano");
  else if (p.vegetarian) diet.push("vegetariano");
  if (p.glutenFree) diet.push("sin gluten");
  if (p.allergies.trim()) diet.push(`alergias: ${p.allergies.trim()}`);
  if (!diet.length) diet.push("sin restricciones");
  const body = [
    `Cocinás para ${p.name} (${args.who}).`,
    `Dieta: ${diet.join(", ")}.`,
    p.age != null ? `Edad ${p.age}.` : "",
    p.weightKg != null ? `Peso ${p.weightKg} kg.` : "",
    p.heightCm != null ? `Altura ${p.heightCm} cm.` : "",
    `Cocina: ${kitchenLine(args.kitchen)}.`,
    args.pantry.length ? `Heladera/alacena: ${args.pantry.join(", ")}.` : "",
    args.recipe
      ? `Receta activa: ${args.recipe.title} (${METHOD_LABEL[args.recipe.method]}). Ingredientes: ${args.recipe.ingredients.join(", ")}. Pasos: ${args.recipe.steps.join(" / ")}.`
      : "No hay receta activa.",
  ];
  return body.filter(Boolean).join(" ");
}

export function cookSystemMessages(args: {
  who: ComidaWho;
  profile: ComidaProfile;
  kitchen: KitchenGear;
  pantry: string[];
  recipe: Recipe | null;
}): { role: "system"; content: string }[] {
  return [{ role: "system", content: `${COOK_SOUL}\n${cookContextLine(args)}` }];
}

export function localCookReply(args: {
  text: string;
  profile: ComidaProfile;
  kitchen: KitchenGear;
  recipe: Recipe | null;
  assistantCount: number;
}): string {
  const t = args.text.toLowerCase();
  if (INCLUSIVE.test(t)) return "Katho ella, Lulox él. Los dos.";
  const b12 = cookShouldTipB12(args.profile, args.assistantCount, args.text) ? ` ${b12Tip(args.profile)}` : "";
  if (!methodAvailable("horno", args.kitchen) && /\b(horne|horno|bake)\b/.test(t)) {
    return `No hay horno. Hacelo en sartén, freidora o crudo.${b12}`.trim();
  }
  if (args.recipe) {
    if (/\b(paso|siguiente|ahora|arranc|empez)\b/.test(t)) {
      return `Arrancá por: ${args.recipe.steps[0]} Después: ${args.recipe.steps[1] || "probá y ajustá sal."}${b12}`;
    }
    return `Para ${args.recipe.title} (${METHOD_LABEL[args.recipe.method]}): ${args.recipe.steps.join(" ")} Ingredientes: ${args.recipe.ingredients.join(", ")}.${b12}`;
  }
  if (/\b(hola|holis|buenas)\b/.test(t)) {
    return `Hola. Decime qué estás cocinando o abrí una receta de hoy.${b12}`.trim();
  }
  if (/\b(b12|vitamina|cansad)\b/.test(t) && (args.profile.vegan || args.profile.vegetarian)) {
    return b12Tip(args.profile) || "Un tip de B12 viene bien en dieta veggie. No es un diagnóstico médico.";
  }
  return `Decime en qué paso estás y te ayudo. Cocina: ${kitchenLine(args.kitchen)}.${b12}`.trim();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampHour(value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(23, Math.max(0, n));
}

function asProfile(raw: unknown, fallbackName: string): ComidaProfile {
  const row = raw && typeof raw === "object" ? (raw as Partial<ComidaProfile>) : {};
  return {
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallbackName,
    vegetarian: !!row.vegetarian,
    vegan: !!row.vegan,
    glutenFree: !!row.glutenFree,
    allergies: typeof row.allergies === "string" ? row.allergies : "",
    age: numOrNull(row.age),
    weightKg: numOrNull(row.weightKg),
    heightCm: numOrNull(row.heightCm),
  };
}

export function emptyComida(): ComidaState {
  return {
    profiles: {
      vos: emptyProfile("vos"),
      pareja: emptyProfile("pareja"),
    },
    kitchen: defaultKitchen(),
    hours: defaultHours(),
    bannerOn: true,
    dismissedBanner: null,
    who: "vos",
    suggestNonce: 1,
    suggestions: [],
    suggestionsDay: "",
    pantry: [],
    pantryUpdatedAt: null,
    favorites: [],
    history: [],
    library: [],
    plan: [],
    cookChat: [],
    activeRecipe: null,
  };
}

export function normalizeComida(raw: unknown): ComidaState {
  const base = emptyComida();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Partial<ComidaState>;
  const kitchen = row.kitchen && typeof row.kitchen === "object" ? row.kitchen : base.kitchen;
  return {
    profiles: {
      vos: asProfile(row.profiles?.vos, "vos"),
      pareja: asProfile(row.profiles?.pareja, "pareja"),
    },
    kitchen: {
      burners: typeof kitchen.burners === "number" && kitchen.burners >= 0 ? Math.min(8, Math.round(kitchen.burners)) : 4,
      oven: !!kitchen.oven,
      electricOven: !!kitchen.electricOven,
      electricSkillet: !!kitchen.electricSkillet,
      airFryer: !!kitchen.airFryer,
      extra: typeof kitchen.extra === "string" ? kitchen.extra : "",
    },
    hours: {
      desayuno: clampHour(row.hours?.desayuno, 8),
      almuerzo: clampHour(row.hours?.almuerzo, 13),
      cena: clampHour(row.hours?.cena, 21),
    },
    bannerOn: row.bannerOn !== false,
    dismissedBanner: typeof row.dismissedBanner === "string" ? row.dismissedBanner : null,
    who: row.who === "pareja" ? "pareja" : "vos",
    suggestNonce: typeof row.suggestNonce === "number" && row.suggestNonce > 0 ? row.suggestNonce : 1,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions.filter((item) => item && item.recipe && item.slot) : [],
    suggestionsDay: typeof row.suggestionsDay === "string" ? row.suggestionsDay : "",
    pantry: Array.isArray(row.pantry) ? row.pantry.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 40) : [],
    pantryUpdatedAt: typeof row.pantryUpdatedAt === "string" ? row.pantryUpdatedAt : null,
    favorites: Array.isArray(row.favorites) ? row.favorites.filter((item) => item && item.recipeId) : [],
    history: Array.isArray(row.history) ? row.history.filter((item) => item && item.title) : [],
    library: Array.isArray(row.library) ? row.library.filter((item) => item && item.recipe) : [],
    plan: Array.isArray(row.plan) ? row.plan.filter((item) => item && item.date) : [],
    cookChat: Array.isArray(row.cookChat) ? row.cookChat.slice(-40) : [],
    activeRecipe: row.activeRecipe && typeof row.activeRecipe === "object" ? row.activeRecipe : null,
  };
}

export function loadComida(): ComidaState {
  return normalizeComida(readJson<unknown>(COMIDA_STORAGE, emptyComida()));
}

export function saveComida(state: ComidaState) {
  writeJson(COMIDA_STORAGE, state);
}

export function ensureTodaySuggestions(state: ComidaState, now = new Date()): ComidaState {
  const today = dayKey(now);
  const profile = state.profiles[state.who];
  const valid =
    state.suggestionsDay === today &&
    state.suggestions.length === 3 &&
    state.suggestions.every((meal) => {
      const seed = RECIPE_BANK.find((row) => row.id === meal.recipe.id);
      if (!seed) return true;
      return dietOk(seed, profile) && !!adaptRecipe(seed, state.kitchen, meal.slot);
    });
  if (valid) return state;
  return {
    ...state,
    suggestionsDay: today,
    suggestions: suggestDay({
      profile,
      kitchen: state.kitchen,
      day: today,
      nonce: state.suggestNonce,
      pantry: state.pantry,
    }),
  };
}

export function setFavorite(state: ComidaState, recipe: Pick<Recipe, "id" | "title">, stars: StarRating): ComidaState {
  const rest = state.favorites.filter((row) => row.recipeId !== recipe.id);
  return {
    ...state,
    favorites: [{ recipeId: recipe.id, title: recipe.title, stars, savedAt: new Date().toISOString() }, ...rest].slice(0, 40),
  };
}

export function saveToLibrary(state: ComidaState, recipe: Recipe): ComidaState {
  if (state.library.some((row) => row.recipe.id === recipe.id && row.recipe.slot === recipe.slot)) return state;
  return {
    ...state,
    library: [{ id: uid("lib"), recipe, savedAt: new Date().toISOString() }, ...state.library].slice(0, 60),
  };
}

export function logEaten(state: ComidaState, recipe: Recipe, who: ComidaWho, rating: StarRating | null): ComidaState {
  return {
    ...state,
    history: [
      {
        id: uid("ate"),
        at: new Date().toISOString(),
        title: recipe.title,
        rating,
        who,
        recipeId: recipe.id,
      },
      ...state.history,
    ].slice(0, 80),
  };
}

export function dietLine(profile: ComidaProfile): string {
  const bits: string[] = [];
  if (profile.vegan) bits.push("vegano");
  else if (profile.vegetarian) bits.push("vegetariano");
  if (profile.glutenFree) bits.push("sin gluten");
  if (profile.allergies.trim()) bits.push(`alergias: ${profile.allergies.trim()}`);
  return bits.length ? bits.join(" · ") : "sin restricciones";
}
