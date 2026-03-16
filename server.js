const express = require("express");
const OpenAI = require("openai");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("."));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const exercises = [
  {
    id: 1,
    title: "Subtext",
    prompt: "Write a short scene between two people who want different things. Neither character may say directly what they want. Limit: 120 words."
  },
  {
    id: 2,
    title: "Concealed motive",
    prompt: "Write a short scene in which one person needs a favour but pretends they are only making conversation. Limit: 120 words."
  },
  {
    id: 3,
    title: "Power shift",
    prompt: "Write a short scene in which the balance of power changes once. Do not explain the change. Limit: 120 words."
  }
];

function randomExercise() {
  return exercises[Math.floor(Math.random() * exercises.length)];
}

app.get("/exercise", (req, res) => {
  res.json(randomExercise());
});

app.post("/review", async (req, res) => {
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
          content: "You review short writing exercises. Be brief, concrete, and unsentimental. Return valid JSON only. No markdown. No preamble."
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