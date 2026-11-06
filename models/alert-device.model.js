const { DataTypes } = require("sequelize");
const db = require("../config/database");
module.exports = db.define("AlertDevice", {
 id: {type: DataTypes.INTEGER, primaryKey:true, autoIncrement:true},
 sensor_id: {type:DataTypes.INTEGER, allowNull:false},
 name: DataTypes.STRING(100), sensor_type: {type:DataTypes.STRING(10), unique:true},
 gpio_pin: DataTypes.INTEGER, status: DataTypes.STRING(10), is_blinking: DataTypes.BOOLEAN,
 updated_at: DataTypes.DATE
}, {tableName:"alert_device", timestamps:false});
