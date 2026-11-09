const Device = require("../models/alert-device.model");
const History = require("../models/alert-history.model");
const SensorData = require("../models/sensor-data.model");
const { ALERT_THRESHOLDS, UNITS } = require("../config/alert");
const { Op, where: sqlWhere, fn, col } = require("sequelize");

async function snapshot() {
  const devices = await Device.findAll({
    order: [["id", "ASC"]],
  });

  return Promise.all(
    devices.map(async d => {
      const sensor = d.sensor_type.toLowerCase();

      const rows = await SensorData.findAll({
        where: {
          sensor_id: d.sensor_id,
          measurement_type: d.sensor_type,
        },
        order: [
          ["created_at", "DESC"],
          ["id", "DESC"],
        ],
        limit: 5,
      });

      return {
        sensor,
        alertDeviceId: d.id,
        value: rows[0]?.value ?? null,
        threshold: ALERT_THRESHOLDS[sensor],
        unit: UNITS[sensor],
        isBlinking: d.is_blinking,
        status: d.status,

        totalAlerts: await History.count({
          where: {
            alert_device_id: d.id,
          },
        }),

        records: rows.reverse(),
      };
    })
  );
}

function dayRange(day) {
  if (
    typeof day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day)
  ) {
    throw new Error("Ngày không hợp lệ.");
  }

  const utc = new Date(day + "T00:00:00.000Z");

  if (
    !Number.isFinite(utc.getTime()) ||
    utc.toISOString().slice(0, 10) !== day
  ) {
    throw new Error("Ngày không hợp lệ.");
  }

  const start = new Date(utc.getTime() - 7 * 3600000);

  return {
    start,
    end: new Date(start.getTime() + 86400000),
  };
}

// =========================
// THỐNG KÊ CẢNH BÁO THEO NGÀY
// =========================

async function dailyCounts(day) {
  const { start, end } = dayRange(day);
  const { Op } = require("sequelize");

  const devices = await Device.findAll({
    order: [["id", "ASC"]],
  });

  return Promise.all(
    devices.map(async d => ({
      sensor: d.sensor_type.toLowerCase(),

      count: await History.count({
        where: {
          alert_device_id: d.id,
          started_at: {
            [Op.gte]: start,
            [Op.lt]: end,
          },
        },
      }),
    }))
  );
}

module.exports.getDashboard = async (req, res) => {
  try {
    const data = await snapshot();
    res.json({ code: "success", data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getDailyAlerts = async (req, res) => {
  try {
    dayRange(req.query.date);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const data = await dailyCounts(req.query.date);
    res.json({ code: "success", date: req.query.date, data });
  } catch (error) {
    res.status(500).json({ message: "Không tải được thống kê cảnh báo." });
  }
};
 
module.exports.getAlertsHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const items = Math.max(1, parseInt(req.query.items, 10) || 10);
    const sort = req.query.sort === "ASC" ? "ASC" : "DESC";
    const sensor = req.query.sensor || "ALL";
    const search = (req.query.search || "").trim();

    const where = {};
    const skip = (page - 1) * items;

    if (sensor !== "ALL") {
      if (sensor === "n2") where.alert_device_id = 1;
      else if (sensor === "co2") where.alert_device_id = 2;
      else if (sensor === "ch4") where.alert_device_id = 3;
    }

    if (search) {
      where[Op.and] = [
        sqlWhere(
          fn(
            "DATE_FORMAT",
            fn(
              "CONVERT_TZ",
              col("AlertHistory.started_at"),
              "+00:00",
              "+07:00"
            ),
            "%e/%m/%Y %H:%i:%s"
          ),
          { [Op.like]: `%${search}%` }
        ),
      ];
    }

    const alertsList = await History.findAndCountAll({
      where,
      order: [
        ["started_at", sort],
        ["id", sort],
      ],
      offset: skip,
      limit: items,
    }); 

    for (const alert of alertsList.rows) {  
      if (alert.alert_device_id === 1) {
        alert.dataValues.sensor = "n2";
      } else if (alert.alert_device_id === 2) {
        alert.dataValues.sensor = "co2";
      } else if (alert.alert_device_id === 3) {
        alert.dataValues.sensor = "ch4";
      }
    }

    res.json({
      code: "success",
      data: alertsList.rows,
      totalPages: Math.ceil(alertsList.count / items),
      currentPage: page,
      total: alertsList.count,
      skip,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      code: "error",
      message: "Không tải được lịch sử cảnh báo.",
    });
  }
};