import express from "express";

const app = express();

// 🔥 BẮT BUỘC: parse JSON cho Lark challenge
app.use(express.json());

// ==================== UTILS ====================

// ===== GET TENANT ACCESS TOKEN =====
async function getTenantAccessToken() {
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
    throw new Error("❌ Missing LARK_APP_ID or LARK_APP_SECRET");
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
    return "❌ Server missing OpenRouter API key";
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

  return data?.choices?.[0]?.message?.content || "AI không trả lời 😢";
}

// ===== REPLY BACK TO LARK =====
async function replyToLark(messageId, text) {
  const token = await getTenantAccessToken();

  const res = await fetch(
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

  const data = await res.json();
  console.log("Reply Lark result:", data);
}

// ==================== WEBHOOK ====================

// LOG MỌI REQUEST ĐI VÀO (kể cả sai route)
app.use((req, res, next) => {
  console.log("\n==============================");
  console.log("➡️ Incoming request");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", req.headers);
  next();
});

// Parse JSON (Lark challenge là JSON)
app.use(express.json());

// LOG BODY SAU KHI PARSE
app.use((req, res, next) => {
  console.log("📦 Parsed body:", req.body);
  next();
});

app.post("/lark/webhook", async (req, res) => {
  console.log("🔥 HIT /lark/webhook");

  // 1️⃣ Verify challenge
  if (req.body?.challenge) {
    console.log("✅ Challenge received:", req.body.challenge);
    console.log("↩️ Responding challenge...");
    return res.status(200).json({ challenge: req.body.challenge });
  }

  console.log("❌ No challenge found in body!");
  console.log("Body keys:", Object.keys(req.body || {}));

  return res.status(200).json({ code: 0 });
});

// Bắt tất cả route khác để biết Lark có gọi nhầm URL không
app.all("*", (req, res) => {
  console.log("❌ HIT WRONG ROUTE:", req.method, req.url);
  return res.status(404).send("Not Found");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at :${PORT}`);
});

