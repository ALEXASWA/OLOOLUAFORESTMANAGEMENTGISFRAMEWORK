(function () {
    const target = document.getElementById("overview-map");
    if (!target || !window.FGMDSS_FOREST_CODE) return;

    const basemapConfig = window.FGMDSS_BASEMAPS || {};
    const basemapKey = basemapConfig.satellite ? "satellite" : Object.keys(basemapConfig)[0];
    const basemap = basemapConfig[basemapKey];
    const basemapLayer = new ol.layer.Tile({
        source: new ol.source.XYZ({
            url: basemap.url,
            attributions: basemap.attribution,
            maxZoom: basemap.max_zoom,
            crossOrigin: "anonymous",
        }),
    });

    const styles = {
        original: new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(0, 100, 0, 0.35)" }),
            stroke: new ol.style.Stroke({ color: "#006400", width: 2.5 }),
        }),
        buffer: new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(244, 194, 13, 0.10)" }),
            stroke: new ol.style.Stroke({ color: "#d4a017", width: 2, lineDash: [8, 6] }),
        }),
        training: new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(199, 21, 133, 0.25)" }),
            stroke: new ol.style.Stroke({ color: "#c71585", width: 1 }),
            image: new ol.style.Circle({ radius: 3.5, fill: new ol.style.Fill({ color: "#c71585" }) }),
        }),
        validation: new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(255, 140, 0, 0.25)" }),
            stroke: new ol.style.Stroke({ color: "#ff8c00", width: 1 }),
            image: new ol.style.Circle({ radius: 3.5, fill: new ol.style.Fill({ color: "#ff8c00" }) }),
        }),
        "management-zone": new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(35, 139, 69, 0.18)" }),
            stroke: new ol.style.Stroke({ color: "#238b45", width: 1.5, lineDash: [4, 4] }),
        }),
    };

    const layerDefs = {
        original: { label: "Forest boundary", checked: true },
        buffer: { label: "100 m buffer", checked: true },
        training: { label: "Training samples", checked: false },
        validation: { label: "Validation samples", checked: false },
        "management-zone": { label: "Management zones", checked: false },
    };

    const sources = {};
    const layers = [];
    Object.keys(layerDefs).forEach(function (key) {
        sources[key] = new ol.source.Vector();
        layers.push(new ol.layer.Vector({ source: sources[key], style: styles[key], visible: layerDefs[key].checked }));
    });

    const map = new ol.Map({
        target: target,
        layers: [basemapLayer].concat(layers.slice().reverse()),
        controls: [new ol.control.Zoom(), new ol.control.ScaleLine(), new ol.control.Attribution({ collapsible: false })],
        view: new ol.View({ center: [0, 0], zoom: 2 }),
    });

    const controlsHost = document.getElementById("overviewMapControls");
    Object.keys(layerDefs).forEach(function (key, index) {
        const layerIndex = Object.keys(layerDefs).indexOf(key);
        const label = document.createElement("label");
        label.className = "overview-map-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "form-check-input";
        input.checked = layerDefs[key].checked;
        input.addEventListener("change", function () { layers[layerIndex].setVisible(input.checked); });
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + layerDefs[key].label));
        controlsHost?.appendChild(label);
    });

    fetch("/api/forests/" + encodeURIComponent(window.FGMDSS_FOREST_CODE) + "/workspace/")
        .then(function (response) {
            if (!response.ok) throw new Error("workspace " + response.status);
            return response.json();
        })
        .then(function (data) {
            const format = new ol.format.GeoJSON();
            const features = format.readFeatures(data, { featureProjection: "EPSG:3857" });
            features.forEach(function (feature) {
                const key = feature.get("layer");
                if (sources[key]) sources[key].addFeature(feature);
            });
            if (data.extent) {
                map.getView().fit(ol.proj.transformExtent(data.extent, "EPSG:4326", "EPSG:3857"),
                    { padding: [24, 24, 24, 24], maxZoom: 16 });
            }
        })
        .catch(function (error) { console.error("FM-GDSS overview map could not load", error); });

    window.addEventListener("load", function () { map.updateSize(); });
})();
