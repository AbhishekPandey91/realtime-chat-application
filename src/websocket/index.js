// websocket/index.js  
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../models/users.models");
const { addUser, removeUser } = require("./connectionManager");
const { routeIncomingMessage } = require("./messageHandler");
const { deliverPendingMessages } = require("./catchUp");
const { subscribeUser, unsubscribeUser } = require("./pubsub");
const { broadcastPresence } = require("./presence");

const HEARTBEAT_MS = 30 * 1000;

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.isAlive === false) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", async (ws, req) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const { searchParams } = new URL(req.url, "http://localhost");
    const token = searchParams.get("token");

    if (!token) {
      ws.close(4001, "Access token is missing");
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESSTOKEN);
    } catch (error) {
      ws.close(4002, "Invalid or expired token");
      return;
    }

    const userId = decoded.userId;
    ws.userId = userId;

    addUser(userId, ws);
    subscribeUser(userId);

    ws.on("message", (raw) => {
      routeIncomingMessage(ws, raw.toString());
    });

    ws.on("close", async () => {
      const wasCurrent = removeUser(userId, ws);
      if (!wasCurrent) return;

      unsubscribeUser(userId);

      try {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, {
          is_online: false,
          last_seen: lastSeen,
        });
        await broadcastPresence(userId, false, lastSeen);
      } catch (error) {
        console.error(`Failed to mark user ${userId} offline:`, error);
      }
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error for user ${userId}:`, err);
    });

    try {
      await User.findByIdAndUpdate(userId, { is_online: true });
      await broadcastPresence(userId, true);
      await deliverPendingMessages(ws);
    } catch (error) {
      console.error(`Connect setup failed for user ${userId}:`, error);
    }
  });

  return wss;
}

module.exports = initWebSocket;
