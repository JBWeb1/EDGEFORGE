import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const COACH_MODEL = "claude-opus-5-5";

/** True when the server has credentials for the Claude API. */
export function coachConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const COACH_DAILY_LIMIT = Math.max(1, Number(process.env.COACH_DAILY_LIMIT) || 30);

let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic();
  return client;
}
