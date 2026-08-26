"""CLI: python -m training <dataset|split|sft|grpo>"""

from __future__ import annotations

import sys


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] in {"-h", "--help"}:
        print("usage: python -m training [dataset|split|sft|grpo] ...")
        return 0
    command = args[0]
    if command == "dataset":
        from training.dataset import main as dataset_main

        return dataset_main(args[1:])
    if command == "split":
        from training.split import main as split_main

        return split_main(args[1:])
    if command == "sft":
        from training.sft import main as sft_main

        return sft_main(args[1:])
    if command == "grpo":
        from training.grpo import main as grpo_main

        return grpo_main(args[1:])
    print(f"unknown command: {command}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
