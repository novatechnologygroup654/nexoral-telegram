
const express = require("express");

const app = express();

app.use(express.json({ limit: "10kb" }));

// Allow requests from your Nexoral website.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Health check.
app.get("/", (req, res) => {
  res.status(200).send("Nexoral service is running.");
});

// Submit and save a new project enquiry.
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

    // Validate required form fields.
    const fields = [
      customer,
      contact,
      country,
      service,
      budget,
      details
    ];

    const validFields = fields.every(
      value => typeof value === "string" && value.trim().length > 0
    );

    if (!validFields) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields."
      });
    }

    // Read server-side environment variables.
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Report missing variable NAMES only. Never log secret values.
    const missingVariables = [];

    if (!token || !token.trim()) {
      missingVariables.push("TELEGRAM_BOT_TOKEN");
    }

    if (!chatId || !String(chatId).trim()) {
      missingVariables.push("TELEGRAM_CHAT_ID");
    }

    if (!supabaseUrl || !supabaseUrl.trim()) {
      missingVariables.push("SUPABASE_URL");
    }

    if (!supabaseKey || !supabaseKey.trim()) {
      missingVariables.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (missingVariables.length > 0) {
      console.error(
        "Missing environment variables:",
        missingVariables.join(", ")
      );

      return res.status(500).json({
        success: false,
        message: "The enquiry service is not fully configured."
      });
    }

    // Check that the Supabase URL has the expected format.
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");

    if (!/^https:\/\/[^/]+\.supabase\.co$/i.test(cleanUrl)) {
      console.error(
        "SUPABASE_URL must be the project's HTTPS API URL."
      );

      return res.status(500).json({
        success: false,
        message: "The database configuration needs checking."
      });
    }

    // Create a unique reference for this enquiry.
    const orderReference =
      "NX-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

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

    // Save the enquiry to Supabase first.
    let databaseResponse;

    try {
      databaseResponse = await fetch(cleanUrl + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": "Bearer " + supabaseKey,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(order),
        signal: AbortSignal.timeout(15000)
      });
    } catch (databaseRequestError) {
      console.error(
        "Supabase connection failed:",
        databaseRequestError.message
      );

      return res.status(502).json({
        success: false,
        message: "Could not connect to the order database. Please try again."
      });
    }

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

    console.log("Order saved successfully:", orderReference);

    // Send the enquiry to Telegram without losing the saved order
    // if Telegram is temporarily unavailable.
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
      token.trim() +
      "/sendMessage";

    try {
      const telegramResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: String(chatId).trim(),
          text: message
        }),
        signal: AbortSignal.timeout(10000)
      });

      const telegramResult = await telegramResponse.json();

      if (!telegramResponse.ok || !telegramResult.ok) {
        console.error(
          "Telegram delivery failed:",
          telegramResult.description || "Unknown Telegram error"
        );
      } else {
        console.log("Telegram notification sent:", orderReference);
      }
    } catch (telegramError) {
      console.error(
        "Telegram request failed:",
        telegramError.message
      );
    }

    // Return success after the database confirms the order is saved.
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

// Start the service.
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Nexoral service listening on port " + port);
});
