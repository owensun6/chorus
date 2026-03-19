// Author: be-domain-modeler

const successResponse = (data: unknown) => ({
  success: true as const,
  data,
  metadata: { timestamp: new Date().toISOString() },
});

const errorResponse = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
  metadata: { timestamp: new Date().toISOString() },
});

const formatZodErrors = (issues: readonly { path: readonly PropertyKey[]; message: string }[]): string =>
  issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");

export { successResponse, errorResponse, formatZodErrors };
