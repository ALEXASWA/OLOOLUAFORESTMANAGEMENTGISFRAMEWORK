(function () {
    const target = document.getElementById("overview-map");
    if (!target || !window.FGMDSS_FOREST_CODE || !window.ol) return;
    const source = new ol.source.Vector();
    const basemap = window.FGMDSS_BASEMAPS?.osm || {};
    const map = new ol.Map({ target, layers: [new ol.layer.Tile({ source: new ol.source.XYZ({ url: basemap.url, attributions: basemap.attribution, maxZoom: basemap.max_zoom }) }), new ol.layer.Vector({ source, style: new ol.style.Style({ fill: new ol.style.Fill({ color: "rgba(77,154,106,.20)" }), stroke: new ol.style.Stroke({ color: "#2d7253", width: 2 }) }) })], controls: [new ol.control.Attribution({ collapsible: false })], view: new ol.View({ center: [0, 0], zoom: 2 }) });
    fetch(`/api/forests/${encodeURIComponent(window.FGMDSS_FOREST_CODE)}/workspace/`).then(response => response.json()).then(data => { const features = new ol.format.GeoJSON().readFeatures(data, { featureProjection: "EPSG:3857" }); source.addFeatures(features.filter(feature => ["original", "buffer"].includes(feature.get("layer")))); if (data.extent) map.getView().fit(ol.proj.transformExtent(data.extent, "EPSG:4326", "EPSG:3857"), { padding: [12, 12, 12, 12], maxZoom: 17 }); });
})();