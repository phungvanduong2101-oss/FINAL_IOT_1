const deviceModel = require("../models/device.model");
const actionHistoryModel = require("../models/action-history.model");
const mqttClient = require("../config/mqtt");


module.exports.getDevicesStatus = async (req, res) => {
  try {
    const devices = await deviceModel.findAll();
    res.json({
      code: "success",
      data: devices,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
module.exports.controlDevice = async (req, res) => {
  try {
    const { action } = req.body;

    if (!["ON", "OFF"].includes(action)) {
      return res.status(400).json({
        message: "Lệnh phải là ON hoặc OFF.",
      });
    }

    const device = await deviceModel.findByPk(req.params.id);

    if (!device) {
      return res.status(404).json({
        message: "Không tìm thấy thiết bị.",
      });
    }

    if (!mqttClient.connected) {
      return res.status(503).json({
        message: "MQTT chưa kết nối.",
      });
    }

    const history = await actionHistoryModel.create({
      device_id: device.id,
      action,
      status: "WAITING",
    });

    mqttClient.publish(
      `device/${device.id}/command`,
      JSON.stringify({
        action,
        action_id: history.id,
      }),
      { retain: false },
      async error => {
        try {
          if (error) {
            await actionHistoryModel.update(
              { status: "FAILED" },
              {
                where: {
                  id: history.id,
                  status: "WAITING",
                },
              }
            );

            return res.status(500).json({
              message: "Gửi lệnh MQTT thất bại.",
            });
          }

          setTimeout(async () => {
            try {
              await actionHistoryModel.update(
                { status: "TIMEOUT" },
                {
                  where: {
                    id: history.id,
                    status: "WAITING",
                  },
                }
              );
            } catch (error) {
              console.error("Lỗi cập nhật TIMEOUT:", error);
            }
          }, 5000);

          return res.json({
            code: "success",
          });
        } catch (error) {
          return res.status(500).json({
            message: error.message,
          });
        }
      }
    );
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};