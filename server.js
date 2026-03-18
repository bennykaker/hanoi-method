const express = require("express");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const exercises = require("./exercises");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("."));

const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    wordCount: 0,
    notes: [
      "Rate limit reached.",
      "Too many reviews requested.",
      "Wait a moment."
    ],
    next: "Try again in a minute."
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getExerciseByCategory(category) {
  if (!category || category === "all") {
    return randomItem(exercises);
  }

  const filtered = exercises.filter(
    (exercise) => exercise.category === category
  );

  if (filtered.length === 0) {
    return randomItem(exercises);
  }

  return randomItem(filtered);
}

app.get("/exercise", (req, res) => {
  const category = req.query.category || "all";
  res.json(getExerciseByCategory(category));
});

app.get("/categories", (req, res) => {
  res.json([
    { value: "all", label: "All" },
    { value: "dialogue", label: "Dialogue" },
    { value: "scene", label: "Scene" },
    { value: "description", label: "Description" },
    { value: "voice", label: "Voice" }
  ]);
});

app.post("/review", reviewLimiter, async (req, res) => {
  const { text, prompt } = req.body;

  if (!text || !text.trim()) {
    return res.json({
      wordCount: 0,
      notes: [
        "Write something first.",
        "No draft to review.",
        "No scene or prose to assess yet."
      ],
      next: "Write a complete draft before submitting."
    });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You review short writing exercises. Be brief, concrete, and unsentimental. Return valid JSON only. No markdown. No preamble."
        },
        {
          role: "user",
          content: `Exercise:
${prompt}

Review this submission and return JSON with exactly this shape:
{
  "wordCount": number,
  "notes": ["string", "string", "string"],
  "next": "string"
}

Rules:
- "wordCount" must be the actual word count.
- "notes" must contain exactly 3 short sentences.
- One note must address length or constraint handling.
- One note must address whether the core exercise requirement was met.
- One note must address scene or prose quality in concrete terms.
- "next" must be one short revision instruction.
- Do not praise effort.
- No extra keys.

Submission:
${text}`
        }
      ]
    });

    const raw = response.output_text;
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error("REVIEW ERROR:");
    console.error(err);

    res.status(500).json({
      wordCount: 0,
      notes: [
        "AI request failed.",
        err.message || "Unknown server error.",
        err.code || err.type || "No error code."
      ],
      next: "Check the terminal."
    });
  }
});

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});