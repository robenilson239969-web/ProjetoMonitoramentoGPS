const SPEED_LIMIT = 30;

const map = L.map("map").setView([-3.119, -60.021], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom:19, attribution:"&copy; OpenStreetMap contributors"
}).addTo(map);

let marker = null;
let route = L.polyline([], {weight:5}).addTo(map);
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

const chart = new Chart(document.getElementById("speedChart"), {
  type:"line",
  data:{
    labels:[],
    datasets:[
      {label:"Velocidade (km/h)",data:[],borderWidth:2,pointRadius:1,tension:.2},
      {label:"Limite (30 km/h)",data:[],borderWidth:1,pointRadius:0,borderDash:[6,6]}
    ]
  },
  options:{
    responsive:true,maintainAspectRatio:false,animation:false,
    scales:{y:{beginAtZero:true}}
  }
});

function refreshSummary(){
  const valid=history.filter(p=>Number.isFinite(Number(p.speed)));
  const max=valid.length?Math.max(...valid.map(p=>Number(p.speed))):0;
  maxEl.textContent=max.toFixed(1);
  pointsEl.textContent=valid.length;
}

function refreshChart(){
  const data=history.slice(-300);
  chart.data.labels=data.map(p=>new Date(p.timestamp).toLocaleTimeString("pt-BR"));
  chart.data.datasets[0].data=data.map(p=>Number(p.speed));
  chart.data.datasets[1].data=data.map(()=>SPEED_LIMIT);
  chart.update();
}

function updateMap(data){
  const lat=Number(data.latitude), lon=Number(data.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;
  const pos=[lat,lon];

  if(!marker){
    marker=L.marker(pos).addTo(map).bindPopup("Veículo");
    map.setView(pos,17);
  }else{
    marker.setLatLng(pos);
  }

  route.addLatLng(pos);

  const speed=Number(data.speed);
  marker.setPopupContent(
    `<b>Veículo</b><br>Velocidade: ${speed.toFixed(1)} km/h<br>`+
    `Latitude: ${lat.toFixed(6)}<br>Longitude: ${lon.toFixed(6)}`
  );

  mapsLink.href=`https://www.google.com/maps/@${lat},${lon},17z`;
}

function updatePanel(data){
  if(data.latitude===null) return;

  const speed=Number(data.speed);
  const lat=Number(data.latitude);
  const lon=Number(data.longitude);

  speedEl.textContent=speed.toFixed(1);
  latEl.textContent=lat.toFixed(6);
  lonEl.textContent=lon.toFixed(6);

  if(speed>SPEED_LIMIT){
    card.classList.add("danger");
    speedStatus.textContent="⚠ ACIMA DO LIMITE";
    speedStatus.className="danger-text";
  }else{
    card.classList.remove("danger");
    speedStatus.textContent="Dentro do limite";
    speedStatus.className="normal";
  }

  updatedEl.textContent=new Date(data.timestamp).toLocaleTimeString("pt-BR");
  updateMap(data);
  refreshSummary();
  refreshChart();
}

async function loadHistory(){
  try{
    const response=await fetch("/api/history");
    history=await response.json();
    if(!Array.isArray(history)) history=[];

    const positions=history
      .filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)))
      .map(p=>[Number(p.latitude),Number(p.longitude)]);

    route.setLatLngs(positions);

    if(history.length) updatePanel(history[history.length-1]);
    else {refreshSummary();refreshChart();}
  }catch(e){console.error("Erro ao carregar histórico:",e);}
}

function connect(){
  const protocol=location.protocol==="https:"?"wss":"ws";
  const socket=new WebSocket(`${protocol}://${location.host}`);

  socket.onopen=()=>{
    statusEl.textContent="● ONLINE";
    statusEl.className="online";
  };

  socket.onmessage=event=>{
    try{
      const data=JSON.parse(event.data);
      if(data.latitude===null) return;

      const last=history[history.length-1];
      if(!last||data.timestamp!==last.timestamp) history.push(data);
      updatePanel(data);
    }catch(e){console.error("Erro nos dados:",e);}
  };

  socket.onclose=()=>{
    statusEl.textContent="● DESCONECTADO";
    statusEl.className="offline";
    setTimeout(connect,2000);
  };

  socket.onerror=()=>socket.close();
}

document.getElementById("clearHistory").onclick=async()=>{
  if(!confirm("Apagar o histórico salvo no servidor?")) return;

  await fetch("/api/history",{method:"DELETE"});
  history=[]; route.setLatLngs([]);

  if(marker){map.removeLayer(marker);marker=null;}

  speedEl.textContent="0.0";maxEl.textContent="0.0";pointsEl.textContent="0";
  latEl.textContent="--";lonEl.textContent="--";updatedEl.textContent="--";
  refreshChart();
};

loadHistory();
connect();
