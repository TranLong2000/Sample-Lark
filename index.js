import express from "express";

const app = express();
app.use(express.json());

// ====== LARK AUTH: lấy tenant_access_token ======
async function getTenantAccessToken() {
  const res = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    }
  );

  const data = await res.json();
  console.log("tenant_access_token:", data);

  return data.tenant_access_token;
}

// ====== OPENROUTER AI CALL ======
async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;

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
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  console.log("AI response:", data);

  return data?.choices?.[0]?.message?.content ?? "AI không trả lời";
}

// ====== GỬI TIN NHẮN NGƯỢC VỀ LARK ======
async function replyToLark(messageId, text) {
  const token = await getTenantAccessToken();

  await fetch(
    `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}/reply`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        msg_type: "text",
        content: JSON.stringify({ text })
      })
    }
  );
}

// ====== HEALTH CHECK ======
app.get("/", (req, res) => {
  res.send("Lark bot webhook is running 🚀");
});

// ====== WEBHOOK ======
app.post("/lark/webhook", async (req, res) => {
  const body = req.body;
  console.log("Webhook received:", body);

  // 1) Challenge verification
  if (body?.challenge) {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(
      JSON.stringify({ challenge: body.challenge })
    );
  }

  // 2) Event message
  if (body?.event?.message?.message_id) {
    const messageId = body.event.message.message_id;
    let userContent = body.event.message.content;

    // Parse nội dung text
    try {
      const parsed = JSON.parse(userContent);
      userContent = parsed.text || userContent;
    } catch (_) {}

    console.log("User text:", userContent);

    // AI trả lời
    const aiReply = await callOpenRouter(userContent);

    // Gửi trả lời về Lark
    await replyToLark(messageId, aiReply);
  }

  return res.status(200).json({ code: 0 });
});

// ====== SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
