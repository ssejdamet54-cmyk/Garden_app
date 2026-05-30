import { useEffect, useMemo, useState } from "react";
import "./App.css";
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

type PlantPlace = "Дом" | "Балкон" | "Улица" | "Теплица";
type PlantCategory = "Все" | PlantPlace;

type Plant = {
  id: number;
  name: string;
  type: string;
  place: PlantPlace;
  room: string;
  image: string;
  photo?: string;
  wateringEveryDays: number;
  lastWateredAt: string;
  wateringHistory?: string[];
  notes: string;
};
type Tab = "home" | "plants" | "watering" | "gallery" | "guide";
type Season = "winter" | "spring" | "summer" | "autumn";
type WeatherInfo = {
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  rainSum: number;
};
type PlantCareGuide = {
  keywords: string[];
  light: string;
  watering: string;
  soil: string;
  feeding: string;
  mistakes: string;
};
type CompanionPlantingGuide = {
  name: string;
  keywords: string[];
  good: string[];
  bad: string[];
  note: string;
};
type PlantPreset = {
  keywords: string[];
  type: string;
  place: PlantPlace;
  image: string;
  wateringEveryDays: number;
  notes: string;
};
const API_URL =
  import.meta.env.VITE_API_URL || "https://garden-backend1.onrender.com";

function getBrowserOwnerId() {
  const storageKey = "garden_browser_owner_id";
  const existingOwnerId = localStorage.getItem(storageKey);

  if (existingOwnerId) {
    return existingOwnerId;
  }

  const newOwnerId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `browser_${crypto.randomUUID()}`
      : `browser_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(storageKey, newOwnerId);

  return newOwnerId;
}

function getOwnerId() {
  const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  if (telegramUserId) {
    return String(telegramUserId);
  }

  return getBrowserOwnerId();
}

function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const ownerId = getOwnerId();

  headers.set("x-owner-id", ownerId);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}
const initialPlants: Plant[] = [
  {
    id: 1,
    name: "Монстера",
    type: "Комнатное растение",
    place: "Дом",
    room: "Гостиная",
    image: "🌿",
    wateringEveryDays: 7,
    lastWateredAt: "2026-01-10",
    notes: "Любит яркий рассеянный свет. Не любит перелив.",
  },
  {
    id: 2,
    name: "Фикус Бенджамина",
    type: "Комнатное дерево",
    place: "Дом",
    room: "Спальня",
    image: "🪴",
    wateringEveryDays: 9,
    lastWateredAt: "2026-01-08",
    notes: "Может сбрасывать листья от сквозняка и резкой смены места.",
  },
  {
    id: 3,
    name: "Томаты",
    type: "Огород",
    place: "Улица",
    room: "Грядка 1",
    image: "🍅",
    wateringEveryDays: 2,
    lastWateredAt: "2026-01-14",
    notes: "Поливать под корень, не мочить листья.",
  },
];
const careGuides: PlantCareGuide[] = [
  {
    keywords: ["монстера", "monstera"],
    light: "Яркий рассеянный свет. Прямое полуденное солнце может обжигать листья.",
    watering: "Поливать после подсыхания верхних 3–5 см грунта. Не держать постоянно мокрой.",
    soil: "Рыхлый воздухопроницаемый грунт: универсальный грунт + кора + перлит.",
    feeding: "С марта по сентябрь 1 раз в 2–3 недели удобрением для декоративно-лиственных.",
    mistakes: "Частые ошибки: перелив, тяжелый грунт, темный угол, отсутствие опоры.",
  },
  {
    keywords: ["фикус", "бенджамина", "ficus"],
    light: "Яркий рассеянный свет. Не любит резкую смену места.",
    watering: "Поливать после подсыхания верхнего слоя грунта. Зимой полив сокращать.",
    soil: "Легкий универсальный грунт с дренажом. Важно, чтобы вода не стояла в горшке.",
    feeding: "Весной и летом 1 раз в 2–4 недели удобрением для декоративно-лиственных.",
    mistakes: "Частые ошибки: сквозняк, перелив, резкая перестановка, холодный подоконник.",
  },
  {
    keywords: ["алоэ", "aloe"],
    light: "Очень светлое место, можно несколько часов прямого солнца.",
    watering: "Редкий полив после полного просыхания грунта. Зимой очень осторожно.",
    soil: "Грунт для суккулентов или смесь с большим количеством песка, перлита и дренажа.",
    feeding: "С апреля по август 1 раз в месяц слабым удобрением для суккулентов.",
    mistakes: "Главная ошибка — перелив. От него быстро загнивают корни.",
  },
  {
    keywords: ["кактус", "cactus"],
    light: "Максимально светлое место. Хорошо переносит прямое солнце после адаптации.",
    watering: "Редко, только после полного просыхания грунта. Зимой почти не поливать.",
    soil: "Минеральный рыхлый грунт для кактусов с песком, перлитом или мелким гравием.",
    feeding: "Только в период активного роста, 1 раз в месяц удобрением для кактусов.",
    mistakes: "Частые ошибки: частый полив, большой горшок, тяжелый влажный грунт.",
  },
  {
    keywords: ["авокадо", "avocado"],
    light: "Яркий рассеянный свет. Молодой росток лучше защищать от жесткого полуденного солнца.",
    watering: "Грунт должен быть слегка влажным, но не болотом. Поливать после подсыхания верхнего слоя.",
    soil: "Легкий питательный грунт с хорошим дренажом. В горшке обязательно отверстие.",
    feeding: "После появления устойчивого роста можно подкармливать 1 раз в 3–4 недели весной и летом.",
    mistakes: "Ошибки: холод, перелив, отсутствие света, слишком плотный грунт.",
  },
  {
    keywords: ["томат", "томаты", "помидор", "помидоры", "tomato"],
    light: "Максимум солнца: 6–8 часов прямого света в день.",
    watering: "Регулярный полив под корень. Не мочить листья. В жару поливать утром или вечером.",
    soil: "Питательный рыхлый грунт, pH слабокислый или нейтральный. Нужен хороший дренаж.",
    feeding: "После укоренения — азот умеренно, при цветении и плодах больше калия и фосфора.",
    mistakes: "Ошибки: перелив, загущение, полив по листьям, избыток азота во время плодоношения.",
  },
  {
    keywords: ["огурец", "огурцы", "cucumber"],
    light: "Светлое место, но в сильную жару может понадобиться легкое притенение.",
    watering: "Любят стабильную влажность. Поливать теплой водой, не пересушивать.",
    soil: "Рыхлая питательная почва с большим количеством органики.",
    feeding: "Регулярные подкормки небольшими дозами: органика, калий, комплексные удобрения.",
    mistakes: "Ошибки: холодная вода, пересушка, резкие перепады влажности, загущение.",
  },
  {
    keywords: ["клубника", "земляника", "strawberry"],
    light: "Солнечное место. В тени урожай хуже и ягоды кислее.",
    watering: "Регулярный полив, особенно при цветении и наливе ягод. Не заболачивать.",
    soil: "Рыхлая плодородная почва. Хорошо работает мульча.",
    feeding: "Весной азот умеренно, перед цветением и после урожая — комплексное удобрение.",
    mistakes: "Ошибки: загущение, отсутствие мульчи, сырость на ягодах, избыток азота.",
  },
];
const companionPlantingGuides: CompanionPlantingGuide[] = [
  {
    name: "Томаты",
    keywords: ["томат", "томаты", "помидор", "помидоры"],
    good: ["базилик", "лук", "чеснок", "морковь", "салат", "петрушка"],
    bad: ["картофель", "фенхель", "капуста"],
    note: "Томаты лучше сажать с ароматными травами и луком. Не стоит сажать рядом с картофелем из-за общих болезней.",
  },
  {
    name: "Огурцы",
    keywords: ["огурец", "огурцы"],
    good: ["укроп", "фасоль", "горох", "кукуруза", "редис", "салат"],
    bad: ["картофель", "шалфей", "ароматные травы в избытке"],
    note: "Огурцы любят влагу и тепло. Хорошо растут рядом с культурами, которые не забирают у них много воды.",
  },
  {
    name: "Клубника",
    keywords: ["клубника", "земляника"],
    good: ["чеснок", "лук", "шпинат", "салат", "бархатцы"],
    bad: ["капуста", "малина", "пасленовые"],
    note: "Чеснок и лук рядом с клубникой помогают снизить риск грибковых болезней.",
  },
  {
    name: "Морковь",
    keywords: ["морковь", "морковка"],
    good: ["лук", "чеснок", "салат", "горох", "томаты"],
    bad: ["укроп", "пастернак", "сельдерей"],
    note: "Классическая пара — морковь и лук. Лук помогает отпугивать морковную муху.",
  },
  {
    name: "Лук",
    keywords: ["лук"],
    good: ["морковь", "свекла", "салат", "клубника", "томаты"],
    bad: ["горох", "фасоль", "бобы"],
    note: "Лук хорошо работает как защитный сосед, но плохо сочетается с бобовыми.",
  },
];

function getCompanionGuideForPlant(plantName: string) {
  const normalizedName = plantName.toLowerCase();

  return companionPlantingGuides.find((guide) =>
    guide.keywords.some((keyword) => normalizedName.includes(keyword))
  );
}
const plantPresets: PlantPreset[] = [
  {
    keywords: ["авокадо", "avocado"],
    type: "Комнатное растение",
    place: "Дом",
    image: "🌱",
    wateringEveryDays: 5,
    notes:
      "Авокадо любит яркий рассеянный свет, легкий грунт и умеренный полив без застоя воды.",
  },
  {
    keywords: ["монстера", "monstera"],
    type: "Комнатное растение",
    place: "Дом",
    image: "🌿",
    wateringEveryDays: 7,
    notes:
      "Монстера любит яркий рассеянный свет, рыхлый грунт и полив после подсыхания верхнего слоя.",
  },
  {
    keywords: ["фикус", "бенджамина", "ficus"],
    type: "Комнатное дерево",
    place: "Дом",
    image: "🪴",
    wateringEveryDays: 9,
    notes:
      "Фикус не любит сквозняки, перелив, холодный подоконник и резкую смену места.",
  },
  {
    keywords: ["алоэ", "aloe"],
    type: "Суккулент",
    place: "Дом",
    image: "🌵",
    wateringEveryDays: 14,
    notes:
      "Алоэ нужен яркий свет и редкий полив после полного просыхания грунта.",
  },
  {
    keywords: ["кактус", "cactus"],
    type: "Суккулент",
    place: "Дом",
    image: "🌵",
    wateringEveryDays: 21,
    notes:
      "Кактус любит максимум света, минеральный грунт и очень редкий полив.",
  },
  {
    keywords: ["томат", "томаты", "помидор", "помидоры", "tomato"],
    type: "Огород",
    place: "Улица",
    image: "🍅",
    wateringEveryDays: 2,
    notes:
      "Томаты любят солнце, регулярный полив под корень, подвязку и проветривание.",
  },
  {
    keywords: ["огурец", "огурцы", "cucumber"],
    type: "Огород",
    place: "Улица",
    image: "🥒",
    wateringEveryDays: 2,
    notes:
      "Огурцы любят теплую воду, стабильную влажность и питательный рыхлый грунт.",
  },
  {
    keywords: ["клубника", "земляника", "strawberry"],
    type: "Ягода",
    place: "Улица",
    image: "🍓",
    wateringEveryDays: 3,
    notes:
      "Клубника любит солнце, мульчу и регулярный полив без заболачивания.",
  },
  {
    keywords: ["морковь", "морковка"],
    type: "Огород",
    place: "Улица",
    image: "🥕",
    wateringEveryDays: 4,
    notes:
      "Морковь любит рыхлый грунт без свежего навоза и равномерную влажность.",
  },
  {
    keywords: ["лук"],
    type: "Огород",
    place: "Улица",
    image: "🧅",
    wateringEveryDays: 5,
    notes:
      "Лук любит солнце, рыхлую почву и умеренный полив. Перед уборкой полив сокращают.",
  },
];

function getPlantPreset(plantName: string) {
  const normalizedName = plantName.toLowerCase();

  return plantPresets.find((preset) =>
    preset.keywords.some((keyword) => normalizedName.includes(keyword))
  );
}
function getCareGuideForPlant(plantName: string) {
  const normalizedName = plantName.toLowerCase();

  return careGuides.find((guide) =>
    guide.keywords.some((keyword) => normalizedName.includes(keyword))
  );
}

function addDays(date: string, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(date);
}
function getCurrentSeason(): Season {
  const month = new Date().getMonth();

  if (month === 11 || month === 0 || month === 1) {
    return "winter";
  }

  if (month >= 2 && month <= 4) {
    return "spring";
  }

  if (month >= 5 && month <= 7) {
    return "summer";
  }

  return "autumn";
}

function getSeasonName(season: Season) {
  const names: Record<Season, string> = {
    winter: "Зима",
    spring: "Весна",
    summer: "Лето",
    autumn: "Осень",
  };

  return names[season];
}

function getAdjustedWateringDays(plant: Plant) {
  const season = getCurrentSeason();
  const baseDays = plant.wateringEveryDays;

  let multiplier = 1;

  if (plant.place === "Дом") {
    if (season === "winter") multiplier = 1.5;
    if (season === "summer") multiplier = 0.85;
  }

  if (plant.place === "Балкон") {
    if (season === "winter") multiplier = 2;
    if (season === "summer") multiplier = 0.75;
    if (season === "autumn") multiplier = 1.2;
  }

  if (plant.place === "Улица") {
    if (season === "winter") multiplier = 3;
    if (season === "spring") multiplier = 0.85;
    if (season === "summer") multiplier = 0.65;
    if (season === "autumn") multiplier = 1.2;
  }

  if (plant.place === "Теплица") {
    if (season === "winter") multiplier = 1.8;
    if (season === "spring") multiplier = 0.85;
    if (season === "summer") multiplier = 0.7;
    if (season === "autumn") multiplier = 1.1;
  }

  return Math.max(1, Math.round(baseDays * multiplier));
}

function getSeasonWateringAdvice(plant: Plant) {
  const season = getCurrentSeason();

  if (plant.place === "Дом" && season === "winter") {
    return "Зимой дома полив реже: меньше света, грунт сохнет медленнее.";
  }

  if (plant.place === "Дом" && season === "summer") {
    return "Летом дома проверяй грунт чаще: жара ускоряет пересыхание.";
  }

  if (plant.place === "Улица" && season === "summer") {
    return "Летом на улице полив чаще, особенно в жару и при ветре.";
  }

  if (plant.place === "Улица" && season === "winter") {
    return "Зимой уличные растения обычно не поливают без необходимости.";
  }

  if (plant.place === "Балкон" && season === "summer") {
    return "На балконе горшки быстро перегреваются, проверяй влажность чаще.";
  }

  if (plant.place === "Теплица" && season === "summer") {
    return "В теплице летом высокая температура, нужен частый контроль влажности.";
  }

  return "Полив рассчитан с учетом сезона и места растения.";
}

function getDaysUntilWatering(plant: Plant) {
  const today = new Date();
 const nextWatering = addDays(
  plant.lastWateredAt,
  getAdjustedWateringDays(plant)
);

  today.setHours(0, 0, 0, 0);
  nextWatering.setHours(0, 0, 0, 0);

  const differenceMs = nextWatering.getTime() - today.getTime();
  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

function getWateringStatus(plant: Plant) {
  const days = getDaysUntilWatering(plant);

  if (days < 0) {
    return {
      label: "Просрочен полив",
      text: `Нужно было полить ${Math.abs(days)} дн. назад`,
      level: "danger",
    };
  }

  if (days === 0) {
    return {
      label: "Полить сегодня",
      text: "Сегодня день полива",
      level: "warning",
    };
  }

  if (days === 1) {
    return {
      label: "Полить завтра",
      text: "Следующий полив завтра",
      level: "normal",
    };
  }

  return {
    label: "Всё хорошо",
    text: `Следующий полив через ${days} дн.`,
    level: "success",
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedCategory, setSelectedCategory] = useState<PlantCategory>("Все");
  const [searchQuery, setSearchQuery] = useState("");

const plantCategories: PlantCategory[] = [
  "Все",
  "Дом",
  "Балкон",
  "Улица",
  "Теплица",
];
const [syncMessage, setSyncMessage] = useState("");
const [canSyncLocalPlants, setCanSyncLocalPlants] = useState(false);
const [isPlantsLoading, setIsPlantsLoading] = useState(false);
  const [plants, setPlants] = useState<Plant[]>(() => {
    const savedPlants = localStorage.getItem("garden-plants");

    if (savedPlants) {
      try {
        return JSON.parse(savedPlants);
      } catch {
        return initialPlants;
      }
    }

    return initialPlants;
  });

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantType, setNewPlantType] = useState("");
  const [newPlantPlace, setNewPlantPlace] = useState<PlantPlace>("Дом");
  const [newPlantRoom, setNewPlantRoom] = useState("");
  const [newPlantWateringDays, setNewPlantWateringDays] = useState("7");
  const [newPlantNotes, setNewPlantNotes] = useState("");
  const [newPlantImage, setNewPlantImage] = useState("🌱");
  const [newPlantPhoto, setNewPlantPhoto] = useState("");
  const [editingPlantId, setEditingPlantId] = useState<number | null>(null);
  const [openedPhoto, setOpenedPhoto] = useState<string | null>(null);
  const [selectedCarePlantId, setSelectedCarePlantId] = useState<number | null>(
  null
);
const [openedPlantId, setOpenedPlantId] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
const [weatherError, setWeatherError] = useState("");
const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  const plantIcons = ["🌱", "🪴", "🌿", "🌵", "🍅", "🥒", "🥕", "🍓", "🌳", "🌸"];
useEffect(() => {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
}, []);
 useEffect(() => {
  async function loadPlantsFromBackend() {
    setIsPlantsLoading(true);
    setSyncMessage("");

    try {
      const response = await apiFetch(`/plants`);

      if (!response.ok) {
        throw new Error("Failed to load plants");
      }

      const backendPlants = await response.json();
      const savedPlantsRaw = localStorage.getItem("garden-plants");
      const localPlants = savedPlantsRaw ? JSON.parse(savedPlantsRaw) : [];

      if (Array.isArray(backendPlants) && backendPlants.length > 0) {
        setPlants(backendPlants);
        setCanSyncLocalPlants(false);
        setSyncMessage("Данные загружены с backend.");
        return;
      }

      if (
        Array.isArray(backendPlants) &&
        backendPlants.length === 0 &&
        Array.isArray(localPlants) &&
        localPlants.length > 0
      ) {
        setPlants(localPlants);
        setCanSyncLocalPlants(true);
        setSyncMessage("Backend пустой. Можно перенести локальные растения на сервер.");
        return;
      }

      setCanSyncLocalPlants(false);
      setSyncMessage("Backend подключен. Растений пока нет.");
    } catch {
      console.warn("Backend недоступен, используем localStorage.");
      setCanSyncLocalPlants(false);
      setSyncMessage("Backend недоступен. Работаем локально.");
    } finally {
      setIsPlantsLoading(false);
    }
  }

  loadPlantsFromBackend();
}, []);
  useEffect(() => {
    localStorage.setItem("garden-plants", JSON.stringify(plants));
  }, [plants]);

 
const visiblePlants = useMemo(() => {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return plants.filter((plant) => {
    const matchesCategory =
      selectedCategory === "Все" || plant.place === selectedCategory;

    const matchesSearch =
      !normalizedSearch ||
      plant.name.toLowerCase().includes(normalizedSearch) ||
      plant.type.toLowerCase().includes(normalizedSearch) ||
      plant.place.toLowerCase().includes(normalizedSearch) ||
      plant.room.toLowerCase().includes(normalizedSearch) ||
      plant.notes.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });
}, [plants, selectedCategory, searchQuery]);
const overduePlants = useMemo(() => {
  return visiblePlants.filter((plant) => getDaysUntilWatering(plant) < 0);
}, [visiblePlants]);

const todayWateringPlants = useMemo(() => {
  return visiblePlants.filter((plant) => getDaysUntilWatering(plant) === 0);
}, [visiblePlants]);

const upcomingWateringPlants = useMemo(() => {
  return [...visiblePlants]
    .filter((plant) => getDaysUntilWatering(plant) > 0)
    .sort(
      (firstPlant, secondPlant) =>
        getDaysUntilWatering(firstPlant) - getDaysUntilWatering(secondPlant)
    )
    .slice(0, 3);
}, [visiblePlants]);

function getCategoryCount(category: PlantCategory) {
  if (category === "Все") {
    return plants.length;
  }

  return plants.filter((plant) => plant.place === category).length;
}
function renderSearchBox() {
  return (
    <div className="search-box">
      <span>🔎</span>
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Поиск: авокадо, томаты, кухня..."
      />

      {searchQuery && (
        <button type="button" onClick={() => setSearchQuery("")}>
          ✕
        </button>
      )}
    </div>
  );
}
function CategoryFilter() {
  return (
    <div className="category-filter">
      {plantCategories.map((category) => (
        <button
          key={category}
          className={selectedCategory === category ? "active" : ""}
          onClick={() => setSelectedCategory(category)}
          type="button"
        >
          <span>{category}</span>
          <small>{getCategoryCount(category)}</small>
        </button>
      ))}
    </div>
  );
}

  function openAddPlantForm() {
    setEditingPlantId(null);
    setNewPlantName("");
    setNewPlantType("");
    setNewPlantPlace("Дом");
    setNewPlantRoom("");
    setNewPlantWateringDays("7");
    setNewPlantNotes("");
    setNewPlantImage("🌱");
    setNewPlantPhoto("");
    setIsAddFormOpen(true);
  }

  function openEditPlantForm(plant: Plant) {
    setEditingPlantId(plant.id);
    setNewPlantName(plant.name);
    setNewPlantType(plant.type);
    setNewPlantPlace(plant.place);
    setNewPlantRoom(plant.room);
    setNewPlantWateringDays(String(plant.wateringEveryDays));
    setNewPlantNotes(plant.notes);
    setNewPlantImage(plant.image);
    setNewPlantPhoto(plant.photo || "");
    setIsAddFormOpen(true);
  }

  function closeAddPlantForm() {
    setIsAddFormOpen(false);
    setEditingPlantId(null);
    setNewPlantName("");
    setNewPlantType("");
    setNewPlantPlace("Дом");
    setNewPlantRoom("");
    setNewPlantWateringDays("7");
    setNewPlantNotes("");
    setNewPlantImage("🌱");
    setNewPlantPhoto("");
  }
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Не удалось прочитать фото"));
        return;
      }

      image.src = reader.result;
    };

    image.onload = () => {
      const maxSize = 900;
      let { width, height } = image;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Не удалось обработать фото"));
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      const compressedImage = canvas.toDataURL("image/jpeg", 0.72);
      resolve(compressedImage);
    };

    image.onerror = () => {
      reject(new Error("Не удалось загрузить фото"));
    };

    reader.onerror = () => {
      reject(new Error("Не удалось прочитать файл"));
    };

    reader.readAsDataURL(file);
  });
}

async function handlePlantPhotoChange(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Выберите изображение");
    return;
  }

  try {
    const compressedPhoto = await resizeImage(file);
    setNewPlantPhoto(compressedPhoto);
  } catch {
    alert("Не удалось обработать фото");
  }

  event.target.value = "";
}
function applyPlantPreset() {
  const preset = getPlantPreset(newPlantName);

  if (!newPlantName.trim()) {
    alert("Сначала введи название растения");
    return;
  }

  if (!preset) {
    alert("Пока нет автозаполнения для этого растения");
    return;
  }

  setNewPlantType(preset.type);
  setNewPlantPlace(preset.place);
  setNewPlantImage(preset.image);
  setNewPlantWateringDays(String(preset.wateringEveryDays));
  setNewPlantNotes(preset.notes);
}
async function syncLocalPlantsToBackend() {
  const savedPlantsRaw = localStorage.getItem("garden-plants");

  if (!savedPlantsRaw) {
    alert("Локальных растений для переноса нет.");
    return;
  }

  const localPlants = JSON.parse(savedPlantsRaw) as Plant[];

  if (!Array.isArray(localPlants) || localPlants.length === 0) {
    alert("Локальных растений для переноса нет.");
    return;
  }

  try {
    setIsPlantsLoading(true);

    const createdPlants: Plant[] = [];

    for (const plant of localPlants) {
      const response = await apiFetch(`/plants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plant),
      });

      if (!response.ok) {
        throw new Error("Failed to sync plant");
      }

      const createdPlant = await response.json();
      createdPlants.push(createdPlant);
    }

    setPlants(createdPlants);
    setCanSyncLocalPlants(false);
    setSyncMessage("Локальные растения перенесены в backend.");
  } catch {
    alert("Не удалось перенести растения в backend.");
  } finally {
    setIsPlantsLoading(false);
  }
}
 async function savePlant() {
    const trimmedName = newPlantName.trim();

    if (!trimmedName) {
      alert("Введите название растения");
      return;
    }

    const wateringDays = Number(newPlantWateringDays);

    if (!wateringDays || wateringDays < 1) {
      alert("Интервал полива должен быть от 1 дня");
      return;
    }

  const plantData = {
  name: trimmedName,
  type: newPlantType.trim() || "Новое растение",
  place: newPlantPlace,
  room: newPlantRoom.trim() || "Не указано",
  image: newPlantImage,
  photo: newPlantPhoto || undefined,
  wateringEveryDays: wateringDays,
  notes: newPlantNotes.trim() || "Правила ухода пока не добавлены.",
};

  if (editingPlantId) {
  try {
    const response = await apiFetch(`/plants/${editingPlantId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(plantData),
    });

    if (!response.ok) {
      throw new Error("Failed to update plant");
    }

    const updatedPlant = await response.json();

    setPlants((currentPlants) =>
      currentPlants.map((plant) =>
        plant.id === editingPlantId ? updatedPlant : plant
      )
    );
  } catch {
    console.warn("Backend недоступен, обновляем только локально.");

    setPlants((currentPlants) =>
      currentPlants.map((plant) =>
        plant.id === editingPlantId
          ? {
              ...plant,
              ...plantData,
            }
          : plant
      )
    );
  }
} else {
  const newPlant: Plant = {
    id: Date.now(),
    ...plantData,
    lastWateredAt: new Date().toISOString().slice(0, 10),
  };

  try {
    const response = await apiFetch(`/plants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPlant),
    });

    if (!response.ok) {
      throw new Error("Failed to create plant");
    }

    const savedPlant = await response.json();

    setPlants((currentPlants) => [savedPlant, ...currentPlants]);
  } catch {
    console.warn("Backend недоступен, сохраняем только локально.");
    setPlants((currentPlants) => [newPlant, ...currentPlants]);
  }
}

    setActiveTab("plants");
    closeAddPlantForm();
  }

async function deletePlant(plantId: number) {
  const shouldDelete = confirm("Удалить это растение?");

  if (!shouldDelete) {
    return;
  }

  try {
    const response = await apiFetch(`/plants/${plantId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete plant");
    }

    setPlants((currentPlants) =>
      currentPlants.filter((plant) => plant.id !== plantId)
    );
  } catch {
    console.warn("Backend недоступен, удаляем только локально.");

    setPlants((currentPlants) =>
      currentPlants.filter((plant) => plant.id !== plantId)
    );
  }
}
  async function loadWeather() {
  if (!navigator.geolocation) {
    setWeatherError("Геолокация не поддерживается этим устройством.");
    return;
  }

  setIsWeatherLoading(true);
  setWeatherError("");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum",
          timezone: "auto",
          forecast_days: "1",
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = await response.json();

        setWeather({
          temperatureMax: Math.round(data.daily.temperature_2m_max[0]),
          temperatureMin: Math.round(data.daily.temperature_2m_min[0]),
          precipitationSum: Number(data.daily.precipitation_sum[0] || 0),
          rainSum: Number(data.daily.rain_sum[0] || 0),
        });
      } catch {
        setWeatherError("Не удалось загрузить погоду.");
      } finally {
        setIsWeatherLoading(false);
      }
    },
    () => {
      setIsWeatherLoading(false);
      setWeatherError("Разреши доступ к геолокации, чтобы получить прогноз.");
    }
  );
}

function getWeatherWateringAdvice(plant: Plant) {
  if (!weather) {
    return "Загрузи погоду, чтобы учесть дождь и температуру.";
  }

  if (plant.place === "Дом") {
    return "Для комнатных растений погода почти не влияет. Ориентируйся на влажность грунта.";
  }

  if (weather.precipitationSum >= 5) {
    return "Сегодня ожидается заметный дождь. Уличный полив лучше пропустить.";
  }

  if (weather.precipitationSum >= 1) {
    return "Возможны осадки. Перед поливом проверь влажность грунта.";
  }

  if (weather.temperatureMax >= 30) {
    return "Жарко и без дождя. Поливать лучше утром или вечером, не по солнцу.";
  }

  if (weather.temperatureMax <= 5) {
    return "Холодно. Полив нужен редко, только если грунт реально сухой.";
  }

  return "Дождя почти нет. Полив по обычному графику, но сначала проверь грунт.";
}
async function markAsWatered(plantId: number) {
  try {
    const response = await apiFetch(`/plants/${plantId}/water`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to water plant");
    }

    const updatedPlant = await response.json();

    setPlants((currentPlants) =>
      currentPlants.map((plant) =>
        plant.id === plantId ? updatedPlant : plant
      )
    );
  } catch {
    console.warn("Backend недоступен, записываем полив только локально.");

    const today = new Date().toISOString().slice(0, 10);

    setPlants((currentPlants) =>
      currentPlants.map((plant) => {
        if (plant.id !== plantId) {
          return plant;
        }

        const currentHistory = plant.wateringHistory || [];
        const updatedHistory = [today, ...currentHistory];

        return {
          ...plant,
          lastWateredAt: today,
          wateringHistory: updatedHistory,
        };
      })
    );
  }
}

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Садовый помощник</p>
          <h1>Мои растения</h1>
        </div>

        <div className="avatar">🌱</div>
      </header>

      <main className="content">
        {activeTab === "home" && (
          <section className="screen">
      {isPlantsLoading && (
  <div className="sync-status">
    Загружаем данные...
  </div>
)}

{syncMessage && (
  <div className="sync-status">
    {syncMessage}
  </div>
)}

{canSyncLocalPlants && (
  <button
    className="sync-button"
    type="button"
    onClick={syncLocalPlantsToBackend}
  >
    Перенести локальные растения в backend
  </button>
)}
  <div className="hero-card">
    <p className="eyebrow">Сегодня</p>
    <h2>
      {overduePlants.length > 0
        ? `Просрочено: ${overduePlants.length}`
        : todayWateringPlants.length > 0
          ? `Полить сегодня: ${todayWateringPlants.length}`
          : "Все растения в порядке"}
    </h2>
    <p>
      Главная показывает только важные задачи: просроченный полив,
      полив на сегодня и ближайшие растения по графику.
    </p>
  </div>
{renderSearchBox()}
  <CategoryFilter />

  <div className="quick-actions">
    <button
      type="button"
      onClick={() => {
        setActiveTab("plants");
        openAddPlantForm();
      }}
    >
      <span>➕</span>
      Добавить
    </button>

    <button type="button" onClick={() => setActiveTab("watering")}>
      <span>💧</span>
      Полив
    </button>

    <button type="button" onClick={() => setActiveTab("guide")}>
      <span>📚</span>
      Уход
    </button>
  </div>

  {overduePlants.length > 0 && (
    <>
      <div className="section-title">
        <h3>Просрочено</h3>
      </div>

      <div className="list">
        {overduePlants.map((plant) => {
          const days = Math.abs(getDaysUntilWatering(plant));

          return (
            <article className="task-card danger-task" key={plant.id}>
              <div className="task-icon">{plant.image}</div>

              <div className="task-info">
                <h3>{plant.name}</h3>
                <p>Полив просрочен на {days} дн.</p>
              </div>

              <button
                className="small-button"
                onClick={() => markAsWatered(plant.id)}
              >
                Полил
              </button>
            </article>
          );
        })}
      </div>
    </>
  )}

  {todayWateringPlants.length > 0 && (
    <>
      <div className="section-title">
        <h3>Полить сегодня</h3>
      </div>

      <div className="list">
        {todayWateringPlants.map((plant) => (
          <article className="task-card warning-task" key={plant.id}>
            <div className="task-icon">{plant.image}</div>

            <div className="task-info">
              <h3>{plant.name}</h3>
              <p>
                {plant.place} · {plant.room}
              </p>
            </div>

            <button
              className="small-button"
              onClick={() => markAsWatered(plant.id)}
            >
              Полил
            </button>
          </article>
        ))}
      </div>
    </>
  )}

  <div className="section-title">
    <h3>Ближайший полив</h3>
  </div>

  <div className="list">
    {upcomingWateringPlants.length > 0 ? (
      upcomingWateringPlants.map((plant) => {
        const days = getDaysUntilWatering(plant);

        return (
          <article className="task-card" key={plant.id}>
            <div className="task-icon">{plant.image}</div>

            <div className="task-info">
              <h3>{plant.name}</h3>
              <p>Через {days} дн.</p>
            </div>

            <span className="task-place">{plant.place}</span>
          </article>
        );
      })
    ) : (
      <div className="empty-state">
        Нет ближайших задач по выбранной категории.
      </div>
    )}
  </div>
</section>
        )}

        {activeTab === "plants" && (
          <section className="screen">
            <div className="section-title">
              <h2>Мои растения</h2>
              <button className="primary-button" onClick={openAddPlantForm}>
                + Добавить
              </button>

            </div>
         {renderSearchBox()}
            <CategoryFilter />


            {visiblePlants.length === 0 ? (
  <div className="empty-state">
    В категории “{selectedCategory}” пока нет растений.
  </div>
) : (
  <div className="grid">
    {visiblePlants.map((plant) => {
               const nextWatering = addDays(
  plant.lastWateredAt,
  getAdjustedWateringDays(plant)
);

               return (
  <article className="big-card" key={plant.id}>
    <button
      className="plant-cover-button"
      type="button"
      onClick={() => plant.photo && setOpenedPhoto(plant.photo)}
    >
      <div className="big-icon">
        {plant.photo ? (
          <img src={plant.photo} alt={plant.name} />
        ) : (
          plant.image
        )}
      </div>
    </button>

    <div className="plant-card-header">
      <div>
        <h3>{plant.name}</h3>
        <p>{plant.type}</p>
      </div>

      <button
        className="details-toggle"
        type="button"
        onClick={() =>
          setOpenedPlantId(openedPlantId === plant.id ? null : plant.id)
        }
      >
        {openedPlantId === plant.id ? "Скрыть" : "Подробнее"}
      </button>
    </div>

    <div className="meta">
      <span>{plant.place}</span>
      <span>{plant.room}</span>
    </div>

    <p className="next-date">
      Следующий полив: {formatDate(nextWatering)}
    </p>

    {openedPlantId === plant.id && (
      <div className="plant-details">
        <div className="detail-row">
          <span>Базовый интервал</span>
          <strong>{plant.wateringEveryDays} дн.</strong>
        </div>

        <div className="detail-row">
          <span>С учетом сезона</span>
          <strong>{getAdjustedWateringDays(plant)} дн.</strong>
        </div>

        <div className="detail-row">
          <span>Последний полив</span>
          <strong>{formatDate(new Date(plant.lastWateredAt))}</strong>
        </div>

        {plant.wateringHistory && plant.wateringHistory.length > 0 && (
          <div className="details-history">
            <span>История полива</span>

            <div>
              {plant.wateringHistory.slice(0, 5).map((date, index) => (
                <small key={`${date}-${index}`}>
                  {formatDate(new Date(date))}
                </small>
              ))}
            </div>
          </div>
        )}

        <div className="plant-note-box">
          <span>Заметка</span>
          <p>{plant.notes}</p>
        </div>

        <div className="card-actions">
          <button
            className="secondary-button"
            onClick={() => openEditPlantForm(plant)}
          >
            Редактировать
          </button>

          <button
            className="danger-button"
            onClick={() => deletePlant(plant.id)}
          >
            Удалить
          </button>
        </div>
      </div>
    )}
  </article>
);
              })}
            </div>)}
          </section>
        )}

        {activeTab === "watering" && (
          <section className="screen">
           <div className="section-title">
  <h2>Полив</h2>

</div>
{renderSearchBox()}
<CategoryFilter />
<div className="weather-panel">
  <div>
    <h3>Погода для уличного полива</h3>
    <p>
      Учитывает дождь и температуру для растений на улице, балконе и в теплице.
    </p>
  </div>

  <button className="primary-button" onClick={loadWeather}>
    {isWeatherLoading ? "Загрузка..." : "Обновить"}
  </button>
</div>

{weather && (
  <div className="weather-card">
    <h3>Погода сегодня</h3>
    <p>
      Температура: {weather.temperatureMin}…{weather.temperatureMax}°C
    </p>
    <p>Осадки: {weather.precipitationSum} мм</p>
    <p>Дождь: {weather.rainSum} мм</p>
  </div>
)}

{weatherError && <div className="weather-error">{weatherError}</div>}

{visiblePlants.length === 0 ? (
  <div className="empty-state">
    В категории “{selectedCategory}” пока нет растений для полива.
  </div>
) : (
  <div className="watering-dashboard">
    {overduePlants.length > 0 && (
      <section className="watering-section">
        <div className="section-title compact">
          <h3>Просрочено</h3>
        </div>

        <div className="list">
          {overduePlants.map((plant) => {
            const days = Math.abs(getDaysUntilWatering(plant));

            return (
              <article className="watering-task-card danger-task" key={plant.id}>
                <div className="task-icon">{plant.image}</div>

                <div className="task-info">
                  <h3>{plant.name}</h3>
                  <p>
                    Полив просрочен на {days} дн. · {plant.place}
                  </p>
                </div>

                <button
                  className="small-button"
                  onClick={() => markAsWatered(plant.id)}
                >
                  Полил
                </button>
              </article>
            );
          })}
        </div>
      </section>
    )}

    {todayWateringPlants.length > 0 && (
      <section className="watering-section">
        <div className="section-title compact">
          <h3>Полить сегодня</h3>
        </div>

        <div className="list">
          {todayWateringPlants.map((plant) => (
            <article className="watering-task-card warning-task" key={plant.id}>
              <div className="task-icon">{plant.image}</div>

              <div className="task-info">
                <h3>{plant.name}</h3>
                <p>
                  {plant.place} · {plant.room}
                </p>
              </div>

              <button
                className="small-button"
                onClick={() => markAsWatered(plant.id)}
              >
                Полил
              </button>
            </article>
          ))}
        </div>
      </section>
    )}

    <section className="watering-section">
      <div className="section-title compact">
        <h3>Скоро поливать</h3>
      </div>

      <div className="list">
        {upcomingWateringPlants.length > 0 ? (
          upcomingWateringPlants.map((plant) => {
            const days = getDaysUntilWatering(plant);

            return (
              <article className="watering-task-card" key={plant.id}>
                <div className="task-icon">{plant.image}</div>

                <div className="task-info">
                  <h3>{plant.name}</h3>
                  <p>
                    Через {days} дн. · {plant.place}
                  </p>
                </div>

                <span className="task-place">{plant.room}</span>
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            Нет ближайших поливов по выбранной категории.
          </div>
        )}
      </div>
    </section>

    <section className="watering-section">
      <div className="section-title compact">
        <h3>Все растения</h3>
      </div>

      <div className="list">
        {visiblePlants.map((plant) => {
          const status = getWateringStatus(plant);

          return (
            <article className="care-card" key={plant.id}>
              <div className="care-main">
                <div className="care-title">
                  <span>{plant.image}</span>
                  <h3>{plant.name}</h3>
                </div>

                <p>{status.text}</p>

                <p className="muted">
                  Базовый интервал: каждые {plant.wateringEveryDays} дн.
                </p>

                <p className="muted">
                  С учетом сезона: каждые {getAdjustedWateringDays(plant)} дн.
                </p>

                <div className="season-advice">
                  <strong>{getSeasonName(getCurrentSeason())}</strong>
                  <span>{getSeasonWateringAdvice(plant)}</span>
                </div>

                <div className="weather-advice">
                  <strong>Погода</strong>
                  <span>{getWeatherWateringAdvice(plant)}</span>
                </div>

                {plant.wateringHistory && plant.wateringHistory.length > 0 && (
                  <div className="watering-history">
                    <span>История:</span>

                    {plant.wateringHistory.slice(0, 3).map((date, index) => (
                      <small key={`${date}-${index}`}>
                        {formatDate(new Date(date))}
                      </small>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="primary-button care-water-button"
                onClick={() => markAsWatered(plant.id)}
              >
                Полил
              </button>
            </article>
          );
        })}
      </div>
    </section>
  </div>
)}
          </section>
        )}

        {activeTab === "gallery" && (
          <section className="screen">
            <div className="section-title">
              <h2>Галерея</h2>
            </div>
          {renderSearchBox()}
<CategoryFilter />

            {visiblePlants.length === 0 ? (
  <div className="empty-state">
    В категории “{selectedCategory}” пока нет фото растений.
  </div>
) : (
  <div className="gallery">
    {visiblePlants.map((plant) => (
                <div className="photo-card" key={plant.id}>
                <button
  className="photo-placeholder photo-clickable"
  onClick={() => plant.photo && setOpenedPhoto(plant.photo)}
  type="button"
>
  {plant.photo ? (
    <img src={plant.photo} alt={plant.name} />
  ) : (
    plant.image
  )}
</button><h3>{plant.name}</h3>
                  <p>Фото роста растения будут здесь</p>
                </div>
              ))}
            </div>)}
          </section>
        )}

        {activeTab === "guide" && (
          <section className="screen">
            <div className="section-title">
              <h2>Справочник ухода</h2>
            </div>
            {renderSearchBox()}
<CategoryFilter />
     {visiblePlants.length === 0 ? (
  <div className="empty-state">
    В категории “{selectedCategory}” пока нет растений для справочника.
  </div>
) : (
  <div className="guide-list">
    {visiblePlants.map((plant) => {
    const guide = getCareGuideForPlant(plant.name);

  return (
  <article className="guide-card" key={plant.id}>
    <button
      className="guide-plant-button"
      type="button"
      onClick={() =>
        setSelectedCarePlantId(
          selectedCarePlantId === plant.id ? null : plant.id
        )
      }
    >
      <span>
        {plant.image} {plant.name}
      </span>

      <strong>
        {selectedCarePlantId === plant.id ? "Скрыть" : "Открыть"}
      </strong>
    </button>

    {selectedCarePlantId === plant.id && (
      <>
        {guide ? (
          <div className="care-guide-details">
            <div>
              <strong>Свет</strong>
              <p>{guide.light}</p>
            </div>

            <div>
              <strong>Полив</strong>
              <p>{guide.watering}</p>
            </div>

            <div>
              <strong>Грунт</strong>
              <p>{guide.soil}</p>
            </div>

            <div>
              <strong>Удобрение</strong>
              <p>{guide.feeding}</p>
            </div>

            <div>
              <strong>Ошибки</strong>
              <p>{guide.mistakes}</p>
            </div>

            {plant.notes && (
              <div>
                <strong>Моя заметка</strong>
                <p>{plant.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="care-guide-details">
            <div>
              <strong>Пока нет точного справочника</strong>
              <p>
                Для этого растения пока используется твоя заметка. Позже
                добавим расширенную базу растений.
              </p>
            </div>

            <div>
              <strong>Моя заметка</strong>
              <p>{plant.notes}</p>
            </div>
          </div>
        )}
      </>
    )}
  </article>
);
  })}

<article className="guide-card">
  <h3>🥕 Совместимость посадок</h3>

  <div className="companion-list">
   {visiblePlants.map((plant) => {
      const companion = getCompanionGuideForPlant(plant.name);

      if (!companion) {
        return null;
      }

      return (
        <div className="companion-card" key={plant.id}>
          <h4>
            {plant.image} {companion.name}
          </h4>

          <div className="companion-section good">
            <strong>Хорошие соседи</strong>
            <p>{companion.good.join(", ")}</p>
          </div>

          <div className="companion-section bad">
            <strong>Плохие соседи</strong>
            <p>{companion.bad.join(", ")}</p>
          </div>

          <p className="companion-note">{companion.note}</p>
        </div>
      );
    })}

   {visiblePlants.every((plant) => !getCompanionGuideForPlant(plant.name)) && (
      <p>
        Пока среди твоих растений нет культур из базы совместимости. Добавь,
        например, томаты, огурцы, клубнику, морковь или лук.
      </p>
    )}
  </div>
</article>
</div>)}
          </section>
        )}
      </main>

      {isAddFormOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {editingPlantId ? "Изменение растения" : "Новое растение"}
                </p>
                <h2>
                  {editingPlantId
                    ? "Редактировать растение"
                    : "Добавить растение"}
                </h2>
              </div>

              <button className="icon-button" onClick={closeAddPlantForm}>
                ✕
              </button>
            </div>
<div className="photo-upload">
  <div className="photo-preview">
    {newPlantPhoto ? (
      <img src={newPlantPhoto} alt="Фото растения" />
    ) : (
      <span>{newPlantImage}</span>
    )}
  </div>

  <label className="photo-button">
    Добавить фото
    <input
      type="file"
      accept="image/*"
      onChange={handlePlantPhotoChange}
    />
  </label>

  {newPlantPhoto && (
    <button
      className="remove-photo-button"
      type="button"
      onClick={() => setNewPlantPhoto("")}
    >
      Удалить фото
    </button>
  )}
</div>
            <div className="icon-picker">
              {plantIcons.map((icon) => (
                <button
                  key={icon}
                  className={
                    newPlantImage === icon ? "icon-choice active" : "icon-choice"
                  }
                  onClick={() => setNewPlantImage(icon)}
                  type="button"
                >
                  {icon}
                </button>
              ))}
            </div>

            <label className="field">
              <span>Название</span>
              <input
                value={newPlantName}
                onChange={(event) => setNewPlantName(event.target.value)}
                placeholder="Например: Алоэ"
              />
            </label>
            <button
  className="auto-fill-button"
  type="button"
  onClick={applyPlantPreset}
>
  Заполнить автоматически
</button>

            <label className="field">
              <span>Тип</span>
              <input
                value={newPlantType}
                onChange={(event) => setNewPlantType(event.target.value)}
                placeholder="Комнатное, овощ, дерево..."
              />
            </label>

            <label className="field">
              <span>Где находится</span>
              <select
                value={newPlantPlace}
                onChange={(event) =>
                  setNewPlantPlace(event.target.value as PlantPlace)
                }
              >
                <option value="Дом">Дом</option>
                <option value="Балкон">Балкон</option>
                <option value="Улица">Улица</option>
                <option value="Теплица">Теплица</option>
              </select>
            </label>

            <label className="field">
              <span>Комната / место</span>
              <input
                value={newPlantRoom}
                onChange={(event) => setNewPlantRoom(event.target.value)}
                placeholder="Кухня, окно, грядка 1..."
              />
            </label>

            <label className="field">
              <span>Поливать каждые N дней</span>
              <input
                type="number"
                min="1"
                value={newPlantWateringDays}
                onChange={(event) => setNewPlantWateringDays(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Заметка по уходу</span>
              <textarea
                value={newPlantNotes}
                onChange={(event) => setNewPlantNotes(event.target.value)}
                placeholder="Свет, полив, удобрение, особенности..."
                rows={4}
              />
            </label>

            <button className="submit-button" onClick={savePlant}>
              {editingPlantId ? "Сохранить изменения" : "Сохранить растение"}
            </button>
          </div>
        </div>
      )}
{openedPhoto && (
  <div className="photo-viewer" onClick={() => setOpenedPhoto(null)}>
    <button
      className="photo-viewer-close"
      onClick={() => setOpenedPhoto(null)}
      type="button"
    >
      ✕
    </button>

    <img
      src={openedPhoto}
      alt="Открытое фото растения"
      onClick={(event) => event.stopPropagation()}
    />
  </div>
)}
      <nav className="bottom-nav">
        <button
          className={activeTab === "home" ? "active" : ""}
          onClick={() => setActiveTab("home")}
        >
          🏠
          <span>Главная</span>
        </button>

        <button
          className={activeTab === "plants" ? "active" : ""}
          onClick={() => setActiveTab("plants")}
        >
          🌿
          <span>Растения</span>
        </button>

        <button
          className={activeTab === "watering" ? "active" : ""}
          onClick={() => setActiveTab("watering")}
        >
          💧
          <span>Полив</span>
        </button>

        <button
          className={activeTab === "gallery" ? "active" : ""}
          onClick={() => setActiveTab("gallery")}
        >
          🖼️
          <span>Фото</span>
        </button>

        <button
          className={activeTab === "guide" ? "active" : ""}
          onClick={() => setActiveTab("guide")}
        >
          📚
          <span>Уход</span>
        </button>
      </nav>
    </div>
  );
}