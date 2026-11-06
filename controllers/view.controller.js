 
module.exports.index = (req, res) => {
  res.render("home", {
    title: "IoT Dashboard",
    activePage: "home",
  });
};

module.exports.dataSensor = (req, res) => {
  res.render("data-sensor", {
    title: "Data Sensor — IoT Dashboard",
    activePage: "data-sensor",
  });
};

module.exports.historyAction = (req, res) => {
  res.render("history-action", {
    title: "History Action — IoT Dashboard",
    activePage: "history-action",
  });
};

module.exports.profile = (req, res) => {
  res.render("profile", {
    title: "Profile — IoT Dashboard",
    activePage: "profile",
  });
};