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

export { successResponse, errorResponse };
