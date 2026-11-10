export const SUPPORTED_GLOSSES = ["RESEARCH1", "DEVELOP1", "CLOUD1", "EDIT1", "DECIDE1"] as const;

export const NO_RESULT = "NO_RESULT";

export type EvaluationSplit = "validation" | "test";

export type PredictionRecord = {
  trialId: string;
  signerId: string;
  split: EvaluationSplit;
  expectedGloss: (typeof SUPPORTED_GLOSSES)[number];
  predictedGloss: string | null;
  confidence: number | null;
  latencyMs: number;
};

type ClassMetrics = {
  support: number;
  signerCount: number;
  correct: number;
  predicted: number;
  noResult: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
};

type EvaluatedRecord = {
  record: PredictionRecord;
  output: (typeof SUPPORTED_GLOSSES)[number] | typeof NO_RESULT;
};

function isSupportedGloss(value: string): value is (typeof SUPPORTED_GLOSSES)[number] {
  return SUPPORTED_GLOSSES.some((gloss) => gloss === value);
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function parseEvaluationRecords(
  value: unknown,
  expectedSplit: EvaluationSplit,
): PredictionRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${expectedSplit} data must be a non-empty JSON array.`);
  }

  const trialIds = new Set<string>();
  return value.map((item, index) => {
    const rowNumber = index + 1;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${expectedSplit} row ${rowNumber} must be an object.`);
    }
    const row = item as Record<string, unknown>;

    const trialIdValue = row["trialId"];
    const signerIdValue = row["signerId"];
    if (typeof trialIdValue !== "string" || trialIdValue.trim() === "") {
      throw new Error(`${expectedSplit} row ${rowNumber} needs a non-empty trialId.`);
    }
    if (typeof signerIdValue !== "string" || signerIdValue.trim() === "") {
      throw new Error(`${expectedSplit} row ${rowNumber} needs a non-empty signerId.`);
    }

    const trialId = trialIdValue.trim();
    if (trialIds.has(trialId)) {
      throw new Error(`${expectedSplit} data contains duplicate trialId "${trialId}".`);
    }
    trialIds.add(trialId);

    if (row["split"] !== expectedSplit) {
      throw new Error(`${expectedSplit} row ${rowNumber} must have split "${expectedSplit}".`);
    }
    const expectedGloss = row["expectedGloss"];
    if (typeof expectedGloss !== "string" || !isSupportedGloss(expectedGloss)) {
      throw new Error(`${expectedSplit} row ${rowNumber} has an unsupported expectedGloss.`);
    }

    const predictedGlossValue = row["predictedGloss"];
    let predictedGloss: string | null;
    if (predictedGlossValue === null) {
      predictedGloss = null;
    } else if (typeof predictedGlossValue === "string" && predictedGlossValue.trim() !== "") {
      predictedGloss = predictedGlossValue.trim();
    } else {
      throw new Error(`${expectedSplit} row ${rowNumber} predictedGloss must be a label or null.`);
    }

    const confidenceValue = row["confidence"];
    let confidence: number | null;
    if (predictedGloss === null) {
      if (confidenceValue !== null) {
        throw new Error(`${expectedSplit} row ${rowNumber} confidence must be null for no-result.`);
      }
      confidence = null;
    } else {
      if (!isConfidence(confidenceValue)) {
        throw new Error(`${expectedSplit} row ${rowNumber} confidence must be between 0 and 1.`);
      }
      confidence = confidenceValue;
    }

    const latencyMs = row["latencyMs"];
    if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs) || latencyMs < 0) {
      throw new Error(`${expectedSplit} row ${rowNumber} latencyMs must be a non-negative number.`);
    }

    return {
      trialId,
      signerId: signerIdValue.trim(),
      split: expectedSplit,
      expectedGloss,
      predictedGloss,
      confidence,
      latencyMs,
    };
  });
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? null;
}

function summarizeLatency(records: PredictionRecord[]) {
  const latencies = records.map((record) => record.latencyMs);
  const sum = latencies.reduce((total, latency) => total + latency, 0);
  return {
    sampleCount: latencies.length,
    meanMs: sum / latencies.length,
    medianMs: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
  };
}

function evaluateAtThreshold(records: PredictionRecord[], threshold: number) {
  const evaluated: EvaluatedRecord[] = records.map((record) => {
    const output =
      record.predictedGloss !== null &&
      isSupportedGloss(record.predictedGloss) &&
      (record.confidence ?? -1) >= threshold
        ? record.predictedGloss
        : NO_RESULT;
    return { record, output };
  });

  const confusionMatrix: Record<string, Record<string, number>> = {};
  const classes: Record<string, ClassMetrics> = {};
  for (const expected of SUPPORTED_GLOSSES) {
    confusionMatrix[expected] = Object.fromEntries(
      [...SUPPORTED_GLOSSES, NO_RESULT].map((output) => [output, 0]),
    );
    const classRecords = evaluated.filter(({ record }) => record.expectedGloss === expected);
    const correct = classRecords.filter(
      ({ record, output }) => record.expectedGloss === output,
    ).length;
    const predicted = evaluated.filter(({ output }) => output === expected).length;
    const signerCount = new Set(classRecords.map(({ record }) => record.signerId)).size;
    classes[expected] = {
      support: classRecords.length,
      signerCount,
      correct,
      predicted,
      noResult: classRecords.filter(({ output }) => output === NO_RESULT).length,
      accuracy:
        evaluated.length > 0
          ? (correct + evaluated.length - classRecords.length - (predicted - correct)) /
            evaluated.length
          : null,
      precision: predicted > 0 ? correct / predicted : null,
      recall: classRecords.length > 0 ? correct / classRecords.length : null,
    };
    for (const { record, output } of classRecords) {
      const confusionRow = confusionMatrix[expected];
      if (!confusionRow) throw new Error(`Missing confusion-matrix row for ${expected}.`);
      confusionRow[output] = (confusionRow[output] ?? 0) + 1;
    }
  }

  const total = evaluated.length;
  const correctCount = evaluated.filter(
    ({ record, output }) => record.expectedGloss === output,
  ).length;
  const coveredCount = evaluated.filter(({ output }) => output !== NO_RESULT).length;
  const confidenceValues = records.flatMap((record) =>
    record.confidence === null ? [] : [record.confidence],
  );
  const coverageRequirements = Object.fromEntries(
    SUPPORTED_GLOSSES.map((gloss) => {
      const metrics = classes[gloss];
      if (!metrics) throw new Error(`Missing metrics for ${gloss}.`);
      const { support, signerCount } = metrics;
      return [
        gloss,
        {
          trialCount: support,
          signerCount,
          meetsMinimum: support >= 5 && signerCount >= 3,
        },
      ];
    }),
  );
  const confidenceMean =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
      : null;

  return {
    sampleCount: total,
    correctCount,
    accuracy: correctCount / total,
    coveredCount,
    coverage: coveredCount / total,
    selectiveAccuracy: coveredCount > 0 ? correctCount / coveredCount : null,
    unsupportedPredictionCount: records.filter(
      ({ predictedGloss }) => predictedGloss !== null && !isSupportedGloss(predictedGloss),
    ).length,
    classes,
    confusionMatrix,
    confidence: {
      scoredPredictionCount: confidenceValues.length,
      mean: confidenceMean,
      median: percentile(confidenceValues, 0.5),
      min:
        confidenceValues.length > 0
          ? confidenceValues.reduce((min, value) => Math.min(min, value), 1)
          : null,
      max:
        confidenceValues.length > 0
          ? confidenceValues.reduce((max, value) => Math.max(max, value), 0)
          : null,
    },
    latency: summarizeLatency(records),
    coverageRequirements: {
      perGloss: coverageRequirements,
      meetsMinimum: Object.values(coverageRequirements).every((item) => item.meetsMinimum),
    },
  };
}

function validationThresholdSweep(records: PredictionRecord[]) {
  const candidates = [
    ...new Set([
      0,
      1,
      ...records.flatMap((record) =>
        record.predictedGloss !== null &&
        isSupportedGloss(record.predictedGloss) &&
        record.confidence !== null
          ? [record.confidence]
          : [],
      ),
    ]),
  ].sort((a, b) => a - b);

  return candidates.map((threshold) => {
    const evaluated = evaluateAtThreshold(records, threshold);
    return {
      threshold,
      coverage: evaluated.coverage,
      accuracy: evaluated.accuracy,
      selectiveAccuracy: evaluated.selectiveAccuracy,
      coverageByGloss: Object.fromEntries(
        SUPPORTED_GLOSSES.map((gloss) => {
          const metrics = evaluated.classes[gloss];
          if (!metrics) throw new Error(`Missing metrics for ${gloss}.`);
          const support = metrics.support;
          const covered = support - metrics.noResult;
          return [gloss, support > 0 ? covered / support : null];
        }),
      ),
    };
  });
}

export function buildEvaluationReport(
  validationRecords: PredictionRecord[],
  testRecords: PredictionRecord[],
  threshold: number,
) {
  if (!isConfidence(threshold)) {
    throw new Error("The confidence threshold must be a number between 0 and 1.");
  }
  const validationSigners = new Set(validationRecords.map(({ signerId }) => signerId));
  const overlappingSigners = [...new Set(testRecords.map(({ signerId }) => signerId))].filter(
    (signerId) => validationSigners.has(signerId),
  );
  if (overlappingSigners.length > 0) {
    throw new Error("Validation and test signers must be disjoint.");
  }
  const thresholdCandidates = validationThresholdSweep(validationRecords);
  if (!thresholdCandidates.some((candidate) => candidate.threshold === threshold)) {
    throw new Error(
      "The confidence threshold must be selected from a validation threshold candidate.",
    );
  }

  return {
    threshold,
    thresholdSource: "Selected from validation results; not fitted on test results.",
    validation: {
      sampleCount: validationRecords.length,
      signerCount: new Set(validationRecords.map(({ signerId }) => signerId)).size,
      thresholdSweep: thresholdCandidates,
    },
    test: evaluateAtThreshold(testRecords, threshold),
  };
}
