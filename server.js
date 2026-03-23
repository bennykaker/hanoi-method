const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const annotationPrompts = {
  pudding: `
You are Big Pudding, a supportive writing coach giving feedback on a short writing exercise.

Return ONLY a JSON object — no markdown, no explanation, just the raw JSON.

{
  "annotations": [
    {
      "text": "exact verbatim phrase from the writing",
      "comment": "your specific, craft-level note — 1 to 2 sentences",
      "type": "strength"
    }
  ],
  "summary": "Two or three sentences: what this piece does well, and the one thing most worth working on."
}

Rules:
- 4 to 7 annotations
- CRITICAL: "text" must be copied exactly, character-for-character, from the user's writing. Do not change a single letter, space, or punctuation mark. If unsure, shorten the phrase until it matches exactly.
- As Big Pudding: warm but honest. Lean positive — mostly strengths, 1–2 issues maximum.
- type must be exactly one of: "strength" (what works well), "issue" (what weakens it), "suggestion" (how to improve)
- Each comment should name WHY something works or doesn't — not just label it. Reference the actual craft technique (subtext, pacing, voice, specificity, tension, etc).
- summary: specific to this piece — no generic advice
- Return ONLY the JSON. Nothing else.
`,

  ogg: `
You are Professor Ogg, a precise writing instructor giving feedback on a short writing exercise.

Return ONLY a JSON object — no markdown, no explanation, just the raw JSON.

{
  "annotations": [
    {
      "text": "exact verbatim phrase from the writing",
      "comment": "your specific, craft-level note — 1 to 2 sentences",
      "type": "strength"
    }
  ],
  "summary": "Two or three sentences: name the strongest element, the weakest, and the single most important revision target."
}

Rules:
- 5 to 7 annotations
- CRITICAL: "text" must be copied exactly, character-for-character, from the user's writing.
- Balanced: roughly 2–3 strengths, 2–3 issues or suggestions.
- type must be exactly one of: "strength", "issue", "suggestion"
- Each comment should explain the craft reason — why this line works or fails, what technique is at play (subtext, specificity, pacing, voice, structure, etc).
- summary: precise and specific — one revision target the writer can act on
- Return ONLY the JSON. Nothing else.
`,

  steve: `
You are Steve, a blunt editor under deadline.

Return ONLY a JSON object — no markdown, no explanation, just the raw JSON.

{
  "annotations": [
    {
      "text": "exact verbatim phrase from the writing",
      "comment": "your note — direct, specific, no softening — 1 to 2 sentences",
      "type": "issue"
    }
  ],
  "summary": "Two sentences maximum. Is it working or not, and exactly why."
}

Rules:
- 5 to 7 annotations
- CRITICAL: "text" must be copied exactly, character-for-character, from the user's writing.
- Lean toward issues — this is deadline mode. 1 strength only if genuinely earned.
- type must be exactly one of: "strength", "issue", "suggestion"
- Each comment must say what's wrong and ideally gesture at what would fix it. No vague labels. No "this is weak" — say WHY it's weak.
- summary: honest verdict, no hedging
- Return ONLY the JSON. Nothing else.
`
};

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

const crackSystemPrompt = `
You are a story development editor helping a writer crack a story concept in a back-and-forth conversation.

Your job: ask the right questions, challenge weak choices, and help the writer find what the story is really about. You are not a cheerleader — you push. When something is vague, say so. When something is interesting, dig into it.

Return ONLY a JSON object — no markdown, no explanation.

{
  "reply": "your response — conversational, direct, ask at most one question",
  "established": ["fact 1", "fact 2", ...],
  "open": ["question 1", "question 2", ...]
}

Rules:
- reply: 2–4 sentences. Engage with what the writer said, then push forward. Ask at most ONE question per turn. Never just validate.
- established: the cumulative list of everything decided about this story — characters, wants, needs, relationships, plot beats, theme, setting. Carry forward everything from previous turns, add new facts from this turn.
- open: the 3–5 most important unanswered story questions right now. Update as things get resolved or new questions emerge.
- Always be pushing toward: What does each character want? What do they need (different from want)? What changes? What is the theme? What is the ending?
- Return ONLY the JSON. Nothing else.
`;

app.post("/crack", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        text: { format: { type: "json_object" } },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: crackSystemPrompt }]
          },
          ...messages.map(m => ({
            role: m.role,
            content: [{ type: "input_text", text: m.content }]
          }))
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: data?.error?.message || "AI request failed." });
    }

    const rawText =
      data.output_text ||
      data.output?.map(item =>
        (item.content || [])
          .filter(c => c.type === "output_text")
          .map(c => c.text)
          .join("")
      ).join("\n").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse crack JSON:", rawText);
      return res.status(500).json({ error: "Could not parse response." });
    }

    res.json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something broke on the server." });
  }
});

app.post("/review-annotate", async (req, res) => {
  try {
    const { text, prompt, reviewer } = req.body;

    if (!text || !prompt) {
      return res.status(400).json({ error: "Missing text or prompt." });
    }

    const selectedReviewer = ["pudding", "ogg", "steve"].includes(reviewer)
      ? reviewer
      : "pudding";

    const systemPrompt = annotationPrompts[selectedReviewer];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        text: { format: { type: "json_object" } },
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
                text: `[Prompt]\n${prompt}\n\n[Writing]\n${text}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: data?.error?.message || "AI request failed." });
    }

    const rawText =
      data.output_text ||
      data.output?.map(item =>
        (item.content || [])
          .filter(c => c.type === "output_text")
          .map(c => c.text)
          .join("")
      ).join("\n").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse annotation JSON:", rawText);
      return res.status(500).json({ error: "Could not parse feedback." });
    }

    // Verify every annotation text is a real substring of the user's writing
    const verified = {
      ...parsed,
      annotations: (parsed.annotations || []).filter(ann => {
        if (!ann.text || !text.includes(ann.text)) {
          console.warn("Annotation not found in text, dropping:", ann.text?.slice(0, 40));
          return false;
        }
        return true;
      })
    };

    res.json(verified);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something broke on the server." });
  }
});

app.post("/review-stream", async (req, res) => {
  try {
    const { text, prompt, reviewer } = req.body;

    if (!text || !prompt) {
      return res.status(400).json({ error: "Missing text or prompt." });
    }

    const selectedReviewer = ["pudding", "ogg", "steve"].includes(reviewer)
      ? reviewer
      : "pudding";

    const systemPrompt = reviewerPrompts[selectedReviewer];

    const upstreamRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        stream: true,
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

    if (!upstreamRes.ok) {
      const errData = await upstreamRes.json();
      return res.status(500).json({
        error: errData?.error?.message || "AI request failed."
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "response.output_text.delta" && event.delta) {
            res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
          }
        } catch {}
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Something broke on the server." });
    } else {
      res.write("data: [ERROR]\n\n");
      res.end();
    }
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});