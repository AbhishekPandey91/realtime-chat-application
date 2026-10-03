// src/websocket/aiHandler.js
const crypto = require("crypto");
const mongoose = require("mongoose");
const Conversation = require("../models/conversation.models");
const { enqueueSummaryJob, enqueueReplySuggestionJob } = require("../ai/aiQueue");

// Lightweight in-memory rate limiting map: userId -> lastRequestTime (ms)
const lastAiRequestTimes = new Map();
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds minimum between AI requests per user

function sendTo(socket, event, data) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

/**
 * Check if the user is exceeding rate limits for AI calls.
 */
function isRateLimited(userId) {
  const now = Date.now();
  const lastTime = lastAiRequestTimes.get(userId) || 0;
  if (now - lastTime < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  lastAiRequestTimes.set(userId, now);
  return false;
}

/**
 * Handle `ai:summarize` event
 */
async function handleSummarize(ws, payload) {
  const userId = ws.userId;
  const { conversationId } = payload || {};

  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    sendTo(ws, "error", { message: "Invalid or missing conversationId" });
    return;
  }

  if (isRateLimited(userId)) {
    sendTo(ws, "ai:error", {
      message: "Rate limit exceeded. Please wait a moment before requesting AI features again.",
    });
    return;
  }

  // Authorize user access to conversation
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).select("_id");

  if (!conversation) {
    sendTo(ws, "error", { message: "Unauthorized conversation access" });
    return;
  }

  const requestId = crypto.randomUUID();

  // Send processing confirmation quickly
  sendTo(ws, "ai:processing", {
    requestId,
    type: "summary",
    conversationId,
  });

  try {
    await enqueueSummaryJob({
      requestId,
      conversationId,
      userId,
    });
  } catch (error) {
    console.error("[AI Handler] Failed to enqueue summary job:", error);
    sendTo(ws, "ai:error", {
      requestId,
      message: "Failed to queue AI request. Please try again.",
    });
  }
}

/**
 * Handle `ai:suggest_replies` event
 */
async function handleSuggestReplies(ws, payload) {
  const userId = ws.userId;
  const { conversationId } = payload || {};

  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    sendTo(ws, "error", { message: "Invalid or missing conversationId" });
    return;
  }

  if (isRateLimited(userId)) {
    sendTo(ws, "ai:error", {
      message: "Rate limit exceeded. Please wait a moment before requesting AI features again.",
    });
    return;
  }

  // Authorize user access to conversation
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).select("_id");

  if (!conversation) {
    sendTo(ws, "error", { message: "Unauthorized conversation access" });
    return;
  }

  const requestId = crypto.randomUUID();

  // Send processing confirmation quickly
  sendTo(ws, "ai:processing", {
    requestId,
    type: "reply_suggestions",
    conversationId,
  });

  try {
    await enqueueReplySuggestionJob({
      requestId,
      conversationId,
      userId,
    });
  } catch (error) {
    console.error("[AI Handler] Failed to enqueue reply suggestion job:", error);
    sendTo(ws, "ai:error", {
      requestId,
      message: "Failed to queue AI request. Please try again.",
    });
  }
}

module.exports = {
  handleSummarize,
  handleSuggestReplies,
};
