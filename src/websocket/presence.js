// websocket/presence.js
const Conversation = require("../models/conversation.models");
const { emitToUser } = require("./pubsub");

async function broadcastPresence(userId, isOnline, lastSeen = null) {
  const uid = String(userId);

  const conversations = await Conversation.find({ participants: uid }).select(
    "participants",
  );

  const partnerIds = new Set();
  conversations.forEach((c) => {
    c.participants.forEach((p) => {
      const id = p.toString();
      if (id !== uid) partnerIds.add(id);
    });
  });

  await Promise.all(
    [...partnerIds].map((id) =>
      emitToUser(id, "presence:update", {
        userId: uid,
        is_online: isOnline,
        last_seen: lastSeen,
      }),
    ),
  );
}

module.exports = { broadcastPresence };
