const { DataTypes } = require("sequelize");
const db = require("../config/database");

const AlertHistory = db.define("AlertHistory", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },

  alert_device_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  threshold_value: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  peak_value: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },

  ended_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: "alert_history",
  timestamps: false
});

module.exports = AlertHistory;