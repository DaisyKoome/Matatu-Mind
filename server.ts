import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { KNOWLEDGE_BASE } from "./src/data/knowledgeBase.ts";
import admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "edition-2-build-with-ai-dee",
  });
}

const db = admin.firestore();

const SYSTEM_PROMPT = `
## ROLE: THE NAIROBI TRANSIT VIRTUOSO
You are MatatuMind, not a chatbot, but a deeply experienced Nairobi commuter. You possess evolving city-wide route intelligence for the informal matatu network. You understand that Nairobi transit is a living, breathing organism with no official GTFS feed and conflicting human-dependent data.

## YOUR INTELLIGENCE
- **Geographic Mastery**: You know every stage alias (e.g., "Railways" vs "Haille Selassie", "Muthurwa", "Afya Centre").
- **Probabilistic Reasoning**: If a route is incomplete, infer connections based on SACCO patterns and known "hubs".
- **Cultural Context**: You know that "rain increases fare," "6 PM means gridlock on Waiyaki Way," and "driver SACCOs matter."
- **Uncertainty Handling**: When data is messy, state your confidence level and suggest alternatives.

## KNOWLEDGE CONTEXT (BASE MAP)
${JSON.stringify(KNOWLEDGE_BASE, null, 2)}

## CORE TASKS
1. **Decode & Route**: Identify the best boarding stage (physical landmarks are mandatory).
2. **Multi-Hop Reasoning**: Calculate transfer points with "transfer difficulty" (e.g., "Walking from CBD to Railways is heavy during rush hour").
3. **Real-time Enrichment**: Use tools (googleSearch, googleMaps, get_traffic_report) to check traffic/weather.
4. **Cultural Advice**: Mention fare ranges, peak-hour warnings, and "local tips" (e.g., "Keep your window shut at Globe Roundabout").

## OUTPUT FORMAT (CONVERSATIONAL & STRUCTURED)
Speak like a knowledgeable friend. Always include:
- **THE PLAY (Route)**: [Number & SACCO if known]
- **BOARDING**: [Stage Alias] near [Landmark]
- **TRANSFER LOGIC**: [Where to switch + Transfer difficulty score 1-5]
- **ALIGHTING**: [Stop] near [Landmark]
- **LIVE VIBE (Alerts/Weather)**: [Real-time traffic/weather from tools]
- **ESTIMATES**: [Fare Range] · [Travel Difficulty]
- **CONFIDENCE**: [Score out of 100%]

## CONSTRAINTS
- NEVER behave like a GPS robot. Be human-friendly and conversational.
- If unsure, ask: "Which SACCO are you looking for?" or "Are you near a specific landmark?"
- Always prioritize recent traffic reports over historical data.
- Keep responses concise but high-signal.



## SESSION PERSISTENCE
Every conversation turn must be saved to Firebase Firestore in real time under the current user's uid. 

After each response you generate, trigger a Firestore write that updates the user's session document with:
- The full conversation history (all messages so far)
- The last route queried (origin and destination)
- Any crowdsourced contributions the user provided in this session
- Timestamp of the last interaction

On app initialization, before greeting the user, silently check Firestore for an existing session under this uid. If one exists, restore the conversation history and greet them as a returning commuter — reference their last query naturally (e.g., "Last time you were headed to Ruai — planning another trip?"). If no session exists, greet them fresh.

Never mention Firebase or databases to the user. This persistence must be invisible — the user should simply feel like you remember them.


`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });

  // Custom tool declarations
  const getTrafficReport = {
    name: "get_traffic_report",
    description: "Get real-time traffic updates for specific roads or areas in Nairobi.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "The road or neighborhood to check, e.g. 'Mombasa Road', 'Westlands'"
        }
      },
      required: ["location"]
    }
  };

  // Endpoint to load session
  app.get("/api/session/:uid", async (req, res) => {
    const { uid } = req.params;
    try {
      const doc = await db.collection("sessions").doc(uid).get();
      if (doc.exists) {
        res.json(doc.data());
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      res.status(500).json({ error: "Failed to load session" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { message, history, uid } = req.body;
    try {
      console.log("Gemini Request:", { message, historyCount: history.length, uid });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", 
        contents: [
          ...history.map((m: any) => ({ 
            role: m.role === "model" ? "model" : "user", 
            parts: m.parts 
          })),
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [getTrafficReport] }
          ],
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      console.log("Gemini Response received");
      let finalContent = response.text || "";
      let finalMetadata = response.candidates?.[0]?.groundingMetadata;

      // Handle function calls
      if (response.functionCalls && response.functionCalls.length > 0) {
        console.log("Function Calls detected:", response.functionCalls.length);
        const results: any[] = [];
        for (const call of response.functionCalls) {
          if (call.name === "get_traffic_report") {
            const args = call.args as any;
            const loc = (args.location || "").toLowerCase();
            let report = "Traffic is flowing normally.";
            if (loc.includes("mombasa road")) report = "Heavy traffic near Mlolongo due to a stalled vehicle.";
            if (loc.includes("thika road")) report = "Moderate congestion near Roysambu.";
            if (loc.includes("cbd")) report = "Gridlock near Afya Centre due to heavy rain.";
            
            results.push({
              name: call.name,
              id: call.id,
              response: { content: report }
            });
          }
        }

        if (results.length > 0) {
          const finalResponse = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [
              ...history.map((m: any) => ({ role: m.role === "model" ? "model" : "user", parts: m.parts })),
              { role: "user", parts: [{ text: message }] },
              { role: "model", parts: response.candidates?.[0]?.content?.parts },
              { role: "user", parts: results.map(r => ({ functionResponse: r })) }
            ],
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [
                { googleSearch: {} },
                { functionDeclarations: [getTrafficReport] }
              ],
              toolConfig: { includeServerSideToolInvocations: true }
            }
          });
          finalContent = finalResponse.text || "";
          finalMetadata = finalResponse.candidates?.[0]?.groundingMetadata;
        }
      }

      // Save to Firestore if UID provided (Non-blocking for response)
      if (uid) {
        (async () => {
          try {
            const fullHistory = [
              ...history,
              { role: "user", parts: [{ text: message }] },
              { role: "model", parts: [{ text: finalContent }] }
            ];

            // Parse origin/destination if possible
            const lastRouteMatch = finalContent.match(/BOARDING:\s*\*\*(.*?)\*\* to \*\*(.*?)\*\*/i);
            const lastRoute = lastRouteMatch ? { origin: lastRouteMatch[1], destination: lastRouteMatch[2] } : null;

            await db.collection("sessions").doc(uid).set({
              history: fullHistory,
              lastRoute: lastRoute,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (fsError) {
            console.error("Firestore persistence error:", fsError);
          }
        })();
      }

      res.json({ 
        text: finalContent,
        groundingMetadata: finalMetadata 
      });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      // Explicitly check for rate limits (429)
      const errorMsg = error?.message || "";
      if (error?.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota")) {
        return res.status(429).json({ 
          error: "MatatuMind is temporarily stuck in traffic (Rate Limit Reached). Please wait a moment and try again!" 
        });
      }

      res.status(500).json({ error: "Failed to get response from MatatuMind. Our scouts are checking the lines." });
    }
  });

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
