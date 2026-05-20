/*
  SmartFarmESP32.ino — ESP32 Firmware สำหรับ Smart Farm Monitor Dashboard
  Version: 1.5  Compatible with Dashboard v1.5+

  ── Libraries ที่ต้องติดตั้งผ่าน Arduino Library Manager ──
  [ Required — ติดตั้งเสมอ ]
    1. ArduinoJson          by bblanchon      (>= 6.x)
    2. DHT sensor library   by Adafruit
    3. Adafruit Unified Sensor by Adafruit
    4. OneWire              by Paul Stoffregen
    5. DallasTemperature    by Miles Burton
    6. WebSockets           by Links2004      (>= 2.x)
    7. ESPAsyncWebServer    by ESP Async Web Server
    8. AsyncTCP             by ESP Async Web Server

  [ Optional — ติดตั้งเฉพาะเมื่อ #define USE_xxx เปิดไว้ ]
    9. Adafruit BME280      by Adafruit          (สำหรับ USE_BME280)
   10. BH1750               by Christopher Laws  (สำหรับ USE_BH1750)

  ── Board ──
    Arduino IDE: "ESP32 Dev Module" (or your specific board)
    Upload Speed: 921600

  ── JSON ที่ส่งออก (ทุก 3 วินาที + เมื่อรับ command) ──
    {
      "soil1": 55.2,   "soil2": 61.8,
      "temp":  29.4,   "humid": 65.1,  "stemp": 26.3,
      "valve1": false, "valve2": false, "valve3": false, "valve4": false,
      "rssi": -62,     "voltage": 4.98,
      // Optional fields (ปรากฏเมื่อ USE_xxx เปิดไว้):
      "light": 25000,  "pressure": 1013.2,
      "rain": 10.5,    "waterLevel": 80.0,  "flow": 1.5
    }

  ── JSON Command ที่รับได้ (WebSocket + REST POST /valve) ──
    { "cmd": "valve", "valve": 1, "state": true }

  ── Endpoints ──
    GET  http://<IP>/sensors   — อ่านค่าเซนเซอร์ทั้งหมด (JSON)
    POST http://<IP>/valve     — สั่งเปิด/ปิดวาล์ว
    WS   ws://<IP>:81          — WebSocket real-time (port 81)
*/

// ─────────────────────────────────────────
//  CONFIGURATION — แก้ไขค่าเหล่านี้ก่อน flash
// ─────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// GPIO Pins — Built-in sensors
#define PIN_SOIL1    34   // Analog: ความชื้นดิน Zone 1 (ADC 0–3.3V)
#define PIN_SOIL2    35   // Analog: ความชื้นดิน Zone 2
#define PIN_DHT      4    // Digital: DHT22
#define PIN_DS18B20  5    // Digital: DS18B20 (OneWire bus)
#define PIN_RELAY1   26   // Relay วาล์ว 1
#define PIN_RELAY2   27   // Relay วาล์ว 2
#define PIN_RELAY3   14   // Relay วาล์ว 3
#define PIN_RELAY4   12   // Relay วาล์ว 4

// ถ้า Relay module เป็น Active-LOW (กดตรงข้าม)
#define RELAY_ON   LOW
#define RELAY_OFF  HIGH

// Sensor calibration — ปรับตามเซนเซอร์จริง
#define SOIL_ADC_DRY  2800   // ADC reading เมื่อดินแห้งสนิท
#define SOIL_ADC_WET   800   // ADC reading เมื่อดินชุ่มสนิท

// อ่านค่าทุกกี่มิลลิวินาที
#define READ_INTERVAL_MS  3000

// ─────────────────────────────────────────
//  OPTIONAL SENSORS — ปิด // เพื่อเปิดใช้งาน
//  ต้องติดตั้ง Library ตามที่ระบุด้วย
// ─────────────────────────────────────────

// #define USE_BME280         // Adafruit BME280 Lib — อุณหภูมิ+ความชื้น+ความดัน (I2C แทน/เสริม DHT22)
// #define USE_BH1750         // BH1750 Lib — ความเข้มแสง (I2C)
// #define USE_RAIN_SENSOR    // ไม่ต้องการ Lib เพิ่ม — Rain Sensor (Analog)
// #define USE_ULTRASONIC     // ไม่ต้องการ Lib เพิ่ม — HC-SR04 วัดระดับน้ำในถัง (Trigger/Echo)
// #define USE_FLOW_METER     // ไม่ต้องการ Lib เพิ่ม — YF-S201 วัดอัตราไหล (Pulse interrupt)

// GPIO สำหรับ Optional Sensors — เปลี่ยน pin ตามวงจรของคุณ
#define PIN_RAIN     32   // Analog: Rain sensor AO
#define PIN_TRIG     18   // HC-SR04 Trigger
#define PIN_ECHO     19   // HC-SR04 Echo
#define PIN_FLOW     23   // YF-S201 signal (interrupt-capable)

#define TANK_HEIGHT_CM  100   // ความสูงถัง (cm) — ปรับตามถังจริง

// I2C pins สำหรับ BME280 / BH1750 (ESP32 default: SDA=21, SCL=22)
// ไม่ต้องเปลี่ยนถ้าใช้ I2C default

// ─────────────────────────────────────────
//  LIBRARIES
// ─────────────────────────────────────────
#include <WiFi.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WebSocketsServer.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

// Optional sensor libraries — คอมไพล์เฉพาะเมื่อ #define เปิดไว้
#ifdef USE_BME280
  #include <Wire.h>
  #include <Adafruit_Sensor.h>
  #include <Adafruit_BME280.h>
#endif
#ifdef USE_BH1750
  #include <Wire.h>
  #include <BH1750.h>
#endif

// ─────────────────────────────────────────
//  OBJECTS
// ─────────────────────────────────────────
DHT                dht(PIN_DHT, DHT22);
OneWire            oneWire(PIN_DS18B20);
DallasTemperature  ds18b20(&oneWire);
WebSocketsServer   wsServer(81);
AsyncWebServer     httpServer(80);

#ifdef USE_BME280
  Adafruit_BME280 bme;
  bool bmeOk = false;
#endif
#ifdef USE_BH1750
  BH1750 lightMeter;
#endif

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
const int RELAY_PINS[4] = { PIN_RELAY1, PIN_RELAY2, PIN_RELAY3, PIN_RELAY4 };
bool      valveState[4]    = { false, false, false, false };
bool      manualOverride[4] = { false, false, false, false };  // true = Dashboard ล็อก Manual

float soil1 = 0, soil2 = 0;
float airTemp = 0, airHumid = 0, soilTemp = 0;

// Optional sensor values
#ifdef USE_BME280
  float pressure = 1013.0;
#endif
#ifdef USE_BH1750
  float lightLux = 0;
#endif
#ifdef USE_RAIN_SENSOR
  float rainPct = 0;
#endif
#ifdef USE_ULTRASONIC
  float waterLevel = -1;
#endif
#ifdef USE_FLOW_METER
  volatile uint32_t _flowPulses = 0;
  float flowLPM = 0;
  void IRAM_ATTR _flowISR() { _flowPulses++; }
#endif

// Auto-irrigation thresholds — อัปเดตได้ผ่าน Dashboard หรือ POST /thresholds
float threshSoilDry = 30.0;  // % เปิดวาล์วเมื่อความชื้นต่ำกว่านี้
float threshSoilWet = 70.0;  // % ปิดวาล์วเมื่อความชื้นสูงกว่านี้

unsigned long lastReadMs = 0;

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────

// แปลง ADC เป็นเปอร์เซ็นต์ความชื้น
float soilPercent(int pin) {
  int raw = analogRead(pin);
  raw = constrain(raw, SOIL_ADC_WET, SOIL_ADC_DRY);
  return (float)map(raw, SOIL_ADC_DRY, SOIL_ADC_WET, 0, 100);
}

// สร้าง JSON payload สำหรับส่งออก
String buildJson() {
  StaticJsonDocument<640> doc;

  doc["soil1"]  = roundf(soil1  * 10) / 10.0f;
  doc["soil2"]  = roundf(soil2  * 10) / 10.0f;
  doc["temp"]   = roundf(airTemp  * 10) / 10.0f;
  doc["humid"]  = roundf(airHumid * 10) / 10.0f;
  doc["stemp"]  = roundf(soilTemp * 10) / 10.0f;
  doc["valve1"] = valveState[0];
  doc["valve2"] = valveState[1];
  doc["valve3"] = valveState[2];
  doc["valve4"] = valveState[3];
  doc["rssi"]   = (int)WiFi.RSSI();

  // อ่านแรงดัน (ต้องต่อ voltage divider ถ้าต้องการค่าจริง)
  // float vcc = (analogRead(36) / 4095.0f) * 3.3f * 2.0f;  // R1=R2=10kΩ
  doc["voltage"] = 5.0;

  // Auto-irrigation state — Dashboard ใช้ sync
  doc["threshDry"]  = threshSoilDry;
  doc["threshWet"]  = threshSoilWet;
  doc["manual1"]    = manualOverride[0];
  doc["manual2"]    = manualOverride[1];

  // ── Optional sensor fields ──
  #ifdef USE_BME280
    doc["pressure"] = roundf(pressure * 10) / 10.0f;
  #endif
  #ifdef USE_BH1750
    doc["light"] = (int)lightLux;
  #endif
  #ifdef USE_RAIN_SENSOR
    doc["rain"] = roundf(rainPct * 10) / 10.0f;
  #endif
  #ifdef USE_ULTRASONIC
    if (waterLevel >= 0) doc["waterLevel"] = roundf(waterLevel * 10) / 10.0f;
  #endif
  #ifdef USE_FLOW_METER
    doc["flow"] = roundf(flowLPM * 100) / 100.0f;
  #endif

  String out;
  serializeJson(doc, out);
  return out;
}

// เปิด/ปิดวาล์ว และอัปเดต state
void setValve(int idx, bool on) {
  if (idx < 0 || idx >= 4) return;
  valveState[idx] = on;
  digitalWrite(RELAY_PINS[idx], on ? RELAY_ON : RELAY_OFF);
  Serial.printf("Valve %d: %s\n", idx + 1, on ? "ON" : "OFF");
}

// แปลง JSON command → setValve / thresholds / auto-reset
void handleValveCommand(const uint8_t* payload, size_t len) {
  StaticJsonDocument<192> cmd;
  if (deserializeJson(cmd, payload, len) != DeserializationError::Ok) return;

  const char* command = cmd["cmd"] | "valve";

  if (strcmp(command, "valve") == 0) {
    if (!cmd.containsKey("valve") || !cmd.containsKey("state")) return;
    int  idx = (int)cmd["valve"] - 1;
    bool on  = (bool)cmd["state"];
    if (idx < 0 || idx >= 4) return;
    manualOverride[idx] = true;   // Dashboard manual → lock auto
    setValve(idx, on);

  } else if (strcmp(command, "auto") == 0) {
    // Dashboard กด "คืนค่า Auto" → ปลดล็อค manualOverride
    if (!cmd.containsKey("valve")) return;
    int idx = (int)cmd["valve"] - 1;
    if (idx < 0 || idx >= 4) return;
    manualOverride[idx] = false;
    Serial.printf("Valve %d: Auto mode restored\n", idx + 1);

  } else if (strcmp(command, "thresholds") == 0) {
    // Dashboard sync ค่า threshold มาให้ ESP32
    if (cmd.containsKey("soilDry")) threshSoilDry = (float)cmd["soilDry"];
    if (cmd.containsKey("soilWet")) threshSoilWet = (float)cmd["soilWet"];
    Serial.printf("Thresholds: dry=%.1f%% wet=%.1f%%\n", threshSoilDry, threshSoilWet);
  }

  wsServer.broadcastTXT(buildJson());
}

// ─────────────────────────────────────────
//  WEBSOCKET HANDLER
// ─────────────────────────────────────────
void onWsEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("WS Client #%u connected\n", clientNum);
      wsServer.sendTXT(clientNum, buildJson());  // ส่งค่าปัจจุบันทันที
      break;

    case WStype_TEXT:
      handleValveCommand(payload, length);
      break;

    case WStype_DISCONNECTED:
      Serial.printf("WS Client #%u disconnected\n", clientNum);
      break;

    default: break;
  }
}

// ─────────────────────────────────────────
//  AUTO-IRRIGATION (ESP32 side — ทำงานแม้ไม่มี Browser เปิดอยู่)
// ─────────────────────────────────────────
void autoIrrigate() {
  // Zone 1 — วาล์ว 1 (ข้ามถ้า Dashboard ล็อก Manual)
  if (!manualOverride[0]) {
    if (soil1 < threshSoilDry && !valveState[0]) {
      setValve(0, true);
      Serial.printf("Auto: Valve 1 ON  (soil=%.1f%% < dry=%.1f%%)\n", soil1, threshSoilDry);
    } else if (soil1 > threshSoilWet && valveState[0]) {
      setValve(0, false);
      Serial.printf("Auto: Valve 1 OFF (soil=%.1f%% > wet=%.1f%%)\n", soil1, threshSoilWet);
    }
  }
  // Zone 2 — วาล์ว 2
  if (!manualOverride[1]) {
    if (soil2 < threshSoilDry && !valveState[1]) {
      setValve(1, true);
      Serial.printf("Auto: Valve 2 ON  (soil=%.1f%% < dry=%.1f%%)\n", soil2, threshSoilDry);
    } else if (soil2 > threshSoilWet && valveState[1]) {
      setValve(1, false);
      Serial.printf("Auto: Valve 2 OFF (soil=%.1f%% > wet=%.1f%%)\n", soil2, threshSoilWet);
    }
  }
}

// ─────────────────────────────────────────
//  READ SENSORS
// ─────────────────────────────────────────
void readSensors() {
  // ── Built-in sensors ──
  soil1    = soilPercent(PIN_SOIL1);
  soil2    = soilPercent(PIN_SOIL2);

  #ifdef USE_BME280
    if (bmeOk) {
      airTemp  = bme.readTemperature();
      airHumid = bme.readHumidity();
      pressure = bme.readPressure() / 100.0f;
    }
  #else
    airTemp  = dht.readTemperature();
    airHumid = dht.readHumidity();
  #endif

  ds18b20.requestTemperatures();
  soilTemp = ds18b20.getTempCByIndex(0);

  // ตรวจสอบค่าผิดปกติ
  if (isnan(airTemp)  || airTemp  < -40 || airTemp  > 125) airTemp  = -1;
  if (isnan(airHumid) || airHumid < 0   || airHumid > 100) airHumid = -1;
  if (soilTemp == DEVICE_DISCONNECTED_C)                    soilTemp = -1;

  // ── Optional sensors ──
  #ifdef USE_BH1750
    lightLux = lightMeter.readLightLevel();
  #endif

  #ifdef USE_RAIN_SENSOR
    int rainRaw = analogRead(PIN_RAIN);
    rainPct = 100.0f - ((float)rainRaw / 4095.0f * 100.0f);
    rainPct = constrain(rainPct, 0, 100);
  #endif

  #ifdef USE_ULTRASONIC
    digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);
    long dur = pulseIn(PIN_ECHO, HIGH, 30000UL);
    if (dur > 0) {
      float distCm = dur * 0.01715f;  // speed of sound / 2
      waterLevel   = constrain(100.0f - (distCm / TANK_HEIGHT_CM * 100.0f), 0, 100);
    }
  #endif

  #ifdef USE_FLOW_METER
    noInterrupts();
    uint32_t pulses = _flowPulses;
    _flowPulses = 0;
    interrupts();
    flowLPM = (pulses / 7.5f) * (60000.0f / READ_INTERVAL_MS);
  #endif
}

// ─────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n\nSmart Farm ESP32 starting...");

  // ── Relay pins (default OFF) ──
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
  }

  // ── Sensors ──
  analogSetAttenuation(ADC_11db);  // รองรับ 0–3.3V input

  #ifndef USE_BME280
    dht.begin();
  #endif
  ds18b20.begin();

  // ── Optional sensors ──
  #ifdef USE_BME280
    Wire.begin();
    bmeOk = bme.begin(0x76);  // ลอง 0x77 ถ้า 0x76 ไม่ตอบสนอง
    if (!bmeOk) { Serial.println("BME280 not found! Check wiring / address."); }
    else        { Serial.println("BME280 OK"); }
  #endif
  #ifdef USE_BH1750
    Wire.begin();
    lightMeter.begin();
    Serial.println("BH1750 OK");
  #endif
  #ifdef USE_RAIN_SENSOR
    pinMode(PIN_RAIN, INPUT);
    Serial.println("Rain Sensor OK (Analog)");
  #endif
  #ifdef USE_ULTRASONIC
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    Serial.println("HC-SR04 OK");
  #endif
  #ifdef USE_FLOW_METER
    pinMode(PIN_FLOW, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW), _flowISR, RISING);
    Serial.println("Flow Meter OK (YF-S201)");
  #endif

  // ── WiFi ──
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.println("Connected! IP: " + WiFi.localIP().toString());

  // ── REST: GET /sensors ──
  httpServer.on("/sensors", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->send(200, "application/json", buildJson());
  });

  // ── REST: POST /valve ──
  httpServer.on("/valve", HTTP_POST,
    [](AsyncWebServerRequest* req) {},
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
      handleValveCommand(data, len);
      req->send(200, "application/json", buildJson());
    }
  );

  // ── REST: OPTIONS /valve (CORS preflight) ──
  httpServer.on("/valve", HTTP_OPTIONS, [](AsyncWebServerRequest* req) {
    req->send(204);
  });

  // ── REST: POST /thresholds — sync threshold จาก Dashboard ──
  httpServer.on("/thresholds", HTTP_POST,
    [](AsyncWebServerRequest* req) {},
    nullptr,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
      handleValveCommand(data, len);
      req->send(200, "application/json", buildJson());
    }
  );
  httpServer.on("/thresholds", HTTP_OPTIONS, [](AsyncWebServerRequest* req) { req->send(204); });

  // ── CORS Headers (ให้ Browser เรียกได้โดยตรง) ──
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin",  "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

  httpServer.begin();

  // ── WebSocket (port 81) ──
  wsServer.begin();
  wsServer.onEvent(onWsEvent);

  // อ่านค่าครั้งแรก
  readSensors();

  Serial.println("─────────────────────────────────");
  Serial.println("REST:      http://" + WiFi.localIP().toString() + "/sensors");
  Serial.println("WebSocket: ws://"   + WiFi.localIP().toString() + ":81");
  Serial.println("─────────────────────────────────");
  Serial.println("Paste the URL above into Dashboard → การเชื่อมต่ออุปกรณ์");
}

// ─────────────────────────────────────────
//  LOOP
// ─────────────────────────────────────────
void loop() {
  wsServer.loop();

  if (millis() - lastReadMs >= READ_INTERVAL_MS) {
    lastReadMs = millis();
    readSensors();
    autoIrrigate();   // ทำงานแม้ไม่มี Dashboard เปิดอยู่

    String json = buildJson();
    wsServer.broadcastTXT(json);  // push ไปยัง Dashboard
    Serial.println(json);
  }
}

// ─────────────────────────────────────────
//  CUSTOM SENSOR EXTENSIONS
//  เพิ่ม sensor พิเศษที่ไม่มี #define — ใส่ใน buildJson() ด้วย
// ─────────────────────────────────────────

/*
// ── pH Probe (Analog — เช่น DFRobot pH v2) ──
#define PH_PIN      33
#define OFFSET_PH   0.0f   // ปรับด้วย pH 7.0 buffer solution
float readPH() {
  float voltage = analogRead(PH_PIN) * (3.3f / 4095.0f);
  return 3.5f * voltage + OFFSET_PH;
}

// ── EC / TDS Probe (Analog) ──
#define EC_PIN      33
#define EC_SCALE    2.0f   // ปรับตาม probe datasheet
float readEC() {
  float voltage = analogRead(EC_PIN) * (3.3f / 4095.0f);
  return voltage * EC_SCALE;
}

// ── MH-Z19B CO₂ (UART) ──
// #include <MHZ19.h>
// MHZ19 mhz19;
// void setupMHZ19() { mhz19.begin(Serial2); mhz19.autoCalibration(); }
// float readCO2() { return mhz19.getCO2(); }

// ── SHT30 / SHT31 Temp+Humid (I2C — แทน DHT22 แม่นยำกว่า) ──
// #include <SHT31.h>
// SHT31 sht31;
// void setupSHT31() { Wire.begin(); sht31.begin(0x44); }
// เรียก sht31.read() แล้วอ่านด้วย sht31.getTemperature() / sht31.getHumidity()

// ── AHT20 / AHT21 Temp+Humid (I2C — ราคาถูก หาง่าย) ──
// #include <AHT20.h>
// AHT20 aht20;
// void setupAHT20() { Wire.begin(); aht20.begin(); }
*/
