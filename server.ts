import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// AI endpoints
app.post("/api/ai/diagnose", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API Key is not set." });
    }
    const { issueDescription, inventory } = req.body;
    if (!issueDescription) {
      return res.status(400).json({ error: "issueDescription is required." });
    }

    const inventoryPrompt = inventory && Array.isArray(inventory)
      ? `Here are the available parts in inventory: ${JSON.stringify(inventory.map(i => ({ name: i.name, sku: i.sku, qty: i.quantity })))}`
      : "No direct inventory provided, recommend standard parts.";

    const prompt = `Analyze the following service device/equipment issue and provide professional diagnostic advice, estimated costs, recommended spare parts, and estimate of repair time.
    
Issue: "${issueDescription}"
${inventoryPrompt}

Provide the response in structured JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an intelligent, senior technician assistant specializing in general systems and stock electronics repair. Provide accurate and direct structural feedback.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            possibleCauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Top 3 likely causes for the reported issue"
            },
            diagnosticSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Step-by-step diagnostic or testing instructions"
            },
            estimatedHours: {
              type: Type.STRING,
              description: "Estimated labor time required (e.g., '1-2 hrs' or '30 mins')"
            },
            recommendedParts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific parts recommended from current inventory or generally"
            },
            proActiveTips: {
              type: Type.STRING,
              description: "A proactive technical tip or preventative advice"
            }
          },
          required: ["possibleCauses", "diagnosticSteps", "estimatedHours", "recommendedParts", "proActiveTips"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("AI Diagnose error:", error);
    res.status(500).json({ error: error.message || "AI Analysis failed" });
  }
});

app.post("/api/ai/inventory-optimize", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API Key is not set." });
    }
    const { inventory } = req.body;
    if (!inventory || !Array.isArray(inventory)) {
      return res.status(400).json({ error: "inventory array is required." });
    }

    const prompt = `Analyze this business inventory: ${JSON.stringify(inventory.map(i => ({ name: i.name, category: i.category, sku: i.sku, qty: i.quantity, min: i.minStock || 5, price: i.price })))}. Give concise critical insights, order/restocking recommendations, and parts compatibility advice.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an inventory supply chain strategist for electronic service stations. Provide short, concise, high-value, bulleted analysis under 250 words.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            criticalAlerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Critical alerts for items that are severely understocked or out"
            },
            restockRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific restocking recommendations with suggested quantities"
            },
            strategicAdvice: {
              type: Type.STRING,
              description: "A high-level sentence on catalog optimization or cost-saving strategy"
            }
          },
          required: ["criticalAlerts", "restockRecommendations", "strategicAdvice"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("AI Inventory error:", error);
    res.status(500).json({ error: error.message || "AI Inventory analysis failed" });
  }
});

app.post("/api/ai/draft-msg", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API Key is not set." });
    }
    const { customerName, jobNo, itemsDescription, status } = req.body;
    if (!customerName || !jobNo) {
      return res.status(400).json({ error: "customerName and jobNo are required." });
    }

    const prompt = `Draft a polite, highly professional message updates for customer ${customerName} regarding their service ticket ${jobNo}. The device items: "${itemsDescription || "Technical Logistics Service"}", current status is "${status || "In Progress"}". Make it neat, pleasant, and include a clear, friendly call-to-action. No markdown formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a customer notifications copywriting wizard. Draft friendly messages clear of markdown headers, direct and perfect for WhatsApp or SMS templates.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            messageText: {
              type: Type.STRING,
              description: "The complete message draft text suitable to copy-paste"
            }
          },
          required: ["messageText"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("AI Draft error:", error);
    res.status(500).json({ error: error.message || "AI Copywriting failed" });
  }
});

// --- Server-Side JSON database key-value persistence ---
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

const DB_FILE_PATH = path.join(process.cwd(), "server_db.json");

function readServerDb(): Record<string, string> {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read server_db.json, fallback: empty local storage representation.", error);
  }
  return {};
}

function writeServerDb(dbData: Record<string, string>) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write server_db.json:", error);
  }
}

// Initialize Firebase Client SDK on the Backend Server if possible
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let clientDb: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    if (firebaseConfig && firebaseConfig.projectId) {
      const clientApp = initializeApp(firebaseConfig);
      clientDb = firebaseConfig.firestoreDatabaseId 
        ? getFirestore(clientApp, firebaseConfig.firestoreDatabaseId)
        : getFirestore(clientApp);
      console.log("Firebase Client initialized successfully on backend server with project ID:", firebaseConfig.projectId, "and database ID:", firebaseConfig.firestoreDatabaseId || "(default)");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Client on backend server:", err);
  }
}

app.get("/api/db/:key", async (req, res) => {
  const { key } = req.params;

  if (clientDb) {
    try {
      const docRef = doc(clientDb, "kv_store", key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return res.json({ value: data && data.value !== undefined ? data.value : null });
      } else {
        // Not found in Firestore yet, fall back to server_db.json
        const dbData = readServerDb();
        const fallbackValue = dbData[key];
        if (fallbackValue !== undefined) {
          // Sync it immediately so it gets stored in Firestore
          await setDoc(docRef, { value: fallbackValue, updatedAt: new Date().toISOString() });
          return res.json({ value: fallbackValue });
        }
        return res.json({ value: null });
      }
    } catch (err: any) {
      console.error(`Firebase Firestore read error for key "${key}", falling back to file storage:`, err);
    }
  }

  // Fallback to absolute file cache
  const dbData = readServerDb();
  const value = dbData[key] !== undefined ? dbData[key] : null;
  res.json({ value });
});

app.post("/api/db/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "value is required in request body" });
  }

  // Always write locally as a hot cache backup
  const dbData = readServerDb();
  dbData[key] = value;
  writeServerDb(dbData);

  if (clientDb) {
    try {
      const docRef = doc(clientDb, "kv_store", key);
      await setDoc(docRef, { value, updatedAt: new Date().toISOString() });
      console.log(`Backend saved key "${key}" securely to Firebase Cloud Firestore via Client SDK.`);
      return res.json({ success: true, key, stored: "firestore" });
    } catch (err: any) {
      console.error(`Firebase Firestore write error for key "${key}":`, err);
    }
  }

  res.json({ success: true, key, stored: "local" });
});

app.get("/api/db-batch", async (req, res) => {
  if (clientDb) {
    try {
      const colRef = collection(clientDb, "kv_store");
      const colSnap = await getDocs(colRef);
      const data: Record<string, string> = {};

      colSnap.forEach((docSnap) => {
        const docData = docSnap.data();
        if (docData && docData.value !== undefined) {
          data[docSnap.id] = docData.value;
        }
      });

      if (Object.keys(data).length > 0) {
        return res.json({ success: true, data });
      }
    } catch (err: any) {
      console.error("Firebase Firestore batch read error, falling back to file storage:", err);
    }
  }

  const dbData = readServerDb();
  res.json({ success: true, data: dbData });
});

app.post("/api/db-batch", async (req, res) => {
  const { payload } = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "payload must be a flat dictionary object" });
  }

  // Always write locally as a hot cache backup
  const dbData = readServerDb();
  const merged = { ...dbData, ...payload };
  writeServerDb(merged);

  if (clientDb) {
    try {
      const writePromises = Object.entries(payload).map(async ([key, value]) => {
        const docRef = doc(clientDb, "kv_store", key);
        await setDoc(docRef, { value, updatedAt: new Date().toISOString() });
      });
      await Promise.all(writePromises);
      console.log(`Backend batch-saved ${Object.keys(payload).length} keys securely to Firebase Cloud Firestore via Client SDK.`);
      return res.json({ success: true, stored: "firestore" });
    } catch (err: any) {
      console.error("Firebase Firestore batch write error:", err);
    }
  }

  res.json({ success: true, stored: "local" });
});

// Vite middleware development / static files production
async function setupVite() {
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
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

setupVite();
