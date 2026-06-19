const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;

const PROMPT = `Resumí la siguiente conversación con un cliente en texto plano, sin títulos, sin bullets, sin markdown. Escribí en primera persona desde mi perspectiva (soy quien atiende al cliente). Usá "le consulté", "le pedí", "quedé en revisar", etc. en lugar de hablar de mí en tercera persona. Máximo un párrafo corto, muy conciso, solo lo más importante. Respondé en el mismo idioma que la conversación.

Conversación:
`;

app.get("/", (_req, res) => res.json({ status: "ok", app: "Arconote Server" }));

// Resumir con Claude
app.post("/summarize", async (req, res) => {
  try {
    const { conversation } = req.body;
    if (!conversation) return res.status(400).json({ error: "Falta la conversación" });
    if (!ANTHROPIC_KEY) return res.status(500).json({ error: "ANTHROPIC_KEY no configurada" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        messages: [{ role: "user", content: PROMPT + conversation }],
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Error en /summarize:", err);
    res.status(500).json({ error: err.message });
  }
});

// Transcribir audio con Whisper
app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta el archivo de audio" });
    if (!OPENAI_KEY) return res.status(500).json({ error: "OPENAI_KEY no configurada" });

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname || "audio.ogg");
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: formData,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Error en /transcribe:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Arconote server corriendo en puerto ${PORT}`));
