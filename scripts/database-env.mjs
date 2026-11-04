import { readFileSync } from 'node:fs';

export function databaseSettings(environment = process.env) {
  const raw = environment.DATABASE_URL || environment.DB_URL;
  if (!raw) throw new Error('Configure DATABASE_URL ou DB_URL.');
  let url;
  try {
    url = new URL(raw.replace(/^jdbc:/, ''));
  } catch {
    throw new Error('Formato de conexão MySQL inválido.');
  }
  if (url.protocol !== 'mysql:' || !url.hostname || url.pathname.length < 2) {
    throw new Error('A conexão deve informar um banco MySQL.');
  }
  const user = environment.DB_USERNAME || decodeURIComponent(url.username);
  const password = environment.DB_PASSWORD || decodeURIComponent(url.password);
  if (!user || !password) throw new Error('Configure as credenciais MySQL.');
  url.username = user;
  url.password = password;
  const ssl = url.searchParams.get('useSSL') === 'true' || url.searchParams.has('sslcert');
  const caPath = environment.DB_SSL_CA_PATH || url.searchParams.get('sslcert');
  const allowPublicKeyRetrieval = url.searchParams.get('allowPublicKeyRetrieval') === 'true' ||
    (environment.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  // Parâmetros JDBC não são parâmetros Prisma. Preservar opções Prisma conhecidas.
  for (const key of ['useSSL', 'serverTimezone', 'createDatabaseIfNotExist', 'allowPublicKeyRetrieval', 'characterEncoding', 'useUnicode', 'verifyServerCertificate']) {
    url.searchParams.delete(key);
  }
  if (ssl && !url.searchParams.has('sslaccept')) url.searchParams.set('sslaccept', 'strict');
  if (caPath) url.searchParams.set('sslcert', caPath);
  return {
    url: url.toString(),
    host: url.hostname,
    port: Number(url.port || 3306),
    user,
    password,
    database: decodeURIComponent(url.pathname.slice(1)),
    allowPublicKeyRetrieval,
    ssl: ssl || caPath ? { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}) } : undefined,
  };
}

export function databaseDialect(environment = process.env) {
  const dialect = environment.DATABASE_DIALECT || "mysql";
  if (!["mysql", "mariadb"].includes(dialect))
    throw new Error("DATABASE_DIALECT deve ser mysql ou mariadb.");
  return dialect;
}
export function migrationDirectory(environment = process.env) {
  return databaseDialect(environment) === "mariadb"
    ? "prisma/migrations-mariadb"
    : "prisma/migrations";
}
