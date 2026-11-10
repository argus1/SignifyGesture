import { readFileSync } from "node:fs";
import { buildEvaluationReport, parseEvaluationRecords } from "../src/lib/aslEvaluation";

function main() {
  const [validationPath, testPath, thresholdText] = process.argv.slice(2);
  if (!validationPath || !testPath || thresholdText === undefined) {
    throw new Error(
      "Usage: bun run scripts/evaluate-asl.ts <validation.json> <test.json> <validation-threshold>",
    );
  }

  const threshold = Number(thresholdText);
  const validation = parseEvaluationRecords(
    JSON.parse(readFileSync(validationPath, "utf8")) as unknown,
    "validation",
  );
  const test = parseEvaluationRecords(
    JSON.parse(readFileSync(testPath, "utf8")) as unknown,
    "test",
  );
  const report = buildEvaluationReport(validation, test, threshold);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
