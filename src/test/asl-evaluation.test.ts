import { describe, expect, it } from "vitest";
import {
  buildEvaluationReport,
  parseEvaluationRecords,
  SUPPORTED_GLOSSES,
  type EvaluationSplit,
  type PredictionRecord,
} from "@/lib/aslEvaluation";

function record(
  split: EvaluationSplit,
  trialId: string,
  signerId: string,
  expectedGloss: (typeof SUPPORTED_GLOSSES)[number],
  predictedGloss: string | null,
  confidence: number | null,
  latencyMs = 30,
): PredictionRecord {
  return { split, trialId, signerId, expectedGloss, predictedGloss, confidence, latencyMs };
}

function validationRecords() {
  return SUPPORTED_GLOSSES.map((gloss, index) =>
    record(
      "validation",
      `validation-${index}`,
      `validation-signer-${index}`,
      gloss,
      gloss,
      0.6 + index * 0.05,
      20 + index,
    ),
  );
}

function testRecords() {
  return SUPPORTED_GLOSSES.flatMap((gloss, glossIndex) =>
    Array.from({ length: 5 }, (_, trialIndex) => {
      const prediction =
        trialIndex === 0
          ? { gloss, confidence: 0.4 }
          : trialIndex === 1
            ? {
                gloss: SUPPORTED_GLOSSES[(glossIndex + 1) % SUPPORTED_GLOSSES.length] ?? gloss,
                confidence: 0.8,
              }
            : trialIndex === 4 && glossIndex === 0
              ? { gloss: "UNSUPPORTED", confidence: 0.99 }
              : { gloss, confidence: 0.9 };
      return record(
        "test",
        `test-${glossIndex}-${trialIndex}`,
        `test-signer-${trialIndex % 3}`,
        gloss,
        prediction.gloss,
        prediction.confidence,
        10 + glossIndex * 5 + trialIndex,
      );
    }),
  );
}

describe("ASL evaluation", () => {
  it("reports per-gloss results, abstentions, confusion, confidence, latency, and signer coverage", () => {
    const report = buildEvaluationReport(validationRecords(), testRecords(), 0.7);

    expect(report.threshold).toBe(0.7);
    expect(
      report.validation.thresholdSweep.find(({ threshold }) => threshold === 0.7),
    ).toMatchObject({
      coverage: 0.6,
      accuracy: 0.6,
      selectiveAccuracy: 1,
    });
    expect(report.test).toMatchObject({
      sampleCount: 25,
      correctCount: 14,
      accuracy: 0.56,
      coveredCount: 19,
      selectiveAccuracy: 14 / 19,
      unsupportedPredictionCount: 1,
      coverageRequirements: { meetsMinimum: true },
      latency: { medianMs: 22, p95Ms: 33 },
    });
    expect(report.test.classes["RESEARCH1"]).toMatchObject({
      support: 5,
      signerCount: 3,
      correct: 2,
      accuracy: 0.84,
      recall: 0.4,
    });
    expect(report.test.confusionMatrix["RESEARCH1"]).toMatchObject({
      RESEARCH1: 2,
      DEVELOP1: 1,
      NO_RESULT: 2,
    });
  });

  it("requires a validation threshold and keeps validation signers separate from test signers", () => {
    expect(() => buildEvaluationReport(validationRecords(), testRecords(), 0.71)).toThrow(
      "selected from a validation threshold candidate",
    );

    const overlappingTest = testRecords().map((row, index) =>
      index === 0 ? { ...row, signerId: "validation-signer-0" } : row,
    );
    expect(() => buildEvaluationReport(validationRecords(), overlappingTest, 0.7)).toThrow(
      "Validation and test signers must be disjoint.",
    );
  });

  it("rejects malformed, mislabeled, or duplicated records", () => {
    expect(() => parseEvaluationRecords([], "test")).toThrow("non-empty JSON array");
    expect(() =>
      parseEvaluationRecords([{ ...testRecords()[0], split: "validation" }], "test"),
    ).toThrow('split "test"');
    expect(() => parseEvaluationRecords([testRecords()[0], testRecords()[0]], "test")).toThrow(
      "duplicate trialId",
    );
    expect(() =>
      parseEvaluationRecords([{ ...testRecords()[0], confidence: 1.1 }], "test"),
    ).toThrow("confidence must be between 0 and 1");
  });
});
