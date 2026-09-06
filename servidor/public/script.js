const SPEED_LIMIT = 30;

const map = L.map("map").setView([-3.119, -60.021], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let marker = null;
let route = L.polyline([], { weight: 5 }).addTo(map);
let history = [];

const speedEl = document.getElementById("speed");
const maxEl = document.getElementById("maxSpeed");
const pointsEl = document.getElementById("points");
const latEl = document.getElementById("latitude");
const lonEl = document.getElementById("longitude");
const statusEl = document.getElementById("status");
const updatedEl = document.getElementById("updated");
const card = document.getElementById("speedCard");
const speedStatus = document.getElementById("speedStatus");
const mapsLink = document.getElementById("mapsLink");
const distanceEl = document.getElementById("distance");
const avgSpeedEl = document.getElementById("avgSpeed");
const travelTimeEl = document.getElementById("travelTime");

const chart = new Chart(document.getElementById("speedChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Velocidade (km/h)",
        data: [],
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.2
      },
      {
        label: "Limite (30 km/h)",
        data: [],
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [6, 6]
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
});

// Distância entre dois pontos GPS usando a fórmula de Haversine.
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function validGpsHistory() {
  return history.filter(p =>
    Number.isFinite(Number(p.latitude)) &&
    Number.isFinite(Number(p.longitude)) &&
    Number.isFinite(Number(p.speed)) &&
    p.timestamp &&
    !Number.isNaN(new Date(p.timestamp).getTime())
  );
}

function calculateDistance(points) {
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    total += distanceKm(
      Number(previous.latitude),
      Number(previous.longitude),
      Number(current.latitude),
      Number(current.longitude)
    );
  }

  return total;
}

function refreshSummary() {
  const valid = validGpsHistory();

  const speeds = valid.map(p => Number(p.speed));
  const max = speeds.length ? Math.max(...speeds) : 0;

  const distance = calculateDistance(valid);

  let avgSpeed = 0;
  if (valid.length) {
    const start = new Date(valid[0].timestamp).getTime();
    const end = new Date(valid[valid.length - 1].timestamp).getTime();
    const hours = (end - start) / 3600000;

    if (hours > 0) {
      avgSpeed = distance / hours;
    } else {
      // Com apenas um ponto ou intervalo muito curto, usa a velocidade registrada.
      avgSpeed = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
    }
  }

  const travelMs = valid.length > 1
    ? new Date(valid[valid.length - 1].timestamp).getTime() -
      new Date(valid[0].timestamp).getTime()
    : 0;

  maxEl.textContent = max.toFixed(1);
  pointsEl.textContent = valid.length;
  distanceEl.textContent = distance.toFixed(2);
  avgSpeedEl.textContent = avgSpeed.toFixed(1);
  travelTimeEl.textContent = formatDuration(travelMs);
}

function refreshChart() {
  const data = history.slice(-300);

  chart.data.labels = data.map(p =>
    new Date(p.timestamp).toLocaleTimeString("pt-BR")
  );

  chart.data.datasets[0].data = data.map(p => Number(p.speed));
  chart.data.datasets[1].data = data.map(() => SPEED_LIMIT);

  chart.update();
}

function updateMap(data, addToRoute = true) {
  const lat = Number(data.latitude);
  const lon = Number(data.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return;
  }

  const pos = [lat, lon];

  if (!marker) {
    marker = L.marker(pos).addTo(map).bindPopup("Veículo");
    map.setView(pos, 17);
  } else {
    marker.setLatLng(pos);
  }

  if (addToRoute) {
    const currentRoute = route.getLatLngs();
    const lastPoint = currentRoute[currentRoute.length - 1];

    if (
      !lastPoint ||
      lastPoint.lat !== lat ||
      lastPoint.lng !== lon
    ) {
      route.addLatLng(pos);
    }
  }

  const speed = Number(data.speed);

  marker.setPopupContent(
    `<b>Veículo</b><br>` +
    `Velocidade: ${speed.toFixed(1)} km/h<br>` +
    `Latitude: ${lat.toFixed(6)}<br>` +
    `Longitude: ${lon.toFixed(6)}`
  );

  mapsLink.href = `https://www.google.com/maps/@${lat},${lon},17z`;
}

function updatePanel(data, addToRoute = true) {
  if (data.latitude === null) {
    return;
  }

  const speed = Number(data.speed);
  const lat = Number(data.latitude);
  const lon = Number(data.longitude);

  speedEl.textContent = speed.toFixed(1);
  latEl.textContent = lat.toFixed(6);
  lonEl.textContent = lon.toFixed(6);

  if (speed > SPEED_LIMIT) {
    card.classList.add("danger");
    speedStatus.textContent = "⚠ ACIMA DO LIMITE";
    speedStatus.className = "danger-text";
  } else {
    card.classList.remove("danger");
    speedStatus.textContent = "Dentro do limite";
    speedStatus.className = "normal";
  }

  updatedEl.textContent =
    new Date(data.timestamp).toLocaleTimeString("pt-BR");

  updateMap(data, addToRoute);
  refreshSummary();
  refreshChart();
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    history = await response.json();

    if (!Array.isArray(history)) {
      history = [];
    }

    const positions = validGpsHistory().map(p => [
      Number(p.latitude),
      Number(p.longitude)
    ]);

    route.setLatLngs(positions);

    if (history.length) {
      // O último ponto já foi colocado na rota acima.
      updatePanel(history[history.length - 1], false);
    } else {
      refreshSummary();
      refreshChart();
    }
  } catch (e) {
    console.error("Erro ao carregar histórico:", e);
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}`);

  socket.onopen = () => {
    statusEl.textContent = "● ONLINE";
    statusEl.className = "online";
  };

  socket.onmessage = event => {
    try {
      const data = JSON.parse(event.data);

      if (data.latitude === null) {
        return;
      }

      const last = history[history.length - 1];

      if (!last || data.timestamp !== last.timestamp) {
        history.push(data);
      }

      updatePanel(data, true);
    } catch (e) {
      console.error("Erro nos dados:", e);
    }
  };

  socket.onclose = () => {
    statusEl.textContent = "● DESCONECTADO";
    statusEl.className = "offline";
    setTimeout(connect, 2000);
  };

  socket.onerror = () => socket.close();
}

document.getElementById("clearHistory").onclick = async () => {
  if (!confirm("Apagar o histórico salvo no servidor?")) {
    return;
  }

  try {
    const response = await fetch("/api/history", {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    history = [];
    route.setLatLngs([]);

    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }

    speedEl.textContent = "0.0";
    maxEl.textContent = "0.0";
    pointsEl.textContent = "0";
    latEl.textContent = "--";
    lonEl.textContent = "--";
    updatedEl.textContent = "--";
    distanceEl.textContent = "0.00";
    avgSpeedEl.textContent = "0.0";
    travelTimeEl.textContent = "00:00:00";

    mapsLink.href = "#";
    refreshChart();
  } catch (e) {
    console.error("Erro ao limpar histórico:", e);
    alert("Não foi possível limpar o histórico.");
  }
};

loadHistory();
connect();
