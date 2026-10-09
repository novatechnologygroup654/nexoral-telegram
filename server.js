
const express = require("express");

const app = express();
app.use(express.json({ limit: "10kb" }));

// Temporary browser access for testing local HTML files.
// When the website is hosted, restrict this to its real domain.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === "null") {
    res.setHeader("Access-Control-Allow-Origin", "null");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", (req, res) => {
  res.send("Nexoral Telegram service is running.");
});

app.post("/api/order", async (req, res) => {
  try {
    const { name, contact, service, budget, details } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof contact !== "string" ||
      typeof service !== "string" ||
      typeof details !== "string" ||
      !name.trim() ||
      !contact.trim() ||
      !service.trim() ||
      !details.trim()
    ) {
      return res.status(400).json({
        error: "Please complete all required order fields."
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({
        error: "Telegram settings are missing."
      });
    }

    const message = [
      "NEW NEXORAL ORDER",
      "",
      `Name: ${name.slice(0, 150)}`,
      `Contact: ${contact.slice(0, 200)}`,
      `Service: ${service.slice(0, 150)}`,
      `Budget: ${String(budget || "Not provided").slice(0, 100)}`,
      "",
      "Project details:",
      details.slice(0, 2500)
    ].join("\n");

    const telegramResponse = await fetch(
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

    const result = await telegramResponse.json();

    if (!telegramResponse.ok || !result.ok) {
      console.error("Telegram delivery failed:", result.description);
      return res.status(502).json({
        error: "Telegram could not receive the order."
      });
    }

    return res.json({
      success: true,
      message: "Your order was sent successfully."
    });
  } catch (error) {
    console.error("Order error:", error.message);
    return res.status(500).json({
      error: "Could not process the order."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Nexoral service listening on port ${port}`);
});
