// src/config/db.js
const mongoose = require("mongoose");
const dns = require("dns");

try {
  dns.setServers(["1.1.1.1"]);
} catch (e) {
  // fallback if environment restricts dns customization
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected");
  } catch (error) {
    console.error("Database Connection Failed ", error);
    process.exit(1);
  }
}

module.exports = connectDB;
