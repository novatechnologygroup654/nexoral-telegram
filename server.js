```javascript
const express = require("express");

const app = express();

app.use(express.json({ limit: "10kb" }));

// Allow local HTML testing and handle browser preflight requests.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === "null") {
    res.setHeader("Access-Control-Allow-Origin", "null");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

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
    // Accept the field names sent by orders.html.
    const {
      customerName,
      name,
      contact,
      country,
      service,
      budget,
      details
    } = req.body || {};

    const customer = customerName || name;

    if (
      typeof customer !== "string" ||
      typeof contact !== "string" ||
      typeof country !== "string" ||
      typeof service !== "string" ||
      typeof budget !== "string" ||
      typeof details !== "string" ||
      !customer.trim() ||
      !contact.trim() ||
      !country.trim() ||
      !service.trim() ||
      !budget.trim() ||
      !details.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required order fields."
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error("Telegram environment variables are missing.");

      return res.status(500).json({
        success: false,
        message: "The enquiry service is not configured yet."
      });
    }

    const message = [
      "NEW NEXORAL PROJECT ENQUIRY",
      "",
      `Name: ${customer.slice(0, 150)}`,
      `Contact: ${contact.slice(0, 200)}`,
      `Country: ${country.slice(0, 100)}`,
      `Service: ${service.slice(0, 150)}`,
      `Estimated budget: ${budget.slice(0, 100)}`,
      "",
      "Project details:",
      details.slice(0, 2500)
    ].join("\n");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );

    const result = await telegramResponse.json();

    if (!telegramResponse.ok || !result.ok) {
      console.error(
        "Telegram delivery failed:",
        result.description || "Unknown Telegram error"
      );

      return res.status(502).json({
        success: false,
        message: "Telegram could not receive the enquiry."
      });
    }

    return res.json({
      success: true,
      message: "Your enquiry was sent successfully."
    });

  } catch (error) {
    console.error("Order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not process the enquiry."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Nexoral service listening on port ${port}`);
});
```
