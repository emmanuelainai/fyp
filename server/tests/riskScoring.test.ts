import { describe, expect, it } from "vitest";
import { calculateIncrement, classifyRisk, shouldCreateRiskAlert } from "../src/services/RiskScoringService";

describe("RiskScoringService", () => {
  it("classifies risk levels using the MVP thresholds", () => {
    expect(classifyRisk(0)).toBe("LOW");
    expect(classifyRisk(26)).toBe("MEDIUM");
    expect(classifyRisk(51)).toBe("HIGH");
    expect(classifyRisk(76)).toBe("CRITICAL");
  });

  it("applies configured event weights and repeated face-missing escalation", () => {
    expect(calculateIncrement("TAB_SWITCH", 0)).toBe(15);
    expect(calculateIncrement("COPY_ATTEMPT", 0)).toBe(10);
    expect(calculateIncrement("FACE_MISSING", 1)).toBe(5);
    expect(calculateIncrement("FACE_MISSING", 3)).toBe(15);
  });

  it("creates alerts for high severity events and high risk transitions", () => {
    expect(shouldCreateRiskAlert(20, 35, "TAB_SWITCH", "MEDIUM")).toBe(true);
    expect(shouldCreateRiskAlert(50, 65, "FULLSCREEN_EXIT", "LOW")).toBe(true);
    expect(shouldCreateRiskAlert(0, 10, "COPY_ATTEMPT", "HIGH")).toBe(true);
  });
});
