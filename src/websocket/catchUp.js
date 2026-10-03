// websocket/catchUp.js
const Message = require("../models/message.models");
const Conversation = require("../models/conversation.models");
const { emitToUser } = require("./pubsub");

function sendTo(socket, event, data) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

async function deliverPendingMessages(ws) {
  const userId = ws.userId;

  const conversations = await Conversation.find({
    participants: userId,
  }).select("_id");
  const conversationIds = conversations.map((c) => c._id);
  if (conversationIds.length === 0) return;

  const pending = await Message.find({
    conversation_id: { $in: conversationIds },
    sender_id: { $ne: userId },
    status: "sent",
  }).sort({ createdAt: 1 });

  if (pending.length === 0) return;

  const deliveredAt = new Date();

  await Message.updateMany(
    { _id: { $in: pending.map((m) => m._id) }, status: "sent" },
    { $set: { status: "delivered", delivered_at: deliveredAt } },
  );

  for (const message of pending) {
    message.status = "delivered";
    message.delivered_at = deliveredAt;

    sendTo(ws, "message:new", message);
    await emitToUser(message.sender_id.toString(), "message:delivered", {
      messageId: message._id,
    });
  }
}

module.exports = { deliverPendingMessages };
