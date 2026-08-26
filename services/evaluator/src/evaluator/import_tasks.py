"""Import local Harbor/TB task directories into the public catalog.

Does not copy licensed dumps into git. Point --root at a gitignored checkout.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from evaluator.store import EvaluatorStore


def discover_task_dirs(root: Path) -> list[Path]:
    found: list[Path] = []
    if not root.is_dir():
        return found
    for child in sorted(root.iterdir()):
        if not child.is_dir() or child.name.startswith("_"):
            continue
        if (child / "instruction.md").is_file() and (
            (child / "task.toml").is_file() or (child / "task.yaml").is_file()
        ):
            found.append(child)
    return found


def task_description(path: Path) -> str:
    instruction = path / "instruction.md"
    if not instruction.is_file():
        return ""
    text = instruction.read_text(encoding="utf-8").strip()
    first = text.splitlines()[0] if text else path.name
    return first[:500]


def ensure_catalog_task(
    store: EvaluatorStore,
    *,
    benchmark_key: str,
    version: str,
    external_key: str,
    name: str,
    description: str,
) -> str:
    benches = store._request("GET", "/benchmarks", query=f"key=eq.{benchmark_key}&select=id")
    if not benches:
        raise RuntimeError(f"unknown benchmark: {benchmark_key}")
    versions = store._request(
        "GET",
        "/benchmark_versions",
        query=f"benchmark_id=eq.{benches[0]['id']}&version=eq.{version}&select=id",
    )
    if not versions:
        raise RuntimeError(f"unknown benchmark version: {benchmark_key}@{version}")
    version_id = versions[0]["id"]
    existing = store._request(
        "GET",
        "/tasks",
        query=f"benchmark_version_id=eq.{version_id}&external_key=eq.{external_key}&select=id",
    )
    if existing:
        task_id = existing[0]["id"]
    else:
        created = store._request(
            "POST",
            "/tasks",
            body={
                "benchmark_version_id": version_id,
                "external_key": external_key,
                "name": name[:200],
                "description": description[:2000] or None,
                "metadata": {"schemaVersion": 1, "imported": True},
            },
        )
        task_id = created[0]["id"] if isinstance(created, list) else created["id"]
    versions_for_task = store._request(
        "GET",
        "/task_versions",
        query=f"task_id=eq.{task_id}&version=eq.1.0.0&select=id",
    )
    if not versions_for_task:
        store._request(
            "POST",
            "/task_versions",
            body={"task_id": task_id, "version": "1.0.0"},
        )
    return str(task_id)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import evaluation fixtures into the catalog")
    parser.add_argument("--root", required=False, default=None)
    parser.add_argument("--benchmark", default=None)
    parser.add_argument("--version", default=None)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Insert missing catalog rows (service role). Default is list-only.",
    )
    args = parser.parse_args(argv)
    tb_root = os.environ.get("TB_FIXTURES_DIR")
    using_tb = not args.root and bool(tb_root)
    root_value = args.root or tb_root
    if not root_value:
        raise RuntimeError("--root or TB_FIXTURES_DIR is required")
    benchmark = args.benchmark or ("terminal-bench" if using_tb else "agentforge-internal")
    version = args.version or ("2.0.0" if benchmark == "terminal-bench" else "1.0.0")
    root = Path(root_value)
    tasks = discover_task_dirs(root)
    print(f"benchmark={benchmark} version={version}")
    for path in tasks:
        print(path.name)
    print(f"count={len(tasks)}")
    if not args.write:
        return 0
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --write")
    store = EvaluatorStore(url, key)
    for path in tasks:
        ensure_catalog_task(
            store,
            benchmark_key=benchmark,
            version=version,
            external_key=path.name,
            name=path.name.replace("-", " "),
            description=task_description(path),
        )
        print(f"imported={path.name}")
    return 0
