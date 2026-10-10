
const express = require("express");

const app = express();

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

    const fields = [
      customer,
      contact,
      country,
      service,
      budget,
      details
    ];

    if (
      !fields.every(
        value => typeof value === "string" && value.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields."
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!token || !chatId || !supabaseUrl || !supabaseKey) {
      console.error("A required server environment variable is missing.");

      return res.status(500).json({
        success: false,
        message: "The enquiry service is not fully configured."
      });
    }

    const orderReference =
      "NX-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const cleanUrl = supabaseUrl.replace(/\/+$/, "");
    const databaseUrl = cleanUrl + "/rest/v1/orders";

    const order = {
      order_reference: orderReference,
      customer_name: customer.trim().slice(0, 150),
      contact: contact.trim().slice(0, 200),
      country: country.trim().slice(0, 100),
      service: service.trim().slice(0, 150),
      budget: budget.trim().slice(0, 100),
      project_details: details.trim().slice(0, 2500),
      status: "new"
    };

    // Save the order in Supabase first.
    const databaseResponse = await fetch(databaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(order)
    });

    if (!databaseResponse.ok) {
      const databaseError = await databaseResponse.text();

      console.error(
        "Supabase save failed:",
        databaseResponse.status,
        databaseError.slice(0, 1000)
      );

      return res.status(502).json({
        success: false,
        message: "The enquiry could not be saved. Please try again."
      });
    }

    // Preserve Telegram notifications.
    const message = [
      "NEW NEXORAL PROJECT ENQUIRY",
      "",
      "Order reference: " + orderReference,
      "Status: NEW",
      "",
      "Name: " + order.customer_name,
      "Contact: " + order.contact,
      "Country: " + order.country,
      "Service: " + order.service,
      "Estimated budget: " + order.budget,
      "",
      "Project details:",
      order.project_details
    ].join("\n");

    const telegramUrl =
      "https://api.telegram.org/bot" +
      token +
      "/sendMessage";

    try {
      const telegramResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      });

      const telegramResult = await telegramResponse.json();

      if (!telegramResponse.ok || !telegramResult.ok) {
        console.error(
          "Telegram delivery failed:",
          telegramResult.description || "Unknown error"
        );
      }
    } catch (telegramError) {
      console.error(
        "Telegram request failed:",
        telegramError.message
      );
    }

    // The order is saved even if Telegram is temporarily unavailable.
    return res.status(201).json({
      success: true,
      message: "Your enquiry has been saved successfully.",
      orderReference: orderReference
    });

  } catch (error) {
    console.error("Order processing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not process the enquiry."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Nexoral service listening on port " + port);
});
