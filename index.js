require("dotenv").config();
const sequelize = require("./config/database");
const webRoutes = require("./routes/web.route");
require("dotenv").config();
const { createServer } = require("http");
const mqttClient = require("./config/mqtt");
const express = require("express");
const path = require("path");
const { initSocket } = require("./config/socket");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);
initSocket(server);
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", webRoutes);  
app.use("/api", require("./routes/api.route"));
 


// Sau khi đã khởi tạo app = express().
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