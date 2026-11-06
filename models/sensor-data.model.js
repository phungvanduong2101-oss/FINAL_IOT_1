
const { DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../config/database");

const SensorData = sequelize.define("SensorData", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },

  sensor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  value: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  measurement_type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
  }
}, {
  tableName: "sensor_data",
  timestamps: false
});

module.exports = SensorData;
