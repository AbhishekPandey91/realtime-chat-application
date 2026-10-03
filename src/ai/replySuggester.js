// src/ai/replySuggester.js
const { buildReplySuggestionPrompt } = require("./aiPrompts");
const aiService = require("./aiService");

/**
 * Generates reply suggestions for a user based on recent conversation context.
 * @param {Array<{ sender: string, text: string }>} messages Chronological list of recent messages
 * @param {string} [userIdentifier="the user"] Name/ID of user receiving suggestions
 * @returns {Promise<{ suggestions: string[] }>}
 */
async function suggestReplies(messages, userIdentifier = "the user") {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      suggestions: [
        "Hello!",
        "How are you?",
        "Could you provide more details?",
      ],
    };
  }

  const { systemPrompt, userPrompt } = buildReplySuggestionPrompt(messages, userIdentifier);

  const rawOutput = await aiService.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 250,
  });

  let parsed;
  try {
    parsed = aiService.cleanAndParseJson(rawOutput);
  } catch (err) {
    console.error("[AI] Failed to parse reply suggestions JSON:", rawOutput);
    if (typeof rawOutput === "string" && rawOutput.trim()) {
      return { suggestions: [rawOutput.trim()] };
    }
    throw new Error("Malformed AI reply suggestions output");
  }

  if (Array.isArray(parsed)) {
    parsed = { suggestions: parsed };
  }

  if (!parsed || !Array.isArray(parsed.suggestions)) {
    if (typeof parsed === "string" && parsed.trim()) {
      return { suggestions: [parsed.trim()] };
    }
    throw new Error("Invalid AI reply suggestions format");
  }

  // Sanitize and limit to 3 suggestions
  const sanitized = parsed.suggestions
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 3);

  if (sanitized.length === 0) {
    throw new Error("No valid suggestions produced by AI");
  }

  return { suggestions: sanitized };
}

module.exports = {
  suggestReplies,
};
