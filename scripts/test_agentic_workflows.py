import json
import os
from pathlib import Path
import re
import subprocess
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github/workflows"
AGENTS = {
    "agent-contract-review",
    "agent-ci-investigator",
    "agent-accessibility-test",
    "agent-evaluation-analysis",
    "agent-docs-drift",
    "agent-issue-regression",
}
REVIEWERS = {
    "agent-contract-review",
    "agent-accessibility-test",
    "agent-evaluation-analysis",
}
WRITERS = {"agent-docs-drift", "agent-issue-regression"}


class UniqueKeyLoader(yaml.BaseLoader):
    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if key in result:
                raise ValueError(f"Duplicate YAML key: {key}")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def load_yaml(text):
    return yaml.load(text, Loader=UniqueKeyLoader)


def source(name):
    text = (WORKFLOWS / f"{name}.md").read_text()
    _, frontmatter, body = text.split("---", 2)
    return load_yaml(frontmatter), body


def lock(name):
    return load_yaml((WORKFLOWS / f"{name}.lock.yml").read_text())


def shared(name):
    return load_yaml((ROOT / f".github/aw/{name}.md").read_text().split("---", 2)[1])


def run_gate(script, data, environment):
    wrapper = """
        const fixture = JSON.parse(process.argv[1]);
        const context = {repo: {owner: "test", repo: "synthetic"}};
        const outputs = {};
        const files = {};
        const summary = {
          addHeading() { return this; }, addRaw() { return this; }, async write() {},
        };
        const core = {setOutput: (key, value) => outputs[key] = value, summary};
        const require = () => ({
          mkdirSync() {}, writeFileSync: (path, text) => files[path] = JSON.parse(text),
        });
        const github = {rest: {
          issues: {get: async () => ({data: fixture})},
          pulls: {get: async () => ({data: fixture})},
          actions: {getWorkflowRun: async () => ({data: fixture})},
        }};
    """ + script + "\nconsole.log(JSON.stringify({outputs, files}));"
    result = subprocess.run(
        ["node", "--input-type=module", "-e", wrapper, json.dumps(data)],
        env={**os.environ, **environment},
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    return result


class AgenticWorkflowTests(unittest.TestCase):
    def test_exactly_six_sources_and_locks(self):
        self.assertEqual({p.stem for p in WORKFLOWS.glob("agent-*.md")}, AGENTS)
        self.assertEqual(
            {p.name.removesuffix(".lock.yml") for p in WORKFLOWS.glob("agent-*.lock.yml")},
            AGENTS,
        )

    def test_yaml_rejects_duplicate_keys_and_preserves_on(self):
        self.assertEqual(load_yaml("on:\n  push:\n"), {"on": {"push": ""}})
        with self.assertRaisesRegex(ValueError, "Duplicate YAML key"):
            load_yaml("on: push\non: issues\n")

    def test_sources_have_explicit_limits_and_opt_in(self):
        for name in sorted(AGENTS):
            with self.subTest(agent=name):
                config, _ = source(name)
                self.assertEqual(config["strict"], "true")
                self.assertIn("vars.AGENTIC_WORKFLOWS_ENABLED == 'true'", config["if"])
                self.assertIn(
                    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
                    config["if"],
                )
                self.assertEqual(set(config["on"]["roles"]), {"admin", "maintain", "write"})
                self.assertEqual(set(config["on"]), {"workflow_dispatch", "roles"})
                self.assertNotIn("environment", config)
                self.assertEqual(config["concurrency"]["job-discriminator"], "${{ github.run_id }}")
                self.assertLessEqual(int(config["timeout-minutes"]), 20)
                self.assertLessEqual(int(config["max-turns"]), 30)
                self.assertEqual(int(config["max-ai-credits"]), 100)
                self.assertEqual(int(config["max-daily-ai-credits"]), 500)
                self.assertIn(".github/aw/common.md", config["imports"])
                self.assertTrue(all(v == "read" for v in config["permissions"].values()))
                self.assertNotIn("pull_request_target", config["on"])
                self.assertNotIn("schedule", config["on"])
                for output in ("report-incomplete", "report-missing-data", "report-missing-tool"):
                    self.assertEqual(config["safe-outputs"][output], "false")

    def test_reports_select_pr_explicitly_and_are_comment_only(self):
        for name in sorted(REVIEWERS):
            with self.subTest(agent=name):
                config, _ = source(name)
                inputs = config["on"]["workflow_dispatch"]["inputs"]
                self.assertEqual(set(inputs), {"pr_number"})
                self.assertEqual(inputs["pr_number"]["required"], "true")
                self.assertEqual(inputs["pr_number"]["type"], "string")
                self.assertIn(".github/aw/manual-pr.md", config["imports"])
                output = config["safe-outputs"]
                self.assertEqual(
                    {key for key, value in output.items() if isinstance(value, dict)},
                    {"add-comment"},
                )
                self.assertEqual(output["add-comment"]["max"], "1")
                self.assertEqual(output["add-comment"]["target"], "${{ inputs.pr_number }}")
                self.assertEqual(output["add-comment"]["replace-older-comments"], "true")
                self.assertEqual(config["concurrency"]["cancel-in-progress"], "true")

    def test_failure_investigator_selects_run_explicitly(self):
        config, body = source("agent-ci-investigator")
        inputs = config["on"]["workflow_dispatch"]["inputs"]
        self.assertEqual(set(inputs), {"run_id"})
        self.assertEqual(inputs["run_id"]["required"], "true")
        self.assertIn("selected-run.json", body)
        self.assertEqual(
            {key for key, value in config["safe-outputs"].items() if isinstance(value, dict)},
            {"create-issue"},
        )
        self.assertEqual(config["safe-outputs"]["create-issue"]["max"], "1")
        self.assertEqual(
            config["safe-outputs"]["create-issue"]["deduplicate-by-title"], "true"
        )
        self.assertIn("attempt", body)
        self.assertNotIn("frontend-tools.md", " ".join(config["imports"]))

    def test_writers_use_manual_authorization_and_restrict_patches(self):
        for name in sorted(WRITERS):
            with self.subTest(agent=name):
                config, _ = source(name)
                self.assertNotIn("manual-approval", config["on"])
                self.assertEqual(config["checkout"]["ref"], "dev")
                output = config["safe-outputs"]["create-pull-request"]
                self.assertEqual(output["base-branch"], "dev")
                self.assertEqual(output["draft"], "true")
                self.assertEqual(output["max"], "1")
                self.assertEqual(output["fallback-as-issue"], "false")
                self.assertEqual(output["auto-close-issue"], "false")
                self.assertTrue(output["allowed-files"])
                self.assertEqual(
                    output["protected-files"],
                    {"policy": "request-review", "exclude": ["/README.md"]},
                )
                self.assertNotIn("auto-merge", output)
                for pattern in output["allowed-files"]:
                    self.assertFalse(pattern.startswith((".github/", "supabase/", "drizzle/")))
                    self.assertNotIn("routeTree", pattern)
                    self.assertNotIn("local", pattern)
                    self.assertNotIn("fixtures/", pattern)

    def test_docs_output_is_only_explicit_documentation(self):
        config, _ = source("agent-docs-drift")
        output = config["safe-outputs"]["create-pull-request"]
        self.assertEqual(output["max-patch-files"], "5")
        self.assertEqual(output["max-patch-size"], "64")
        self.assertEqual(config["on"]["workflow_dispatch"], "")
        for path in output["allowed-files"]:
            self.assertTrue(path == "README.md" or path.startswith("Docs/"))
            self.assertTrue((ROOT / path).is_file(), path)
            self.assertNotIn("*", path)
            self.assertTrue(path.endswith(".md"))

    def test_issue_fix_is_opt_in_and_requires_red_green(self):
        config, body = source("agent-issue-regression")
        inputs = config["on"]["workflow_dispatch"]["inputs"]
        self.assertEqual(set(inputs), {"issue_number"})
        self.assertEqual(inputs["issue_number"]["required"], "true")
        self.assertIn("current metadata again", body)
        self.assertIn("BEFORE changing production code", body)
        self.assertIn("do not create a PR if validation is blocked or fails", body)
        for hook in ("pre-agent-steps", "post-steps"):
            script = config[hook][0]["with"]["script"]
            self.assertIn('issue.state !== "open"', script)
            self.assertNotIn("labels", script)
            self.assertIn("process.env.ISSUE_NUMBER", script)
            self.assertNotIn("context.issue.number", script)
            self.assertIn('throw new Error(', script)
        output = config["safe-outputs"]["create-pull-request"]
        self.assertEqual(output["max-patch-files"], "8")
        self.assertEqual(output["max-patch-size"], "128")

    def test_issue_authorization_gates_execute_against_live_state(self):
        config, _ = source("agent-issue-regression")
        cases = (
            ({"state": "open", "labels": [{"name": "agentic-fix"}]}, True),
            ({"state": "open", "labels": []}, True),
            ({"state": "closed", "labels": [{"name": "agentic-fix"}]}, False),
            ({
                "state": "open",
                "labels": [{"name": "agentic-fix"}],
                "pull_request": {"url": "synthetic"},
            }, False),
        )
        for hook in ("pre-agent-steps", "post-steps"):
            script = config[hook][0]["with"]["script"]
            for issue, allowed in cases:
                with self.subTest(hook=hook, issue=issue):
                    result = run_gate(script, issue, {"ISSUE_NUMBER": "1"})
                    self.assertEqual(result.returncode == 0, allowed, result.stderr)
                    if not allowed:
                        self.assertIn("refusing", result.stderr)

    def test_pr_snapshot_and_stale_result_gates(self):
        config = shared("manual-pr")
        self.assertEqual(config["checkout"]["ref"], "${{ github.event.repository.default_branch }}")
        self.assertEqual(config["checkout"]["fetch-depth"], "0")
        self.assertEqual(config["checkout"]["pull-request"], "false")
        pr = {
            "number": 7,
            "state": "open",
            "head": {"sha": "a" * 40, "repo": {"full_name": "test/synthetic"}},
            "base": {"sha": "b" * 40, "repo": {"full_name": "test/synthetic"}},
        }
        cases = [
            (pr, True),
            ({**pr, "state": "closed"}, False),
            ({**pr, "head": {**pr["head"], "repo": None}}, False),
            ({**pr, "head": {**pr["head"], "repo": {"full_name": "fork/synthetic"}}}, False),
            ({**pr, "head": {**pr["head"], "sha": "invalid"}}, False),
        ]
        script = config["pre-agent-steps"][0]["with"]["script"]
        for value, allowed in cases:
            with self.subTest(pr=value):
                result = run_gate(script, value, {"PR_NUMBER": "7"})
                self.assertEqual(result.returncode == 0, allowed, result.stderr)
                if allowed:
                    snapshot = json.loads(result.stdout)["files"]["/tmp/gh-aw/agent/selected-pr.json"]
                    self.assertEqual(snapshot, {"number": 7, "head_sha": "a" * 40, "base_sha": "b" * 40})
        script = config["post-steps"][0]["with"]["script"]
        for head, base, allowed in (("a", "b", True), ("c", "b", False), ("a", "c", False)):
            result = run_gate(script, pr, {
                "PR_NUMBER": "7", "REVIEWED_HEAD": head * 40, "REVIEWED_BASE": base * 40,
            })
            self.assertEqual(result.returncode == 0, allowed, result.stderr)

    def test_manual_numeric_inputs_reject_invalid_values(self):
        issue, _ = source("agent-issue-regression")
        ci, _ = source("agent-ci-investigator")
        scripts = [
            (shared("manual-pr")["pre-agent-steps"][0]["with"]["script"], "PR_NUMBER"),
            (issue["pre-agent-steps"][0]["with"]["script"], "ISSUE_NUMBER"),
            (ci["pre-agent-steps"][0]["with"]["script"], "RUN_ID"),
        ]
        for script, key in scripts:
            for value in ("", "0", "-1", "1.5", "1;echo injected", "9007199254740992"):
                with self.subTest(input=key, value=value):
                    result = run_gate(script, {}, {key: value})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("positive safe integer", result.stderr)

    def test_manual_ci_run_validation(self):
        config, _ = source("agent-ci-investigator")
        script = config["pre-agent-steps"][0]["with"]["script"]
        run = {
            "id": 9, "run_attempt": 2, "head_sha": "a" * 40,
            "status": "completed", "conclusion": "failure",
            "event": "push", "head_branch": "dev", "name": "CI",
            "path": ".github/workflows/ci.yml",
            "repository": {"full_name": "test/synthetic"},
            "head_repository": {"full_name": "test/synthetic"},
        }
        cases = [
            (run, True),
            ({**run, "event": "pull_request"}, True),
            ({**run, "conclusion": "success"}, False),
            ({**run, "status": "in_progress"}, False),
            ({**run, "event": "workflow_dispatch"}, False),
            ({**run, "name": "Agent - CI failure investigator"}, False),
            ({**run, "head_repository": {"full_name": "fork/synthetic"}}, False),
            ({**run, "head_branch": "untrusted"}, False),
        ]
        for value, allowed in cases:
            with self.subTest(run=value):
                result = run_gate(script, value, {"RUN_ID": "9"})
                self.assertEqual(result.returncode == 0, allowed, result.stderr)
                if allowed:
                    snapshot = json.loads(result.stdout)["files"]["/tmp/gh-aw/agent/selected-run.json"]
                    self.assertEqual(snapshot["attempt"], 2)

    def test_shared_tooling_stays_read_only_and_install_scripts_disabled(self):
        config = load_yaml((ROOT / ".github/aw/common.md").read_text().split("---", 2)[1])
        self.assertEqual(config["engine"], "copilot")
        self.assertEqual(config["tools"]["github"]["read-only"], "true")
        self.assertEqual(config["network"]["allowed"], ["defaults", "github"])
        self.assertEqual(config["safe-outputs"]["activation-comments"], "false")
        self.assertEqual(config["safe-outputs"]["noop"]["report-as-issue"], "false")
        tools = load_yaml(
            (ROOT / ".github/aw/frontend-tools.md").read_text().split("---", 2)[1]
        )
        self.assertIn(
            "bun install --frozen-lockfile --ignore-scripts", tools["tools"]["bash"]
        )
        self.assertEqual(tools["network"]["allowed"], ["node"])
        for step in tools["steps"]:
            self.assertNotIn("run", step)
            self.assertRegex(step["uses"], r"@[a-f0-9]{40}$")

    def test_compiled_policy_matches_sources(self):
        for name in sorted(AGENTS):
            with self.subTest(agent=name):
                compiled = lock(name)
                config, _ = source(name)
                self.assertEqual(compiled["permissions"], {})
                agent = compiled["jobs"]["agent"]
                self.assertTrue(all(v == "read" for v in agent["permissions"].values()))
                self.assertIn(
                    "vars.AGENTIC_WORKFLOWS_ENABLED == 'true'",
                    compiled["jobs"]["activation"]["if"],
                )
                configs = [
                    step["env"]["GH_AW_SAFE_OUTPUTS_CONFIG"]
                    for step in agent["steps"]
                    if "GH_AW_SAFE_OUTPUTS_CONFIG" in step.get("env", {})
                ]
                self.assertEqual(len(configs), 1)
                outputs = json.loads(configs[0])
                self.assertEqual(
                    set(outputs),
                    {
                        key.replace("-", "_")
                        for key, value in config["safe-outputs"].items()
                        if isinstance(value, dict)
                    } | {"noop"},
                )
                self.assertEqual(outputs["noop"]["report-as-issue"], "false")
                for output_name, authored in config["safe-outputs"].items():
                    if not isinstance(authored, dict):
                        continue
                    generated = outputs[output_name.replace("-", "_")]
                    self.assertEqual(generated["max"], int(authored["max"]))
                    if output_name == "create-pull-request":
                        self.assertTrue(generated["draft"])
                        self.assertEqual(generated["base_branch"], "dev")
                        self.assertEqual(generated["allowed_files"], authored["allowed-files"])
                self.assertEqual(set(compiled["on"]), {"workflow_dispatch"})
                for job in compiled["jobs"].values():
                    self.assertNotIn("environment", job)
                if name in REVIEWERS | {"agent-issue-regression", "agent-ci-investigator"}:
                    self.assertIn(
                        "needs.agent.result == 'success'",
                        compiled["jobs"]["safe_outputs"]["if"],
                    )
                if name in REVIEWERS:
                    handler_configs = [
                        step["env"]["GH_AW_SAFE_OUTPUTS_HANDLER_CONFIG"]
                        for step in compiled["jobs"]["safe_outputs"]["steps"]
                        if "GH_AW_SAFE_OUTPUTS_HANDLER_CONFIG" in step.get("env", {})
                    ]
                    self.assertEqual(
                        json.loads(handler_configs[0])["add_comment"]["target"],
                        "${{ inputs.pr_number }}",
                    )
                    self.assertIn(
                        "Reject stale PR results before publication",
                        [step.get("name") for step in agent["steps"]],
                    )

    def test_autonomous_maintenance_is_disabled(self):
        config = json.loads((WORKFLOWS / "aw.json").read_text())
        self.assertIs(config["maintenance"], False)
        self.assertFalse((WORKFLOWS / "agentics-maintenance.yml").exists())

    def test_locks_pin_compiler_actions_and_containers(self):
        for name in sorted(AGENTS):
            with self.subTest(agent=name):
                text = (WORKFLOWS / f"{name}.lock.yml").read_text()
                metadata = json.loads(text.splitlines()[0].split(": ", 1)[1])
                self.assertEqual(metadata["compiler_version"], "v1.2.2")
                self.assertTrue(metadata["strict"])
                for action in re.findall(r"^\s+uses:\s+([^\s]+)", text, re.MULTILINE):
                    if not action.startswith("./"):
                        self.assertRegex(action, r"@[a-f0-9]{40}$")
                manifest = json.loads(text.splitlines()[1].split(": ", 1)[1])
                self.assertEqual(manifest["threat_detection"]["mode"], "enabled")
                for container in manifest["containers"]:
                    self.assertRegex(container["pinned_image"], r"@sha256:[a-f0-9]{64}$")

    def test_conventional_workflows_parse_and_pin_actions(self):
        for name in ("ci.yml", "native-ci.yml", "agentic-workflow-validation.yml"):
            with self.subTest(workflow=name):
                config = load_yaml((WORKFLOWS / name).read_text())
                self.assertEqual(config["permissions"], {"contents": "read"})
                self.assertIn("pull_request", config["on"])
                for job in config["jobs"].values():
                    self.assertLessEqual(int(job["timeout-minutes"]), 30)
                    for step in job["steps"]:
                        if "uses" in step:
                            self.assertRegex(step["uses"], r"@[a-f0-9]{40}$")
                        if step.get("uses", "").startswith("actions/checkout@"):
                            self.assertEqual(step["with"]["persist-credentials"], "false")


if __name__ == "__main__":
    unittest.main()
