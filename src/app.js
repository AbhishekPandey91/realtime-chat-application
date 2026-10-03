// src/app.js 
require("dotenv").config();
const dns = require("dns");
const dnsServers = ["1.1.1.1"];
if (dnsServers?.length) {
  dns.setServers(dnsServers);
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const conversationRoutes = require("./routes/conversation.routes");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

const path = require("path");
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);

module.exports = app;
