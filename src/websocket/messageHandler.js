// websocket/messageHandler.js
const Message = require("../models/message.models");
const Conversation = require("../models/conversation.models");
const { findOrCreateConversation, nextSeq } = require("./conversationService");
const { emitToUser } = require("./pubsub");
const { handleSummarize, handleSuggestReplies } = require("./aiHandler");

function sendTo(socket, event, data) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

async function handleMessageSend(ws, payload) {
  const { recipientId, text, clientMessageId } = payload || {};
  const senderId = ws.userId;

  if (!recipientId || !text || !text.trim() || !clientMessageId) {
    sendTo(ws, "error", {
      message: "recipientId, text and clientMessageId are required",
    });
    return;
  }

  const conversation = await findOrCreateConversation(senderId, recipientId);

  let message;
  let isNew = true;

  try {
    const seq = await nextSeq(conversation._id);
    message = await Message.create({
      conversation_id: conversation._id,
      sender_id: senderId,
      client_message_id: clientMessageId,
      seq,
      text,
      status: "sent",
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate send (retry) — reuse the message already created the first time.
      // Note: this burns one seq number on the conversation, which is fine —
      // seq only needs to be strictly increasing, not gap-free.
      isNew = false;
      message = await Message.findOne({
        sender_id: senderId,
        client_message_id: clientMessageId,
      });
      if (!message) throw error;
    } else {
      throw error;
    }
  }

  if (isNew) {
    conversation.last_message_at = new Date();
    await conversation.save();
  }

  sendTo(ws, "message:sent", message);

  if (message.status !== "sent") return;

  const deliveredAt = new Date();
  const forRecipient = {
    ...message.toObject(),
    status: "delivered",
    delivered_at: deliveredAt,
  };

  const receivers = await emitToUser(recipientId, "message:new", forRecipient);

  if (receivers > 0) {
    await Message.updateOne(
      { _id: message._id, status: "sent" },
      { $set: { status: "delivered", delivered_at: deliveredAt } },
    );
    sendTo(ws, "message:delivered", { messageId: message._id });
  }
}

async function handleMessageRead(ws, payload) {
  const { messageIds } = payload || {};
  const readerId = ws.userId;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    sendTo(ws, "error", {
      message: "messageIds (non-empty array) is required",
    });
    return;
  }

  const messages = await Message.find({
    _id: { $in: messageIds },
    sender_id: { $ne: readerId },
    status: { $ne: "read" },
  });

  if (messages.length === 0) return;

  const conversationIds = [
    ...new Set(messages.map((m) => m.conversation_id.toString())),
  ];
  const allowedConversations = await Conversation.find({
    _id: { $in: conversationIds },
    participants: readerId,
  }).select("_id");

  const allowedSet = new Set(allowedConversations.map((c) => c._id.toString()));
  const validMessages = messages.filter((m) =>
    allowedSet.has(m.conversation_id.toString()),
  );

  if (validMessages.length === 0) return;

  const validIds = validMessages.map((m) => m._id);
  const readAt = new Date();

  await Message.updateMany(
    { _id: { $in: validIds } },
    { $set: { status: "read", read_at: readAt } },
  );

  const bySender = {};
  for (const m of validMessages) {
    const sid = m.sender_id.toString();
    if (!bySender[sid]) bySender[sid] = [];
    bySender[sid].push(m._id);
  }

  for (const [senderId, ids] of Object.entries(bySender)) {
    await emitToUser(senderId, "message:read", {
      messageIds: ids,
      readBy: readerId,
      read_at: readAt,
    });
  }
}

async function routeIncomingMessage(ws, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    sendTo(ws, "error", { message: "Invalid JSON payload" });
    return;
  }

  const { event, payload } = parsed;

  try {
    switch (event) {
      case "message:send":
        await handleMessageSend(ws, payload);
        break;
      case "message:read":
        await handleMessageRead(ws, payload);
        break;
      case "ai:summarize":
        await handleSummarize(ws, payload);
        break;
      case "ai:suggest_replies":
        await handleSuggestReplies(ws, payload);
        break;
      default:
        sendTo(ws, "error", { message: `Unknown event: ${event}` });
    }
  } catch (error) {
    console.error(`Error handling ${event}:`, error);
    sendTo(ws, "error", { message: "Server error" });
  }
}

module.exports = { routeIncomingMessage };
