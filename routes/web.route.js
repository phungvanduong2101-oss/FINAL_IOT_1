const express = require("express");
const router = express.Router();

const controller = require("../controllers/view.controller"); 
const { requirePageAuth } = require("../middlewares/auth.middleware"); 
 
router.get("/login", (req, res) => res.render("login"));

router.get("/",requirePageAuth ,controller.index);
router.get("/data-sensor",requirePageAuth ,controller.dataSensor);
router.get("/history-action", requirePageAuth, controller.historyAction);
router.get("/profile", requirePageAuth, controller.profile);

router.get("/gas-dashboard", requirePageAuth, (req,res) => res.render("gas-dashboard", {title:"Gas Dashboard",activePage:"gas"}));
module.exports = router;