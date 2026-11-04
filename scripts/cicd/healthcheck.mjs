try {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || '3000'}/api/v1/health/ready`,
    { signal: AbortSignal.timeout(5000) },
  );
  const body = await response.json();
  if (!response.ok || body?.data?.status !== 'up') process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
