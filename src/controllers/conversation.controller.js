// controllers/conversation.controller.js
const mongoose = require("mongoose");
const Conversation = require("../models/conversation.models");
const Message = require("../models/message.models");

const listConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ last_message_at: -1 })
      .populate("participants", "username is_online last_seen");

    const data = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.participants.find(
          (p) => p._id.toString() !== userId,
        );

        const lastMessage = await Message.findOne({ conversation_id: conv._id })
          .sort({ createdAt: -1 })
          .select("text sender_id status createdAt");

        const unreadCount = await Message.countDocuments({
          conversation_id: conv._id,
          sender_id: { $ne: userId },
          status: { $ne: "read" },
        });

        return {
          _id: conv._id,
          user: otherUser,
          lastMessage,
          unreadCount,
          last_message_at: conv.last_message_at,
        };
      }),
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("listConversations error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { before } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const filter = { conversation_id: id };

    if (before) {
      if (!mongoose.isValidObjectId(before)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid before cursor" });
      }
      filter._id = { $lt: before };
    }

    const messages = await Message.find(filter).sort({ _id: -1 }).limit(limit);

    messages.reverse();

    return res.status(200).json({
      success: true,
      data: messages,
      nextCursor: messages.length === limit ? messages[0]._id : null,
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { listConversations, getMessages };