
const { DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../config/database");

const ActionHistory = sequelize.define("ActionHistory", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },

  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  action: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [["ON", "OFF"]]
    }
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "WAITING",
    validate: {
      isIn: [["TIMEOUT", "WAITING", "SUCCESS", "FAILED"]]
    }
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
  }
}, {
  tableName: "action_history",
  timestamps: false
});

module.exports = ActionHistory;
