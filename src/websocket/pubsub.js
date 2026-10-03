// websocket/pubsub.js
const Redis = require("ioredis");
const { getUserSocket } = require("./connectionManager");

const REDIS_URL = process.env.REDIS_URL;
let pub = null;
let sub = null;

const channel = (userId) => `user:${String(userId)}`;

// Deliver to a socket connected to THIS instance
function sendLocal(userId, event, data) {
  const socket = getUserSocket(String(userId));
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
    return true;
  }
  return false;
}

if (REDIS_URL) {
  pub = new Redis(REDIS_URL);
  sub = new Redis(REDIS_URL);

  pub.on("error", (err) => console.error("Redis pub error:", err.message));
  sub.on("error", (err) => console.error("Redis sub error:", err.message));

  sub.on("message", (ch, raw) => {
    const userId = ch.slice("user:".length);
    try {
      const { event, data } = JSON.parse(raw);
      sendLocal(userId, event, data);
    } catch (error) {
      console.error("Bad pubsub payload:", error);
    }
  });

  console.log("Redis pub/sub enabled");
} else {
  console.log("REDIS_URL not set, running in single-instance mode");
}

function subscribeUser(userId) {
  if (sub) sub.subscribe(channel(userId)).catch((e) => console.error(e));
}

function unsubscribeUser(userId) {
  if (sub) sub.unsubscribe(channel(userId)).catch((e) => console.error(e));
}

// Returns how many sockets received it (0 = user not online anywhere)
async function emitToUser(userId, event, data) {
  if (!pub) return sendLocal(userId, event, data) ? 1 : 0;
  return pub.publish(channel(userId), JSON.stringify({ event, data }));
}

module.exports = { subscribeUser, unsubscribeUser, emitToUser };
