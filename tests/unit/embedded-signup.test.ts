import { describe, expect, it } from "vitest";
import { readEmbeddedSignupMessage } from "@/modules/integrations/embedded-signup";

const META = "https://www.facebook.com";
const message = (event: string, data: Record<string, unknown>) => JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event, data });

describe("readEmbeddedSignupMessage", () => {
  it("only trusts messages from facebook.com and its subdomains", () => {
    const finish = message("FINISH", { phone_number_id: "111", waba_id: "222" });
    expect(readEmbeddedSignupMessage("https://www.facebook.com", finish)).not.toBeNull();
    expect(readEmbeddedSignupMessage("https://web.facebook.com", finish)).not.toBeNull();
    expect(readEmbeddedSignupMessage("https://facebook.com", finish)).not.toBeNull();
    expect(readEmbeddedSignupMessage("https://evilfacebook.com", finish)).toBeNull();
    expect(readEmbeddedSignupMessage("https://facebook.com.evil.io", finish)).toBeNull();
    expect(readEmbeddedSignupMessage("http://www.facebook.com", finish)).toBeNull();
    expect(readEmbeddedSignupMessage("null", finish)).toBeNull();
  });

  it("ignores other messages Meta's SDK sends", () => {
    expect(readEmbeddedSignupMessage(META, "not json")).toBeNull();
    expect(readEmbeddedSignupMessage(META, JSON.stringify({ type: "SOMETHING_ELSE", event: "FINISH" }))).toBeNull();
    expect(readEmbeddedSignupMessage(META, 42)).toBeNull();
  });

  it("returns the WhatsApp account and number from every finish event", () => {
    for (const event of ["FINISH", "FINISH_GRANT_ONLY_API_ACCESS", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"]) {
      expect(readEmbeddedSignupMessage(META, message(event, { phone_number_id: "111", waba_id: "222", business_id: "333" }))).toEqual({
        kind: "finish",
        phoneNumberId: "111",
        wabaId: "222",
      });
    }
  });

  it("accepts the payload as an object as well as a JSON string", () => {
    const data = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "111", waba_id: "222" } };
    expect(readEmbeddedSignupMessage(META, data)).toEqual({ kind: "finish", phoneNumberId: "111", wabaId: "222" });
  });

  it("reports a finished signup that has no phone number", () => {
    expect(readEmbeddedSignupMessage(META, message("FINISH_ONLY_WABA", { waba_id: "222" }))).toEqual({ kind: "no_number" });
    expect(readEmbeddedSignupMessage(META, message("FINISH", { waba_id: "222" }))).toEqual({ kind: "no_number" });
  });

  it("reports where the owner stopped, and Meta's error message", () => {
    expect(readEmbeddedSignupMessage(META, message("CANCEL", { current_step: "PHONE_NUMBER_VERIFICATION" }))).toEqual({
      kind: "cancel",
      step: "PHONE_NUMBER_VERIFICATION",
    });
    expect(readEmbeddedSignupMessage(META, message("CANCEL", {}))).toEqual({ kind: "cancel", step: null });
    expect(readEmbeddedSignupMessage(META, message("ERROR", { error_message: "Number already in use", error_code: "2388001" }))).toEqual({
      kind: "error",
      message: "Number already in use",
    });
    expect(readEmbeddedSignupMessage(META, message("ERROR", {}))).toEqual({ kind: "error", message: null });
  });

  it("rejects ids that are not Meta's numeric ids", () => {
    expect(readEmbeddedSignupMessage(META, message("FINISH", { phone_number_id: "11/../1", waba_id: "222" }))).toEqual({ kind: "no_number" });
  });
});
