import express from "express";
import cors from "cors";
import waweb from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = waweb;

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 4005;

const CHROME_PATH =
  "/Users/yash/.cache/puppeteer/chrome/mac_arm-148.0.7778.167/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

/* ========================
WhatsApp Client
======================== */

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
WhatsApp State
======================== */

let whatsappState = "STARTING";
let isInitializing = false;

/* ========================
WhatsApp Events
======================== */

client.on("qr", (qr) => {
  whatsappState = "QR";
  console.log("\n📲 Scan QR to login WhatsApp\n");
  qrcode.generate(qr, {
    small: true,
  });
});

client.on("authenticated", () => {
  whatsappState = "AUTHENTICATED";
  console.log("🔐 WhatsApp authenticated");
});

client.on("ready", () => {
  whatsappState = "CONNECTED";
  console.log("✅ WhatsApp client is ready!");
});

client.on("change_state", (state) => {
  whatsappState = state;
  console.log(`🔄 WhatsApp state changed: ${state}`);
});

client.on("auth_failure", (message) => {
  whatsappState = "AUTH_FAILURE";
  console.error("❌ WhatsApp authentication failure:", message);
});

client.on("disconnected", (reason) => {
  whatsappState = "DISCONNECTED";
  console.log("⚠️ WhatsApp disconnected:", reason);
  console.log("ℹ️ WhatsApp will not be automatically reinitialized.");
});

/* ========================
WhatsApp Initialization
======================== */

async function initializeWhatsApp() {
  if (isInitializing) {
    console.log("⏳ WhatsApp initialization already in progress");
    return;
  }

  isInitializing = true;

  try {
    console.log("🚀 Initializing WhatsApp client...");
    await client.initialize();
    console.log("✅ WhatsApp initialize() completed");
  } catch (error) {
    whatsappState = "INITIALIZATION_ERROR";
    console.error("❌ WhatsApp initialization failed:");
    console.error(error);
  } finally {
    isInitializing = false;
  }
}

/* ========================
Helpers
======================== */

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  throw new Error(`Invalid Indian phone number: ${phone}`);
}

function getMonthName(month) {
  const [year, monthNumber] = month.split("-");
  return new Date(
    Number(year),
    Number(monthNumber) - 1
  ).toLocaleString("hi-IN", {
    month: "long",
  });
}

async function ensureWhatsAppConnected() {
  try {
    const state = await client.getState();
    if (state !== "CONNECTED") {
      return {
        connected: false,
        state,
      };
    }
    return {
      connected: true,
      state,
    };
  } catch (error) {
    return {
      connected: false,
      state: whatsappState,
      error: error.message,
    };
  }
}

async function sendMessages(recipients, messageBuilder) {
  const results = [];

  for (const user of recipients) {
    let phone;

    try {
      phone = normalizePhone(user.phone);

      const message = messageBuilder(user);

      console.log("Resolving WhatsApp number:", {
        name: user.name,
        phone,
      });

      const numberId = await client.getNumberId(phone);

      if (!numberId) {
        throw new Error(
          `WhatsApp number not registered: ${phone}`
        );
      }

      const chatId = numberId._serialized;

      console.log("Resolved WhatsApp chat:", {
        phone,
        chatId,
      });

      await client.sendMessage(
        chatId,
        message
      );

      results.push({
        phone,
        status: "sent"
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });
    } catch (error) {
      results.push({
        phone: phone || user.phone,
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

/* ========================
STATUS ROUTE
======================== */

app.get("/status", async (req, res) => {
  const connection = await ensureWhatsAppConnected();
  return res.json({
    whatsapp: connection,
    internalState: whatsappState,
    isInitializing,
  });
});

/* ========================
SEND BROADCAST
======================== */

app.post("/send-broadcast", async (req, res) => {
  try {
    const { recipients, month } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        error: "Invalid recipients list",
      });
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        error: "Invalid month. Expected format YYYY-MM",
      });
    }

    const connection = await ensureWhatsAppConnected();

    if (!connection.connected) {
      return res.status(503).json({
        error: "WhatsApp client not connected",
        state: connection.state,
      });
    }

    const monthName = getMonthName(month);

    const results = await sendMessages(
      recipients,
      (user) => 
        "नमस्कार,\n\n" +
        "यह " + monthName + " माह के किराये ₹" + user.rent + 
        " के संबंध में एक विनम्र स्मरण है। कृपया लंबित किराया शीघ्र जमा करने का कष्ट करें।\n\n" +
        "यदि भुगतान पहले ही किया जा चुका है, तो कृपया पुष्टि कर दें। अन्यथा कृपया इस संदेश को अनदेखा करें।\n\n" +
        "सादर।"
    );
    const failedResults = results.filter((result) => result.status === "failed");

    if (failedResults.length > 0) {
      console.error("WhatsApp broadcast completed with failures", {
        month,
        totalRecipients: recipients.length,
        failed: failedResults.length,
        failedResults,
      });
    }

    return res.json({
      success: true,
      sent: results.filter((result) => result.status === "sent").length,
      failed: failedResults.length,
      results,
    });
  } catch (error) {
    console.error("❌ Broadcast error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

/* ========================
MONTHLY GREETING
======================== */

app.post("/send-monthly-greeting", async (req, res) => {
  try {
    const { recipients, month } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        error: "Invalid recipients list",
      });
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        error: "Invalid month. Expected format YYYY-MM",
      });
    }

    const connection = await ensureWhatsAppConnected();

    if (!connection.connected) {
      return res.status(503).json({
        error: "WhatsApp client not connected",
        state: connection.state,
      });
    }

    const monthName = getMonthName(month);

    const results = await sendMessages(
      recipients,
      (user) =>
        "नमस्कार,\n\n" +
        "आपको " + monthName + " माह की हार्दिक शुभकामनाएँ। आशा है कि आप और आपका परिवार स्वस्थ एवं सुखी होंगे।\n\n" +
        monthName + " माह के लिए देय किराया ₹" + user.rent + 
        " है। कृपया सुविधानुसार समय पर भुगतान करें।\n\n" +
        "आपके सहयोग हेतु धन्यवाद।\n\n" +
        "सादर।"
    );

    return res.json({
      success: true,
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("❌ Monthly greeting error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

/* ========================
START SERVER
======================== */

app.listen(PORT, () => {
  console.log(
    `🚀 WhatsApp worker running on http://localhost:${PORT}`
  );
});

/* ========================
START WHATSAPP
======================== */

initializeWhatsApp();
