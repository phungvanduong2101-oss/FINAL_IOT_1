const { Op, where: sqlWhere, fn, col } = require("sequelize");
const ActionHistory = require("../models/action-history.model");
const Device = require("../models/device.model");

module.exports.getActionsHistory = async (req, res) => {
  try {
    const {
      search = "",
      device = "ALL",
      status = "ALL",
      items = "10",
      sort = "DESC",
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(items, 10) || 10);
    const offset = (page - 1) * limit;
    const sortOrder = sort === "ASC" ? "ASC" : "DESC";
    const keyword = search.trim();

    const where = {};

    if (status !== "ALL") {
      where.status = status;
    }

    if (device !== "ALL") {
      where.device_id = Number(device);
    }

    if (keyword) {
      where[Op.or] = [
        {
          "$device.name$": {
            [Op.like]: `%${keyword}%`,
          },
        },
        {
          action: {
            [Op.like]: `%${keyword}%`,
          },
        },
        {
          status: {
            [Op.like]: `%${keyword}%`,
          },
        },
        sqlWhere(
          fn(
            "DATE_FORMAT",
            fn(
              "CONVERT_TZ",
              col("ActionHistory.created_at"),
              "+00:00",
              "+07:00"
            ),
            "%e/%m/%Y %H:%i:%s"
          ),
          { [Op.like]: `%${keyword}%` }
        ),
      ];
    }

    const result = await ActionHistory.findAll({
      where,
      include: [
        {
          model: Device,
          as: "device",
          attributes: ["id", "name"],
        },
      ],
      limit,
      offset,
      order: [
        ["created_at", sortOrder],
        ["id", sortOrder],
      ],
    });

    const total = await ActionHistory.count({
      where,
      include: [
        {
          model: Device,
          as: "device",
          attributes: [],
        },
      ],
    });

    return res.json({
      code: "success",
      data: result,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      skip: offset,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      code: "error",
      message: "Không tải được lịch sử thao tác.",
    });
  }
};