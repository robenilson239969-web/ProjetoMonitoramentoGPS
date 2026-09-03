const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Credenciais configuradas no Render → Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "ERRO: SUPABASE_URL e SUPABASE_KEY não foram configuradas."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const EMPTY_DATA = {
  latitude: null,
  longitude: null,
  speed: 0,
  timestamp: null
};

let lastData = { ...EMPTY_DATA };


// ==========================================
// TRANSMISSÃO EM TEMPO REAL
// ==========================================

function transmitir(data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}


// ==========================================
// CARREGAR ÚLTIMO DADO DO SUPABASE
// ==========================================

async function carregarUltimoDado() {
  const { data, error } = await supabase
    .from("gps_data")
    .select("latitude, longitude, speed, timestamp")
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) {
    console.error(
      "Erro ao carregar último GPS:",
      error.message
    );
    return;
  }

  if (data && data.length > 0) {
    lastData = data[0];

    console.log(
      "Último GPS carregado do Supabase:",
      lastData
    );
  } else {
    console.log(
      "Nenhum dado GPS encontrado no Supabase."
    );
  }
}


// ==========================================
// RECEBER DADOS DO ESP32
// ==========================================

app.post("/api/gps", async (req, res) => {

  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const speed = Number(req.body.speed);

  // Validação dos dados
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(speed) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    speed < 0
  ) {

    return res.status(400).json({
      error: "Dados GPS inválidos"
    });

  }

  // Dados que serão armazenados
  const data = {
    latitude,
    longitude,
    speed,
    timestamp: new Date().toISOString()
  };


  // ========================================
  // SALVAR NO SUPABASE
  // ========================================

  const { error } = await supabase
    .from("gps_data")
    .insert([data]);

  if (error) {

    console.error(
      "Erro ao salvar no Supabase:",
      error.message
    );

    return res.status(500).json({
      error: "Erro ao salvar dados GPS",
      details: error.message
    });

  }


  // Atualiza última posição
  lastData = data;


  // Envia para o painel em tempo real
  transmitir(data);


  console.log(
    `${latitude.toFixed(6)}, ` +
    `${longitude.toFixed(6)} | ` +
    `${speed.toFixed(1)} km/h`
  );


  res.json({
    ok: true
  });

});


// ==========================================
// ÚLTIMA POSIÇÃO
// ==========================================

app.get("/api/gps", async (req, res) => {

  if (!lastData.timestamp) {
    await carregarUltimoDado();
  }

  res.json(lastData);

});


// ==========================================
// HISTÓRICO
// ==========================================

app.get("/api/history", async (req, res) => {

  const { data, error } = await supabase
    .from("gps_data")
    .select(
      "latitude, longitude, speed, timestamp"
    )
    .order("timestamp", {
      ascending: true
    })
    .limit(100000);


  if (error) {

    console.error(
      "Erro ao carregar histórico:",
      error.message
    );

    return res.status(500).json({
      error: "Erro ao carregar histórico",
      details: error.message
    });

  }


  res.json(data || []);

});


// ==========================================
// APAGAR HISTÓRICO
// ==========================================

app.delete("/api/history", async (req, res) => {

  const { error } = await supabase
    .from("gps_data")
    .delete()
    .not("id", "is", null);


  if (error) {

    console.error(
      "Erro ao apagar histórico:",
      error.message
    );

    return res.status(500).json({
      error: "Erro ao apagar histórico",
      details: error.message
    });

  }


  lastData = { ...EMPTY_DATA };


  // Atualiza os clientes conectados
  transmitir(lastData);


  res.json({
    ok: true
  });

});


// ==========================================
// WEBSOCKET
// ==========================================

wss.on("connection", socket => {

  console.log("Painel conectado.");

  // Envia imediatamente a última posição
  socket.send(
    JSON.stringify(lastData)
  );

});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

async function iniciar() {

  await carregarUltimoDado();

  server.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log(
        "----------------------------------------"
      );

      console.log(
        "MONITORAMENTO GPS 3.0"
      );

      console.log(
        `Porta: ${PORT}`
      );

      console.log(
        "Banco: Supabase"
      );

      console.log(
        "----------------------------------------"
      );

    }
  );

}


iniciar();