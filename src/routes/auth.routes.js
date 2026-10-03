// src/routes/auth.routes.js
const express= require("express");

const {registerUser,loginUser,logoutUser}= require("../controllers/auth.controller");

const {authenticate}= require("../middlewares/auth.middleware");

const router = express.Router();

router.post('/register',registerUser);
router.post('/login',loginUser);
router.post('/logout',authenticate,logoutUser);

module.exports= router;