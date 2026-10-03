// websocket/connectionManager.js
const onlineUsers = new Map(); // userId -> ws connection

function addUser(userId, ws) {
  onlineUsers.set(userId, ws);
}

// Only removes if this exact socket is the current one for the user.
// Returns true if removed.
function removeUser(userId, ws) {
  if (onlineUsers.get(userId) === ws) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

function getUserSocket(userId) {
  return onlineUsers.get(userId);
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

module.exports = { addUser, removeUser, getUserSocket, isUserOnline };
