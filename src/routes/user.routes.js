// routes/user.routes.js
const express = require("express");
const { searchUsers } = require("../controllers/user.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/search", authenticate, searchUsers);

module.exports = router;
