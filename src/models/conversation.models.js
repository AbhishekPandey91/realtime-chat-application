// models/conversation.models.js
const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      required: true,
    },
    last_message_at: {
      type: Date,
      default: Date.now,
    },
    last_seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
