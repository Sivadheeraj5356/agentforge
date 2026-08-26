"""v1 CLI: prints a legacy dump without client keys."""

from app.main import list_entries


def main() -> None:
    payload = list_entries()
    print("legacy")
    for row in payload["entries"]:
        print(f"{row['id']}:{row['amount']}")


if __name__ == "__main__":
    main()
