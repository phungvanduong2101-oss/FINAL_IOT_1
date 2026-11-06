#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =========================
// LED
// =========================
#define LED_D2 2
#define LED_D5 5
#define LED_D23 23

// =========================
// DHT11
// =========================
#define DHTPIN 22
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// =========================
// CẢM BIẾN ÁNH SÁNG
// A0 -> GPIO34
// =========================
#define LIGHT_PIN 34

// =========================
// WIFI
// Điền lại thông tin của m
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

// =========================
// MQTT TOPIC
// =========================
const char* MQTT_TOPIC_CONTROL = "device/+/command";
const char* MQTT_TOPIC_STATUS = "device/status";
const char* MQTT_TOPIC_SENSOR = "sensors/data";

// =========================
// MQTT CLIENT
// =========================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// =========================
// SENSOR TIMER
// =========================
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;

// Gas LEDs are separate from the original device LEDs.
const uint8_t alertPins[3] = { 18, 19, 21 };
int alertIds[3] = { 0, 0, 0 };
bool blinking[3] = { false, false, false }, levels[3] = { false, false, false };
unsigned long blinkTimes[3] = { 0, 0, 0 };
float gasN2 = 78;
int gasCO2 = 850, gasCH4 = 400;
void tickAlerts() {
  unsigned long now = millis();
  for (int i = 0; i < 3; i++)
    if (blinking[i] && now - blinkTimes[i] >= 500) {
      blinkTimes[i] = now;
      levels[i] = !levels[i];
      digitalWrite(alertPins[i], levels[i]);
    }
}
// =====================================================
// KẾT NỐI WIFI
// =====================================================
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

// =====================================================
// GỬI TRẠNG THÁI THIẾT BỊ + ACTION ID
// =====================================================
void sendStatus(
  int deviceIds[],
  const char* states[],
  const char* statuses[],
  int count,
  int actionId) {
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

// =====================================================
// ĐỌC VÀ GỬI DỮ LIỆU CẢM BIẾN
// =====================================================
void sendSensorData() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  int lightValue = analogRead(LIGHT_PIN);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 read error!");
    return;
  }

  JsonDocument doc;

  JsonArray sensors = doc["sensorsData"].to<JsonArray>();

  JsonObject dhtSensor = sensors.add<JsonObject>();
  dhtSensor["sensor_id"] = 1;
  dhtSensor["temperature"] = temperature;
  dhtSensor["humidity"] = humidity;

  JsonObject lightSensor = sensors.add<JsonObject>();
  lightSensor["sensor_id"] = 2;
  lightSensor["light"] = lightValue;

  gasN2 = random(750, 851) / 10.0f;  // 75.0 - 85.0 %
  gasCO2 = random(600, 1401);         // 600 - 1400 ppm
  gasCH4 = random(100, 901);          // 100 - 900 ppm
  doc["n2"] = gasN2;
  doc["co2"] = gasCO2;
  doc["ch4"] = gasCH4;
  char buffer[700];
  serializeJson(doc, buffer, sizeof(buffer));

  mqttClient.publish(MQTT_TOPIC_SENSOR, buffer);

  Serial.print("Sensor data sent: ");
  Serial.println(buffer);
}

// =====================================================
// ĐIỀU KHIỂN MỘT THIẾT BỊ
// =====================================================
void controlDevice(
  uint8_t pin,
  int deviceId,
  const String& action,
  int actionId) {
  if (action != "ON" && action != "OFF") {
    return;
  }

  int target = (action == "ON") ? HIGH : LOW;

  digitalWrite(pin, target);

  int deviceIds[] = { deviceId };

  const char* states[] = {
    action.c_str()
  };

  const char* statuses[] = {
    digitalRead(pin) == target ? "SUCCESS" : "FAILED"
  };

  sendStatus(deviceIds, states, statuses, 1, actionId);
}

// =====================================================
// ĐIỀU KHIỂN TẤT CẢ THIẾT BỊ
// =====================================================
void controlAllDevices(const String& action, int actionId) {
  if (action != "ON" && action != "OFF") {
    return;
  }

  int target = (action == "ON") ? HIGH : LOW;

  digitalWrite(LED_D2, target);
  digitalWrite(LED_D5, target);
  digitalWrite(LED_D23, target);

  int deviceIds[] = { 1, 2, 3 };

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

// =====================================================
// NHẬN LỆNH MQTT
// Payload: {"action_id":123,"action":"ON"}
// =====================================================
void callback(char* topic, byte* payload, unsigned int length) {
  String incoming(topic);
  if (incoming == "alert/config") {
    JsonDocument config;
    if (deserializeJson(config, payload, length) || !config.is<JsonArray>()) return;
    for (int i = 0; i < 3; i++) {
      int newId = 0;
      for (JsonObject item : config.as<JsonArray>())
        if (item["gpio"].as<int>() == alertPins[i] && item["id"].is<int>()) newId = item["id"].as<int>();
      if (newId != alertIds[i]) {
        if (alertIds[i] > 0) mqttClient.unsubscribe(("alert/" + String(alertIds[i]) + "/blink").c_str());
        blinking[i] = false;
        levels[i] = false;
        digitalWrite(alertPins[i], LOW);
        alertIds[i] = newId;
      }
      // Subscribe after mapping arrives so retained blink states are replayed.
      if (newId > 0) mqttClient.subscribe(("alert/" + String(newId) + "/blink").c_str());
    }
    return;
  }
  if (incoming.startsWith("alert/")) {
    if (length != 1 || (payload[0] != '0' && payload[0] != '1')) return;
    for (int i = 0; i < 3; i++)
      if (alertIds[i] > 0 && incoming == "alert/" + String(alertIds[i]) + "/blink") {
        blinking[i] = payload[0] == '1';
        if (!blinking[i]) {
          levels[i] = false;
          digitalWrite(alertPins[i], LOW);
        }
      }
    return;
  }
  Serial.print("Received topic: ");
  Serial.println(topic);

  JsonDocument doc;

  DeserializationError error = deserializeJson(doc, payload, length);

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

  String topicString = String(topic);

  if (topicString == "device/1/command") {
    controlDevice(LED_D2, 1, action, actionId);

  } else if (topicString == "device/2/command") {
    controlDevice(LED_D5, 2, action, actionId);

  } else if (topicString == "device/3/command") {
    controlDevice(LED_D23, 3, action, actionId);

  } else if (topicString == "device/all/command") {
    controlAllDevices(action, actionId);

  } else if (topicString == "device/random/command") {
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

// =====================================================
// KẾT NỐI LẠI MQTT
// =====================================================
void reconnectMQTT() {
  static unsigned long lastAttempt = 0;
  if (millis() - lastAttempt < 2000) return;
  lastAttempt = millis();
  if (!mqttClient.connected()) {
    Serial.print("Connecting MQTT...");

    String clientId = "ESP32-";
    clientId += String(random(0xffff), HEX);

    if (mqttClient.connect(
          clientId.c_str(),
          MQTT_USERNAME,
          MQTT_PASSWORD)) {
      Serial.println("MQTT connected!");

      mqttClient.subscribe(MQTT_TOPIC_CONTROL);
      mqttClient.subscribe("alert/config");
      mqttClient.subscribe("alert/+/blink");

      Serial.print("Subscribed: ");
      Serial.println(MQTT_TOPIC_CONTROL);

    } else {
      Serial.print("MQTT failed, rc=");
      Serial.println(mqttClient.state());

      // Retry on a later loop iteration.
    }
  }
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 3; i++) {
    pinMode(alertPins[i], OUTPUT);
    digitalWrite(alertPins[i], LOW);
  }
  randomSeed(micros());

  pinMode(LED_D2, OUTPUT);
  pinMode(LED_D5, OUTPUT);
  pinMode(LED_D23, OUTPUT);

  digitalWrite(LED_D2, LOW);
  digitalWrite(LED_D5, LOW);
  digitalWrite(LED_D23, LOW);

  dht.begin();

  pinMode(LIGHT_PIN, INPUT);

  setupWiFi();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(1024);
  mqttClient.setSocketTimeout(1);
  espClient.setConnectionTimeout(1000);
  mqttClient.setCallback(callback);
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  tickAlerts();
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long retry = 0;
    if (millis() - retry >= 10000) {
      retry = millis();
      WiFi.reconnect();
    }
    return;
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }

  mqttClient.loop();

  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    sendSensorData();
  }
}