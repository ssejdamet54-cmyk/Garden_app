"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
const dataFilePath = path_1.default.join(process.cwd(), "data", "plants.json");
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
async function readPlants() {
    try {
        const fileContent = await promises_1.default.readFile(dataFilePath, "utf-8");
        return JSON.parse(fileContent);
    }
    catch {
        return [];
    }
}
async function writePlants(plants) {
    await promises_1.default.writeFile(dataFilePath, JSON.stringify(plants, null, 2), "utf-8");
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
    const newPlant = {
        id: Date.now(),
        name: request.body.name,
        type: request.body.type || "Новое растение",
        place: request.body.place || "Дом",
        room: request.body.room || "Не указано",
        image: request.body.image || "🌱",
        photo: request.body.photo,
        wateringEveryDays: Number(request.body.wateringEveryDays || 7),
        lastWateredAt: request.body.lastWateredAt || new Date().toISOString().slice(0, 10),
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
    const updatedPlant = {
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
    let updatedPlant = null;
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
