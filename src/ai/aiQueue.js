// src/ai/aiQueue.js
const { Queue } = require("bullmq");
const { URL } = require("url");

const QUEUE_NAME = "ai-processing-queue";
const REDIS_URL = process.env.REDIS_URL;

function parseRedisUrl(redisUrl) {
  if (!redisUrl) return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (err) {
    console.error("[AI Queue] Invalid REDIS_URL format, using localhost default");
    return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
  }
}

let aiQueue = null;

try {
  const connection = parseRedisUrl(REDIS_URL);
  aiQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  aiQueue.on("error", (err) => {
    console.error("[AI Queue] Redis Queue Error:", err.message);
  });
} catch (err) {
  console.error("[AI Queue] Failed to initialize queue:", err.message);
}

/**
 * Enqueue a conversation summarization job.
 */
async function enqueueSummaryJob({ requestId, conversationId, userId }) {
  if (!aiQueue) {
    throw new Error("AI Queue is unavailable");
  }

  const job = await aiQueue.add(
    "conversation_summary",
    {
      type: "summary",
      requestId,
      conversationId: String(conversationId),
      userId: String(userId),
    },
    { jobId: `summary_${requestId}` }
  );

  console.log(`[AI] Summary job queued (requestId: ${requestId}, jobId: ${job.id})`);
  return job;
}

/**
 * Enqueue a reply suggestion job.
 */
async function enqueueReplySuggestionJob({ requestId, conversationId, userId }) {
  if (!aiQueue) {
    throw new Error("AI Queue is unavailable");
  }

  const job = await aiQueue.add(
    "reply_suggestion",
    {
      type: "reply_suggestions",
      requestId,
      conversationId: String(conversationId),
      userId: String(userId),
    },
    { jobId: `suggest_${requestId}` }
  );

  console.log(`[AI] Reply suggestion job queued (requestId: ${requestId}, jobId: ${job.id})`);
  return job;
}

module.exports = {
  enqueueSummaryJob,
  enqueueReplySuggestionJob,
  parseRedisUrl,
  QUEUE_NAME,
};
