const boundarySource = new ol.source.Vector();
const boundaryLayer = new ol.layer.Vector({source: boundarySource});
const map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({source: new ol.source.OSM()}),
    boundaryLayer
  ],
  view: new ol.View({center: [4100000, -150000], zoom: 6})
});

async function loadBoundary() {
  const code = document.getElementById("forestSelect")?.value;
  if (!code) return;
  const response = await fetch(`/api/boundaries/?limit=100`);
  const data = await response.json();
  boundarySource.clear();
  const format = new ol.format.GeoJSON();
  const features = format.readFeatures(data, {featureProjection: "EPSG:3857"});
  features.filter(f => f.get("forest") !== null).forEach(f => boundarySource.addFeature(f));
  if (features.length) map.getView().fit(boundarySource.getExtent(), {padding:[30,30,30,30], maxZoom:16});
}
document.getElementById("boundary")?.addEventListener("change", e => boundaryLayer.setVisible(e.target.checked));
document.getElementById("forestSelect")?.addEventListener("change", e => location.href = `/gis/?forest=${e.target.value}`);
loadBoundary();
