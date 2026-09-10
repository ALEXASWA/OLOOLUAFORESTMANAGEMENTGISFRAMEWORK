const defaultCenter = [4100000, -150000];
const defaultZoom = 6;
const boundarySource = new ol.source.Vector();
const boundaryLayer = new ol.layer.Vector({
  source: boundarySource,
  style: new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(77, 154, 106, 0.12)" }),
    stroke: new ol.style.Stroke({ color: "#2d7253", width: 3 })
  })
});
const map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({ source: new ol.source.OSM(), properties: { name: "OpenStreetMap" } }),
    boundaryLayer
  ],
  view: new ol.View({ center: defaultCenter, zoom: defaultZoom })
});

window.resetMapView = function () {
  map.getView().animate({ center: defaultCenter, zoom: defaultZoom, duration: 350 });
};

async function loadBoundary() {
  const code = document.getElementById("forestSelect")?.value;
  if (!code) return;
  try {
    const response = await fetch(`/api/boundaries/?limit=100`);
    if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
    const data = await response.json();
    boundarySource.clear();
    const format = new ol.format.GeoJSON();
    const features = format.readFeatures(data, { featureProjection: "EPSG:3857" });
    features.filter(f => f.get("forest") !== null).forEach(f => boundarySource.addFeature(f));
    if (boundarySource.getFeatures().length) map.getView().fit(boundarySource.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 16, duration: 450 });
  } catch (error) {
    console.error("FM-GDSS boundary layer could not be loaded", error);
  }
}
document.getElementById("boundary")?.addEventListener("change", e => boundaryLayer.setVisible(e.target.checked));
const forestSelect = document.getElementById("forestSelect");
if (forestSelect?.dataset.selected) forestSelect.value = forestSelect.dataset.selected;
forestSelect?.addEventListener("change", e => location.href = `/gis/?forest=${e.target.value}`);
map.on("pointermove", event => {
  const coordinate = ol.proj.toLonLat(event.coordinate);
  const target = document.getElementById("mapCoordinates");
  if (target) target.textContent = `${coordinate[1].toFixed(4)}, ${coordinate[0].toFixed(4)}`;
});
loadBoundary();
