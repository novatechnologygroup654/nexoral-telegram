
const express = require("express");

const app = express();
app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.send("Nexoral Telegram service is running.");
});

app.post("/api/order", async (req, res) => {
  try {
    const { name, contact, service, budget, details } = req.body || {};

    if (!name || !contact || !service || !details) {
      return res.status(400).json({
        error: "Please complete all required order fields."
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({
        error: "The Telegram service has not been configured yet."
      });
    }

    const message = [
      "🆕 NEW NEXORAL ORDER",
      "",
      `Name: ${String(name).slice(0, 150)}`,
      `Contact: ${String(contact).slice(0, 200)}`,
      `Service: ${String(service).slice(0, 150)}`,
      `Budget: ${String(budget || "Not provided").slice(0, 100)}`,
      "",
      "Project details:",
      String(details).slice(0, 2500)
    ].join("\n");

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram delivery failed:", result.description);
      return res.status(502).json({
        error: "Telegram could not receive the order."
      });
    }

    res.json({ success: true, message: "Order sent to Nexoral." });
  } catch (error) {
    console.error("Order error:", error.message);
    res.status(500).json({ error: "Could not process the order." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Nexoral service listening on port ${port}`);
});
