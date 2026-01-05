/**
 * HTTP Response utilities
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  cacheControl?: string
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  };
  
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }
  
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Create a CORS preflight response
 */
export function corsPreflightResponse(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status: number = 500
): Response {
  return jsonResponse({ error: message }, status);
}

