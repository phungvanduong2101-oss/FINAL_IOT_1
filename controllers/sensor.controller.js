const {
  Op,
  Sequelize,
  where: sqlWhere,
  fn,
  col,
} = require("sequelize");

const Sensor = require("../models/sensor.model");
const SensorData = require("../models/sensor-data.model");

module.exports.getSensorsDataLatest = async (req, res) => {
  try {
    const dataTemperature = await SensorData.findAll({
      where: { measurement_type: "Temperature" },
      limit: 10,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    const dataHumidity = await SensorData.findAll({
      where: { measurement_type: "Humidity" },
      limit: 10,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    const dataLight = await SensorData.findAll({
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
    const limit = Math.max(1, parseInt(items, 10) || 10);
    const offset = (page - 1) * limit;
    const sortOrder = sort === "ASC" ? "ASC" : "DESC";

    const keyword = search.trim();
    const where = {};

    // Ngày trước, giờ sau: 8/11/2026 15:38:02
    const timeCondition = sqlWhere(
      fn(
        "DATE_FORMAT",
        fn(
          "CONVERT_TZ",
          col("SensorData.created_at"),
          "+00:00",
          "+07:00"
        ),
        "%e/%m/%Y %H:%i:%s"
      ),
      { [Op.like]: `%${keyword}%` }
    );

    const valueCondition = sqlWhere(
      Sequelize.cast(col("SensorData.value"), "CHAR"),
      { [Op.like]: `%${keyword}%` }
    );

    if (searchBy === "ALL") {
      if (keyword) {
        where[Op.or] = [
          valueCondition,
          {
            measurement_type: {
              [Op.like]: `%${keyword}%`,
            },
          },
          timeCondition,
        ];
      }
    } else if (searchBy === "Time") {
      if (keyword) {
        where[Op.or] = [timeCondition];
      }
    } else {
      where.measurement_type = searchBy.trim();

      if (keyword) {
        where[Op.or] = [valueCondition];
      }
    }

    const sensors = await SensorData.findAll({
      where,
      limit,
      offset,
      order: [
        ["created_at", sortOrder],
        ["id", sortOrder],
      ],
      include: [
        {
          model: Sensor,
          as: "sensor",
          attributes: ["id", "type", "name"],
        },
      ],
    });

    const count = await SensorData.count({ where });
    const totalPages = Math.ceil(count / limit);

    res.json({
      code: "success",
      data: sensors,
      currentPage: page,
      totalPages,
      totalItems: count,
      skip: offset,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};