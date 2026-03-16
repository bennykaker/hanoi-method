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
    prompt:
      "Write a short scene between two people who want different things. Neither character may say directly what they want. Limit: 120 words."
  },
  {
    id: 2,
    title: "Concealed motive",
    prompt:
      "Write a short scene in which one person needs a favour but pretends they are only making conversation. Limit: 120 words."
  },
  {
    id: 3,
    title: "Power shift",
    prompt:
      "Write a short scene in which the balance of power changes once. Do not explain the change. Limit: 120 words."
  },
  {
    id: 4,
    title: "Conflict",
    prompt:
      "Write a short scene between two people who are being polite while trying to block each other. Limit: 120 words."
  },
  {
    id: 5,
    title: "Pressure",
    prompt:
      "Write a short scene in which one person is in a hurry and the other refuses to speed up. Limit: 120 words."
  },
  {
    id: 6,
    title: "Bad news",
    prompt:
      "Write a short scene in which someone delivers bad news indirectly. Limit: 120 words."
  },
  {
    id: 7,
    title: "Object",
    prompt:
      "Describe an ordinary object so that it feels charged with emotion, but do not name the emotion. Limit: 120 words."
  },
  {
    id: 8,
    title: "Arrival",
    prompt:
      "Write a short scene in which someone arrives late and tries to hide why. Limit: 120 words."
  },
  {
    id: 9,
    title: "Voice",
    prompt:
      "Write a short scene in which one person is trying to sound calm and fails only once. Limit: 120 words."
  },
  {
    id: 10,
    title: "Decision",
    prompt:
      "Write a short scene that ends with a decision, but do not state the decision directly. Limit: 120 words."
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
      notes: ["Write something first.", "No draft to review.", "No scene or prose to assess yet."],
      next: "Write a complete draft before submitting."
    });
  }

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You review short writing exercises. Be brief, concrete, and unsentimental. Return valid JSON only. No markdown. No preamble."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Exercise:
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
- One note must address scene/prose quality in concrete terms.
- "next" must be one short revision instruction.
- Do not praise effort.
- Do not use bullet symbols inside the strings.
- No extra keys.

Submission:
${text}`
            }
          ]
        }
      ]
    });

    const raw = response.output_text;
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        wordCount: 0,
        notes: ["The review response was not valid JSON.", "The model output could not be parsed.", "Submit again."],
        next: "Submit again."
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      wordCount: 0,
      notes: ["AI request failed.", "The review could not be generated.", "Try again."],
      next: "Try again."
    });
  }
});

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});