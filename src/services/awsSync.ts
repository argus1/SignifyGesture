/**
 * Stub for saving a conversation session to AWS (API Gateway + Cognito).
 * Replace the body with a real fetch to the API Gateway endpoint once the backend exists.
 */
export async function syncSessionToAWS(sessionData: unknown): Promise<{ ok: true; id: string }> {
  console.debug("[awsSync stub] would POST session to AWS", sessionData);
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true, id: `local-${Date.now()}` };
}
