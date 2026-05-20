const express = require("express");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(cors());
app.use(express.json());

let isReady = false;

const CHROME_PATH =
  "/Users/yash/.cache/puppeteer/chrome/mac_arm-148.0.7778.167/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
});

/* ========================
   WhatsApp Events
======================== */

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("📲 Scan QR to login WhatsApp");
});

client.on("ready", () => {
  console.log("✅ WhatsApp client is ready!");
  isReady = true;
});

client.on("auth_failure", (msg) => {
  console.error("❌ AUTH FAILURE:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp disconnected:", reason);

  isReady = false;

  console.log("♻️ Reinitializing client...");

  setTimeout(() => {
    client.initialize();
  }, 3000);
});

/* ========================
   Initialize WhatsApp
======================== */

client.initialize();

/* ========================
   API ROUTE
======================== */

app.post("/send-broadcast", async (req, res) => {
  try {
    if (!isReady) {
      return res.status(503).json({
        error: "WhatsApp client not ready yet",
      });
    }

    const { recipients, month } = req.body;

    const [year, monthNumber] = month.split("-"); 
    const monthName = new Date( Number(year), Number(monthNumber) - 1 ).toLocaleString("hi-IN", { month: "long", });

    const results = [];

    for (const user of recipients) {
      try {
        const message = `नमस्कार,\n\nयह ${monthName} माह के किराये ₹${user.rent} के संबंध में एक विनम्र स्मरण है। कृपया लंबित किराया शीघ्र जमा करने का कष्ट करें।\n\nयदि भुगतान पहले ही किया जा चुका है, तो कृपया पुष्टि कर दें। अन्यथा कृपया इस संदेश को अनदेखा करें।\n\nसादर।`;

        const chatId = `91${user.phone}@c.us`;

        const result = await client.sendMessage(chatId, message);

        results.push({
          phone: user.phone,
          status: "sent",
          messageId: result.id?._serialized,
        });

        // ⏳ prevent WhatsApp throttle / frame crash
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        results.push({
          phone: user.phone,
          status: "failed",
          error: err.message,
        });
      }
    }

    return res.json({
      success: true,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (err) {
    console.error("Broadcast error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
});


/* ========================
   MONTH START GREETING ROUTE
======================== */

app.post("/send-monthly-greeting", async (req, res) => {
  try {
    if (!isReady) {
      return res.status(503).json({
        error: "WhatsApp client not ready yet",
      });
    }

    const { recipients, month } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        error: "Invalid recipients list",
      });
    }

    // month format: "2026-05"
    const [year, monthNumber] = month.split("-");

    const monthName = new Date(
      Number(year),
      Number(monthNumber) - 1
    ).toLocaleString("hi-IN", {
      month: "long",
    });

    const results = [];

    for (const user of recipients) {
      try {
        const message = `नमस्कार,\n\nआपको ${monthName} माह की हार्दिक शुभकामनाएँ। आशा है कि आप और आपका परिवार स्वस्थ एवं सुखी होंगे।\n\n${monthName} माह के लिए देय किराया ₹${user.rent} है। कृपया सुविधानुसार समय पर भुगतान करें।\n\nआपके सहयोग हेतु धन्यवाद।\n\nसादर।`;

        const chatId = `91${user.phone}@c.us`;

        const result = await client.sendMessage(chatId, message);

        results.push({
          phone: user.phone,
          status: "sent",
          messageId: result.id?._serialized,
        });

        // ⏳ Prevent WhatsApp throttling
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        results.push({
          phone: user.phone,
          status: "failed",
          error: err.message,
        });
      }
    }

    return res.json({
      success: true,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (err) {
    console.error("Monthly greeting error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

/* ========================
   START SERVER
======================== */

app.listen(4005, () => {
  console.log("🚀 WhatsApp worker running on http://localhost:4005");
});