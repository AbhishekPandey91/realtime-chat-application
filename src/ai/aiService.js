// src/ai/aiService.js

/**
 * AI Provider abstraction service.
 * Supports OpenAI-compatible REST endpoints, Google Gemini REST API, or custom provider APIs.
 */

function getConfig() {
  return {
    enabled: process.env.AI_ENABLED === "true" || process.env.AI_ENABLED === true,
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "gemini-1.5-flash",
    baseUrl: process.env.AI_BASE_URL || "",
    provider: (process.env.AI_PROVIDER || "gemini").toLowerCase(),
  };
}

/**
 * Call LLM endpoint with system and user prompts and return response content as text.
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {number} [params.maxTokens=500]
 * @returns {Promise<string>} Raw text output from LLM
 */
async function generate({ systemPrompt, userPrompt, maxTokens = 500 }) {
  const config = getConfig();

  if (!config.enabled) {
    throw new Error("AI service is currently disabled (AI_ENABLED is false)");
  }
  if (!config.apiKey && config.provider !== "mock") {
    throw new Error("AI_API_KEY environment variable is not configured");
  }

  if (config.provider === "mock") {
    return mockResponse(systemPrompt, userPrompt);
  }

  if (config.provider === "gemini" || config.model.toLowerCase().includes("gemini")) {
    return generateGemini({ systemPrompt, userPrompt, maxTokens, config });
  }

  // Fallback / default: OpenAI-compatible API
  return generateOpenAI({ systemPrompt, userPrompt, maxTokens, config });
}

/**
 * Helper to clean markdown fences and extract/parse JSON from raw LLM output strings.
 */
function cleanAndParseJson(rawOutput) {
  if (typeof rawOutput !== "string") return rawOutput;
  let text = rawOutput.trim();

  // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // Attempt extracting first JSON object {} or array [] substring
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw err;
  }
}

/**
 * Generate response using Google Gemini REST API with retries and fallback models
 */
async function generateGemini({ systemPrompt, userPrompt, maxTokens, config }) {
  const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  let primaryModel = config.model || "gemini-1.5-flash";
  if (primaryModel.startsWith("models/")) {
    primaryModel = primaryModel.replace(/^models\//, "");
  }

  // Candidate models to try sequentially (working models first)
  const candidateModels = [
    primaryModel,
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
  ].filter((m, i, self) => self.indexOf(m) === i);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  };

  let lastStatus = null;
  let lastErrorText = "";

  for (const modelName of candidateModels) {
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${config.apiKey}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;

          if (!text) {
            throw new Error("Empty response received from Gemini API");
          }
          return text;
        }

        lastStatus = response.status;
        lastErrorText = await response.text();
        console.warn(`[AI] Gemini model "${modelName}" returned HTTP ${response.status} (attempt ${attempt}/${maxRetries})`);

        // Retriable HTTP statuses: 503 (High Demand / Spikes), 429 (Rate Limit), 500 (Internal Server Error)
        if (response.status === 503 || response.status === 429 || response.status === 500) {
          if (attempt < maxRetries) {
            const delayMs = attempt * 1000;
            console.log(`[AI] Retrying model "${modelName}" in ${delayMs}ms due to HTTP ${response.status}...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
        }

        // Break retry loop to try next fallback candidate model
        break;
      } catch (err) {
        lastErrorText = err.message;
        console.warn(`[AI] Network error calling Gemini model "${modelName}" (attempt ${attempt}/${maxRetries}):`, err.message);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }
  }

  console.error(`[AI] Gemini API error response (all candidate models exhausted): ${lastStatus} ${lastErrorText}`);
  throw new Error(`AI Provider API returned error HTTP ${lastStatus || 503}`);
}

/**
 * Generate response using OpenAI-compatible REST API (OpenAI, Groq, Ollama, etc.)
 */
async function generateOpenAI({ systemPrompt, userPrompt, maxTokens, config }) {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const requestBody = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[AI] OpenAI-compatible API error response:", response.status, errText);
    throw new Error(`AI Provider API returned error HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Empty response received from LLM API");
  }

  return text;
}

/**
 * Fallback mock response for testing without API keys
 */
function mockResponse(systemPrompt, userPrompt) {
  if (systemPrompt.includes("summarizer")) {
    return JSON.stringify({
      summary: "This is a mock summary of the conversation.",
    });
  }
  return JSON.stringify({
    suggestions: [
      "Sure, I will take care of it.",
      "Thanks for letting me know!",
      "I will get back to you shortly.",
    ],
  });
}

module.exports = {
  generate,
  cleanAndParseJson,
};
