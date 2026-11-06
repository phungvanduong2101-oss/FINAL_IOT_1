const { Op, Sequelize , where: sqlWhere, fn, col } = require("sequelize");
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
 
    const limit = Number(items);
    const offset = (page - 1) * limit; 
 
    const where = {}; 

    if (status !== "ALL") {
      where.status = status;
    }

    if (device !== "ALL") {
      where.device_id = Number(device);
    } 

    if(search.trim()) { 
      where[Op.or] = [  
        {"$device.name$": { [Op.like]: `%${search.trim()}%` } },
        {action: {[Op.like]: `%${search.trim()}%`}}, 
        {status: {[Op.like]: `%${search.trim()}%`}}, 
        sqlWhere( 
          fn( 
            "DATE_FORMAT", 
            fn("CONVERT_TZ",col("ActionHistory.created_at"),"+00:00","+07:00"), 
            "%H:%i:%s %d/%m/%Y"
          ), 
          { [Op.like]: `%${search.trim()}%` }
        )
      ]
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
      order: [["created_at", sort]],
    }) 
 
    const total = await ActionHistory.count({ 
    where, 
    include : [
      {
        model: Device, 
        as: "device",
        attributes: ["id", "name"],
      },
    ] 
    });
    const totalPages = Math.ceil(total / limit);
    return res.json({
      code: "success",
      data: result,
      totalPages,
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