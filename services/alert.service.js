const db = require("../config/database");
const Device = require("../models/alert-device.model");
const History = require("../models/alert-history.model");
const SensorData = require("../models/sensor-data.model");
const { getIO } = require("../config/socket");

// =========================
// CẤU HÌNH
// =========================

// Ngưỡng demo, không phải ngưỡng an toàn khí thực tế.
const ALERT_THRESHOLDS = {
  n2: 80,
  co2: 1000,
  ch4: 500,
};

const UNITS = {
  n2: "%",
  co2: "ppm",
  ch4: "ppm",
};

const valid = value =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

// =========================
// PUBLISH MQTT
// =========================

function publish(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(
      topic,
      payload,
      {
        retain: true,
        qos: 1,
      },
      error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

// =========================
// LẤY TRẠNG THÁI DASHBOARD
// =========================

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
        limit: 10,
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

// =========================
// ĐỒNG BỘ LED VỚI ESP32
// =========================

async function sync(client) {
  const devices = await Device.findAll();

  await publish(
    client,
    "alert/config",
    JSON.stringify(
      devices.map(d => ({
        id: d.id,
        gpio: d.gpio_pin,
      }))
    )
  );

  for (const d of devices) {
    await publish(
      client,
      `alert/${d.id}/blink`,
      d.is_blinking ? "1" : "0"
    );
  }
}

// =========================
// XỬ LÝ DỮ LIỆU CẢM BIẾN
// =========================

async function processPacket(data, client) {
  for (const [sensor, threshold] of Object.entries(ALERT_THRESHOLDS)) {
    const value = data[sensor];

    if (!valid(value) || (sensor === "n2" && value > 100)) {
      continue;
    }

    const result = await db.transaction(async transaction => {
      const d = await Device.findOne({
        where: {
          sensor_type: sensor.toUpperCase(),
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!d) {
        throw new Error(`Import SQL first: missing ${sensor}`);
      }

      const blinking = value > threshold;
      const now = new Date();

      // Bắt đầu một đợt cảnh báo.
      if (blinking && d.status !== "alert") {
        await History.create(
          {
            alert_device_id: d.id,
            sensor_value: value,
            threshold_value: threshold,
            started_at: now,
            status: "active",
          },
          {
            transaction,
          }
        );
      }

      // Kết thúc đợt cảnh báo.
      if (!blinking && d.status === "alert") {
        await History.update(
          {
            ended_at: now,
            status: "resolved",
          },
          {
            where: {
              alert_device_id: d.id,
              status: "active",
            },
            transaction,
          }
        );
      }

      // Chỉ cập nhật thiết bị khi trạng thái thay đổi.
      if (
        blinking !== Boolean(d.is_blinking) ||
        d.status !== (blinking ? "alert" : "normal")
      ) {
        await d.update(
          {
            status: blinking ? "alert" : "normal",
            is_blinking: blinking,
            updated_at: now,
          },
          {
            transaction,
          }
        );
      }

      // Lưu dữ liệu đo.
      const row = await SensorData.create(
        {
          sensor_id: d.sensor_id,
          measurement_type: d.sensor_type,
          value,
          created_at: now,
        },
        {
          transaction,
        }
      );

      return {
        sensor,
        alertDeviceId: d.id,
        value,
        threshold,
        unit: UNITS[sensor],
        isBlinking: blinking,
        status: blinking ? "alert" : "normal",

        totalAlerts: await History.count({
          where: {
            alert_device_id: d.id,
          },
          transaction,
        }),

        record: row.toJSON(),
      };
    });

    // Cập nhật giao diện.
    getIO().emit("alert:status", result);

    // Điều khiển LED vật lý.
    await publish(
      client,
      `alert/${result.alertDeviceId}/blink`,
      result.isBlinking ? "1" : "0"
    );
  }
}

// =========================
// KHOẢNG THỜI GIAN THEO NGÀY
// =========================

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

// =========================
// EXPORT
// =========================

module.exports = {
  snapshot,
  sync,
  processPacket,
  ALERT_THRESHOLDS,
  valid,
  dayRange,
  dailyCounts,
};