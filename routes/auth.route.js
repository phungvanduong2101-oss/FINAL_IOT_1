const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return res.status(400).json({ code: "error", message: "Vui lòng nhập tài khoản và mật khẩu" });
  }
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ code: "unauthorized", message: "Sai tài khoản hoặc mật khẩu" });
  }
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
    algorithm: "HS256", subject: "iot-admin", expiresIn: "2h",
  });
  res.cookie("accessToken", token, { ...cookieOptions, maxAge: 2 * 60 * 60 * 1000 });
  return res.json({ code: "success", message: "Đăng nhập thành công" });
});

router.post("/logout", (req, res) => {
  res.clearCookie("accessToken", cookieOptions);
  return res.json({ code: "success", message: "Đã đăng xuất" });
});
module.exports = router;
