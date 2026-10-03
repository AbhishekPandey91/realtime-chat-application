// models/message.models.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    client_message_id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    delivered_at: {
      type: Date,
      default: null,
    },
    read_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ conversation_id: 1, seq: 1 }, { unique: true });
messageSchema.index({ sender_id: 1, client_message_id: 1 }, { unique: true });

module.exports = mongoose.model("Message", messageSchema);
