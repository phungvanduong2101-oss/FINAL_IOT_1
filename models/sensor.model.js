
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Sensor = sequelize.define("Sensor", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },

  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: "sensors",
  timestamps: false
});

module.exports = Sensor;
