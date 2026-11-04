"""Metadados de releases, sem leitura de configurações ou segredos do servidor."""
import hashlib
import json
import re
import sys
from pathlib import Path

FILES = (
    "images.tar.gz", "docker-compose.hml.yml", "manifest.json",
    "scripts/cicd/release.py", "scripts/cicd/deploy-common.sh",
    "scripts/cicd/deploy-hml.sh", "scripts/cicd/rollback-hml.sh",
    "scripts/cicd/prepare-config.py",
)


def digest(stream):
    checksum = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        checksum.update(chunk)
    return checksum.hexdigest()


def valid_release(value):
    if not re.fullmatch(r"[0-9]+-[a-f0-9]{40}", value):
        raise ValueError("Identificador de release inválido.")
    return value


def manifest(directory, expected):
    data = json.loads((directory / "manifest.json").read_text())
    if valid_release(data["releaseId"]) != valid_release(expected):
        raise ValueError("Artifact não pertence ao run/commit esperado.")
    for kind, repository in (("api", "lambdaquality-api"), ("migrations", "lambdaquality-migrations")):
        image = data[kind]
        if image["tag"] != f"{repository}:{expected}" or not re.fullmatch(r"sha256:[a-f0-9]{64}", image["id"]):
            raise ValueError("Imagem de release inválida.")
    return data


def verify(directory, expected):
    entries = (directory / "SHA256SUMS").read_text().splitlines()
    seen = set()
    for line in entries:
        checksum, name = line.split("  ", 1)
        if name not in FILES or name in seen or not re.fullmatch(r"[a-f0-9]{64}", checksum):
            raise ValueError("Inventário de checksums inválido.")
        file = directory / name
        if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(directory.resolve()):
            raise ValueError("Arquivo de release inválido.")
        with file.open("rb") as stream:
            actual = digest(stream)
        if actual != checksum:
            raise ValueError("Checksum do artifact não confere.")
        seen.add(name)
    if seen != set(FILES):
        raise ValueError("Artifact incompleto.")
    return manifest(directory, expected)


def main():
    command, raw_directory, expected, *args = sys.argv[1:]
    directory = Path(raw_directory)
    expected = valid_release(expected)
    if command == "create":
        api_id, migrations_id = args
        data = {"releaseId": expected,
                "api": {"tag": f"lambdaquality-api:{expected}", "id": api_id},
                "migrations": {"tag": f"lambdaquality-migrations:{expected}", "id": migrations_id}}
        (directory / "manifest.json").write_text(json.dumps(data, indent=2) + "\n")
        manifest(directory, expected)
        lines = []
        for name in FILES:
            with (directory / name).open("rb") as stream:
                lines.append(f"{digest(stream)}  {name}")
        (directory / "SHA256SUMS").write_text("\n".join(lines) + "\n")
    elif command == "verify":
        verify(directory, expected)
        print("Artifact e checksums verificados.")
    elif command == "image":
        kind, field = args
        if kind not in ("api", "migrations") or field not in ("tag", "id"):
            raise ValueError("Campo inválido.")
        print(manifest(directory, expected)[kind][field])
    else:
        raise ValueError("Comando de release inválido.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError):
        print("Release inválida ou inacessível; operação interrompida.", file=sys.stderr)
        raise SystemExit(1)
