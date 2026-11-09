const mqtt = require("mqtt");
const { SensorData, Device, ActionHistory } = require("../models");
const { getIO } = require("./socket");
const AlertDevice = require("../models/alert-device.model");
const History = require("../models/alert-history.model");
const { ALERT_THRESHOLDS, UNITS } = require("./alert");

// =========================
// KẾT NỐI MQTT
// =========================

const client = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

let queue = Promise.resolve();

client.on("connect", () => {
  console.log("MQTT connected!");

  client.subscribe(
    ["sensors/data", "device/status", "alerts/history"],
    error => {
      if (error) {
        console.error("MQTT subscribe error:", error.message);
      }
    }
  );
});

// =========================
// DỮ LIỆU CẢM BIẾN
// =========================

async function handleSensorData(data) {
  const records = [];
  const now = new Date();

  for (const record of data.sensorsData) {
    // DHT11.
    if (record.sensor_id === 1) {
      records.push({
        sensor_id: 1,
        measurement_type: "Temperature",
        value: Number(record.temperature.toFixed(1)),
        created_at: now,
      });

      records.push({
        sensor_id: 1,
        measurement_type: "Humidity",
        value: Number(record.humidity.toFixed(1)),
        created_at: now,
      });
    }

    // Ánh sáng.
    else if (record.sensor_id === 2) {
      records.push({
        sensor_id: 2,
        measurement_type: "Light",
        value: Math.round(
          ((4095 - record.light) / 4095) * 1000
        ),
        created_at: now,
      });
    }

    // N2, CO2, CH4.
    else if (
      record.sensor_id === 3 ||
      record.sensor_id === 4 ||
      record.sensor_id === 5
    ) {
      const sensor = {
        3: "n2",
        4: "co2",
        5: "ch4",
      }[record.sensor_id];

      const alertDeviceId = {
        3: 1,
        4: 2,
        5: 3,
      }[record.sensor_id];

      const value = record[sensor];
      const threshold = ALERT_THRESHOLDS[sensor];

      const isBlinking = value >= threshold;
      const status = isBlinking ? "alert" : "normal";

      const sensorRecord = {
        sensor_id: record.sensor_id,
        measurement_type: sensor.toUpperCase(),
        value,
        created_at: now,
      };

      getIO().emit("alert:status", {
        sensor,
        alertDeviceId,
        value,
        threshold,
        unit: UNITS[sensor],
        isBlinking,
        status,
        record: sensorRecord,
      });

      await AlertDevice.update(
        {
          status,
          is_blinking: isBlinking,
          updated_at: now,
        },
        {
          where: { id: alertDeviceId },
        }
      );

      // Lưu riêng để giữ nguyên dữ liệu của event sensors:update.
      await SensorData.create(sensorRecord);
    }
  }

  getIO().emit("sensors:update", records);

  if (records.length > 0) {
    await SensorData.bulkCreate(records);
  }
}

// =========================
// ĐỢT CẢNH BÁO ĐÃ KẾT THÚC
// =========================


async function handleAlertHistory(data) {
  await History.create({
    alert_device_id: data.alert_device_id,
    threshold_value: data.threshold_value,
    peak_value: data.peak_value,
    started_at: new Date(data.started_at * 1000),
    ended_at: new Date(data.ended_at * 1000),
  });

  getIO().emit("alert:history-updated");
} 

// =========================
// PHẢN HỒI THIẾT BỊ
// =========================

async function handleDeviceStatus(data) {
  for (const device of data.devicesState) {
    if (device.status === "SUCCESS") {
      await Device.update(
        { current_status: device.state },
        { where: { id: device.device_id } }
      );

      await ActionHistory.update(
        { status: device.status },
        {
          where: {
            device_id: device.device_id,
            id: data.action_id,
          },
        }
      );
    } else if (device.status === "FAILED") {
      await ActionHistory.update(
        { status: device.status },
        {
          where: {
            device_id: device.device_id,
            id: data.action_id,
          },
        }
      );
    }
  }

  getIO().emit("devices:update", data.devicesState);
}

// =========================
// PHÂN LOẠI BẢN TIN
// =========================

async function handleMessage(topic, message) {
  const data = JSON.parse(message.toString());

  if (topic === "sensors/data") {
    await handleSensorData(data);
  } else if (topic === "alerts/history") {
    await handleAlertHistory(data);
  } else if (topic === "device/status") {
    await handleDeviceStatus(data);
  }
}

// Xử lý lần lượt các bản tin.
client.on("message", (topic, message) => {
  queue = queue
    .then(() => handleMessage(topic, message))
    .catch(error => {
      console.error(
        `MQTT message error [${topic}]:`,
        error.message
      );
    });
});

client.on("error", error => {
  console.error("MQTT error:", error.message);
});

module.exports = client;