
const Sensor = require("./sensor.model");
const SensorData = require("./sensor-data.model");
const Device = require("./device.model");
const ActionHistory = require("./action-history.model");

// Sensor 1 - N SensorData
Sensor.hasMany(SensorData, {
  foreignKey: "sensor_id",
  as: "data",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE"
});

SensorData.belongsTo(Sensor, {
  foreignKey: "sensor_id",
  as: "sensor"
});

// Device 1 - N ActionHistory
Device.hasMany(ActionHistory, {
  foreignKey: "device_id",
  as: "history",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE"
});

ActionHistory.belongsTo(Device, {
  foreignKey: "device_id",
  as: "device"
});

module.exports = {
  Sensor,
  SensorData,
  Device,
  ActionHistory
};
