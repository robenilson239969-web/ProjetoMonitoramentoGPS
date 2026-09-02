#define BLYNK_TEMPLATE_ID "TMPL2yRBpEL5V"
#define BLYNK_TEMPLATE_NAME "VelocidadePex"
#define BLYNK_AUTH_TOKEN "SEU_TOKEN_BLYNK"
#define BLYNK_PRINT Serial

#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <BlynkSimpleEsp32.h>
#include <TinyGPS++.h>
#include <U8g2lib.h>
#include <Wire.h>

char auth[] = BLYNK_AUTH_TOKEN;
char ssid[] = "SEU_WIFI";
char pass[] = "SUA_SENHA";

// IP do computador onde o Node.js está rodando.
const char* serverURL = "http://192.168.1.100:3000/api/gps";

#define RXD2 16
#define TXD2 17
#define INTERVAL 1000L
#define SPEED_LIMIT 30.0

HardwareSerial neogps(2);
TinyGPSPlus gps;

U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(
  U8G2_R0, U8X8_PIN_NONE
);

BlynkTimer timer;

void enviarAlerta(String mensagem, float latitude, float longitude, float speed)
{
  String linkMaps = "https://www.google.com/maps/@" +
                    String(latitude, 6) + "," +
                    String(longitude, 6) + ",17z";

  String mensagemCompleta =
    mensagem +
    "\nVelocidade: " + String(speed, 1) + " km/h" +
    "\n\n" + linkMaps;

  Blynk.logEvent("alerta", mensagemCompleta);
}

void enviarParaServidor(float latitude, float longitude, float speed)
{
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado.");
    return;
  }

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"latitude\":" + String(latitude, 6) + ",";
  json += "\"longitude\":" + String(longitude, 6) + ",";
  json += "\"speed\":" + String(speed, 1);
  json += "}";

  int httpCode = http.POST(json);

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.print("Erro HTTP: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

void enviarDadosDisplayEBlynk()
{
  if (!gps.location.isValid()) {
    Serial.println("Aguardando sinal válido do GPS...");
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_ncenB08_tr);
    u8g2.drawStr(20, 35, "Sem Sinal GPS");
    u8g2.sendBuffer();
    return;
  }

  float latitude = gps.location.lat();
  float longitude = gps.location.lng();
  float speed = gps.speed.kmph();

  Serial.print("Lat: ");
  Serial.println(latitude, 6);
  Serial.print("Lon: ");
  Serial.println(longitude, 6);
  Serial.print("Vel: ");
  Serial.println(speed, 1);

  char speedStr[10];
  dtostrf(speed, 4, 1, speedStr);

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(20, 30, "Velocidade:");
  u8g2.drawStr(50, 50, speedStr);
  u8g2.sendBuffer();

  Blynk.virtualWrite(V1, String(latitude, 6));
  Blynk.virtualWrite(V2, String(longitude, 6));
  Blynk.virtualWrite(V0, String(speed, 1));

  enviarParaServidor(latitude, longitude, speed);

  if (speed > SPEED_LIMIT) {
    enviarAlerta(
      "Direcao Perigosa! O motorista esta acima da velocidade permitida.",
      latitude,
      longitude,
      speed
    );
  }
}

void setup()
{
  Serial.begin(115200);

  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0, 10, "Conectando WiFi...");
  u8g2.sendBuffer();

  Blynk.begin(auth, ssid, pass);

  neogps.begin(9600, SERIAL_8N1, RXD2, TXD2);

  Serial.println("GPS inicializado.");
  Serial.print("IP do ESP32: ");
  Serial.println(WiFi.localIP());

  timer.setInterval(INTERVAL, enviarDadosDisplayEBlynk);
}

void loop()
{
  Blynk.run();
  timer.run();

  while (neogps.available() > 0) {
    gps.encode(neogps.read());
  }
}
