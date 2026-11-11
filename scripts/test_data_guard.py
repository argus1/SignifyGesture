import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


GUARD_PATH = Path(__file__).with_name("check-asl-citizen-data.py")
SPEC = importlib.util.spec_from_file_location("data_guard", GUARD_PATH)
assert SPEC is not None and SPEC.loader is not None
data_guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(data_guard)


class DataGuardTests(unittest.TestCase):
    def test_guard_infrastructure_is_allowed(self):
        self.assertEqual(
            data_guard.find_blocked_paths([
                ".github/workflows/asl-citizen-data-guard.yml",
                "scripts/check-asl-citizen-data.py",
                "scripts/test_data_guard.py",
                "src/lib/aslEvaluation.ts",
                "public/logo.jpg",
            ]),
            [],
        )

    def test_named_data_paths_are_blocked_regardless_of_case_or_extension(self):
        paths = [
            "local-data/asl-citizen/records.json",
            "datasets/ASL_CITIZEN/README.md",
            "ASL-Citizen.zip",
            "asl_citizen_annotations.json",
            "scripts/check-asl-citizen-data.py/samples.json",
            ".github/workflows/asl-citizen-data-guard.yml/samples.json",
        ]
        self.assertEqual(data_guard.find_blocked_paths(paths), paths)

    def test_artifacts_stay_blocked_even_outside_named_directories(self):
        paths = [
            f"exports/sample{suffix.upper()}"
            for suffix in sorted(data_guard.BLOCKED_SUFFIXES)
        ] + [
            "models/classifier.mlpackage/Manifest.json",
            "models/classifier.mlmodelc/metadata.json",
        ]
        self.assertEqual(data_guard.find_blocked_paths(paths), paths)

    def test_cli_checks_git_index_not_untracked_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(
                ["git", "init", "--quiet", directory], check=True, capture_output=True,
            )
            for relative_path in (
                ".github/workflows/asl-citizen-data-guard.yml",
                "scripts/check-asl-citizen-data.py",
            ):
                path = root / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("# guard infrastructure\n")
                subprocess.run(
                    ["git", "add", "--", relative_path],
                    cwd=root, check=True, capture_output=True,
                )
            local_data = root / "local-data/asl-citizen"
            local_data.mkdir(parents=True)
            (local_data / "records.json").write_text("[]")

            result = subprocess.run(
                [sys.executable, "-B", str(GUARD_PATH)],
                cwd=root, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

            subprocess.run(
                ["git", "add", "--", "local-data/asl-citizen/records.json"],
                cwd=root, check=True, capture_output=True,
            )
            result = subprocess.run(
                [sys.executable, "-B", str(GUARD_PATH)],
                cwd=root, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("local-data/asl-citizen/records.json", result.stderr)


if __name__ == "__main__":
    unittest.main()
