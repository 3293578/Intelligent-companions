export function safeRequestFailure(error) {
  if (Number(error?.status) === 413) return { status: 413, body: { error: 'request_too_large' } };
  if (error instanceof URIError || error instanceof SyntaxError || Number(error?.status) === 400) {
    return { status: 400, body: { error: 'invalid_request' } };
  }
  return { status: 500, body: { error: 'internal_error', retryable: true } };
}
