const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *     - Auth
 *     summary: Đăng nhập quản trị
 *     description: Kiểm tra ADMIN_USERNAME/ADMIN_PASSWORD. Thành công đặt cookie accessToken
 *       (JWT HS256), HttpOnly, SameSite=Strict, thời hạn 2 giờ, Secure ở production.
 *       Đăng nhập tại /login trên cùng origin với Swagger để trình duyệt tự gửi cookie;
 *       Swagger UI không thể tự đặt cookie HttpOnly qua Authorize.
 *     operationId: postApiAuthLogin
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *         headers:
 *           Set-Cookie:
 *             description: accessToken=<JWT>; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200
 *               (Secure ở production).
 *             schema:
 *               type: string
 *       '400':
 *         description: Thiếu tài khoản/mật khẩu hoặc sai kiểu dữ liệu.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *             example:
 *               code: error
 *               message: Vui lòng nhập tài khoản và mật khẩu
 *       '401':
 *         description: Sai thông tin đăng nhập.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *             example:
 *               code: unauthorized
 *               message: Sai tài khoản hoặc mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *             required:
 *             - username
 *             - password
 *     security: []
 */
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

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *     - Auth
 *     summary: Đăng xuất
 *     description: Xóa cookie accessToken tại path /. Không yêu cầu đăng nhập.
 *     operationId: postApiAuthLogout
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *             example:
 *               code: success
 *               message: Đã đăng xuất
 *     security: []
 */
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken", cookieOptions);
  return res.json({ code: "success", message: "Đã đăng xuất" });
});
module.exports = router;
