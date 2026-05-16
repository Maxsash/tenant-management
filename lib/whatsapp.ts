export async function sendRentReminder(
  phone: string,
  tenantName: string
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: `91${phone}`,
      type: "template",
      template: {
        name: "hello_world",
        language: {
          code: "en_US",
        },
      },
    };

    console.log("===== WHATSAPP REQUEST =====");
    console.log(
      "URL:",
      `https://graph.facebook.com/v25.0/${process.env.WA_PHONE_ID}/messages`
    );
    console.log("TO:", `91${phone}`);
    console.log("TENANT:", tenantName);
    console.log(
      "TOKEN EXISTS:",
      !!process.env.WA_TOKEN
    );
    console.log(
      "PAYLOAD:",
      JSON.stringify(payload, null, 2)
    );

    const res = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WA_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await res.text();

    console.log("===== WHATSAPP RESPONSE =====");
    console.log("STATUS:", res.status);
    console.log("RAW RESPONSE:", text);

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    return {
      success: res.ok,
      status: res.status,
      response: parsed,
    };
  } catch (err) {
    console.error(
      "SEND RENT REMINDER FAILED:"
    );
    console.error(err);

    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : String(err),
    };
  }
}