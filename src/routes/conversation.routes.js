// routes/conversation.routes.js
const express = require("express");
const {
  listConversations,
  getMessages,
} = require("../controllers/conversation.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authenticate, listConversations);
router.get("/:id/messages", authenticate, getMessages);

module.exports = router;
