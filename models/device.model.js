
const { DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../config/database");

const Device = sequelize.define("Device", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },

  current_status: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: "OFF",
    validate: {
      isIn: [["ON", "OFF"]]
    }
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
  }
}, {
  tableName: "devices",
  timestamps: false
});

module.exports = Device;
