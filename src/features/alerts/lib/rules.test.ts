import { describe, expect, it } from "vitest";
import { ruleConfigPayload, ruleErrors, ruleFields, toRuleDraft } from "./rules";

const config = {
  speed_kph: 80,
  duration_s: 120,
  enabled: true,
  note: "highway",
  nested: { a: 1 },
  list: [1, 2],
  nothing: null,
};

describe("alert rule config", () => {
  it("describes primitive fields and keeps nested values read-only", () => {
    const fields = ruleFields(config);
    expect(fields.map((field) => [field.key, field.type])).toEqual([
      ["speed_kph", "number"],
      ["duration_s", "number"],
      ["enabled", "boolean"],
      ["note", "string"],
      ["nested", "readonly"],
      ["list", "readonly"],
      ["nothing", "readonly"],
    ]);
  });

  it("builds a draft with strings for numbers and booleans as-is", () => {
    expect(toRuleDraft(config)).toEqual({
      speed_kph: "80",
      duration_s: "120",
      enabled: true,
      note: "highway",
    });
  });

  it("rejects empty, negative and non-numeric values", () => {
    expect(
      ruleErrors(config, {
        speed_kph: "",
        duration_s: "-1",
        enabled: true,
        note: " ",
      }),
    ).toEqual({
      speed_kph: "Enter a number of 0 or more.",
      duration_s: "Enter a number of 0 or more.",
      note: "Enter a value.",
    });

    expect(
      ruleErrors(config, { speed_kph: "fast", duration_s: "120", enabled: true, note: "ok" }),
    ).toMatchObject({ speed_kph: "Enter a number of 0 or more." });
  });

  it("sends the full object and preserves untouched and read-only keys", () => {
    const payload = ruleConfigPayload(config, {
      speed_kph: "81",
      duration_s: "120",
      enabled: false,
      note: "highway",
    });
    expect(payload).toEqual({
      speed_kph: 81,
      duration_s: 120,
      enabled: false,
      note: "highway",
      nested: { a: 1 },
      list: [1, 2],
      nothing: null,
    });
  });
});
