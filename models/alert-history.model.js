const {DataTypes} = require("sequelize");
module.exports = require("../config/database").define("AlertHistory", {
 id:{type:DataTypes.BIGINT,primaryKey:true,autoIncrement:true},
 alert_device_id:DataTypes.INTEGER, sensor_value:DataTypes.FLOAT,
 threshold_value:DataTypes.FLOAT, started_at:DataTypes.DATE,
 ended_at:DataTypes.DATE, status:DataTypes.STRING(10)
}, {tableName:"alert_history",timestamps:false});
