import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/api/parseProtocol", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }

    const prompt = `You are a medical assistant specialized in rehabilitation and trauma protocols. 
I will provide you with either unstructured text, a partial JSON layout, or rough notes about a rehabilitation protocol.
Parse the information and return it strictly according to the schema provided. 

CRITICAL INSTRUCTIONS FOR TEXT FORMATTING (goals, loads, redFlags, rules, transition):
1. Keep the text EXTREMELY SHORT and concise. Maximum 3-4 bullet points per section.
2. You MUST use physical newline characters (\\n) to separate each bullet point. Do NOT combine points into a single line.
3. Every single point MUST be formatted as a short bold-like label followed by a colon, then a brief description. Example: "Адаптация: безболезненная переносимость упражнений."
4. Remove any fluff or introductory words. Be as direct as a medical checklist.

If information is missing for an exercise (like execution details, reps, sets, etc.), generate clinically sound default instructions based on modern traumatology and rehabilitation protocols.
If an exercise feels incomplete, enrich it safely with standard instructions.

CRITICAL: If the input contains a diagnosis, but does NOT contain specific information about "allowed loads" (разрешенные нагрузки) or it's empty, YOU MUST GENUINELY CREATE AND WRITE a clinically appropriate "loads" block based on that diagnosis IN RUSSIAN. For example, explain what activities, weight bearing, or loads are permitted for this typical diagnosis. Do not leave it empty if a diagnosis is known. All text must be in Russian language.

If there are fields for the protocol header (like doctor, patient name) missing, leave them as null or omit them.

Here is the input data:
${input}
`;
    // Define the schema using Gemini SDK format
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING, description: "Diagnosis string. Can be empty string if not provided." },
            stage: { type: Type.STRING, description: "Rehabilitation stage. Can be empty." },
            patientName: { type: Type.STRING, description: "Patient's name. Can be empty." },
            goals: { type: Type.STRING, description: "Goals of rehabilitation. Format as a list with short labels followed by a colon. Each item on a new line (e.g., 'Цель 1: описание'). All text in Russian. Leave empty if missing." },
            loads: { type: Type.STRING, description: "Information about loads/weight bearing. If missing, strictly generate appropriate load information based on the diagnosis. Format as a list with short labels followed by a colon. Each item on a new line (e.g., 'Этап 1: описание'). All text in Russian." },
            redFlags: { type: Type.STRING, description: "Red flags or warnings. Format as a list with short labels followed by a colon. Each item on a new line (e.g., 'Симптом: описание'). All text in Russian. Leave empty if missing." },
            rules: { type: Type.STRING, description: "Important rules. Format as a list with short labels followed by a colon. Each item on a new line (e.g., 'Правило: описание'). All text in Russian. Leave empty if missing." },
            transition: { type: Type.STRING, description: "Criteria for transition to next stage. Format as a list with short labels followed by a colon. Each item on a new line (e.g., 'Критерий: описание'). All text in Russian. Leave empty if missing." },
            doctorName: { type: Type.STRING, description: "Doctor's name. Or default to 'МИХАИЛ БРАТУСЬ'." },
            doctorRole: { type: Type.STRING, description: "Doctor's role. Or default to 'ГЛАВНЫЙ ВРАЧ «СМП МЕД»'." },
            doctorTg: { type: Type.STRING, description: "Doctor's telegram. Or default to '@Doc_Bratus'." },
            doctorPhone: { type: Type.STRING, description: "Doctor's phone. Or default to '+7 965 761-65-43'." },
            exercises: {
              type: Type.ARRAY,
              description: "Array of exercises",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Title of the exercise" },
                  desc: { type: Type.STRING, description: "Detailed description. Do NOT use markdown like asterisks (* or **) or hashtags. Use plain text. Use standard prefixes like 'Исходное положение:', 'Выполнение:', 'Важно:', 'Ошибки:'." },
                  dose: { type: Type.STRING, description: "Dosage like '10-12 ПОВТОРЕНИЙ, 2-3 ПОДХОДА'" },
                  imageCount: { type: Type.INTEGER, description: "Number of images attached, usually 2 or 1 or 3. Default to 2." }
                },
                required: ["title", "desc", "dose"]
              }
            }
          },
        }
      }
    });

    if (response.text) {
      const parsedData = JSON.parse(response.text);
      res.json(parsedData);
    } else {
      throw new Error("Unable to parse model response");
    }

  } catch (error: any) {
    console.error("Error parsing protocol:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
