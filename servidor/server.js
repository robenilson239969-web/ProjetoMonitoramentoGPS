const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;
const DATA_DIR = path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "gps-history.json");

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let history = [];
try {
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    if (!Array.isArray(history)) history = [];
  }
} catch (e) {
  console.error("Erro ao carregar histórico:", e.message);
  history = [];
}

let lastData = history.length
  ? history[history.length - 1]
  : { latitude: null, longitude: null, speed: 0, timestamp: null };

function salvarHistorico() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
}

function transmitir(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

app.post("/api/gps", (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const speed = Number(req.body.speed);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !Number.isFinite(speed) || latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180 || speed < 0) {
    return res.status(400).json({ error: "Dados GPS inválidos" });
  }

  const data = {
    latitude,
    longitude,
    speed,
    timestamp: new Date().toISOString()
  };

  lastData = data;
  history.push(data);

  // Limite de segurança do arquivo.
  if (history.length > 100000) history = history.slice(-100000);

  salvarHistorico();
  transmitir(data);

  console.log(
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)} | ${speed.toFixed(1)} km/h`
  );

  res.json({ ok: true });
});

app.get("/api/gps", (req, res) => res.json(lastData));
app.get("/api/history", (req, res) => res.json(history));

app.delete("/api/history", (req, res) => {
  history = [];
  lastData = { latitude: null, longitude: null, speed: 0, timestamp: null };
  salvarHistorico();
  transmitir(lastData);
  res.json({ ok: true });
});

wss.on("connection", socket => {
  console.log("Painel conectado.");
  socket.send(JSON.stringify(lastData));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------------");
  console.log("MONITORAMENTO GPS 2.0");
  console.log(`Painel: http://localhost:${PORT}`);
  console.log(`Porta: ${PORT}`);
  console.log("----------------------------------------");
});
