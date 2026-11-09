// Shared demo settings for MQTT and HTTP responses.
const ALERT_THRESHOLDS = {
  n2: 50,
  co2: 700,
  ch4: 450,
};

const UNITS = {
  n2: "%",
  co2: "ppm",
  ch4: "ppm",
};
module.exports = { ALERT_THRESHOLDS, UNITS };
