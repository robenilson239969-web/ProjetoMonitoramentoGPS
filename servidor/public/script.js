const vehicleSelect = document.getElementById("vehicleSelect");
const vehicleStatus = document.getElementById("vehicleStatus");
let selectedVehicle = localStorage.getItem("selectedVehicle") || "VEICULO-01";

async function loadVehicles6() {
  try {
    const r = await fetch("/api/vehicles");
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) return;
    vehicleSelect.innerHTML = "";
    list.forEach(v => {
      const o = document.createElement("option");
      o.value = v.vehicle_id;
      o.textContent = v.vehicle_id;
      vehicleSelect.appendChild(o);
    });
    if (!list.some(v => v.vehicle_id === selectedVehicle)) selectedVehicle = list[0].vehicle_id;
    vehicleSelect.value = selectedVehicle;
  } catch(e) { console.error("Erro ao carregar veículos:", e); }
}

if (vehicleSelect) {
  vehicleSelect.value = selectedVehicle;
  vehicleSelect.addEventListener("change", () => {
    selectedVehicle = vehicleSelect.value;
    localStorage.setItem("selectedVehicle", selectedVehicle);
    location.reload();
  });
}

const SPEED_LIMIT = 30;
const TRIP_GAP_MINUTES = 5;

const map = L.map("map").setView([-3.119, -60.021], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let marker = null;
let route = L.polyline([], { weight: 5 }).addTo(map);
let history = [];
let selectedTripIndex = null; // null = tempo real

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
const tripNumberEl = document.getElementById("tripNumber");
const tripCountEl = document.getElementById("tripCount");
const tripListEl = document.getElementById("tripList");
const viewModeEl = document.getElementById("viewMode");
const liveTripButton = document.getElementById("liveTrip");

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
    scales: { y: { beginAtZero: true } }
  }
});

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
  if (!Number.isFinite(ms) || ms < 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(v => String(v).padStart(2, "0"))
    .join(":");
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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

function splitTrips(points) {
  if (!points.length) return [];

  const trips = [[points[0]]];

  for (let i = 1; i < points.length; i++) {
    const previous = new Date(points[i - 1].timestamp).getTime();
    const current = new Date(points[i].timestamp).getTime();
    const gapMinutes = (current - previous) / 60000;

    if (gapMinutes > TRIP_GAP_MINUTES) {
      trips.push([]);
    }

    trips[trips.length - 1].push(points[i]);
  }

  return trips;
}

function calculateDistance(points) {
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    total += distanceKm(
      Number(points[i - 1].latitude),
      Number(points[i - 1].longitude),
      Number(points[i].latitude),
      Number(points[i].longitude)
    );
  }

  return total;
}

function getTrips() {
  return splitTrips(validGpsHistory());
}

function getCurrentTrip() {
  const trips = getTrips();
  return trips.length ? trips[trips.length - 1] : [];
}

function getSelectedTrip() {
  const trips = getTrips();

  if (!trips.length) return [];

  if (selectedTripIndex === null) {
    return trips[trips.length - 1];
  }

  return trips[selectedTripIndex] || trips[trips.length - 1];
}

function tripStats(trip) {
  if (!trip.length) {
    return {
      distance: 0,
      average: 0,
      max: 0,
      duration: 0
    };
  }

  const speeds = trip.map(p => Number(p.speed));
  const max = Math.max(...speeds);

  const start = new Date(trip[0].timestamp).getTime();
  const end = new Date(trip[trip.length - 1].timestamp).getTime();
  const duration = Math.max(0, end - start);
  const hours = duration / 3600000;
  const distance = calculateDistance(trip);

  let average = 0;
  if (hours > 0) {
    average = distance / hours;
  } else {
    average = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
  }

  return { distance, average, max, duration };
}

function updateTripIndicators() {
  const trips = getTrips();
  tripCountEl.textContent = trips.length;

  if (!trips.length) {
    tripNumberEl.textContent = "0";
    pointsEl.textContent = "0";
    distanceEl.textContent = "0.00";
    avgSpeedEl.textContent = "0.0";
    travelTimeEl.textContent = "00:00:00";
    maxEl.textContent = "0.0";
    return;
  }

  const actualIndex = selectedTripIndex === null
    ? trips.length - 1
    : Math.min(selectedTripIndex, trips.length - 1);

  const trip = trips[actualIndex];
  const stats = tripStats(trip);

  tripNumberEl.textContent = actualIndex + 1;
  pointsEl.textContent = trip.length;
  distanceEl.textContent = stats.distance.toFixed(2);
  avgSpeedEl.textContent = stats.average.toFixed(1);
  travelTimeEl.textContent = formatDuration(stats.duration);
  maxEl.textContent = stats.max.toFixed(1);

  viewModeEl.textContent = selectedTripIndex === null
    ? "Exibindo viagem atual em tempo real"
    : `Visualizando viagem #${actualIndex + 1}`;

  liveTripButton.style.display = selectedTripIndex === null ? "none" : "block";
}

function refreshChart(trip = getSelectedTrip()) {
  const data = trip.slice(-300);

  chart.data.labels = data.map(p =>
    new Date(p.timestamp).toLocaleTimeString("pt-BR")
  );

  chart.data.datasets[0].data = data.map(p => Number(p.speed));
  chart.data.datasets[1].data = data.map(() => SPEED_LIMIT);

  chart.update();
}

function drawTripRoute(trip, fit = true) {
  const positions = trip.map(p => [
    Number(p.latitude),
    Number(p.longitude)
  ]);

  route.setLatLngs(positions);

  if (fit && positions.length > 0) {
    if (positions.length === 1) {
      map.setView(positions[0], 17);
    } else {
      map.fitBounds(route.getBounds(), { padding: [25, 25] });
    }
  }
}

function updateMapMarker(data) {
  const lat = Number(data.latitude);
  const lon = Number(data.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const pos = [lat, lon];

  if (!marker) {
    marker = L.marker(pos).addTo(map);
  } else {
    marker.setLatLng(pos);
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

function updateLivePanel(data) {
  if (data.latitude === null) return;

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

  updateMapMarker(data);

  if (selectedTripIndex === null) {
    drawTripRoute(getCurrentTrip(), false);
    updateTripIndicators();
    refreshChart();
  }
}

function renderTripList() {
  const trips = getTrips();
  tripListEl.innerHTML = "";

  if (!trips.length) {
    tripListEl.innerHTML =
      `<div class="empty-trips">Nenhuma viagem registrada ainda.</div>`;
    return;
  }

  for (let i = trips.length - 1; i >= 0; i--) {
    const trip = trips[i];
    const stats = tripStats(trip);
    const first = trip[0];
    const last = trip[trip.length - 1];

    const item = document.createElement("button");
    item.className =
      "trip-item" +
      (selectedTripIndex === i ? " selected" : "");

    item.innerHTML = `
      <div class="trip-main">
        <strong>Viagem #${i + 1}</strong>
        <span>${formatDate(first.timestamp)}</span>
      </div>
      <div class="trip-details">
        <span>${stats.distance.toFixed(2)} km</span>
        <span>${formatDuration(stats.duration)}</span>
        <span>Máx. ${stats.max.toFixed(1)} km/h</span>
      </div>
      <div class="trip-period">
        ${formatDateTime(first.timestamp)} → ${formatDateTime(last.timestamp)}
      </div>
    `;

    item.addEventListener("click", () => selectTrip(i));
    tripListEl.appendChild(item);
  }
}

function selectTrip(index) {
  const trips = getTrips();
  if (!trips[index]) return;

  selectedTripIndex = index;

  const trip = trips[index];
  drawTripRoute(trip, true);
  updateTripIndicators();
  refreshChart(trip);
  renderTripList();

  // O marcador continua mostrando a posição atual do veículo.
  // O mapa mostra a rota histórica selecionada.
}

function showLiveTrip() {
  selectedTripIndex = null;

  const currentTrip = getCurrentTrip();

  if (currentTrip.length) {
    drawTripRoute(currentTrip, true);
  }

  updateTripIndicators();
  refreshChart(currentTrip);
  renderTripList();

  if (history.length) {
    updateMapMarker(history[history.length - 1]);
  }
}

async function loadHistory() {
  try {
    const response = await fetch(`/api/history?vehicle_id=${encodeURIComponent(selectedVehicle)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    history = await response.json();

    if (!Array.isArray(history)) {
      history = [];
    }

    selectedTripIndex = null;

    const currentTrip = getCurrentTrip();

    if (currentTrip.length) {
      drawTripRoute(currentTrip, true);
      updateLivePanel(currentTrip[currentTrip.length - 1]);
    } else {
      updateTripIndicators();
      refreshChart([]);
      renderTripList();
    }

    renderTripList();
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

      if (data.latitude === null) return;

      const last = history[history.length - 1];

      if (!last || data.timestamp !== last.timestamp) {
        history.push(data);
      }

      updateLivePanel(data);

      // Se estiver no histórico, apenas atualizamos a lista.
      // O usuário continua visualizando a viagem escolhida.
      if (selectedTripIndex !== null) {
        renderTripList();
        updateTripIndicators();
      }
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

liveTripButton.addEventListener("click", showLiveTrip);

document.getElementById("clearHistory").onclick = async () => {
  if (!confirm("Apagar todo o histórico salvo no servidor?")) return;

  try {
    const response = await fetch("/api/history", { method: "DELETE" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    history = [];
    selectedTripIndex = null;
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
    tripNumberEl.textContent = "0";
    tripCountEl.textContent = "0";
    viewModeEl.textContent = "Exibindo viagem atual";
    mapsLink.href = "#";

    refreshChart([]);
    renderTripList();
  } catch (e) {
    console.error("Erro ao limpar histórico:", e);
    alert("Não foi possível limpar o histórico.");
  }
};

loadVehicles6().then(() => loadHistory());
connect();
