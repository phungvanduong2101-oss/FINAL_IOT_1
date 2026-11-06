const express = require("express");
const router = express.Router();

const controller = require("../controllers/view.controller");

router.get("/", controller.index);
router.get("/data-sensor", controller.dataSensor);
router.get("/history-action", controller.historyAction);
router.get("/profile", controller.profile);

router.get("/gas-dashboard", (req,res) => res.render("gas-dashboard", {title:"Gas Dashboard",activePage:"gas"}));
module.exports = router;