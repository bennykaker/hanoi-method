const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the current folder
app.use(express.static(__dirname));

app.post("/review", async (req, res) => {
  const { text, prompt } = req.body;

  const systemPrompt = `
You are Big Pudding, a supportive but honest writing coach.

You MUST follow this structure exactly:

1. What's working
- Give 2–3 specific points
- Reference the actual text

2. What to improve
- Give 1–2 important issues only
- Be clear and concrete

3. Next step
- Give one specific revision action

Rules:
- No fluff
- No generic advice
- Do not rewrite the whole piece
- Keep it under 200 words
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.3",
        input: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `[Prompt]\n${prompt}\n\n[User Writing]\n${text}`
          }
        ]
      })
    });

    const data = await response.json();

    const output =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "No response";

    res.json({ feedback: output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something broke" });
  }
});

// Explicit homepage route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});