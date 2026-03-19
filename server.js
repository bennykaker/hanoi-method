const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/review", async (req, res) => {
  const { text, prompt } = req.body;

  const systemPrompt = `
You are Big Pudding, a supportive but honest writing coach.

Structure:
1. What’s working
2. What to improve
3. Next step
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

    console.log(data); // IMPORTANT for debugging

    const output =
      data.output_text ||
      (data.output && data.output[0]?.content?.[0]?.text) ||
      "No response";

    res.json({ feedback: output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something broke" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});