import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

type PlantPlace = "Дом" | "Балкон" | "Улица" | "Теплица";

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

const app = express();
const port = Number(process.env.PORT || 4000);

const dataFilePath = path.join(process.cwd(), "data", "plants.json");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

async function readPlants(): Promise<Plant[]> {
  try {
    const fileContent = await fs.readFile(dataFilePath, "utf-8");
    return JSON.parse(fileContent) as Plant[];
  } catch {
    return [];
  }
}

async function writePlants(plants: Plant[]) {
  await fs.writeFile(dataFilePath, JSON.stringify(plants, null, 2), "utf-8");
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "garden-backend",
  });
});

app.get("/plants", async (_request, response) => {
  const plants = await readPlants();
  response.json(plants);
});

app.post("/plants", async (request, response) => {
  const plants = await readPlants();

  const newPlant: Plant = {
    id: Date.now(),
    name: request.body.name,
    type: request.body.type || "Новое растение",
    place: request.body.place || "Дом",
    room: request.body.room || "Не указано",
    image: request.body.image || "🌱",
    photo: request.body.photo,
    wateringEveryDays: Number(request.body.wateringEveryDays || 7),
    lastWateredAt:
      request.body.lastWateredAt || new Date().toISOString().slice(0, 10),
    wateringHistory: request.body.wateringHistory || [],
    notes: request.body.notes || "Правила ухода пока не добавлены.",
  };

  const updatedPlants = [newPlant, ...plants];

  await writePlants(updatedPlants);

  response.status(201).json(newPlant);
});

app.put("/plants/:id", async (request, response) => {
  const plantId = Number(request.params.id);
  const plants = await readPlants();

  const plantIndex = plants.findIndex((plant) => plant.id === plantId);

  if (plantIndex === -1) {
    response.status(404).json({
      message: "Растение не найдено",
    });
    return;
  }

  const updatedPlant: Plant = {
    ...plants[plantIndex],
    ...request.body,
    id: plants[plantIndex].id,
  };

  plants[plantIndex] = updatedPlant;

  await writePlants(plants);

  response.json(updatedPlant);
});

app.delete("/plants/:id", async (request, response) => {
  const plantId = Number(request.params.id);
  const plants = await readPlants();

  const updatedPlants = plants.filter((plant) => plant.id !== plantId);

  await writePlants(updatedPlants);

  response.json({
    ok: true,
  });
});

app.post("/plants/:id/water", async (request, response) => {
  const plantId = Number(request.params.id);
  const plants = await readPlants();
  const today = new Date().toISOString().slice(0, 10);

  let updatedPlant: Plant | null = null;

  const updatedPlants = plants.map((plant) => {
    if (plant.id !== plantId) {
      return plant;
    }

    updatedPlant = {
      ...plant,
      lastWateredAt: today,
      wateringHistory: [today, ...(plant.wateringHistory || [])],
    };

    return updatedPlant;
  });

  if (!updatedPlant) {
    response.status(404).json({
      message: "Растение не найдено",
    });
    return;
  }

  await writePlants(updatedPlants);

  response.json(updatedPlant);
});

app.listen(port, () => {
  console.log(`Garden backend is running on http://localhost:${port}`);
});
