import express from "express";

const app = express();

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Lark bot webhook is running 🚀");
});

// Hàm gọi OpenRouter AI
async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY env");
    return "Server missing AI API key";
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://railway.app",
      "X-Title": "Lark Bot"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json();
  console.log("AI:", data);

  return data?.choices?.[0]?.message?.content ?? "AI không trả lời";
}

// Webhook endpoint
app.post("/lark/webhook", async (req, res) => {
  const body = req.body;
  console.log("Webhook:", body);

  // ---- 1) xử lý CHALLENGE của Lark ----
  if (body?.challenge) {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(
      JSON.stringify({ challenge: body.challenge })
    );
  }

  // ---- 2) xử lý message event ----
  if (body?.event?.message?.content) {
    let messageText = body.event.message.content;

    // parse Lark content JSON
    try {
      const parsed = JSON.parse(messageText);
      messageText = parsed.text || messageText;
    } catch (_) {}

    console.log("User message:", messageText);

    const reply = await callOpenRouter(messageText);

    console.log("AI reply:", reply);
  }

  return res.status(200).json({ code: 0 });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
