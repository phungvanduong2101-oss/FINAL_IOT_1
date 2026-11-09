#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>

// =========================
// LED THIẾT BỊ
// =========================

#define LED_D2 2
#define LED_D5 5
#define LED_D23 23

// =========================
// CẢM BIẾN
// =========================

#define DHTPIN 22
#define DHTTYPE DHT11
#define LIGHT_PIN 34

DHT dht(DHTPIN, DHTTYPE);

// =========================
// WIFI
// =========================

const char* WIFI_SSID = "Phong302";
const char* WIFI_PASSWORD = "03112005";

// =========================
// MQTT
// =========================

const char* MQTT_HOST = "192.168.68.100";
const int MQTT_PORT = 2711;

const char* MQTT_USERNAME = "PhungVanDuong";
const char* MQTT_PASSWORD = "B23DCCN226";

const char* MQTT_TOPIC_CONTROL = "device/+/command";
const char* MQTT_TOPIC_STATUS = "device/status";
const char* MQTT_TOPIC_SENSOR = "sensors/data";
const char* MQTT_TOPIC_ALERT = "alerts/history";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// =========================
// CHU KỲ ĐỌC CẢM BIẾN
// =========================

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;

// =========================
// LED CẢNH BÁO
// Chỉ số: N2 = 0, CO2 = 1, CH4 = 2
// =========================

const uint8_t alertPins[3] = {18, 19, 21};

bool blinking[3] = {false, false, false};
bool levels[3] = {false, false, false};

unsigned long blinkTimes[3] = {0, 0, 0};

// Thời gian bắt đầu từng đợt
time_t alertStartTimes[3] = {0, 0, 0};

// Giá trị lớn nhất đo được trong từng đợt
float peakValues[3] = {0, 0, 0};

// Ngưỡng cảnh báo
const float alertN2 = 50.0;
const int alertCO2 = 700;
const int alertCH4 = 450;

// =========================
// NHẤP NHÁY LED
// =========================

void tickAlerts() {
  unsigned long now = millis();

  for (int i = 0; i < 3; i++) {
    if (blinking[i] && now - blinkTimes[i] >= 270) {
      blinkTimes[i] = now;
      levels[i] = !levels[i];
      digitalWrite(alertPins[i], levels[i]);
    }
  }
}

// =========================
// KẾT NỐI WIFI
// =========================

void setupWiFi() {
  Serial.print("Connecting WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected!");

  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

// =========================
// GỬI TRẠNG THÁI THIẾT BỊ
// =========================

void sendStatus(
  int deviceIds[],
  const char* states[],
  const char* statuses[],
  int count,
  int actionId
) {
  JsonDocument doc;

  doc["action_id"] = actionId;

  JsonArray devices = doc["devicesState"].to<JsonArray>();

  for (int i = 0; i < count; i++) {
    JsonObject device = devices.add<JsonObject>();

    device["device_id"] = deviceIds[i];
    device["state"] = states[i];
    device["status"] = statuses[i];
  }

  char buffer[500];
  serializeJson(doc, buffer, sizeof(buffer));

  bool sent = mqttClient.publish(MQTT_TOPIC_STATUS, buffer);

  Serial.print(sent ? "Status sent: " : "Status publish failed: ");
  Serial.println(buffer);
}

// =========================
// ĐỌC VÀ GỬI CẢM BIẾN
// =========================

void sendSensorData() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  int lightValue = analogRead(LIGHT_PIN);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 read error!");
    return;
  }

  float gasN2 = random(10, 1001) / 10.0f;
  int gasCO2 = random(1, 1401);
  int gasCH4 = random(1, 901);

  JsonDocument doc;
  JsonArray sensors = doc["sensorsData"].to<JsonArray>();

  // =========================
  // DHT11
  // =========================

  JsonObject dhtSensor = sensors.add<JsonObject>();
  dhtSensor["sensor_id"] = 1;
  dhtSensor["temperature"] = temperature;
  dhtSensor["humidity"] = humidity;

  // =========================
  // ÁNH SÁNG
  // =========================

  JsonObject lightSensor = sensors.add<JsonObject>();
  lightSensor["sensor_id"] = 2;
  lightSensor["light"] = lightValue;

  // =========================
  // N2 ẢO
  // =========================

  JsonObject n2Sensor = sensors.add<JsonObject>();
  n2Sensor["sensor_id"] = 3;

  if (gasN2 >= alertN2) {
    if (!blinking[0]) {
      // Bắt đầu đợt mới
      alertStartTimes[0] = time(nullptr);
      peakValues[0] = gasN2;
    }

    // Cập nhật peak trong đợt
    if (gasN2 > peakValues[0]) {
      peakValues[0] = gasN2;
    }

    blinking[0] = true;
  } else {
    if (blinking[0]) {
      // Kết thúc đợt
      time_t endedAt = time(nullptr);

      JsonDocument alertDoc;
      alertDoc["alert_device_id"] = 1;
      alertDoc["threshold_value"] = alertN2;
      alertDoc["peak_value"] = peakValues[0];
      alertDoc["started_at"] = (long long)alertStartTimes[0];
      alertDoc["ended_at"] = (long long)endedAt;

      char alertBuffer[256];
      serializeJson(alertDoc, alertBuffer, sizeof(alertBuffer));

      bool sent = mqttClient.publish(MQTT_TOPIC_ALERT, alertBuffer);

      Serial.print(sent ? "N2 alert sent: " : "N2 alert publish failed: ");
      Serial.println(alertBuffer);
    }

    blinking[0] = false;
    levels[0] = false;
    digitalWrite(alertPins[0], LOW);
  }

  n2Sensor["n2"] = gasN2;

  // =========================
  // CO2 ẢO
  // =========================

  JsonObject co2Sensor = sensors.add<JsonObject>();
  co2Sensor["sensor_id"] = 4;

  if (gasCO2 >= alertCO2) {
    if (!blinking[1]) {
      // Bắt đầu đợt mới
      alertStartTimes[1] = time(nullptr);
      peakValues[1] = gasCO2;
    }

    // Cập nhật peak trong đợt
    if (gasCO2 > peakValues[1]) {
      peakValues[1] = gasCO2;
    }

    blinking[1] = true;
  } else {
    if (blinking[1]) {
      // Kết thúc đợt
      time_t endedAt = time(nullptr);

      JsonDocument alertDoc;
      alertDoc["alert_device_id"] = 2;
      alertDoc["threshold_value"] = alertCO2;
      alertDoc["peak_value"] = peakValues[1];
      alertDoc["started_at"] = (long long)alertStartTimes[1];
      alertDoc["ended_at"] = (long long)endedAt;

      char alertBuffer[256];
      serializeJson(alertDoc, alertBuffer, sizeof(alertBuffer));

      bool sent = mqttClient.publish(MQTT_TOPIC_ALERT, alertBuffer);

      Serial.print(sent ? "CO2 alert sent: " : "CO2 alert publish failed: ");
      Serial.println(alertBuffer);
    }

    blinking[1] = false;
    levels[1] = false;
    digitalWrite(alertPins[1], LOW);
  }

  co2Sensor["co2"] = gasCO2;

  // =========================
  // CH4 ẢO
  // =========================

  JsonObject ch4Sensor = sensors.add<JsonObject>();
  ch4Sensor["sensor_id"] = 5;

  if (gasCH4 >= alertCH4) {
    if (!blinking[2]) {
      // Bắt đầu đợt mới
      alertStartTimes[2] = time(nullptr);
      peakValues[2] = gasCH4;
    }

    // Cập nhật peak trong đợt
    if (gasCH4 > peakValues[2]) {
      peakValues[2] = gasCH4;
    }

    blinking[2] = true;
  } else {
    if (blinking[2]) {
      // Kết thúc đợt
      time_t endedAt = time(nullptr);

      JsonDocument alertDoc;
      alertDoc["alert_device_id"] = 3;
      alertDoc["threshold_value"] = alertCH4;
      alertDoc["peak_value"] = peakValues[2];
      alertDoc["started_at"] = (long long)alertStartTimes[2];
      alertDoc["ended_at"] = (long long)endedAt;

      char alertBuffer[256];
      serializeJson(alertDoc, alertBuffer, sizeof(alertBuffer));

      bool sent = mqttClient.publish(MQTT_TOPIC_ALERT, alertBuffer);

      Serial.print(sent ? "CH4 alert sent: " : "CH4 alert publish failed: ");
      Serial.println(alertBuffer);
    }

    blinking[2] = false;
    levels[2] = false;
    digitalWrite(alertPins[2], LOW);
  }

  ch4Sensor["ch4"] = gasCH4;

  // =========================
  // GỬI DỮ LIỆU CẢM BIẾN
  // =========================

  char buffer[700];
  serializeJson(doc, buffer, sizeof(buffer));

  bool sent = mqttClient.publish(MQTT_TOPIC_SENSOR, buffer);

  Serial.print(sent ? "Sensor data sent: " : "Sensor publish failed: ");
  Serial.println(buffer);
}

// =========================
// ĐIỀU KHIỂN MỘT THIẾT BỊ
// =========================

void controlDevice(
  uint8_t pin,
  int deviceId,
  const String& action,
  int actionId
) {
  if (action != "ON" && action != "OFF") {
    return;
  }

  int target = action == "ON" ? HIGH : LOW;

  digitalWrite(pin, target);

  int deviceIds[] = {deviceId};

  const char* states[] = {
    action.c_str()
  };

  const char* statuses[] = {
    digitalRead(pin) == target ? "SUCCESS" : "FAILED"
  };

  sendStatus(deviceIds, states, statuses, 1, actionId);
}

// =========================
// ĐIỀU KHIỂN TẤT CẢ THIẾT BỊ
// =========================

void controlAllDevices(const String& action, int actionId) {
  if (action != "ON" && action != "OFF") {
    return;
  }

  int target = action == "ON" ? HIGH : LOW;

  digitalWrite(LED_D2, target);
  digitalWrite(LED_D5, target);
  digitalWrite(LED_D23, target);

  int deviceIds[] = {1, 2, 3};

  const char* states[] = {
    action.c_str(),
    action.c_str(),
    action.c_str()
  };

  const char* statuses[] = {
    digitalRead(LED_D2) == target ? "SUCCESS" : "FAILED",
    digitalRead(LED_D5) == target ? "SUCCESS" : "FAILED",
    digitalRead(LED_D23) == target ? "SUCCESS" : "FAILED"
  };

  sendStatus(deviceIds, states, statuses, 3, actionId);
}

// =========================
// NHẬN LỆNH MQTT
// =========================

void callback(char* topic, byte* payload, unsigned int length) {
  String incoming(topic);

  Serial.print("Received topic: ");
  Serial.println(topic);

  JsonDocument doc;

  DeserializationError error =
    deserializeJson(doc, payload, length);

  if (error) {
    Serial.println("JSON ERROR!");
    return;
  }

  if (!doc["action_id"].is<int>()) {
    Serial.println("Missing or invalid action_id!");
    return;
  }

  int actionId = doc["action_id"].as<int>();
  String action = doc["action"] | "";

  if (action != "ON" && action != "OFF") {
    Serial.println("Invalid action!");
    return;
  }

  Serial.print("Action ID: ");
  Serial.println(actionId);

  Serial.print("Action: ");
  Serial.println(action);

  if (incoming == "device/1/command") {
    controlDevice(LED_D2, 1, action, actionId);
  } else if (incoming == "device/2/command") {
    controlDevice(LED_D5, 2, action, actionId);
  } else if (incoming == "device/3/command") {
    controlDevice(LED_D23, 3, action, actionId);
  } else if (incoming == "device/all/command") {
    controlAllDevices(action, actionId);
  } else if (incoming == "device/random/command") {
    int deviceId = random(1, 4);
    uint8_t pin;

    if (deviceId == 1) {
      pin = LED_D2;
    } else if (deviceId == 2) {
      pin = LED_D5;
    } else {
      pin = LED_D23;
    }

    controlDevice(pin, deviceId, action, actionId);
  }
}

// =========================
// KẾT NỐI LẠI MQTT
// =========================

void reconnectMQTT() {
  static unsigned long lastAttempt = 0;

  if (millis() - lastAttempt < 2000) {
    return;
  }

  lastAttempt = millis();

  if (!mqttClient.connected()) {
    Serial.print("Connecting MQTT...");

    String clientId = "ESP32-";
    clientId += String(random(0xffff), HEX);

    if (
      mqttClient.connect(
        clientId.c_str(),
        MQTT_USERNAME,
        MQTT_PASSWORD
      )
    ) {
      Serial.println("MQTT connected!");

      mqttClient.subscribe(MQTT_TOPIC_CONTROL);

      Serial.println("Subscribed to control topic");
    } else {
      Serial.print("MQTT failed, rc=");
      Serial.println(mqttClient.state());
    }
  }
}

// =========================
// SETUP
// =========================

void setup() {
  Serial.begin(115200);

  randomSeed(micros());

  pinMode(LED_D2, OUTPUT);
  pinMode(LED_D5, OUTPUT);
  pinMode(LED_D23, OUTPUT);

  digitalWrite(LED_D2, LOW);
  digitalWrite(LED_D5, LOW);
  digitalWrite(LED_D23, LOW);

  for (int i = 0; i < 3; i++) {
    pinMode(alertPins[i], OUTPUT);
    digitalWrite(alertPins[i], LOW);
  }

  dht.begin();
  pinMode(LIGHT_PIN, INPUT);

  setupWiFi();

  // Đồng bộ thời gian UTC
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  struct tm timeInfo;
  while (!getLocalTime(&timeInfo)) {
    Serial.println("Dang dong bo thoi gian...");
  }

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(1024);
  mqttClient.setSocketTimeout(1);

  espClient.setConnectionTimeout(1000);

  mqttClient.setCallback(callback);
}

// =========================
// LOOP
// =========================

void loop() {
  tickAlerts();

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long retry = 0;

    if (millis() - retry >= 10000) {
      retry = millis();
      WiFi.reconnect();
    }
  } else {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }

    mqttClient.loop();
  }

  // Vẫn đọc và kiểm tra ngưỡng khi mất Wi-Fi.
  // Bản tin gửi thất bại không được gửi lại.
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    sendSensorData();
  }
}