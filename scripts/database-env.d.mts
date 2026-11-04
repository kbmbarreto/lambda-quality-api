export function databaseSettings(
  environment?: Record<string, string | undefined>,
): {
  url: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  allowPublicKeyRetrieval: boolean;
  ssl?: { rejectUnauthorized: boolean; ca?: string };
};

export function databaseDialect(
  environment?: Record<string, string | undefined>,
): 'mysql' | 'mariadb';
export function migrationDirectory(
  environment?: Record<string, string | undefined>,
): string;
