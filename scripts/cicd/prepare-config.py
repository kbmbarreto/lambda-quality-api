"""Converte variáveis explícitas da Library em configuração privada da release."""
import ipaddress
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

API_VARIABLES = (
    "TEST_VAULT_ACTIVE_KEY_ID", "TEST_VAULT_ENCRYPTION_KEYS",
    "DATABASE_DIALECT", "DATABASE_URL", "DB_URL", "DB_USERNAME", "DB_PASSWORD",
    "DB_SSL_CA_PATH", "JWT_SECRET", "OTP_HMAC_SECRET", "INVITATION_ENCRYPTION_SECRET",
    "JWT_KEY_ID", "JWT_ISSUER", "JWT_AUDIENCE", "ACCESS_TOKEN_TTL_SECONDS",
    "SESSION_TTL_SECONDS", "REFRESH_IDLE_TTL_SECONDS", "EMAIL_CODE_TTL_SECONDS",
    "EMAIL_CODE_MAX_ATTEMPTS", "EMAIL_CODE_COOLDOWN_SECONDS", "AUTH_RATE_LIMIT",
    "AUTH_RATE_WINDOW_SECONDS", "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL",
    "SENDGRID_FROM_NAME", "MAIL_USERNAME", "CORS_ORIGINS", "WORKSPACE_RATE_LIMIT",
    "INVITATION_TTL_SECONDS", "INVITATION_COOLDOWN_SECONDS", "INVITATION_ACCEPT_URL",
    "LAMBDAQUALITY_STORAGE_ORACLE_REGION", "LAMBDAQUALITY_STORAGE_ORACLE_NAMESPACE",
    "LAMBDAQUALITY_STORAGE_ORACLE_BUCKET", "LAMBDAQUALITY_STORAGE_PREFIX",
    "LAMBDAQUALITY_STORAGE_ORACLE_TENANCY_OCID", "LAMBDAQUALITY_STORAGE_ORACLE_USER_OCID",
    "LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT",
    "LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PASSPHRASE",
    "ATTACHMENT_MAX_BYTES", "ATTACHMENT_RETENTION_DAYS",
)
DEPLOY_DEFAULTS = {
    "LAMBDAQUALITY_HTTP_PORT": "3000",
    "LAMBDAQUALITY_BIND_ADDRESS": "127.0.0.1",
    "LAMBDAQUALITY_DOCKER_NETWORK": "proxy",
}
REQUIRED = (
    "DATABASE_DIALECT", "SENDGRID_API_KEY", "CORS_ORIGINS",
)


def value(name):
    raw = os.environ.get("LQ_ENV_" + name, "")
    if raw == f"$({name})":
        return ""
    if any(ord(character) < 32 or ord(character) == 127 for character in raw):
        raise ValueError(f"Variável {name} possui caracteres de controle não suportados.")
    return raw


def main():
    raw_root, release = sys.argv[1:]
    if not re.fullmatch(r"[0-9]+-[a-f0-9]{40}", release):
        raise ValueError("Release inválida.")
    data = {name: value(name) for name in API_VARIABLES if value(name)}
    missing = [name for name in REQUIRED if not data.get(name)]
    if not data.get("DATABASE_URL") and not data.get("DB_URL"):
        missing.append("DATABASE_URL ou DB_URL")
    if data.get("DB_URL") and not data.get("DATABASE_URL"):
        missing.extend(name for name in ("DB_USERNAME", "DB_PASSWORD") if not data.get(name))
    if not data.get("OTP_HMAC_SECRET") and not data.get("JWT_SECRET"):
        missing.append("OTP_HMAC_SECRET ou JWT_SECRET")
    if not data.get("SENDGRID_FROM_EMAIL") and not data.get("MAIL_USERNAME"):
        missing.append("SENDGRID_FROM_EMAIL ou MAIL_USERNAME")
    if missing:
        raise ValueError("Configure na Library: " + ", ".join(missing) + ".")
    if data["DATABASE_DIALECT"] not in ("mysql", "mariadb"):
        raise ValueError("DATABASE_DIALECT deve ser mysql ou mariadb.")
    data.update(NODE_ENV="production", HOST="0.0.0.0", PORT="3000", SWAGGER_ENABLED="false",
                JWT_PRIVATE_KEY_PATH="/run/secrets/jwt_private.pem",
                JWT_PUBLIC_KEY_PATH="/run/secrets/jwt_public.pem",
                LAMBDAQUALITY_STORAGE_ORACLE_PRIVATE_KEY_PATH="/run/secrets/oci_api_key.pem")
    deploy = {name: value(name) or default for name, default in DEPLOY_DEFAULTS.items()}
    if not deploy["LAMBDAQUALITY_HTTP_PORT"].isdigit() or not 1 <= int(deploy["LAMBDAQUALITY_HTTP_PORT"]) <= 65535:
        raise ValueError("LAMBDAQUALITY_HTTP_PORT inválida.")
    try:
        address = ipaddress.ip_address(deploy["LAMBDAQUALITY_BIND_ADDRESS"])
    except ValueError:
        raise ValueError("LAMBDAQUALITY_BIND_ADDRESS inválido.") from None
    if address.version != 4:
        raise ValueError("Configure LAMBDAQUALITY_BIND_ADDRESS com IPv4.")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", deploy["LAMBDAQUALITY_DOCKER_NETWORK"]):
        raise ValueError("LAMBDAQUALITY_DOCKER_NETWORK inválida.")
    payload = {
        "api.env": "".join(f"{name}={data[name]}\n" for name in sorted(data)),
        "deploy.env": "".join(f"{name}={deploy[name]}\n" for name in sorted(deploy)),
    }
    parent = Path(raw_root) / "config/releases"
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory = parent / release
    if directory.exists():
        if any((directory / name).read_text() != content for name, content in payload.items()):
            raise ValueError("Library mudou para uma release existente. Execute um novo run para publicar a nova configuração.")
    else:
        temporary = Path(tempfile.mkdtemp(prefix=".preparing-", dir=parent))
        try:
            for name, content in payload.items():
                file = temporary / name
                file.write_text(content)
                file.chmod(0o600)
            temporary.rename(directory)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
    print("Configuração privada da Library preparada; nenhum valor foi exibido.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    except (OSError, KeyError):
        print("Não foi possível preparar a configuração privada da release.", file=sys.stderr)
        raise SystemExit(1)
