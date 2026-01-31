import express from "express";

const app = express();

// ===== GET TENANT ACCESS TOKEN =====
async function getTenantAccessToken() {

  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
    console.error("❌ Missing LARK_APP_ID or LARK_APP_SECRET");
  }

  const res = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
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
  console.log("tenant token response:", data);

  if (data.code !== 0) {
    throw new Error("Failed to get tenant_access_token: " + data.msg);
  }

  return data.tenant_access_token;
}

// ===== CALL OPENROUTER =====
async function callOpenRouter(prompt) {

  if (!process.env.OPENROUTER_API_KEY) {
    return "Server missing OpenRouter API key";
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://railway.app",
        "X-Title": "Lark Bot AI"
      },
      body: JSON.stringify({
        model: "allenai/molmo-2-8b:free",
        messages: [{ role: "user", content: prompt }]
      })
    }
  );

  const data = await response.json();
  console.log("AI response:", data);

  return data?.choices?.[0]?.message?.content ?? "AI không trả lời 😢";
}

// ===== REPLY BACK TO LARK =====
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


// Parse JSON + RAW để không bị mất challenge
app.use(express.json({ type: "*/*" }));

app.post("/lark/webhook", async (req, res) => {
  console.log("Webhook raw body:", req.body);

  // 1. Verify challenge (BẮT BUỘC)
  if (req.body?.challenge) {
    console.log("Challenge received:", req.body.challenge);
    return res.status(200).json({
      challenge: req.body.challenge
    });
  }

  const event = req.body?.event;
  if (!event?.message) {
    return res.status(200).json({ code: 0 });
  }

  const msgId = event.message.message_id;

  // 2. Parse text user gửi
  let text = "";
  try {
    text = JSON.parse(event.message.content || "{}").text || "";
  } catch (e) {
    console.log("Parse content error:", e.message);
  }

  text = text.replace(/@_user_\d+/g, "").trim();
  console.log("User text:", text);

  // 3. Gọi AI
  let reply = "Xin chào 👋";
  try {
    reply = await callOpenRouter(text || "Xin chào");
  } catch (e) {
    console.error("AI error:", e.message);
    reply = "❌ AI đang lỗi, thử lại sau.";
  }

  // 4. Trả lời lại Lark
  try {
    await replyToLark(msgId, reply);
  } catch (e) {
    console.error("Reply Lark error:", e.response?.data || e.message);
  }

  return res.status(200).json({ code: 0 });
});

app.listen(3000, () => console.log("Server running at :3000"));

