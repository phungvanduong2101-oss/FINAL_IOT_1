const { DataTypes } = require("sequelize");
const db = require("../config/database");

const AlertDevice = db.define("AlertDevice", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  sensor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },

  sensor_type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },

  is_blinking: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "alert_device",
  timestamps: false
});

module.exports = AlertDevice;