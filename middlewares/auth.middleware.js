const jwt = require("jsonwebtoken");

function isAuthenticated(req) {
  try {
    const payload = jwt.verify(req.cookies?.accessToken, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload.sub === "iot-admin" && payload.role === "admin";
  } catch {
    return false;
  }
}

module.exports.requireAuth = (req, res, next) => {
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ code: "unauthorized", message: "Vui lòng đăng nhập để điều khiển thiết bị" });
};

module.exports.requirePageAuth = (req, res, next) => {
  if (isAuthenticated(req)) return next();
  return res.redirect("/login");
};
