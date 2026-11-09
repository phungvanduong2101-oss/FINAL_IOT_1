const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const definition = {
  "openapi": "3.0.0",
  "info": {
    "title": "IoT API",
    "version": "1.0.0",
    "description": "Tài liệu toàn bộ endpoint /api. Đăng nhập qua /login cùng origin trước khi Try it out; trình duyệt tự gửi cookie accessToken. Các API dữ liệu và điều khiển đều yêu cầu quyền admin. Ngày giờ JSON theo ISO 8601; tìm kiếm thời gian và thống kê ngày dùng UTC+07."
  },
  "servers": [
    {
      "url": "/",
      "description": "Cùng origin với Swagger UI"
    }
  ],
  "tags": [
    {
      "name": "Auth",
      "description": "Đăng nhập và đăng xuất"
    },
    {
      "name": "Sensors",
      "description": "Dữ liệu cảm biến"
    },
    {
      "name": "Devices",
      "description": "Trạng thái và điều khiển thiết bị"
    },
    {
      "name": "Actions",
      "description": "Lịch sử điều khiển"
    },
    {
      "name": "Alerts",
      "description": "Dashboard khí và lịch sử cảnh báo"
    }
  ],
  "security": [
    {
      "cookieAuth": []
    }
  ],
  "components": {
    "securitySchemes": {
      "cookieAuth": {
        "type": "apiKey",
        "in": "cookie",
        "name": "accessToken",
        "description": "Cookie JWT do /api/auth/login đặt; đăng nhập cùng origin, trình duyệt gửi tự động."
      }
    },
    "schemas": {
      "Message": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string",
            "example": "Thông báo lỗi"
          }
        }
      },
      "AuthMessage": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "example": "success"
          },
          "message": {
            "type": "string",
            "example": "Đăng nhập thành công"
          }
        }
      },
      "Sensor": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1
          },
          "type": {
            "type": "string",
            "example": "Temperature"
          },
          "name": {
            "type": "string",
            "example": "Cảm biến nhiệt độ"
          }
        }
      },
      "SensorData": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 301,
            "format": "int64"
          },
          "sensor_id": {
            "type": "integer",
            "example": 1
          },
          "value": {
            "type": "number",
            "example": 30.5
          },
          "measurement_type": {
            "type": "string",
            "enum": [
              "Temperature",
              "Humidity",
              "Light",
              "N2",
              "CO2",
              "CH4"
            ],
            "example": "N2"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "example": "2026-11-08T08:30:00.000Z"
          }
        }
      },
      "Device": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1
          },
          "name": {
            "type": "string",
            "example": "Quạt"
          },
          "current_status": {
            "type": "string",
            "enum": [
              "ON",
              "OFF"
            ],
            "example": "OFF"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "example": "2026-11-08T08:30:00.000Z"
          }
        }
      },
      "ActionHistory": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 123,
            "format": "int64"
          },
          "device_id": {
            "type": "integer",
            "example": 1
          },
          "action": {
            "type": "string",
            "enum": [
              "ON",
              "OFF"
            ],
            "example": "ON"
          },
          "status": {
            "type": "string",
            "enum": [
              "WAITING",
              "SUCCESS",
              "FAILED",
              "TIMEOUT"
            ],
            "example": "WAITING"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "example": "2026-11-08T08:30:00.000Z"
          },
          "device": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "example": 1
              },
              "name": {
                "type": "string",
                "example": "Quạt"
              }
            },
            "nullable": true
          }
        }
      },
      "AlertHistory": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1,
            "format": "int64"
          },
          "alert_device_id": {
            "type": "integer",
            "example": 1
          },
          "threshold_value": {
            "type": "number",
            "example": 50
          },
          "peak_value": {
            "type": "number",
            "example": 82
          },
          "started_at": {
            "type": "string",
            "format": "date-time",
            "example": "2026-11-08T08:30:00.000Z"
          },
          "ended_at": {
            "type": "string",
            "format": "date-time",
            "example": "2026-11-08T08:30:10.000Z"
          },
          "sensor": {
            "type": "string",
            "enum": [
              "n2",
              "co2",
              "ch4"
            ],
            "description": "Được bổ sung khi alert_device_id là 1, 2 hoặc 3.",
            "example": "n2"
          }
        }
      },
      "GasSnapshot": {
        "type": "object",
        "properties": {
          "sensor": {
            "type": "string",
            "enum": [
              "n2",
              "co2",
              "ch4"
            ],
            "example": "n2"
          },
          "alertDeviceId": {
            "type": "integer",
            "example": 1
          },
          "value": {
            "type": "number",
            "example": 82,
            "nullable": true
          },
          "threshold": {
            "type": "number",
            "example": 50
          },
          "unit": {
            "type": "string",
            "enum": [
              "%",
              "ppm"
            ],
            "example": "%"
          },
          "isBlinking": {
            "type": "boolean",
            "example": true
          },
          "status": {
            "type": "string",
            "example": "alert"
          },
          "totalAlerts": {
            "type": "integer",
            "example": 12,
            "minimum": 0
          },
          "records": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SensorData"
            },
            "maxItems": 5,
            "description": "Tối đa 5 bản ghi mới nhất, trả theo thứ tự thời gian tăng dần."
          }
        }
      },
      "SensorDataWithSensor": {
        "allOf": [
          {
            "$ref": "#/components/schemas/SensorData"
          },
          {
            "type": "object",
            "properties": {
              "sensor": {
                "$ref": "#/components/schemas/Sensor",
                "nullable": true
              }
            }
          }
        ]
      }
    },
    "responses": {
      "Unauthorized": {
        "description": "Thiếu cookie, token hết hạn/không hợp lệ hoặc không có quyền admin.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/AuthMessage"
            },
            "example": {
              "code": "unauthorized",
              "message": "Vui lòng đăng nhập để điều khiển thiết bị"
            }
          }
        }
      }
    }
  }
};

module.exports = swaggerJsdoc({
  definition,
  apis: [path.join(__dirname, "../routes/api.route.js"), path.join(__dirname, "../routes/auth.route.js")],
  failOnErrors: true,
});
