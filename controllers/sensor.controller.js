
const sensorsData = require("../models/sensor-data.model");
const { Op, Sequelize, where: sqlWhere, fn, col } = require("sequelize");
const Sensor = require("../models/sensor.model");
const SensorData = require("../models/sensor-data.model");
module.exports.getSensorsDataLatest = async (req, res) => {
  try {
    const dataTemperature = await sensorsData.findAll({
      where: { measurement_type: "Temperature" },
      limit: 10,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    const dataHumidity = await sensorsData.findAll({
      where: { measurement_type: "Humidity" },
      limit: 10,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    const dataLight = await sensorsData.findAll({
      where: { measurement_type: "Light" },
      limit: 10,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    res.json({
      code: "success",
      Temperature: dataTemperature,
      Humidity: dataHumidity,
      Light: dataLight,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getSensorsData = async (req, res) => {
  try {
    const {
      search = "",
      searchBy = "ALL",
      items = "10",
      sort = "DESC",
    } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const limit = Number(items);
    const offset = (page - 1) * limit;

    const where = {};

    if (searchBy === 'ALL') {
      where[Op.or] = [
        Sequelize.where(
          Sequelize.cast(Sequelize.col("SensorData.value"), "CHAR"),
          { [Op.like]: `%${search.trim()}%` },
        ),
        { measurement_type: { [Op.like]: `%${search.trim()}%` } },
        sqlWhere(
          fn(
            "DATE_FORMAT",
            fn("CONVERT_TZ", col("SensorData.created_at"), "+00:00", "+07:00"),
            "%H:%i:%s %e/%m/%Y"
          ),
          { [Op.like]: `%${search.trim()}%` }
        )
      ]
    } else if (searchBy !== 'Time') {
      where.measurement_type = searchBy.trim();
      where[Op.or] = [
        Sequelize.where(
          Sequelize.cast(Sequelize.col("SensorData.value"), "CHAR"),
          { [Op.like]: `%${search.trim()}%` },
        ),
      ]
    } else if (searchBy === 'Time') {
      where[Op.or] = [
        sqlWhere(
          fn(
            "DATE_FORMAT",
            fn("CONVERT_TZ", col("SensorData.created_at"), "+00:00", "+07:00"),
            "%H:%i:%s %e/%m/%Y"
          ),
          { [Op.like]: `%${search.trim()}%` }
        )
      ]
    }

    const sensors = await SensorData.findAll({
      where,
      limit,
      offset,
      order: [["created_at", sort], ["id", sort]],
      include: [
        {
          model: Sensor,
          as: "sensor",
          attributes: ["id", "type", "name"],
        }
      ]

    });

    const count = await SensorData.count({ where });
    const totalPages = Math.ceil(count / limit);

    res.json({
      code: "success",
      data: sensors,
      currentPage: page,
      totalPages,
      totalItems: count,
      skip: offset
    });


  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};