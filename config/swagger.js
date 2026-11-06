const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IoT API",
      version: "1.0.0",
      description: "Tài liệu API hệ thống giám sát và điều khiển thiết bị",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Server local",
      },
    ],
  },

  // Đường dẫn đến các file chứa comment mô tả API.
  apis: ["./routes/api.route.js"],
});

module.exports = swaggerSpec;