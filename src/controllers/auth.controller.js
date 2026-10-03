// src/controllers/auth.controller.js
const User = require("../models/users.models");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateToken");

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "username is required" });
    }
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email is required" });
    }
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "password is required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email or username already exists",
      });
    }

    const user = await User.create({ username, email, password });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("registerUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email is required" });
    }
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "password is required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email" });
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res
        .status(401)
        .json({ success: false, message: "invalid password" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .cookie("refreshToken", refreshToken)
      .json({
        success: true,
        message: "Login Successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
          accessToken,
        },
      });
  } catch (error) {
    console.error("loginUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

const logoutUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      $set: { refreshToken: null },
    });

    return res.status(200).clearCookie("refreshToken").json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("logoutUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { registerUser, loginUser, logoutUser };
