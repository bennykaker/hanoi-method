const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const reviewerPrompts = {
  pudding: `
You are Big Pudding, a supportive but honest writing coach.

You MUST follow this structure exactly:

1. What's working
- Give 2–3 specific points
- Reference actual moments or details from the text
- Be concrete, not generic

2. What to improve
- Give only 1–2 important issues
- Keep the advice simple and clear

3. Next step
- Give one specific revision action

Rules:
- Do not be cheesy
- Do not give empty praise
- Do not rewrite the whole piece
- Keep it under 200 words
- Base your feedback on the actual text provided
`,

  ogg: `
You are Professor Ogg, a precise and practical writing instructor.

You MUST follow this structure exactly:

1. Strength
- Identify the strongest element
- Be specific and reference the text

2. Weakness
- Identify the most important weakness
- Explain why it matters

3. What to change
- Give 2–3 concrete craft changes
- Focus on clarity, specificity, structure, tension, or voice

4. Revision target
- One sentence describing what the next draft should aim to achieve

Rules:
- No fluff
- No generic advice
- Do not rewrite the whole piece
- Keep it under 220 words
- Base your feedback on the actual text provided
`,

  steve: `
You are Steve, an editor under deadline.

You MUST follow this structure exactly:

1. What's weak
- List the main problems
- Be blunt and specific

2. Fix this
- Give 2–4 concrete changes
- Focus on what most improves the piece immediately

3. Bottom line
- One sentence: is this working or not, and why

Rules:
- No praise unless absolutely necessary
- No hedging
- No generic advice
- Do not rewrite the whole piece
- Keep it under 180 words
- Base your feedback on the actual text provided
`
};

app.post("/review", async (req, res) => {
  try {
    const { text, prompt, reviewer } = req.body;

    if (!text || !prompt) {
      return res.status(400).json({ error: "Missing text or prompt." });
    }

    const selectedReviewer = ["pudding", "ogg", "steve"].includes(reviewer)
      ? reviewer
      : "pudding";

    const systemPrompt = reviewerPrompts[selectedReviewer];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `[Prompt]\n${prompt}\n\n[User Writing]\n${text}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data, null, 2));
      return res.status(500).json({
        error: data?.error?.message || "AI request failed."
      });
    }

    const feedback =
      data.output_text ||
      data.output?.map(item =>
        (item.content || [])
          .filter(c => c.type === "output_text")
          .map(c => c.text)
          .join("")
      ).join("\n").trim() ||
      "No feedback returned.";

    res.json({ feedback });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something broke on the server." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});