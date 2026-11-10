import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import syntheticValidation from "../../fixtures/asl-evaluation/validation.json";
import syntheticTest from "../../fixtures/asl-evaluation/test.json";
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
  it("reproduces the documented synthetic fixture report without recordings", () => {
    const validation = parseEvaluationRecords(syntheticValidation, "validation");
    const test = parseEvaluationRecords(syntheticTest, "test");
    const report = buildEvaluationReport(validation, test, 0.7);

    expect(report.validation).toMatchObject({ sampleCount: 5, signerCount: 1 });
    expect(new Set(test.map(({ signerId }) => signerId)).size).toBe(3);
    expect(report.test).toMatchObject({
      sampleCount: 25,
      correctCount: 13,
      accuracy: 0.52,
      coveredCount: 18,
      coverage: 0.72,
      abstainedCount: 7,
      abstentionRate: 0.28,
      selectiveAccuracy: 13 / 18,
      unsupportedPredictionCount: 1,
      confidence: {
        scoredPredictionCount: 24,
        mean: 0.77875,
        median: 0.9,
        min: 0.4,
        max: 0.99,
      },
      latency: { sampleCount: 25, meanMs: 22, medianMs: 22, p95Ms: 33 },
      coverageRequirements: { meetsMinimum: true },
    });
    const expectedRows = {
      RESEARCH1: [2, 1, 0, 0, 0, 2],
      DEVELOP1: [0, 2, 1, 0, 0, 2],
      CLOUD1: [0, 0, 3, 1, 0, 1],
      EDIT1: [0, 0, 0, 3, 1, 1],
      DECIDE1: [1, 0, 0, 0, 3, 1],
    };
    for (const gloss of SUPPORTED_GLOSSES) {
      expect(Object.values(report.test.confusionMatrix[gloss] ?? {})).toEqual(expectedRows[gloss]);
      expect(report.test.classes[gloss]).toMatchObject({
        support: 5,
        signerCount: 3,
        accuracy: gloss === "RESEARCH1" || gloss === "DEVELOP1" ? 0.84 : 0.88,
        precision: gloss === "RESEARCH1" || gloss === "DEVELOP1" ? 2 / 3 : 0.75,
        recall: gloss === "RESEARCH1" || gloss === "DEVELOP1" ? 0.4 : 0.6,
      });
    }
  });

  it("keeps committed fixtures prediction-only with explicitly synthetic identities", () => {
    const allowedKeys = [
      "trialId",
      "signerId",
      "split",
      "expectedGloss",
      "predictedGloss",
      "confidence",
      "latencyMs",
    ].sort();
    for (const row of [...syntheticValidation, ...syntheticTest]) {
      expect(Object.keys(row).sort()).toEqual(allowedKeys);
      expect(row.trialId).toMatch(/^synthetic-/);
      expect(row.signerId).toMatch(/^synthetic-/);
    }
  });

  it("reports all-no-result input without invented confidence or selective accuracy", () => {
    const report = buildEvaluationReport(
      parseEvaluationRecords(syntheticValidation, "validation"),
      parseEvaluationRecords(syntheticTest, "test").map((row) => ({
        ...row,
        predictedGloss: null,
        confidence: null,
      })),
      0.7,
    );
    expect(report.test).toMatchObject({
      correctCount: 0,
      coveredCount: 0,
      abstainedCount: 25,
      abstentionRate: 1,
      selectiveAccuracy: null,
      confidence: {
        scoredPredictionCount: 0,
        mean: null,
        median: null,
        min: null,
        max: null,
      },
    });
  });

  it("runs the documented CLI and emits the same JSON report", () => {
    const result = runEvaluationCLI("0.7");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      buildEvaluationReport(
        parseEvaluationRecords(syntheticValidation, "validation"),
        parseEvaluationRecords(syntheticTest, "test"),
        0.7,
      ),
    );
  });

  it("fails the CLI explicitly for missing arguments or a non-validation threshold", () => {
    for (const threshold of [undefined, "0.71"]) {
      const result = runEvaluationCLI(threshold);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(
        threshold === undefined ? "Usage:" : "selected from a validation threshold candidate",
      );
    }
  });

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
    expect(() =>
      parseEvaluationRecords([{ ...testRecords()[0], predictedGloss: null }], "test"),
    ).toThrow("confidence must be null for no-result");
    expect(() => parseEvaluationRecords([{ ...testRecords()[0], latencyMs: -1 }], "test")).toThrow(
      "latencyMs must be a non-negative number",
    );
  });
});

function runEvaluationCLI(threshold: string | undefined) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/evaluate-asl.ts",
      "fixtures/asl-evaluation/validation.json",
      "fixtures/asl-evaluation/test.json",
      ...(threshold === undefined ? [] : [threshold]),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}
