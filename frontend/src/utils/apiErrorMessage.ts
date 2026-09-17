/** Keep useful validation details and translate transport errors for the user. */
export function apiErrorMessage(error: { response?: { status?: number; data?: unknown }; code?: string; message?: string }): string {
  const data = error.response?.data;
  const candidate = data && typeof data === 'object'
    ? (data as Record<string, unknown>).message || (data as Record<string, unknown>).error : undefined;
  if (typeof candidate === 'string' && candidate.trim() && !/^(\d{3}|(?:error\s*)?\d{3}(?:\s.*)?|request failed with status code\s*\d+|internal server error|not found)$/i.test(candidate.trim())) return candidate.trim();
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'The request took too long. Please try again.';
  switch (error.response?.status) {
    case 400: case 422: return 'Some details are invalid. Please check the fields and try again.';
    case 401: return 'Your session has expired or your login details are incorrect. Please sign in again.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested record or page could not be found. Refresh and try again.';
    case 409: return 'This record has changed or already exists. Refresh and check the details.';
    case 413: return 'The uploaded file is too large. Please upload a smaller file.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 502: case 503: case 504: return 'The service is temporarily unavailable. Please try again shortly.';
  }
  if (error.response?.status && error.response.status >= 500) return 'We could not complete your request. Please try again. If it continues, contact the administrator.';
  if (!error.response) return 'Unable to connect to the server. Check your connection and try again.';
  return 'We could not complete this action. Please try again.';
}
