(function () {
    const defaultHost = 'transporter-tc2026.local';

    function cleanMdns(host) {
        return String(host || defaultHost).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.local$/, '') || 'transporter-tc2026';
    }

    function defaultCode(host) {
        const mdns = cleanMdns(host);
        return `/*
 * TECHNOCORNER UGM 2026 - TRANSPORTER OMNI ROBOT
 *
 * Browser tidak compile Arduino langsung.
 * Build firmware .bin dengan Arduino CLI / PlatformIO, flash awal via ESP Web Tools,
 * lalu update berikutnya via OTA .bin ketika firmware ini sudah berjalan.
 *
 * Dashboard:
 * - Telemetry: http://${mdns}.local/data
 * - Serial WiFi log: http://${mdns}.local/serial
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <math.h>

const char* WIFI_SSID = "ISI_DI_FIRMWARE";
const char* WIFI_PASS = "ISI_DI_FIRMWARE";
const char* MDNS_NAME = "${mdns}";

WebServer server(80);

struct PIDController {
  float Kp, Ki, Kd;
  float tau;
  float limMin, limMax;
  float limMinInt, limMaxInt;
  float T;
  float integrator;
  float prevError;
  float differentiator;
  float prevMeasurement;
  float out;
};

void PIDController_Init(PIDController* pid) {
  pid->integrator = 0.0f;
  pid->prevError = 0.0f;
  pid->differentiator = 0.0f;
  pid->prevMeasurement = 0.0f;
  pid->out = 0.0f;
}

float PIDController_Update(PIDController* pid, float setpoint, float measurement) {
  float error = setpoint - measurement;
  float proportional = pid->Kp * error;

  pid->integrator = pid->integrator + 0.5f * pid->Ki * pid->T * (error + pid->prevError);
  pid->integrator = constrain(pid->integrator, pid->limMinInt, pid->limMaxInt);

  pid->differentiator = -(2.0f * pid->Kd * (measurement - pid->prevMeasurement)
    + (2.0f * pid->tau - pid->T) * pid->differentiator)
    / (2.0f * pid->tau + pid->T);

  pid->out = proportional + pid->integrator + pid->differentiator;
  pid->out = constrain(pid->out, pid->limMin, pid->limMax);

  pid->prevError = error;
  pid->prevMeasurement = measurement;
  return pid->out;
}

struct RobotTelemetry {
  int tofFront = 999;
  int tofRight = 999;
  int tofBack = 999;
  int tofLeft = 999;
  long encFL = 0;
  long encFR = 0;
  long encRL = 0;
  long encRR = 0;
  int pwmFL = 0;
  int pwmFR = 0;
  int pwmRL = 0;
  int pwmRR = 0;
  int servo1 = 90;
  int servo2 = 90;
  int servo3 = 90;
  float gyroRad = 0.0f;
  float yawTarget = 0.0f;
  float cmdX = 0.0f;
  float cmdY = 0.0f;
  float cmdTurn = 0.0f;
} robot;

PIDController yawPid;

String serialLog = "";
unsigned long lastControlMs = 0;

float wrapAngle(float a) {
  while (a > PI) a -= TWO_PI;
  while (a < -PI) a += TWO_PI;
  return a;
}

void appendLog(const String& message) {
  Serial.println(message);
  serialLog += String(millis()) + " " + message + "\\n";
  if (serialLog.length() > 4096) serialLog.remove(0, serialLog.length() - 4096);
}

void configurePid() {
  yawPid.Kp = 1.65f;
  yawPid.Ki = 0.00f;
  yawPid.Kd = 0.32f;
  yawPid.tau = 0.04f;
  yawPid.limMin = -0.75f;
  yawPid.limMax = 0.75f;
  yawPid.limMinInt = -1.50f;
  yawPid.limMaxInt = 1.50f;
  yawPid.T = 0.01f;
  PIDController_Init(&yawPid);
}

void omniKinematic(float x, float y, float turn, int& fl, int& fr, int& rl, int& rr) {
  float rawFL = y + x + turn;
  float rawFR = y - x - turn;
  float rawRL = y - x + turn;
  float rawRR = y + x - turn;

  float maxMag = max(max(fabsf(rawFL), fabsf(rawFR)), max(fabsf(rawRL), fabsf(rawRR)));
  if (maxMag < 1.0f) maxMag = 1.0f;

  fl = constrain((int)(rawFL / maxMag * 255.0f), -255, 255);
  fr = constrain((int)(rawFR / maxMag * 255.0f), -255, 255);
  rl = constrain((int)(rawRL / maxMag * 255.0f), -255, 255);
  rr = constrain((int)(rawRR / maxMag * 255.0f), -255, 255);
}

void updateControl() {
  unsigned long now = millis();
  if (now - lastControlMs < 10) return;
  lastControlMs = now;

  float yawError = wrapAngle(robot.yawTarget - robot.gyroRad);
  float yawHold = PIDController_Update(&yawPid, 0.0f, -yawError);
  float turnCmd = constrain(robot.cmdTurn + yawHold, -1.0f, 1.0f);

  omniKinematic(robot.cmdX, robot.cmdY, turnCmd, robot.pwmFL, robot.pwmFR, robot.pwmRL, robot.pwmRR);

  // TODO: ganti dummy encoder/sensor dengan hardware asli.
  robot.encFL += robot.pwmFL / 32;
  robot.encFR += robot.pwmFR / 32;
  robot.encRL += robot.pwmRL / 32;
  robot.encRR += robot.pwmRR / 32;
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleData() {
  sendCors();
  String json = "{";
  json += "\\"mode\\":\\"ESP32 MDNS OTA\\",";
  json += "\\"uptime\\":" + String(millis()) + ",";
  json += "\\"cmd\\":{\\"x\\":" + String(robot.cmdX, 3) + ",\\"y\\":" + String(robot.cmdY, 3) + ",\\"turn\\":" + String(robot.cmdTurn, 3) + "},";
  json += "\\"tof\\":{\\"front\\":" + String(robot.tofFront) + ",\\"right\\":" + String(robot.tofRight) + ",\\"back\\":" + String(robot.tofBack) + ",\\"left\\":" + String(robot.tofLeft) + "},";
  json += "\\"encoder\\":{\\"fl\\":" + String(robot.encFL) + ",\\"fr\\":" + String(robot.encFR) + ",\\"rl\\":" + String(robot.encRL) + ",\\"rr\\":" + String(robot.encRR) + "},";
  json += "\\"pwm\\":{\\"fl\\":" + String(robot.pwmFL) + ",\\"fr\\":" + String(robot.pwmFR) + ",\\"rl\\":" + String(robot.pwmRL) + ",\\"rr\\":" + String(robot.pwmRR) + "},";
  json += "\\"servo\\":[" + String(robot.servo1) + "," + String(robot.servo2) + "," + String(robot.servo3) + "],";
  json += "\\"gyro\\":" + String(robot.gyroRad, 5) + ",";
  json += "\\"pid\\":{\\"target\\":" + String(robot.yawTarget, 5) + ",\\"out\\":" + String(yawPid.out, 4) + "}";
  json += "}";
  server.send(200, "application/json", json);
}

void handleSerialLog() {
  sendCors();
  server.send(200, "text/plain", serialLog);
}

void setup() {
  Serial.begin(115200);
  configurePid();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  appendLog("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  appendLog("IP: " + WiFi.localIP().toString());

  if (MDNS.begin(MDNS_NAME)) {
    MDNS.addService("http", "tcp", 80);
    appendLog("mDNS ready: http://" + String(MDNS_NAME) + ".local");
  }

  ArduinoOTA.setHostname(MDNS_NAME);
  ArduinoOTA.onStart([]() { appendLog("OTA start"); });
  ArduinoOTA.onEnd([]() { appendLog("OTA finished"); });
  ArduinoOTA.onError([](ota_error_t error) { appendLog("OTA error: " + String(error)); });
  ArduinoOTA.begin();

  server.on("/data", HTTP_GET, handleData);
  server.on("/serial", HTTP_GET, handleSerialLog);
  server.on("/data", HTTP_OPTIONS, []() { sendCors(); server.send(204); });
  server.on("/serial", HTTP_OPTIONS, []() { sendCors(); server.send(204); });
  server.begin();
  appendLog("HTTP monitor ready");
}

void loop() {
  ArduinoOTA.handle();
  server.handleClient();
  updateControl();
}
`;
    }

    function getHost() {
        const input = document.getElementById('gen-ota-host');
        return (input && input.value.trim()) || defaultHost;
    }

    function getEditorCode() {
        if (window.editor && typeof window.editor.getValue === 'function') return window.editor.getValue();
        const textarea = document.getElementById('cpp-editor');
        return textarea ? textarea.value : '';
    }

    function setEditorCode(code) {
        if (window.editor && typeof window.editor.setValue === 'function') {
            const current = window.editor.getValue();
            if (!current || current.includes('ESP32 WIFI TETHERING MONITOR ENDPOINT') || current.includes('FIRMWARE SKELETON')) {
                window.editor.setValue(code);
            }
            window.editor.refresh();
            return;
        }
        const textarea = document.getElementById('cpp-editor');
        if (textarea && (!textarea.value || textarea.value.includes('ESP32 WIFI TETHERING MONITOR ENDPOINT'))) textarea.value = code;
    }

    function setStatus(message) {
        const el = document.getElementById('generator-status');
        if (el) el.textContent = message;
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(getEditorCode());
            setStatus('Code copied. Build jadi .bin sebelum flash ke ESP32.');
        } catch (err) {
            setStatus('Clipboard blocked. Select code manual dari editor.');
        }
    }

    async function serialPrep() {
        setStatus(`Serial WiFi log endpoint: http://${cleanMdns(getHost())}.local/serial setelah firmware jalan.`);
    }

    function otaReady() {
        setStatus(`OTA update butuh firmware .bin dan robot aktif di ${cleanMdns(getHost())}.local.`);
    }

    function init() {
        setEditorCode(defaultCode(getHost()));
        document.getElementById('copy-code-btn')?.addEventListener('click', copyCode);
        document.getElementById('serial-prep-btn')?.addEventListener('click', serialPrep);
        document.getElementById('ota-ready-btn')?.addEventListener('click', otaReady);
        document.getElementById('gen-ota-host')?.addEventListener('input', () => {
            setStatus(`mDNS target set to ${cleanMdns(getHost())}.local.`);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
