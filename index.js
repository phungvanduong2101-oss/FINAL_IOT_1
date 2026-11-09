require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const { createServer } = require("http");
const sequelize = require("./config/database");
const { initSocket } = require("./config/socket");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

initSocket(server);

// Khởi tạo MQTT sau Socket.
require("./config/mqtt");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Routes 
app.use("/api/auth", require("./routes/auth.route"));
app.use("/", require("./routes/web.route"));
app.use("/api", require("./routes/api.route"));

// Swagger
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Kết nối Database và khởi động Server
async function startServer() {
  try {
    await sequelize.authenticate();

    console.log("MySQL connected successfully!");

    server.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
}

startServer();