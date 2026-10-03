// websocket/conversationService.js
const Conversation = require("../models/conversation.models");

async function findOrCreateConversation(userIdA, userIdB) {
  // Atomic upsert: two simultaneous first-messages between the same pair
  // can no longer create two separate conversation documents.
  const conversation = await Conversation.findOneAndUpdate(
    { participants: { $all: [userIdA, userIdB], $size: 2 } },
    {
      $setOnInsert: {
        participants: [userIdA, userIdB],
        last_message_at: new Date(),
        last_seq: 0,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return conversation;
}

// Atomically claims the next sequence number for a conversation.
// Two concurrent sends can never get the same seq.
async function nextSeq(conversationId) {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId },
    { $inc: { last_seq: 1 } },
    { returnDocument: "after" },
  );
  return conversation.last_seq;
}

module.exports = { findOrCreateConversation, nextSeq };
