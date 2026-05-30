import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./db";

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

type DbPlant = {
  id: number;
  name: string;
  type: string;
  place: PlantPlace;
  room: string;
  image: string;
  photo: string | null;
  watering_every_days: number;
  last_watered_at: string;
  watering_history: string[] | null;
  notes: string;
};

const app = express();
const port = Number(process.env.PORT || 4000);
const defaultOwnerId = process.env.OWNER_ID || "default";

function getOwnerId(request: express.Request) {
  const ownerId = request.header("x-owner-id");

  if (ownerId && ownerId.trim().length > 0) {
    return ownerId;
  }

  return defaultOwnerId;
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function toApiPlant(plant: DbPlant): Plant {
  return {
    id: Number(plant.id),
    name: plant.name,
    type: plant.type,
    place: plant.place,
    room: plant.room,
    image: plant.image,
    photo: plant.photo || undefined,
    wateringEveryDays: Number(plant.watering_every_days),
    lastWateredAt: String(plant.last_watered_at).slice(0, 10),
    wateringHistory: Array.isArray(plant.watering_history)
      ? plant.watering_history
      : [],
    notes: plant.notes,
  };
}

function toDbPlant(plant: Partial<Plant>, ownerId: string) {
  return {
    id: Number(plant.id || Date.now()),
    owner_id: ownerId,
    name: plant.name || "Новое растение",
    type: plant.type || "Новое растение",
    place: plant.place || "Дом",
    room: plant.room || "Не указано",
    image: plant.image || "🌱",
    photo: plant.photo || null,
    watering_every_days: Number(plant.wateringEveryDays || 7),
    last_watered_at:
      plant.lastWateredAt || new Date().toISOString().slice(0, 10),
    watering_history: Array.isArray(plant.wateringHistory)
      ? plant.wateringHistory
      : [],
    notes: plant.notes || "Правила ухода пока не добавлены.",
  };
}

app.get("/health", async (_request, response) => {
  const { error } = await supabase.from("plants").select("id").limit(1);

  if (error) {
    console.error("Supabase health error:", error);

    response.status(500).json({
      ok: false,
      service: "garden-backend",
      database: "disconnected",
      error: error.message,
    });

    return;
  }

  response.json({
    ok: true,
    service: "garden-backend",
    database: "connected",
  });
});

app.get("/plants", async (request, response) => {
  const ownerId = getOwnerId(request);
  const { data, error } = await supabase
    .from("plants")
    .select(
      "id,name,type,place,room,image,photo,watering_every_days,last_watered_at,watering_history,notes"
    )
    .eq("owner_id", ownerId)
    .order("id", { ascending: false });

  if (error) {
    console.error("Get plants error:", error);

    response.status(500).json({
      message: "Не удалось получить растения",
      error: error.message,
    });

    return;
  }

  response.json((data || []).map((plant) => toApiPlant(plant as DbPlant)));
});

app.post("/plants", async (request, response) => {
  const ownerId = getOwnerId(request);
  const dbPlant = toDbPlant(request.body as Partial<Plant>, ownerId);

  const { data, error } = await supabase
    .from("plants")
    .insert(dbPlant)
    .select()
    .single();

  if (error) {
    console.error("Create plant error:", error);

    response.status(500).json({
      message: "Не удалось добавить растение",
      error: error.message,
    });

    return;
  }

  response.status(201).json(toApiPlant(data as DbPlant));
});

app.put("/plants/:id", async (request, response) => {
  const plantId = Number(request.params.id);
const ownerId = getOwnerId(request);
const { data: existingPlant, error: findError } = await supabase
  .from("plants")
  .select("*")
  .eq("id", plantId)
  .eq("owner_id", ownerId)
  .single();
  if (findError || !existingPlant) {
    response.status(404).json({
      message: "Растение не найдено",
    });

    return;
  }

  const currentPlant = toApiPlant(existingPlant as DbPlant);

  const updatedPlant: Plant = {
    ...currentPlant,
    ...(request.body as Partial<Plant>),
    id: plantId,
  };

  const { data, error } = await supabase
    .from("plants")
    .update({
      name: updatedPlant.name,
      type: updatedPlant.type,
      place: updatedPlant.place,
      room: updatedPlant.room,
      image: updatedPlant.image,
      photo: updatedPlant.photo || null,
      watering_every_days: Number(updatedPlant.wateringEveryDays),
      last_watered_at: updatedPlant.lastWateredAt,
      watering_history: updatedPlant.wateringHistory || [],
      notes: updatedPlant.notes,
      updated_at: new Date().toISOString(),
    })
  .eq("id", plantId)
.eq("owner_id", ownerId)
    .select()
    .single();

  if (error) {
    console.error("Update plant error:", error);

    response.status(500).json({
      message: "Не удалось обновить растение",
      error: error.message,
    });

    return;
  }

  response.json(toApiPlant(data as DbPlant));
});

app.delete("/plants/:id", async (request, response) => {
  const plantId = Number(request.params.id);
  const ownerId = getOwnerId(request);

 const { error } = await supabase
  .from("plants")
  .delete()
  .eq("id", plantId)
  .eq("owner_id", ownerId);

  if (error) {
    console.error("Delete plant error:", error);

    response.status(500).json({
      message: "Не удалось удалить растение",
      error: error.message,
    });

    return;
  }

  response.json({
    ok: true,
  });
});

app.post("/plants/:id/water", async (request, response) => {
  const plantId = Number(request.params.id);
  const ownerId = getOwnerId(request);
  const today = new Date().toISOString().slice(0, 10);

  const { data: existingPlant, error: findError } = await supabase
  .from("plants")
  .select("*")
  .eq("id", plantId)
  .eq("owner_id", ownerId)
  .single();
  
  if (findError || !existingPlant) {
    response.status(404).json({
      message: "Растение не найдено",
    });

    return;
  }

  const currentPlant = toApiPlant(existingPlant as DbPlant);
  const updatedHistory = [today, ...(currentPlant.wateringHistory || [])];

  const { data, error } = await supabase
    .from("plants")
    .update({
      last_watered_at: today,
      watering_history: updatedHistory,
      updated_at: new Date().toISOString(),
    })
   .eq("id", plantId)
    .select()
    .single();

  if (error) {
    console.error("Water plant error:", error);

    response.status(500).json({
      message: "Не удалось отметить полив",
      error: error.message,
    });

    return;
  }

  response.json(toApiPlant(data as DbPlant));
});

app.listen(port, () => {
  console.log(`Garden backend is running on http://localhost:${port}`);
});