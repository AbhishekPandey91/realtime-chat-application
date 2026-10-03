// utils/generateToken.js
const jwt = require("jsonwebtoken");

function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
    },
    process.env.ACCESSTOKEN,
    {
      expiresIn: process.env.ACCESSTOKEN_EXPIRY,
    }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user._id,
    },
    process.env.REFRESHTOKEN,
    {
      expiresIn: process.env.REFRESHTOKEN_EXPIRY,
    }
  );
}

module.exports = { generateAccessToken, generateRefreshToken };