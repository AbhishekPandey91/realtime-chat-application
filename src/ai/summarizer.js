// src/ai/summarizer.js
const { buildSummaryPrompt } = require("./aiPrompts");
const aiService = require("./aiService");

/**
 * Summarizes a given array of conversation messages.
 * @param {Array<{ sender: string, text: string }>} messages Chronological list of messages
 * @returns {Promise<{ summary: string }>}
 */
async function summarizeConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { summary: "No messages in conversation to summarize." };
  }

  const { systemPrompt, userPrompt } = buildSummaryPrompt(messages);

  const rawOutput = await aiService.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 300,
  });

  let parsed;
  try {
    parsed = aiService.cleanAndParseJson(rawOutput);
  } catch (err) {
    console.error("[AI] Failed to parse summary JSON:", rawOutput);
    // If output is plain text rather than JSON, wrap it safely
    if (typeof rawOutput === "string" && rawOutput.trim()) {
      return { summary: rawOutput.trim() };
    }
    throw new Error("Malformed AI summary output");
  }

  if (!parsed || typeof parsed.summary !== "string") {
    if (typeof parsed === "string" && parsed.trim()) {
      return { summary: parsed.trim() };
    }
    throw new Error("Invalid AI summary output format");
  }

  return { summary: parsed.summary.trim() };
}

module.exports = {
  summarizeConversation,
};
