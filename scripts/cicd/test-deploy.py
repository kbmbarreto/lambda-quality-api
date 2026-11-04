"""Testa o ciclo de publicação sem conectar a Docker, OCI ou banco reais."""
import fcntl
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FIRST = "101-" + "a" * 40
SECOND = "102-" + "b" * 40
THIRD = "103-" + "c" * 40
IMAGE_ID = "sha256:" + "d" * 64

DOCKER = '''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
with open(os.environ["FAKE_DOCKER_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
if args[:2] == ["image", "inspect"]:
    print("sha256:" + ("e" if os.environ.get("FAKE_IMAGE_MISMATCH") else "d") * 64)
elif args[:2] == ["image", "load"]:
    sys.stdin.buffer.read()
elif args[0] == "compose" and "config" in args:
    print(json.dumps({"networks": {"backend": {"name": "proxy"}}}))
elif args[0] == "compose":
    if "run" in args and "migrations" in args and os.environ.get("FAKE_MIGRATION_FAILURE"):
        sys.exit(1)
    if "run" in args and "api" in args and os.environ.get("FAKE_PREFLIGHT_FAILURE"):
        sys.exit(1)
    if "up" in args and os.environ.get("FAKE_HEALTH_FAILURE"):
        sys.exit(1)
'''


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="lambdaquality_cicd_")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "hml"
        (self.root / "config").mkdir(parents=True)
        (self.root / "config/api.env").write_text("PRIVATE_TEST_VALUE=never-print-this-value\n")
        (self.root / "secrets").mkdir()
        for key in ("jwt_private.pem", "jwt_public.pem", "oci_api_key.pem"):
            (self.root / "secrets" / key).write_text("test fixture, not a real key\n")
        self.bin = self.base / "bin"
        self.bin.mkdir()
        docker = self.bin / "docker"
        docker.write_text(DOCKER)
        docker.chmod(0o700)
        # macOS não inclui util-linux; usa o mesmo flock do kernel no fd da shell.
        if not shutil.which("flock"):
            flock = self.bin / "flock"
            flock.write_text("#!/usr/bin/env python3\nimport fcntl,sys\n"
                             "try: fcntl.flock(int(sys.argv[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)\n"
                             "except BlockingIOError: sys.exit(1)\n")
            flock.chmod(0o700)
        self.log = self.base / "docker.log"
        self.env = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}",
                        FAKE_DOCKER_LOG=str(self.log))
        for name in tuple(self.env):
            if name.startswith("FAKE_") and name != "FAKE_DOCKER_LOG":
                del self.env[name]

    def bundle(self, release):
        directory = self.base / release
        (directory / "scripts/cicd").mkdir(parents=True)
        for name in ("release.py", "prepare-config.py", "deploy-common.sh", "deploy-hml.sh", "rollback-hml.sh"):
            shutil.copyfile(HERE / name, directory / "scripts/cicd" / name)
        shutil.copyfile(REPO / "docker-compose.hml.yml", directory / "docker-compose.hml.yml")
        with gzip.open(directory / "images.tar.gz", "wb") as stream:
            stream.write(b"fake image archive")
        subprocess.run([sys.executable, str(HERE / "release.py"), "create", str(directory),
                        release, IMAGE_ID, IMAGE_ID], check=True, capture_output=True)
        return directory

    def invoke(self, script, *args, failure=None, success=True):
        env = dict(self.env)
        if failure:
            env[failure] = "1"
        result = subprocess.run(["bash", str(HERE / script), str(self.root), *map(str, args)],
                                env=env, text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        self.assertNotIn("never-print-this-value", result.stdout + result.stderr)
        return result

    def deploy(self, release, **kwargs):
        return self.invoke("deploy-hml.sh", self.bundle(release), release, **kwargs)

    def state(self, name):
        return (self.root / "state" / name).read_text().strip()

    def commands(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_migration_before_api_and_successful_rollback(self):
        self.deploy(FIRST)
        self.deploy(SECOND)
        calls = self.commands()
        migration = next(i for i, args in enumerate(calls) if "run" in args and "migrations" in args)
        publication = next(i for i, args in enumerate(calls) if "up" in args)
        self.assertLess(migration, publication)
        self.assertEqual(self.state("current"), SECOND)
        self.invoke("rollback-hml.sh", SECOND)
        self.assertEqual(self.state("current"), FIRST)
        self.assertEqual(self.state("active"), FIRST)

    def test_failed_migration_preserves_current_api(self):
        self.deploy(FIRST)
        self.log.write_text("")
        self.deploy(SECOND, failure="FAKE_MIGRATION_FAILURE", success=False)
        self.assertEqual(self.state("current"), FIRST)
        self.assertEqual(self.state("active"), FIRST)
        self.assertFalse(any("up" in args for args in self.commands()))
        self.invoke("rollback-hml.sh", SECOND)

    def test_failed_health_requires_recovery_before_another_deploy(self):
        self.deploy(FIRST)
        self.deploy(SECOND, failure="FAKE_HEALTH_FAILURE", success=False)
        self.assertEqual(self.state("current"), FIRST)
        self.assertEqual(self.state("active"), SECOND)
        self.deploy(THIRD, success=False)
        self.invoke("rollback-hml.sh", SECOND)
        self.assertEqual(self.state("active"), FIRST)

    def test_failed_preflight_runs_no_migrations(self):
        self.deploy(FIRST, failure="FAKE_PREFLIGHT_FAILURE", success=False)
        self.assertFalse(any("migrations" in args and "run" in args for args in self.commands()))

    def test_stale_rollback_cannot_replace_newer_release(self):
        self.deploy(FIRST)
        self.deploy(SECOND)
        self.deploy(THIRD)
        self.invoke("rollback-hml.sh", SECOND, success=False)
        self.assertEqual(self.state("current"), THIRD)

    def test_first_deploy_has_no_predecessor(self):
        self.deploy(FIRST)
        self.invoke("rollback-hml.sh", FIRST, success=False)

    def test_corrupted_artifact_is_rejected_before_image_load(self):
        bundle = self.bundle(FIRST)
        (bundle / "docker-compose.hml.yml").write_text("tampered")
        self.invoke("deploy-hml.sh", bundle, FIRST, success=False)
        self.assertFalse(any(args[:2] == ["image", "load"] for args in self.commands()))

    def test_changed_image_id_is_rejected(self):
        self.deploy(FIRST, failure="FAKE_IMAGE_MISMATCH", success=False)
        self.assertFalse(any("run" in args for args in self.commands()))

    def test_retry_healthy_release_does_not_repeat_migration(self):
        self.deploy(FIRST)
        self.log.write_text("")
        self.invoke("deploy-hml.sh", self.base / FIRST, FIRST)
        self.assertFalse(any("run" in args or "up" in args for args in self.commands()))

    def test_concurrent_deploy_is_rejected(self):
        (self.root / "state").mkdir()
        with (self.root / "state/deploy.lock").open("w") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.deploy(FIRST, success=False)

    def library(self):
        self.env["LAMBDAQUALITY_CONFIG_SOURCE"] = "library"
        values = {
            "TEST_VAULT_ACTIVE_KEY_ID": "v1", "TEST_VAULT_ENCRYPTION_KEYS": '{"v1":"' + "a" * 43 + '="}',
            "DATABASE_DIALECT": "mariadb", "DB_URL": "jdbc:mysql://database:3306/test",
            "DB_USERNAME": "test", "DB_PASSWORD": "never-print-this-value$#'\\\"=",
            "OTP_HMAC_SECRET": "t" * 32, "SENDGRID_API_KEY": "fake-mail-key",
            "SENDGRID_FROM_EMAIL": "test@example.com", "CORS_ORIGINS": "https://hml.example.com",
            "LAMBDAQUALITY_STORAGE_ORACLE_REGION": "sa-saopaulo-1",
            "LAMBDAQUALITY_STORAGE_ORACLE_NAMESPACE": "fake-namespace",
            "LAMBDAQUALITY_STORAGE_ORACLE_BUCKET": "fake-bucket",
            "LAMBDAQUALITY_STORAGE_PREFIX": "fake/attachments",
            "LAMBDAQUALITY_STORAGE_ORACLE_TENANCY_OCID": "fake-tenancy",
            "LAMBDAQUALITY_STORAGE_ORACLE_USER_OCID": "fake-user",
            "LAMBDAQUALITY_STORAGE_ORACLE_FINGERPRINT": "fake-fingerprint",
            "INVITATION_ENCRYPTION_SECRET": "$(INVITATION_ENCRYPTION_SECRET)",
        }
        self.env.update({"LQ_ENV_" + name: value for name, value in values.items()})

    def test_library_preserves_literal_secrets_and_private_permissions(self):
        self.library()
        (self.root / "config/api.env").unlink()
        self.deploy(FIRST)
        config = self.root / "config/releases" / FIRST / "api.env"
        self.assertIn("DB_PASSWORD=" + self.env["LQ_ENV_DB_PASSWORD"] + "\n", config.read_text())
        self.assertNotIn("INVITATION_ENCRYPTION_SECRET", config.read_text())
        self.assertIn("TEST_VAULT_ENCRYPTION_KEYS=" + self.env["LQ_ENV_TEST_VAULT_ENCRYPTION_KEYS"] + "\n", config.read_text())
        self.assertEqual(config.stat().st_mode & 0o777, 0o600)

    def test_library_change_requires_new_run_and_rollback_uses_previous_config(self):
        self.library()
        self.deploy(FIRST)
        self.env["LQ_ENV_DB_PASSWORD"] = "new-secret"
        self.invoke("deploy-hml.sh", self.base / FIRST, FIRST, success=False)
        self.deploy(SECOND)
        self.invoke("rollback-hml.sh", SECOND)
        self.assertEqual(self.state("current"), FIRST)
        self.assertIn("never-print-this-value", (self.root / "config/releases" / FIRST / "api.env").read_text())
        calls = [args for args in self.commands() if "up" in args]
        self.assertIn(str(self.root / "config/releases" / FIRST / "deploy.env"), calls[-1])

    def test_library_missing_variable_or_line_injection_blocks_migration(self):
        self.library()
        self.env["LQ_ENV_SENDGRID_API_KEY"] = "$(SENDGRID_API_KEY)"
        self.deploy(FIRST, success=False)
        self.assertFalse(any("run" in args for args in self.commands()))
        self.env["LQ_ENV_SENDGRID_API_KEY"] = "fake-mail-key"
        self.env["LQ_ENV_DB_PASSWORD"] = "password\nINJECTED=true"
        self.invoke("deploy-hml.sh", self.base / FIRST, FIRST, success=False)
        self.assertFalse(any("run" in args for args in self.commands()))

    def test_missing_oci_settings_and_pem_do_not_block_core_deployment(self):
        self.library()
        (self.root / "secrets/oci_api_key.pem").unlink()
        for name in tuple(self.env):
            if name.startswith("LQ_ENV_LAMBDAQUALITY_STORAGE_"):
                del self.env[name]
        self.deploy(FIRST)
        self.assertEqual(self.state("current"), FIRST)


if __name__ == "__main__":
    unittest.main(verbosity=2)
