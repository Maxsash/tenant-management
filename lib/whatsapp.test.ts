import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  buildWhatsAppMessage,
  getGreetingRecipients,
  getReminderRecipients,
  hindiMonthName,
  isWhatsAppMessageKind,
  toWhatsAppNumber,
} from "./whatsapp";
import { makeTenant } from "@/test/fixtures/tenants";
import { makePayment } from "@/test/fixtures/payments";

describe("isWhatsAppMessageKind", () => {
  it.each(["reminder", "greeting"])("accepts %j", (value) => {
    expect(isWhatsAppMessageKind(value)).toBe(true);
  });

  it.each([null, undefined, "", "Reminder", "broadcast"])("rejects %j", (value) => {
    expect(isWhatsAppMessageKind(value)).toBe(false);
  });
});

describe("getReminderRecipients", () => {
  it("keeps only active tenants whose rent is still pending", () => {
    const pending = makeTenant({ id: "t1", tenant_since: undefined });
    const paid = makeTenant({ id: "t2", tenant_since: undefined });
    const inactive = makeTenant({ id: "t3", active: false, tenant_since: undefined });

    const recipients = getReminderRecipients(
      [pending, paid, inactive],
      [makePayment({ tenant_id: "t2", month: "2026-07", paid_on: "2026-07-03" })],
      "2026-06"
    );

    expect(recipients.map((r) => r.id)).toEqual(["t1"]);
  });

  it("treats a late payment as paid — only pending tenants get a reminder", () => {
    const late = makeTenant({ id: "t1", tenant_since: undefined });

    const recipients = getReminderRecipients(
      [late],
      [makePayment({ tenant_id: "t1", month: "2026-07", paid_on: "2026-07-20" })],
      "2026-06"
    );

    expect(recipients).toEqual([]);
  });

  it("still reminds a tenant whose only payment is for a different month", () => {
    const tenant = makeTenant({ id: "t1", tenant_since: undefined });

    // Paid in June = rent for May, not June.
    const recipients = getReminderRecipients(
      [tenant],
      [makePayment({ tenant_id: "t1", month: "2026-06", paid_on: "2026-06-03" })],
      "2026-06"
    );

    expect(recipients.map((r) => r.id)).toEqual(["t1"]);
  });

  it("skips a tenant who hadn't moved in yet that month", () => {
    const future = makeTenant({ id: "t1", tenant_since: "2026-08-01" });

    expect(getReminderRecipients([future], [], "2026-06")).toEqual([]);
  });

  it("keeps a pending tenant with no phone, leaving it to the caller", () => {
    const tenant = makeTenant({ id: "t1", phone: "", tenant_since: undefined });

    expect(getReminderRecipients([tenant], [], "2026-06")).toEqual([
      expect.objectContaining({ id: "t1", phone: "" }),
    ]);
  });

  it("carries the rent calculated for the month", () => {
    const tenant = makeTenant({
      id: "t1",
      name: "Asha",
      phone: "9876543210",
      base_rent: 12000,
      tenant_since: undefined,
    });

    expect(getReminderRecipients([tenant], [], "2026-06")).toEqual([
      { id: "t1", name: "Asha", phone: "9876543210", rent: 12000 },
    ]);
  });
});

describe("getGreetingRecipients", () => {
  it("includes every active tenant regardless of payment", () => {
    const a = makeTenant({ id: "t1", tenant_since: undefined });
    const b = makeTenant({ id: "t2", tenant_since: undefined });
    const inactive = makeTenant({ id: "t3", active: false, tenant_since: undefined });

    expect(getGreetingRecipients([a, b, inactive], "2026-06").map((r) => r.id)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("skips a tenant who hadn't moved in yet that month", () => {
    const future = makeTenant({ id: "t1", tenant_since: "2026-08-01" });

    expect(getGreetingRecipients([future], "2026-06")).toEqual([]);
  });
});

describe("hindiMonthName", () => {
  it.each([
    ["2026-01", "जनवरी"],
    ["2026-08", "अगस्त"],
    ["2026-12", "दिसंबर"],
  ])("names %s as %s", (month, expected) => {
    expect(hindiMonthName(month)).toBe(expected);
  });
});

describe("buildWhatsAppMessage", () => {
  it("writes the rent reminder word for word", () => {
    expect(buildWhatsAppMessage("reminder", 12000, "2026-08")).toBe(
      "नमस्कार,\n\n" +
        "यह अगस्त माह के किराये ₹12000 के संबंध में एक विनम्र स्मरण है। कृपया लंबित किराया शीघ्र जमा करने का कष्ट करें।\n\n" +
        "यदि भुगतान पहले ही किया जा चुका है, तो कृपया पुष्टि कर दें। अन्यथा कृपया इस संदेश को अनदेखा करें।\n\n" +
        "सादर।"
    );
  });

  it("writes the monthly greeting word for word", () => {
    expect(buildWhatsAppMessage("greeting", 9500, "2026-09")).toBe(
      "नमस्कार,\n\n" +
        "आपको सितंबर माह की हार्दिक शुभकामनाएँ। आशा है कि आप और आपका परिवार स्वस्थ एवं सुखी होंगे।\n\n" +
        "सितंबर माह के लिए देय किराया ₹9500 है। कृपया सुविधानुसार समय पर भुगतान करें।\n\n" +
        "आपके सहयोग हेतु धन्यवाद।\n\n" +
        "सादर।"
    );
  });
});

describe("toWhatsAppNumber", () => {
  it.each([
    ["9876543210", "919876543210"],
    ["+91 98765 43210", "919876543210"],
    ["91-98765-43210", "919876543210"],
    ["919876543210", "919876543210"],
  ])("normalises %j to %j", (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it.each([undefined, "", "+91111", "09876543210", "12345678901234"])(
    "rejects %j",
    (input) => {
      expect(toWhatsAppNumber(input)).toBeNull();
    }
  );
});

describe("buildWhatsAppLink", () => {
  it("opens a chat with the number and the message already typed", () => {
    const link = buildWhatsAppLink("+91 98765 43210", "नमस्कार,\n\nसादर।");
    const url = new URL(link!);

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/919876543210");
    expect(url.searchParams.get("text")).toBe("नमस्कार,\n\nसादर।");
  });

  it("encodes characters that would otherwise break the query string", () => {
    const link = buildWhatsAppLink("9876543210", "rent & dues #1 = ₹100?");

    expect(new URL(link!).searchParams.get("text")).toBe("rent & dues #1 = ₹100?");
  });

  it("returns null when the phone can't be used", () => {
    expect(buildWhatsAppLink("", "hello")).toBeNull();
    expect(buildWhatsAppLink(undefined, "hello")).toBeNull();
  });
});
