// src/workers/aiWorker.js
require("dotenv").config();
const { Worker } = require("bullmq");
const connectDB = require("../config/db");
const Conversation = require("../models/conversation.models");
const Message = require("../models/message.models");
const User = require("../models/users.models");
const { summarizeConversation } = require("../ai/summarizer");
const { suggestReplies } = require("../ai/replySuggester");
const { parseRedisUrl, QUEUE_NAME } = require("../ai/aiQueue");
const { emitToUser } = require("../websocket/pubsub");

const MAX_CONTEXT_MESSAGES = parseInt(process.env.AI_MAX_CONTEXT_MESSAGES, 10) || 50;

async function processJob(job) {
  const { type, requestId, conversationId, userId } = job.data || {};

  console.log(`[AI] ${type} job started (requestId: ${requestId}, job: ${job.id})`);

  // Verify conversation & user membership
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).populate("participants", "username");

  if (!conversation) {
    console.error(`[AI] Job failed: Unauthorized or non-existent conversation ${conversationId} for user ${userId}`);
    await emitToUser(userId, "ai:error", {
      requestId,
      message: "Unauthorized or invalid conversation access",
    });
    return;
  }

  // Find requesting user details
  const requestingUser = conversation.participants.find(
    (p) => p._id.toString() === String(userId)
  );
  const requestingUserName = requestingUser ? requestingUser.username : "User";

  // Fetch recent messages ordered chronologically (by seq asc, or createdAt asc)
  const rawMessages = await Message.find({ conversation_id: conversationId })
    .sort({ seq: 1, createdAt: 1 })
    .limit(MAX_CONTEXT_MESSAGES)
    .populate("sender_id", "username");

  if (!rawMessages || rawMessages.length === 0) {
    await emitToUser(userId, "ai:error", {
      requestId,
      message: "No messages found in conversation",
    });
    return;
  }

  // Build message history preserving strict chronological ordering
  const formattedMessages = rawMessages.map((m) => {
    const senderName = m.sender_id?.username || "Unknown";
    return {
      sender: senderName,
      text: m.text,
    };
  });

  if (type === "summary") {
    const { summary } = await summarizeConversation(formattedMessages);
    console.log(`[AI] Summary job completed (requestId: ${requestId})`);
    await emitToUser(userId, "ai:summary", {
      requestId,
      conversationId,
      summary,
    });
  } else if (type === "reply_suggestions") {
    const { suggestions } = await suggestReplies(formattedMessages, requestingUserName);
    console.log(`[AI] Reply suggestion job completed (requestId: ${requestId})`);
    await emitToUser(userId, "ai:reply_suggestions", {
      requestId,
      conversationId,
      suggestions,
    });
  } else {
    throw new Error(`Unknown job type: ${type}`);
  }
}

async function startWorker() {
  await connectDB();

  const connection = parseRedisUrl(process.env.REDIS_URL);
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[AI] Job ${job.id} completed successfully`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[AI] Job ${job?.id} failed with error:`, err.message);
    if (job && job.data) {
      const { userId, requestId } = job.data;
      if (userId && requestId) {
        await emitToUser(userId, "ai:error", {
          requestId,
          message: "AI request failed. Please try again.",
        }).catch((e) => console.error("Failed to send error receipt:", e));
      }
    }
  });

  worker.on("error", (err) => {
    console.error("[AI Worker] Error:", err.message);
  });

  console.log(`[AI Worker] Worker started, listening to queue "${QUEUE_NAME}"...`);
}

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker, processJob };
