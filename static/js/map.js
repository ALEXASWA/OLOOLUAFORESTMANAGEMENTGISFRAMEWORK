(function () {
  "use strict";

  const APP = document.getElementById("gisApp");
  const els = {
    forestSelect: document.getElementById("forestSelect"),
    basemapMenu: document.getElementById("basemapMenu"),
    exportMenu: document.getElementById("exportMenu"),
    layerPanel: document.getElementById("layerPanel"),
    layerSearch: document.getElementById("layerSearch"),
    legendPanel: document.getElementById("legendPanel"),
    legendBody: document.getElementById("legendBody"),
    legendCount: document.getElementById("legendCount"),
    layerInfo: document.getElementById("layerInfo"),
    layerInfoBody: document.getElementById("layerInfoBody"),
    popup: document.getElementById("mapPopup"),
    popupBody: document.getElementById("mapPopupBody"),
    message: document.getElementById("mapMessage"),
    coordinates: document.getElementById("mapCoordinates"),
    zoom: document.getElementById("mapZoom"),
    layerCount: document.getElementById("layerCount"),
    paneYearA: document.getElementById("paneYearA"),
    paneYearB: document.getElementById("paneYearB"),
    paneLabelA: document.getElementById("paneLabelA"),
    paneLabelB: document.getElementById("paneLabelB"),
    yearChips: document.getElementById("yearChips"),
    yearSelectA: document.getElementById("yearSelectA"),
    yearSelectB: document.getElementById("yearSelectB"),
    compareSelects: document.getElementById("compareSelects"),
    swipeHandle: document.getElementById("swipeHandle"),
    mapShell: document.getElementById("mapShell"),
    mapB: document.getElementById("mapB"),
    progress: document.getElementById("mapProgress"),
    skeleton: document.getElementById("mapSkeleton"),
    toastStack: document.getElementById("toastStack"),
    insightsPanel: document.getElementById("insightsPanel"),
    insightsTitle: document.getElementById("insightsTitle"),
    insightKpis: document.getElementById("insightKpis"),
    insightContext: document.getElementById("insightContext"),
    gisPanel: document.getElementById("gisPanel"),
    panelToggle: document.getElementById("panelToggle"),
    themeToggle: document.getElementById("themeToggle"),
    insightsToggle: document.getElementById("insightsToggle"),
    yearPlay: document.getElementById("yearPlay"),
  };

  const basemapConfig = window.FGMDSS_BASEMAPS || {};
  const basemapKeys = Object.keys(basemapConfig);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BASEMAP_ICONS = {
    osm: "bi-map",
    light: "bi-brightness-high",
    satellite: "bi-globe-americas",
    terrain: "bi-mountains",
    dark: "bi-moon-stars",
  };

  const state = {
    forest: window.FGMDSS?.forestCode || "",
    forestName: window.FGMDSS?.forestName || "Forest workspace",
    items: [],
    analytics: null,
    changeRows: [],
    structureRows: [],
    pressureRows: [],
    vectorCounts: { training: 0, validation: 0, "management-zone": 0 },
    vectorVisible: { original: true, buffer: true, training: true, validation: true, "management-zone": true },
    visible: {},
    opacity: {},
    years: [],
    yearA: null,
    yearB: null,
    lulcOn: false,
    compare: "single",
    basemap: basemapKeys[0] || "osm",
    rasterA: [],
    rasterB: [],
    mapB: null,
    charts: {},
    playTimer: null,
    loadToken: 0,
    extent4326: null,
    theme: "light",
    legendFloating: false,
  };

  /* ---------------- Helpers ---------------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const node = document.createElement("i");
    node.className = `bi ${name}`;
    return node;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value, digits) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: digits === undefined ? 1 : digits,
      maximumFractionDigits: digits === undefined ? 1 : digits,
    });
  }

  function formatSigned(value, digits) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const number = Number(value);
    return `${number > 0 ? "+" : ""}${formatNumber(number, digits)}`;
  }

  function setMessage(text, isError) {
    if (!els.message) return;
    els.message.textContent = text || "";
    els.message.classList.toggle("is-error", Boolean(isError));
  }

  function toast(message, type) {
    if (!els.toastStack) return;
    const node = el("div", `gis-toast ${type || "info"}`);
    node.appendChild(icon(type === "success" ? "bi-check-circle" : type === "error" ? "bi-exclamation-triangle" : "bi-info-circle"));
    node.appendChild(el("span", null, message));
    els.toastStack.appendChild(node);
    setTimeout(() => node.classList.add("is-leaving"), 3200);
    setTimeout(() => node.remove(), 3600);
  }

  function debounceFrame(fn) {
    let frame = null;
    return function debounced() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = null; fn(); });
    };
  }

  function isLulcSeries(item) {
    return item && item.kind === "lulc" && !/analysisgrid/i.test(item.slug);
  }

  function shortName(item) {
    return String(item.name || item.slug || "Layer")
      .replace(/^Oloolua\s+/i, "")
      .replace(/\s+30m AnalysisGrid$/i, " (30 m grid)");
  }

  function itemMeta(item) {
    const parts = [item.data_status];
    if (item.year) parts.push(String(item.year));
    else if (/1990-2025/i.test(item.slug)) parts.push("1990–2025");
    if (item.resolution_m) parts.push(`${item.resolution_m} m`);
    return parts.filter(Boolean).join(" · ");
  }

  function swatchFill(item) {
    const entries = item.legend || [];
    if (!entries.length) return "#496d58";
    if (item.data_type === "continuous") {
      const colors = entries.map((entry) => entry.color);
      return `linear-gradient(90deg, ${colors.join(", ")})`;
    }
    if (entries.length === 1) return entries[0].color;
    const stops = entries.map((entry, index) => {
      const start = Math.round((index / entries.length) * 100);
      const end = Math.round(((index + 1) / entries.length) * 100);
      return `${entry.color} ${start}% ${end}%`;
    });
    return `linear-gradient(135deg, ${stops.join(", ")})`;
  }

  /* ---------------- Basemaps ---------------- */
  function createBasemapLayers() {
    return basemapKeys.map((key) => {
      const config = basemapConfig[key];
      const layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: config.url,
          attributions: config.attribution,
          maxZoom: config.max_zoom,
          crossOrigin: "anonymous",
          transition: REDUCED ? 0 : 150,
        }),
        visible: key === state.basemap,
        properties: { basemapKey: key, name: config.label },
      });
      layer.getSource().on("tileloaderror", () => {
        if (key !== state.basemap) return;
        setMessage(`${config.label} basemap unavailable; choose another basemap`, true);
      });
      return layer;
    });
  }

  const basemapLayersA = createBasemapLayers();

  /* ---------------- Vector layers ---------------- */
  const VECTOR_COLORS = {
    original: "#006400",
    buffer: "#d4a017",
    training: "#c71585",
    validation: "#ff8c00",
    "management-zone": "#238b45",
  };

  const vectorStyles = {
    original: [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: "rgba(255, 255, 255, 0.92)", width: 6 }) }),
      new ol.style.Style({
        fill: new ol.style.Fill({ color: "rgba(0, 100, 0, 0.10)" }),
        stroke: new ol.style.Stroke({ color: "#006400", width: 2.5 }),
      }),
    ],
    buffer: [
      new ol.style.Style({ stroke: new ol.style.Stroke({ color: "rgba(255, 255, 255, 0.85)", width: 5 }) }),
      new ol.style.Style({
        fill: new ol.style.Fill({ color: "rgba(244, 194, 13, 0.06)" }),
        stroke: new ol.style.Stroke({ color: "#b8860b", width: 2, lineDash: [8, 6] }),
      }),
    ],
    training: new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(199, 21, 133, 0.22)" }),
      stroke: new ol.style.Stroke({ color: "#c71585", width: 1.4 }),
      image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: "#c71585" }) }),
    }),
    validation: new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(255, 140, 0, 0.22)" }),
      stroke: new ol.style.Stroke({ color: "#ff8c00", width: 1.4 }),
      image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: "#ff8c00" }) }),
    }),
    "management-zone": new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(35, 139, 69, 0.16)" }),
      stroke: new ol.style.Stroke({ color: "#238b45", width: 2 }),
    }),
  };

  const vectorKeys = ["original", "buffer", "training", "validation", "management-zone"];
  const vectorSources = {};
  vectorKeys.forEach((key) => { vectorSources[key] = new ol.source.Vector(); });

  function createVectorLayers() {
    return vectorKeys.slice().reverse().map((key) => new ol.layer.Vector({
      source: vectorSources[key],
      style: vectorStyles[key],
      properties: { vectorKey: key },
    }));
  }

  const vectorLayersA = createVectorLayers();
  let vectorLayersB = [];

  /* ---------------- Draw / measure ---------------- */
  const measureSource = new ol.source.Vector();
  const drawSource = new ol.source.Vector();

  const measureLayer = new ol.layer.Vector({
    source: measureSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#0057b8", width: 2.5, lineDash: [6, 6] }),
      fill: new ol.style.Fill({ color: "rgba(0, 87, 184, 0.12)" }),
      image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: "#0057b8" }) }),
    }),
  });

  const drawStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({ color: "#0B3D2E", width: 2.5 }),
    fill: new ol.style.Fill({ color: "rgba(11, 61, 46, 0.12)" }),
    image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: "#0B3D2E" }) }),
  });
  const drawLayer = new ol.layer.Vector({ source: drawSource, style: drawStyle });

  const measureTooltip = el("div", "measure-tooltip");
  measureTooltip.hidden = true;
  const popupOverlay = new ol.Overlay({
    element: els.popup,
    positioning: "bottom-center",
    offset: [0, -16],
    stopEvent: true,
    autoPan: { animation: { duration: REDUCED ? 0 : 250 } },
  });
  const measureOverlay = new ol.Overlay({ element: measureTooltip, positioning: "bottom-center", offset: [0, -12] });

  /* ---------------- Map A ---------------- */
  const mapA = new ol.Map({
    target: "map",
    layers: [...basemapLayersA, ...vectorLayersA, measureLayer, drawLayer],
    controls: [
      new ol.control.ScaleLine({ units: "metric" }),
      new ol.control.Attribution({ collapsible: false }),
    ],
    overlays: [popupOverlay, measureOverlay],
    view: new ol.View({ center: [0, 0], zoom: 2, maxZoom: 21 }),
  });

  function syncViews() {
    if (!state.mapB) return;
    let lock = false;
    const a = mapA.getView();
    const b = state.mapB.getView();
    const apply = (source, target) => {
      if (lock || state.compare === "single") return;
      lock = true;
      target.setCenter(source.getCenter());
      target.setResolution(source.getResolution());
      target.setRotation(source.getRotation());
      lock = false;
    };
    a.on(["change:center", "change:resolution", "change:rotation"], () => apply(a, b));
    b.on(["change:center", "change:resolution", "change:rotation"], () => apply(b, a));
  }

  function ensureMapB() {
    if (state.mapB) return state.mapB;
    els.mapB.hidden = false;
    vectorLayersB = createVectorLayers();
    const basemapLayersB = createBasemapLayers();
    state.mapB = new ol.Map({
      target: "mapB",
      layers: [...basemapLayersB, ...vectorLayersB],
      controls: [],
      view: new ol.View({
        center: mapA.getView().getCenter(),
        resolution: mapA.getView().getResolution(),
        maxZoom: 21,
      }),
    });
    state.rasterB = [];
    const basemapCount = basemapLayersB.length;
    let insertAt = basemapCount;
    state.items.forEach((item) => {
      const layer = buildRasterLayer(item, "B");
      if (!layer) return;
      layer.setVisible(itemVisibleOn("B", item));
      state.rasterB.push(layer);
      state.mapB.getLayers().insertAt(insertAt, layer);
      insertAt += 1;
    });
    applyVectorVisibility("B");
    syncViews();
    requestAnimationFrame(() => state.mapB.updateSize());
    return state.mapB;
  }

  function rebuildRasterLayersB() {
    if (!state.mapB) return;
    state.rasterB.forEach((layer) => state.mapB.removeLayer(layer));
    state.rasterB = [];
    const layers = state.mapB.getLayers();
    const basemapCount = layers.getArray().filter((layer) => layer.get("basemapKey")).length;
    let insertAt = basemapCount;
    state.items.forEach((item) => {
      const layer = buildRasterLayer(item, "B");
      if (!layer) return;
      layer.setVisible(itemVisibleOn("B", item));
      state.rasterB.push(layer);
      state.mapB.getLayers().insertAt(insertAt, layer);
      insertAt += 1;
    });
  }

  /* ---------------- Raster layers ---------------- */
  function buildRasterLayer(item) {
    if (!item.bounds_4326) {
      setMessage(`${item.name} has no registered georeference and cannot be drawn.`, true);
      return null;
    }
    const source = new ol.source.ImageStatic({
      url: item.overlay_url,
      imageExtent: item.bounds_4326,
      projection: "EPSG:4326",
      crossOrigin: "anonymous",
    });
    source.on("imageloaderror", () => {
      setMessage(`${item.name} failed to load; the overlay may be unavailable.`, true);
    });
    return new ol.layer.Image({
      source,
      opacity: state.opacity[item.id] === undefined ? 0.85 : state.opacity[item.id],
      interpolate: item.data_type === "continuous",
      properties: { itemId: item.id, item },
    });
  }

  function removeRasterLayersA() {
    state.rasterA.forEach((layer) => mapA.removeLayer(layer));
    state.rasterA = [];
  }

  function yearFor(side) {
    return side === "B" ? state.yearB : state.yearA;
  }

  function itemVisibleOn(side, item) {
    if (isLulcSeries(item)) {
      return state.lulcOn && Number(item.year) === Number(yearFor(side));
    }
    return Boolean(state.visible[item.id]);
  }

  function applyVisibility(side) {
    const layers = side === "B" ? state.rasterB : state.rasterA;
    layers.forEach((layer) => layer.setVisible(itemVisibleOn(side, layer.get("item"))));
  }

  function applyVectorVisibility(side) {
    const layers = side === "B" ? vectorLayersB : vectorLayersA;
    layers.forEach((layer) => {
      const key = layer.get("vectorKey");
      layer.setVisible(state.vectorVisible[key] !== false);
    });
  }

  function setVectorVisibility(key, visible, opacity) {
    state.vectorVisible[key] = visible;
    if (opacity !== undefined) {
      vectorLayersA.forEach((layer) => { if (layer.get("vectorKey") === key) layer.setOpacity(opacity); });
      vectorLayersB.forEach((layer) => { if (layer.get("vectorKey") === key) layer.setOpacity(opacity); });
    }
    applyVectorVisibility("A");
    applyVectorVisibility("B");
    updateLegend();
    updateLayerCount();
  }

  function setItemVisible(item, visible) {
    if (isLulcSeries(item)) {
      if (visible) {
        state.lulcOn = true;
        state.yearA = Number(item.year);
        if (state.yearB === null) state.yearB = state.years.find((year) => year !== state.yearA) ?? state.yearA;
      } else if (Number(item.year) === Number(state.yearA)) {
        state.lulcOn = false;
      } else {
        return;
      }
      applyVisibility("A");
      applyVisibility("B");
      syncLulcCards();
      updateYearUi();
      updateLegend();
      renderInsights();
      if (visible) flyToLayer(item);
      return;
    }
    state.visible[item.id] = visible;
    applyVisibility("A");
    applyVisibility("B");
    updateLegend();
    updateLayerCount();
    if (visible) flyToLayer(item);
  }

  function flyToLayer(item) {
    if (!item.bounds_4326 || !item.bounds_4326.length) return;
    const extent = ol.proj.transformExtent(item.bounds_4326, "EPSG:4326", "EPSG:3857");
    const size = mapA.getSize() || [800, 600];
    const resolution = mapA.getView().getResolutionForExtent(extent, [Math.max(size[0] - 220, 240), Math.max(size[1] - 260, 240)]);
    const current = mapA.getView().getResolution();
    const target = Math.min(current, resolution * 1.05);
    mapA.getView().animate({
      center: ol.extent.getCenter(extent),
      resolution: target,
      duration: REDUCED ? 0 : 450,
      easing: ol.easing.easeOut,
    });
  }

  /* ---------------- Layer panel ---------------- */
  function groupElement(title, rows, open) {
    const details = el("details", "gis-group");
    details.open = Boolean(open);
    const summary = el("summary");
    summary.appendChild(icon("bi-chevron-right"));
    summary.appendChild(el("span", "gis-group-name", title));
    summary.appendChild(el("span", "gis-group-badge", String(rows.length)));
    const body = el("div", "gis-group-body");
    rows.forEach((row) => body.appendChild(row));
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function awaitingRow(label, reason) {
    const row = el("div", "gis-awaiting");
    row.dataset.name = label;
    row.appendChild(el("span", "gis-awaiting-swatch"));
    const main = el("div", "gis-awaiting-main");
    main.appendChild(el("span", "gis-awaiting-name", label));
    main.appendChild(el("span", "gis-awaiting-tag", reason));
    row.appendChild(main);
    return row;
  }

  function infoButton(html, label) {
    const button = el("button", "gis-card-info");
    button.type = "button";
    button.title = `About ${label}`;
    button.setAttribute("aria-label", `About ${label}`);
    button.appendChild(icon("bi-info-circle"));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      els.layerInfoBody.innerHTML = html;
      els.layerInfo.hidden = false;
    });
    return button;
  }

  function vectorCard(key, label, info, color) {
    const visible = state.vectorVisible[key] !== false;
    const card = el("div", `gis-layer-card ${visible ? "is-on" : ""}`);
    card.dataset.name = label;

    const toggle = el("label", "gis-switch");
    const input = el("input");
    input.type = "checkbox";
    input.checked = visible;
    input.setAttribute("role", "switch");
    input.setAttribute("aria-label", `${label} visibility`);
    const knob = el("span");
    toggle.append(input, knob);

    const swatch = el("span", "gis-layer-swatch");
    swatch.style.background = color;

    const main = el("div", "gis-layer-main");
    main.appendChild(el("span", "gis-layer-name", label));
    main.appendChild(el("span", "gis-layer-sub", "Vector · observed"));

    const controls = el("div", "gis-layer-controls");
    controls.appendChild(infoButton(info, label));
    const opacity = el("div", "gis-layer-opacity");
    const slider = el("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round((vectorLayersA.find((layer) => layer.get("vectorKey") === key)?.getOpacity() ?? 1) * 100));
    slider.setAttribute("aria-label", `${label} opacity`);
    const applyOpacity = debounceFrame(() => {
      const value = Number(slider.value) / 100;
      vectorLayersA.forEach((layer) => { if (layer.get("vectorKey") === key) layer.setOpacity(value); });
      vectorLayersB.forEach((layer) => { if (layer.get("vectorKey") === key) layer.setOpacity(value); });
    });
    slider.addEventListener("input", applyOpacity);
    opacity.appendChild(slider);

    input.addEventListener("change", () => {
      card.classList.toggle("is-on", input.checked);
      setVectorVisibility(key, input.checked);
    });

    card.append(toggle, swatch, main, controls, opacity);
    return card;
  }

  function rasterCard(item) {
    const lulc = isLulcSeries(item);
    const on = lulc ? state.lulcOn && Number(item.year) === Number(state.yearA) : Boolean(state.visible[item.id]);
    const card = el("div", `gis-layer-card ${on ? "is-on" : ""} status-${item.data_status}`);
    card.dataset.name = item.name;
    if (lulc) card.dataset.lulcYear = String(item.year);

    const toggle = el("label", "gis-switch");
    const input = el("input");
    input.type = "checkbox";
    input.checked = on;
    input.setAttribute("role", "switch");
    input.setAttribute("aria-label", `${shortName(item)} visibility`);
    const knob = el("span");
    toggle.append(input, knob);

    const swatch = el("span", "gis-layer-swatch");
    swatch.style.background = swatchFill(item);

    const main = el("div", "gis-layer-main");
    const name = el("span", "gis-layer-name", shortName(item));
    name.title = item.name;
    const sub = el("span", "gis-layer-sub");
    const dot = el("i", `gis-status-dot ${item.data_status}`);
    sub.appendChild(dot);
    sub.appendChild(document.createTextNode(itemMeta(item)));
    main.append(name, sub);

    const controls = el("div", "gis-layer-controls");
    controls.appendChild(infoButton(rasterInfoHtml(item), shortName(item)));

    const opacity = el("div", "gis-layer-opacity");
    const slider = el("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round((state.opacity[item.id] === undefined ? 0.85 : state.opacity[item.id]) * 100));
    slider.setAttribute("aria-label", `${shortName(item)} opacity`);
    const applyOpacity = debounceFrame(() => {
      const value = Number(slider.value) / 100;
      state.opacity[item.id] = value;
      [...state.rasterA, ...state.rasterB].forEach((layer) => {
        if (layer.get("itemId") === item.id) layer.setOpacity(value);
      });
    });
    slider.addEventListener("input", applyOpacity);
    opacity.appendChild(slider);

    input.addEventListener("change", () => {
      card.classList.toggle("is-on", input.checked);
      setItemVisible(item, input.checked);
    });

    card.append(toggle, swatch, main, controls, opacity);
    return card;
  }

  function syncLulcCards() {
    els.layerPanel.querySelectorAll("[data-lulc-year]").forEach((card) => {
      const year = Number(card.dataset.lulcYear);
      const on = state.lulcOn && year === Number(state.yearA);
      card.classList.toggle("is-on", on);
      const input = card.querySelector("input[type=checkbox]");
      if (input) input.checked = on;
    });
  }

  function buildPanel() {
    els.layerPanel.innerHTML = "";
    const groups = [];

    groups.push({
      title: "Forest boundary",
      open: true,
      rows: [
        vectorCard("original", "Original boundary", infoHtml("Original forest boundary", "Boundary vector imported from the supplied shapefile; stored in EPSG:32737. Area is derived from this geometry."), VECTOR_COLORS.original),
        vectorCard("buffer", "100 m external buffer", infoHtml("100 m external analytical buffer", "Configurable buffer used for analysis context only; it is not part of the forest's actual area."), VECTOR_COLORS.buffer),
      ],
    });

    const referenceRows = [];
    if (state.vectorCounts.training > 0) {
      referenceRows.push(vectorCard("training", `Training samples (${state.vectorCounts.training})`, infoHtml("Training samples", "Reference polygons/points assigned to the training split (70%) of the polygon-level random split, seed 42."), VECTOR_COLORS.training));
    } else {
      referenceRows.push(awaitingRow("Training samples", "Awaiting training samples"));
    }
    if (state.vectorCounts.validation > 0) {
      referenceRows.push(vectorCard("validation", `Validation samples (${state.vectorCounts.validation})`, infoHtml("Validation samples", "Reference polygons/points assigned to the validation split (30%) used for accuracy assessment."), VECTOR_COLORS.validation));
    } else {
      referenceRows.push(awaitingRow("Validation samples", "Awaiting validation samples"));
    }
    groups.push({ title: "Reference data", open: true, rows: referenceRows });

    const rasterGroups = new Map();
    state.items.forEach((item) => {
      if (!rasterGroups.has(item.group)) rasterGroups.set(item.group, []);
      rasterGroups.get(item.group).push(item);
    });
    [...rasterGroups.entries()]
      .sort((a, b) => a[1][0].group_order - b[1][0].group_order)
      .forEach(([title, items]) => {
        groups.push({
          title,
          open: /land use/i.test(title),
          rows: items
            .slice()
            .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.slug.localeCompare(b.slug))
            .map(rasterCard),
        });
      });

    const ndviPresent = state.items.some((item) => item.slug.includes("ndvi"));
    if (!ndviPresent) {
      groups.push({
        title: "Vegetation (awaiting)",
        open: false,
        rows: [
          awaitingRow("NDVI 2025", "Awaiting GEE export"),
          awaitingRow("NDVI change (1990–2025)", "Awaiting GEE export"),
        ],
      });
    }

    groups.push({
      title: "Management (vectors)",
      open: false,
      rows: state.vectorCounts["management-zone"] > 0
        ? [vectorCard("management-zone", `Proposed analytical zones (${state.vectorCounts["management-zone"]})`, infoHtml("Proposed analytical management zones", "Proposed decision-support zones from the supplied workflow; not legally gazetted boundaries."), VECTOR_COLORS["management-zone"])]
        : [awaitingRow("Proposed analytical zones", "Zone vector not supplied; zone statistics are available on the Management page")],
    });

    groups.forEach((group) => els.layerPanel.appendChild(groupElement(group.title, group.rows, group.open)));
    if (els.layerSearch.value) applyFilter(els.layerSearch.value);
  }

  function applyFilter(query) {
    const term = String(query || "").trim().toLowerCase();
    els.layerPanel.querySelectorAll(".gis-layer-card, .gis-awaiting").forEach((row) => {
      const match = !term || String(row.dataset.name || "").toLowerCase().includes(term);
      row.hidden = !match;
    });
    els.layerPanel.querySelectorAll(".gis-group").forEach((group) => {
      const visible = [...group.querySelectorAll(".gis-layer-card, .gis-awaiting")].some((row) => !row.hidden);
      group.hidden = !visible;
      if (term && visible) group.open = true;
    });
  }

  function setAllGroups(open) {
    els.layerPanel.querySelectorAll(".gis-group").forEach((group) => {
      if (!group.hidden) group.open = open;
    });
  }

  /* ---------------- Layer information ---------------- */
  function infoHtml(title, description) {
    return `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>`;
  }

  function rasterInfoHtml(item) {
    const rows = [
      ["Source", item.source || "Not recorded"],
      ["Year", item.year || "Multi-year product"],
      ["Resolution", item.resolution_m ? `${item.resolution_m} m` : "Not recorded"],
      ["CRS", item.crs || "Not recorded"],
      ["Data type", item.data_type],
      ["Data status", item.data_status],
      ["Method", item.processing_method || "Not recorded"],
      ["Dimensions", item.width && item.height ? `${item.width} × ${item.height} px` : "Not recorded"],
      ["Checksum", item.checksum ? `SHA-256 ${item.checksum}…` : "Not recorded"],
    ];
    if (item.description) rows.push(["Description", item.description]);
    return `<strong>${escapeHtml(item.name)}</strong><dl>${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>`;
  }

  /* ---------------- Legend ---------------- */
  const LULC_STAT_ALIASES = { Forest: "Forest", Grassland: "Grassland", Quarry: "Quarry", "Built-up": "Built-up" };

  function lulcStatsFor(label, stats) {
    const keys = Object.keys(stats || {});
    const base = Object.keys(LULC_STAT_ALIASES).find((key) => label.toLowerCase().includes(key.toLowerCase()));
    const key = keys.find((entry) => (base ? entry.toLowerCase() === base.toLowerCase() : label.toLowerCase().includes(entry.toLowerCase())));
    if (!key) return null;
    const areas = Object.values(stats).map(Number).filter((value) => Number.isFinite(value));
    const total = areas.reduce((sum, value) => sum + value, 0);
    const area = Number(stats[key]);
    return { area, percentage: total ? (area / total) * 100 : null };
  }

  function collectLegendBlocks() {
    const blocks = [];
    const originalFeatures = vectorSources.original.getFeatures().length;
    if (state.vectorVisible.original !== false && originalFeatures) {
      blocks.push({ title: "Original boundary", meta: "Vector · observed", type: "categorical", rows: [{ color: VECTOR_COLORS.original, label: "Forest boundary" }] });
    }
    if (state.vectorVisible.buffer !== false && vectorSources.buffer.getFeatures().length) {
      blocks.push({ title: "100 m external buffer", meta: "Analytical context", type: "categorical", rows: [{ color: VECTOR_COLORS.buffer, label: "External buffer" }] });
    }
    if (state.vectorVisible.training !== false && vectorSources.training.getFeatures().length) {
      blocks.push({ title: "Training samples", meta: `${state.vectorCounts.training} features`, type: "categorical", rows: [{ color: VECTOR_COLORS.training, label: "Training split" }] });
    }
    if (state.vectorVisible.validation !== false && vectorSources.validation.getFeatures().length) {
      blocks.push({ title: "Validation samples", meta: `${state.vectorCounts.validation} features`, type: "categorical", rows: [{ color: VECTOR_COLORS.validation, label: "Validation split" }] });
    }

    const visibleItems = state.items
      .filter((item) => itemVisibleOn("A", item))
      .sort((a, b) => a.group_order - b.group_order || (a.year || 9999) - (b.year || 9999));

    const yearStats = state.analytics?.lulc?.years?.[String(state.yearA)] || {};

    visibleItems.forEach((item) => {
      const entries = item.legend || [];
      if (isLulcSeries(item)) {
        const rows = entries.map((entry) => {
          const stats = lulcStatsFor(entry.label, yearStats);
          const value = stats
            ? `${formatNumber(stats.area)} ha · ${stats.percentage === null ? "—" : formatNumber(stats.percentage, 2)}%`
            : "Awaiting area statistics";
          return { color: entry.color, label: entry.label, value };
        });
        blocks.push({
          title: `${shortName(item)}`,
          meta: `LULC ${item.year} · observed`,
          type: "categorical",
          rows,
          note: `Areas from registered LULC statistics, ${item.year}.`,
        });
      } else if (item.data_type === "continuous") {
        blocks.push({
          title: shortName(item),
          meta: itemMeta(item),
          type: "continuous",
          colors: entries.map((entry) => entry.color),
          min: entries.length ? entries[0].value : null,
          max: entries.length ? entries[entries.length - 1].value : null,
        });
      } else {
        blocks.push({
          title: shortName(item),
          meta: itemMeta(item),
          type: "categorical",
          rows: entries.map((entry) => ({ color: entry.color, label: entry.label })),
        });
      }
    });

    if (state.vectorVisible["management-zone"] !== false && vectorSources["management-zone"].getFeatures().length) {
      blocks.push({
        title: "Proposed analytical zones",
        meta: "Vector · proposed",
        type: "categorical",
        rows: [{ color: VECTOR_COLORS["management-zone"], label: "Management zone" }],
      });
    }
    return blocks;
  }

  function updateLegend() {
    if (!els.legendBody) return;
    const blocks = collectLegendBlocks();
    els.legendBody.innerHTML = "";
    els.legendCount.textContent = `${blocks.length} active`;
    if (!blocks.length) {
      els.legendBody.appendChild(el("p", "gis-legend-empty", "No thematic layers are switched on."));
      updateInsightContext(blocks.length);
      return;
    }
    blocks.forEach((block) => {
      const wrap = el("div", "gis-legend-block");
      const title = el("div", "gis-legend-title");
      title.appendChild(el("span", null, block.title));
      title.appendChild(el("em", null, block.meta));
      wrap.appendChild(title);
      if (block.type === "continuous") {
        const ramp = el("div", "gis-ramp");
        ramp.style.background = `linear-gradient(90deg, ${(block.colors || []).join(", ")})`;
        wrap.appendChild(ramp);
        const labels = el("div", "gis-ramp-labels");
        labels.appendChild(el("span", null, formatNumber(block.min, 2)));
        labels.appendChild(el("span", null, formatNumber(block.max, 2)));
        wrap.appendChild(labels);
      } else {
        (block.rows || []).forEach((row) => {
          const line = el("div", "gis-legend-row");
          const swatch = el("span", "gis-legend-swatch");
          swatch.style.background = row.color;
          line.appendChild(swatch);
          line.appendChild(el("span", "gis-legend-label", row.label));
          if (row.value) line.appendChild(el("span", "gis-legend-value", row.value));
          wrap.appendChild(line);
        });
      }
      if (block.note) wrap.appendChild(el("p", "gis-legend-note", block.note));
      els.legendBody.appendChild(wrap);
    });
    updateInsightContext(blocks.length);
  }

  function updateInsightContext(count) {
    if (!els.insightContext) return;
    els.insightContext.textContent = count
      ? `${count} active layer${count === 1 ? "" : "s"} · ${state.forestName}. Values from registered LULC and change statistics; none are simulated.`
      : `${state.forestName}. Values from registered LULC and change statistics; none are simulated.`;
  }

  function updateLayerCount() {
    if (!els.layerCount) return;
    const visibleVectors = vectorLayersA.filter((layer) => layer.getVisible() && (layer.getSource()?.getFeatures().length || 0)).length;
    const visibleRasters = state.rasterA.filter((layer) => layer.getVisible()).length;
    els.layerCount.textContent = String(visibleVectors + visibleRasters);
  }

  /* ---------------- Year controls ---------------- */
  function updateYearUi() {
    if (els.yearChips) {
      els.yearChips.innerHTML = "";
      state.years.forEach((year) => {
        const button = el("button", year === Number(state.yearA) ? "is-active" : "", String(year));
        button.type = "button";
        button.dataset.year = String(year);
        button.setAttribute("aria-pressed", String(year === Number(state.yearA)));
        button.addEventListener("click", () => setYear(year, "A", true));
        els.yearChips.appendChild(button);
      });
    }
    [els.yearSelectA, els.yearSelectB].forEach((select, index) => {
      if (!select) return;
      select.innerHTML = "";
      state.years.forEach((year) => {
        const option = el("option", null, String(year));
        option.value = String(year);
        select.appendChild(option);
      });
      const value = index === 0 ? state.yearA : state.yearB;
      if (value !== null) select.value = String(value);
    });
    if (els.paneYearA) els.paneYearA.textContent = state.yearA === null ? "—" : String(state.yearA);
    if (els.paneYearB) els.paneYearB.textContent = state.yearB === null ? "—" : String(state.yearB);
    syncLulcCards();
  }

  function setYear(year, side, userInitiated) {
    if (userInitiated) stopPlay();
    if (side === "B") {
      state.yearB = Number(year);
    } else {
      state.yearA = Number(year);
      state.lulcOn = true;
    }
    applyVisibility("A");
    applyVisibility("B");
    updateYearUi();
    updateLegend();
    renderInsights();
  }

  function togglePlay() {
    if (state.playTimer) {
      stopPlay();
      return;
    }
    if (!state.years.length) {
      toast("No registered LULC years to animate", "info");
      return;
    }
    state.lulcOn = true;
    const startIndex = Math.max(0, state.years.indexOf(Number(state.yearA)));
    let index = startIndex;
    const step = () => {
      index = (index + 1) % state.years.length;
      setYear(state.years[index], "A", false);
    };
    setYear(state.years[index], "A", false);
    state.playTimer = setInterval(step, REDUCED ? 1500 : 1100);
    els.yearPlay.classList.add("is-active");
    els.yearPlay.setAttribute("aria-pressed", "true");
    els.yearPlay.innerHTML = '<i class="bi bi-pause-fill"></i>';
  }

  function stopPlay() {
    if (state.playTimer) {
      clearInterval(state.playTimer);
      state.playTimer = null;
    }
    if (els.yearPlay) {
      els.yearPlay.classList.remove("is-active");
      els.yearPlay.setAttribute("aria-pressed", "false");
      els.yearPlay.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
  }

  /* ---------------- Insights ---------------- */
  function parseRowValue(rows, key, label) {
    const row = rows.find((entry) => String(entry[key] || "").toLowerCase() === label.toLowerCase());
    return row ? Number(row.Area_ha) : null;
  }

  function getChart(id) {
    const node = document.getElementById(id);
    if (!node || typeof echarts === "undefined" || !node.clientWidth) return null;
    if (!state.charts[id]) state.charts[id] = echarts.init(node, null, { renderer: "canvas" });
    return state.charts[id];
  }

  function chartTextColor() {
    return getComputedStyle(APP).getPropertyValue("--gis-text").trim() || "#18211e";
  }

  function chartMutedColor() {
    return getComputedStyle(APP).getPropertyValue("--gis-muted").trim() || "#6b7b72";
  }

  function animateValue(node, value, digits) {
    if (!node) return;
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      node.textContent = "—";
      return;
    }
    const target = Number(value);
    if (REDUCED) {
      node.textContent = formatNumber(target, digits);
      return;
    }
    const started = performance.now();
    const duration = 650;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatNumber(target * eased, digits);
      if (progress < 1) requestAnimationFrame(step);
      else node.textContent = formatNumber(target, digits);
    };
    requestAnimationFrame(step);
    setTimeout(() => { node.textContent = formatNumber(target, digits); }, duration + 150);
  }

  function kpiCard(label, value, unit, note, digits) {
    const card = el("div", "gis-kpi");
    card.appendChild(el("span", "gis-kpi-label", label));
    const line = el("div", "gis-kpi-line");
    const valueNode = el("strong", "gis-kpi-value", "—");
    line.appendChild(valueNode);
    if (unit) line.appendChild(el("small", null, unit));
    card.appendChild(line);
    card.appendChild(el("span", "gis-kpi-note", note));
    animateValue(valueNode, value, digits === undefined ? 1 : digits);
    return card;
  }

  function renderInsights() {
    if (!state.analytics) return;
    const yearsData = state.analytics.lulc?.years || {};
    const yearKey = String(state.yearA);
    const stats = yearsData[yearKey] || {};
    const forest = stats.Forest ? Number(stats.Forest) : null;

    const loss = parseRowValue(state.changeRows, "Indicator", "Forest loss");
    const gain = parseRowValue(state.changeRows, "Indicator", "Forest gain");
    const persistent = parseRowValue(state.changeRows, "Indicator", "Persistent forest");
    const netHa = gain !== null && loss !== null ? gain - loss : null;
    const base = persistent !== null && loss !== null ? persistent + loss : null;
    const netPct = netHa !== null && base ? (netHa / base) * 100 : null;

    const core = parseRowValue(state.structureRows, "Structure", "Forest core");
    const edge = parseRowValue(state.structureRows, "Structure", "Forest edge");
    const fragmentation = core !== null && edge !== null && core + edge > 0 ? (edge / (core + edge)) * 100 : null;

    const builtup = parseRowValue(state.pressureRows, "Indicator", "Built-up expansion");
    const quarry = parseRowValue(state.pressureRows, "Indicator", "Quarry expansion");

    if (els.insightKpis) {
      els.insightKpis.innerHTML = "";
      els.insightKpis.appendChild(kpiCard(`Forest area ${yearKey}`, forest, "ha", `Registered LULC ${yearKey}`, 1));
      els.insightKpis.appendChild(kpiCard("Net forest change", netPct, "%", netHa !== null ? `${formatSigned(netHa, 2)} ha · gain − loss` : "Awaiting change statistics", 1));
      els.insightKpis.appendChild(kpiCard("Fragmentation index", fragmentation, "%", edge !== null && core !== null ? `${formatNumber(edge)} ha edge / ${formatNumber(core)} ha core` : "Awaiting core/edge statistics", 1));
      els.insightKpis.appendChild(kpiCard("Built-up expansion", builtup, "ha", quarry !== null ? `Quarry expansion ${formatNumber(quarry)} ha` : "Awaiting pressure statistics", 1));
    }
    if (els.insightsTitle) els.insightsTitle.textContent = `Landscape summary · ${yearKey}`;

    const textColor = chartTextColor();
    const mutedColor = chartMutedColor();

    const donut = getChart("insightDonut");
    if (donut) {
      const lulcItem = state.items.find((item) => isLulcSeries(item) && item.legend && item.legend.length);
      const classColors = {};
      (lulcItem?.legend || []).forEach((entry) => {
        Object.keys(stats).forEach((name) => {
          if (entry.label.toLowerCase().includes(name.toLowerCase())) classColors[name] = entry.color;
        });
      });
      const palette = ["#006400", "#90EE90", "#A0522D", "#D73027", "#7cce91"];
      const data = Object.keys(stats).map((name, index) => ({
        name,
        value: Number(stats[name]),
        itemStyle: { color: classColors[name] || palette[index % palette.length] },
      }));
      donut.setOption({
        animationDuration: REDUCED ? 0 : 250,
        backgroundColor: "transparent",
        tooltip: { trigger: "item", formatter: "{b}: {c} ha ({d}%)" },
        legend: { bottom: 0, left: "center", itemWidth: 8, itemHeight: 8, textStyle: { color: mutedColor, fontSize: 10 } },
        title: {
          text: yearKey,
          subtext: "LULC",
          left: "50%",
          top: "29%",
          textAlign: "center",
          textStyle: { color: textColor, fontSize: 18, fontWeight: 700 },
          subtextStyle: { color: mutedColor, fontSize: 10 },
        },
        series: [{
          type: "pie",
          radius: ["42%", "60%"],
          center: ["50%", "40%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data,
        }],
      }, true);
    }

    const trend = getChart("insightTrend");
    if (trend) {
      const trendYears = Object.keys(yearsData).map(Number).sort((a, b) => a - b);
      const values = trendYears.map((year) => (yearsData[String(year)]?.Forest ? Number(yearsData[String(year)].Forest) : null));
      trend.setOption({
        animationDuration: REDUCED ? 0 : 250,
        backgroundColor: "transparent",
        grid: { left: 38, right: 10, top: 24, bottom: 22 },
        tooltip: { trigger: "axis", valueFormatter: (value) => `${formatNumber(value)} ha` },
        xAxis: {
          type: "category",
          data: trendYears.map(String),
          axisLabel: { color: mutedColor, fontSize: 9 },
          axisLine: { lineStyle: { color: mutedColor } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          name: "ha",
          nameTextStyle: { color: mutedColor, fontSize: 9 },
          axisLabel: { color: mutedColor, fontSize: 9 },
          splitLine: { lineStyle: { color: "rgba(120,140,128,.16)" } },
        },
        series: [{
          name: "Forest",
          type: "line",
          smooth: true,
          symbolSize: 5,
          data: values,
          lineStyle: { color: "#1B5E45", width: 2 },
          itemStyle: { color: "#1B5E45" },
          areaStyle: { color: "rgba(27,94,69,.14)" },
        }],
      }, true);
    }

    const changeChart = getChart("insightChange");
    if (changeChart) {
      const categories = ["Gain", "Loss", "Persistent"];
      const values = [gain, loss, persistent];
      const colors = ["#1A9850", "#D73027", "#006400"];
      changeChart.setOption({
        animationDuration: REDUCED ? 0 : 250,
        backgroundColor: "transparent",
        grid: { left: 60, right: 26, top: 18, bottom: 20 },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value) => `${formatNumber(value)} ha` },
        xAxis: {
          type: "value",
          axisLabel: { color: mutedColor, fontSize: 9 },
          splitLine: { lineStyle: { color: "rgba(120,140,128,.16)" } },
        },
        yAxis: {
          type: "category",
          data: categories,
          axisLabel: { color: mutedColor, fontSize: 9 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          type: "bar",
          barWidth: 12,
          data: values.map((value, index) => ({ value, itemStyle: { color: colors[index], borderRadius: [0, 3, 3, 0] } })),
          label: { show: true, position: "right", color: textColor, fontSize: 9, formatter: (params) => (params.value === null ? "—" : `${formatNumber(params.value)} ha`) },
        }],
      }, true);
    }

    updateLegendContextOnly();
  }

  function updateLegendContextOnly() {
    const blocks = collectLegendBlocks();
    if (els.legendCount) els.legendCount.textContent = `${blocks.length} active`;
    updateInsightContext(blocks.length);
  }

  const renderInsightsDebounced = debounceFrame(renderInsights);

  /* ---------------- Compare modes ---------------- */
  function setCompareMode(mode) {
    state.compare = mode;
    document.querySelectorAll(".gis-mode-switch button").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    els.mapShell.classList.toggle("is-split", mode === "split");
    els.mapShell.classList.toggle("is-swipe", mode === "swipe");
    els.swipeHandle.hidden = mode !== "swipe";
    els.compareSelects.hidden = mode === "single";
    els.paneLabelA.hidden = mode === "single";
    els.paneLabelB.hidden = mode === "single";
    els.mapB.hidden = mode === "single";
    if (mode !== "single") {
      ensureMapB();
      if (state.yearB === null || state.yearB === state.yearA) {
        state.yearB = state.years.find((year) => year !== state.yearA) ?? state.yearA;
      }
      applyVisibility("B");
      updateYearUi();
      updateLegend();
      renderInsightsDebounced();
    } else {
      els.mapB.style.clipPath = "";
    }
    if (mode === "swipe") setSwipe(50);
    requestAnimationFrame(() => {
      mapA.updateSize();
      if (state.mapB) state.mapB.updateSize();
    });
    setTimeout(() => {
      mapA.updateSize();
      if (state.mapB) state.mapB.updateSize();
    }, 280);
  }

  function setSwipe(percent) {
    const clamped = Math.max(6, Math.min(94, percent));
    els.mapB.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    els.swipeHandle.style.left = `${clamped}%`;
  }

  function enableSwipeDrag() {
    let dragging = false;
    const move = (event) => {
      if (!dragging) return;
      const rect = els.mapShell.getBoundingClientRect();
      setSwipe(((event.clientX - rect.left) / rect.width) * 100);
    };
    els.swipeHandle.addEventListener("pointerdown", (event) => {
      dragging = true;
      els.swipeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    els.swipeHandle.addEventListener("pointermove", move);
    els.swipeHandle.addEventListener("pointerup", () => { dragging = false; });
    els.swipeHandle.addEventListener("pointercancel", () => { dragging = false; });
  }

  /* ---------------- Basemap menu ---------------- */
  function buildBasemapMenu() {
    if (!els.basemapMenu) return;
    basemapKeys.forEach((key) => {
      const config = basemapConfig[key];
      const button = el("button", key === state.basemap ? "is-active" : "");
      button.type = "button";
      button.dataset.key = key;
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(key === state.basemap));
      button.appendChild(icon(BASEMAP_ICONS[key] || "bi-map"));
      const text = el("span");
      text.appendChild(el("strong", null, config.label));
      text.appendChild(el("small", null, key === "satellite" ? "Imagery" : key === "dark" ? "Low light" : key === "terrain" ? "Topographic" : "Street"));
      button.appendChild(text);
      button.addEventListener("click", () => setBasemap(key));
      els.basemapMenu.appendChild(button);
    });
  }

  function setBasemap(key) {
    if (!basemapConfig[key]) return;
    state.basemap = key;
    [mapA, state.mapB].filter(Boolean).forEach((map) => {
      map.getLayers().forEach((layer) => {
        const basemapKey = layer.get("basemapKey");
        if (basemapKey) layer.setVisible(basemapKey === key);
      });
    });
    els.basemapMenu.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.key === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
    closeMenus();
    toast(`${basemapConfig[key].label} basemap`, "success");
  }

  function closeMenus() {
    [els.basemapMenu, els.exportMenu].forEach((menu) => { if (menu) menu.hidden = true; });
    document.querySelectorAll("#basemapToggle, #exportToggle").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function toggleMenu(menu, button) {
    if (!menu || !button) return;
    const willOpen = menu.hidden;
    closeMenus();
    if (!willOpen) return;
    if (window.innerWidth <= 640) {
      menu.style.removeProperty("top");
      menu.style.removeProperty("left");
    } else {
      menu.style.top = `${Math.max(0, button.offsetTop - 6)}px`;
    }
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  /* ---------------- Identify / popups ---------------- */
  let identifyMode = false;

  function hidePopup() {
    els.popup.hidden = true;
    popupOverlay.setPosition(undefined);
  }

  function showPopup(coordinate, html) {
    els.popupBody.innerHTML = html;
    els.popup.hidden = false;
    popupOverlay.setPosition(coordinate);
  }

  function vectorFeatureLines(pixel) {
    const lines = [];
    mapA.forEachFeatureAtPixel(pixel, (feature) => {
      const label = feature.get("label");
      const layerKey = feature.get("layer");
      if (!label) return;
      const prefix = layerKey === "buffer" ? "Buffer" : layerKey === "management-zone" ? "Zone" : "Feature";
      lines.push(`<div><strong>${escapeHtml(prefix)}</strong>: ${escapeHtml(label)}</div>`);
    }, { hitTolerance: 5, layerFilter: (layer) => Boolean(layer.get("vectorKey")) });
    return lines;
  }

  mapA.on("singleclick", (event) => {
    if (!identifyMode) {
      const vectorLines = vectorFeatureLines(event.pixel);
      if (!vectorLines.length) {
        hidePopup();
        return;
      }
      const lonLat = ol.proj.toLonLat(event.coordinate);
      showPopup(event.coordinate, `<div class="gis-popup-title">Feature</div>${vectorLines.join("")}<small>${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}</small>`);
      return;
    }

    const lonLat = ol.proj.toLonLat(event.coordinate);
    const lines = vectorFeatureLines(event.pixel);
    const visibleRasters = state.rasterA.filter((layer) => layer.getVisible()).slice().reverse();
    const queries = visibleRasters.map((layer) => {
      const item = layer.get("item");
      return fetch(`${item.identify_url}?lon=${lonLat[0].toFixed(6)}&lat=${lonLat[1].toFixed(6)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((result) => {
          if (!result) return;
          const valueText = result.value === null || result.value === undefined
            ? result.label
            : `${Number(result.value).toLocaleString(undefined, { maximumFractionDigits: 3 })}${result.label ? " — " + result.label : ""}`;
          lines.push(`<div><strong>${escapeHtml(result.layer)}</strong>: ${escapeHtml(valueText)}</div>`);
        })
        .catch(() => {});
    });
    Promise.all(queries).then(() => {
      if (!lines.length) lines.push("<div>No registered layer value at this location.</div>");
      showPopup(event.coordinate, `<div class="gis-popup-title">Identify</div>${lines.join("")}<small>${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}</small>`);
    });
  });

  /* ---------------- Measure / draw ---------------- */
  let activeInteraction = null;
  const measureButtons = {
    line: document.getElementById("measureLine"),
    area: document.getElementById("measureArea"),
  };
  const drawButton = document.getElementById("drawToggle");
  const clearButton = document.getElementById("clearMeasure");

  function deactivateTools() {
    if (activeInteraction) {
      mapA.removeInteraction(activeInteraction);
      activeInteraction = null;
    }
    Object.values(measureButtons).forEach((button) => {
      if (!button) return;
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    if (drawButton) {
      drawButton.classList.remove("is-active");
      drawButton.setAttribute("aria-pressed", "false");
    }
  }

  function updateClearVisibility() {
    if (!clearButton) return;
    clearButton.hidden = measureSource.getFeatures().length === 0 && drawSource.getFeatures().length === 0;
  }

  function startMeasure(type) {
    const wasActive = measureButtons[type]?.classList.contains("is-active");
    deactivateTools();
    if (wasActive) return;
    const isLine = type === "line";
    const geometryFunction = isLine ? undefined : (coordinates, geometry) => {
      const ring = coordinates[0];
      if (!geometry) return new ol.geom.Polygon([ring.concat([ring[0]])]);
      geometry.setCoordinates([ring.concat([ring[0]])]);
      return geometry;
    };
    activeInteraction = new ol.interaction.Draw({
      source: measureSource,
      type: isLine ? "LineString" : "Polygon",
      geometryFunction,
      style: measureLayer.getStyle(),
    });
    mapA.addInteraction(activeInteraction);
    activeInteraction.on("drawstart", (event) => {
      measureSource.clear();
      measureTooltip.hidden = false;
      const geometry = event.feature.getGeometry();
      geometry.on("change", () => updateMeasureTooltip(geometry, isLine));
    });
    activeInteraction.on("drawend", (event) => {
      updateMeasureTooltip(event.feature.getGeometry(), isLine);
      mapA.removeInteraction(activeInteraction);
      activeInteraction = null;
      measureButtons[type]?.classList.remove("is-active");
      measureButtons[type]?.setAttribute("aria-pressed", "false");
      updateClearVisibility();
    });
    measureButtons[type]?.classList.add("is-active");
    measureButtons[type]?.setAttribute("aria-pressed", "true");
    updateClearVisibility();
    setMessage(isLine ? "Click to measure distance; double-click to finish" : "Click vertices to measure area; double-click to finish");
  }

  function updateMeasureTooltip(geometry, isLine) {
    let output;
    if (isLine) {
      const length = ol.sphere.getLength(geometry, { projection: "EPSG:3857" });
      output = length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${length.toFixed(1)} m`;
    } else {
      const area = ol.sphere.getArea(geometry, { projection: "EPSG:3857" });
      output = area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${area.toFixed(1)} m²`;
    }
    measureTooltip.textContent = output;
    const coordinates = geometry.getCoordinates();
    const last = isLine ? coordinates[coordinates.length - 1] : coordinates[0][coordinates[0].length - 1];
    measureOverlay.setPosition(last);
  }

  function startDraw() {
    const wasActive = drawButton?.classList.contains("is-active");
    deactivateTools();
    if (wasActive) return;
    activeInteraction = new ol.interaction.Draw({ source: drawSource, type: "Polygon", style: drawStyle });
    mapA.addInteraction(activeInteraction);
    activeInteraction.on("drawend", () => {
      mapA.removeInteraction(activeInteraction);
      activeInteraction = null;
      drawButton?.classList.remove("is-active");
      drawButton?.setAttribute("aria-pressed", "false");
      updateClearVisibility();
      setMessage("Polygon added to the drawing layer");
    });
    drawButton?.classList.add("is-active");
    drawButton?.setAttribute("aria-pressed", "true");
    setMessage("Draw a polygon: click vertices, double-click to finish");
  }

  function clearMeasurement() {
    deactivateTools();
    measureSource.clear();
    drawSource.clear();
    measureTooltip.hidden = true;
    measureOverlay.setPosition(undefined);
    updateClearVisibility();
    setMessage("");
  }

  /* ---------------- Mini-map ---------------- */
  let miniMap = null;
  const miniExtent = new ol.Feature(new ol.geom.Polygon([[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]]));
  const miniExtentSource = new ol.source.Vector({ features: [miniExtent] });

  function createMiniMap() {
    const target = document.getElementById("miniMap");
    if (!target) return;
    miniMap = new ol.Map({
      target: "miniMap",
      layers: [
        new ol.layer.Tile({ source: new ol.source.OSM({ crossOrigin: "anonymous" }) }),
        new ol.layer.Vector({
          source: miniExtentSource,
          style: new ol.style.Style({
            fill: new ol.style.Fill({ color: "rgba(11, 61, 46, 0.12)" }),
            stroke: new ol.style.Stroke({ color: "#0B3D2E", width: 2 }),
          }),
        }),
      ],
      controls: [],
      interactions: new ol.Collection(),
      view: new ol.View({ center: [0, 0], zoom: 2 }),
    });
    miniMap.on("singleclick", (event) => {
      mapA.getView().animate({ center: event.coordinate, duration: REDUCED ? 0 : 300 });
    });
    const update = () => {
      const size = mapA.getSize();
      if (!size) return;
      const extent = mapA.getView().calculateExtent(size);
      const ring = [
        [extent[0], extent[1]], [extent[0], extent[3]], [extent[2], extent[3]],
        [extent[2], extent[1]], [extent[0], extent[1]],
      ];
      miniExtent.setGeometry(new ol.geom.Polygon([ring]));
      miniMap.getView().setCenter(mapA.getView().getCenter());
      miniMap.getView().setZoom(Math.max(1, (mapA.getView().getZoom() || 2) - 4));
    };
    mapA.getView().on(["change:center", "change:resolution"], update);
    mapA.on("moveend", update);
    update();
  }

  /* ---------------- Export ---------------- */
  function niceDistance(value) {
    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);
    const nice = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
    return nice * Math.pow(10, exponent);
  }

  function waitForRender() {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      mapA.once("rendercomplete", finish);
      mapA.renderSync();
      setTimeout(finish, 900);
    });
  }

  function captureMap() {
    const target = document.getElementById("map");
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    const nodes = [...target.querySelectorAll(".ol-layer")];
    nodes.sort((a, b) => (parseFloat(getComputedStyle(a).zIndex) || 0) - (parseFloat(getComputedStyle(b).zIndex) || 0));
    nodes.forEach((node) => {
      const opacity = parseFloat(getComputedStyle(node).opacity);
      ctx.globalAlpha = Number.isNaN(opacity) ? 1 : opacity;
      node.querySelectorAll("canvas").forEach((item) => {
        const box = item.getBoundingClientRect();
        if (!box.width || !box.height) return;
        ctx.drawImage(item, box.left - rect.left, box.top - rect.top, box.width, box.height);
      });
      node.querySelectorAll("img").forEach((item) => {
        if (!item.complete || !item.naturalWidth) return;
        const box = item.getBoundingClientRect();
        if (!box.width || !box.height) return;
        ctx.drawImage(item, box.left - rect.left, box.top - rect.top, box.width, box.height);
      });
      ctx.globalAlpha = 1;
    });
    return { canvas, width: rect.width, height: rect.height, ratio };
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  async function composeExport() {
    await waitForRender();
    const capture = captureMap();
    const blocks = collectLegendBlocks();
    const scale = capture.ratio;
    const pad = 24;
    const header = 76;
    const footer = 34;
    const legendWidth = 300;
    const gap = 20;
    const legendHeight = blocks.reduce((sum, block) => {
      const rows = block.type === "continuous" ? 2 : (block.rows || []).length;
      return sum + 26 + rows * 18 + (block.note ? 16 : 0);
    }, 0) + 28;
    const contentHeight = Math.max(capture.height, legendHeight + 10);
    const width = pad * 2 + capture.width + gap + legendWidth;
    const height = header + contentHeight + footer + pad;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#F6F8F7";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#0B3D2E";
    ctx.fillRect(0, 0, width, header);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 20px Inter, 'Segoe UI', sans-serif";
    ctx.fillText(`${state.forestName} — Web GIS`, pad, 34);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "500 11px Inter, 'Segoe UI', sans-serif";
    ctx.fillText(`Registered data only · ${new Date().toLocaleDateString()} · EPSG:3857`, pad, 55);

    ctx.drawImage(capture.canvas, pad, header, capture.width, capture.height);
    ctx.strokeStyle = "#DDE6E0";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, header + 0.5, capture.width - 1, capture.height - 1);

    const legendX = pad + capture.width + gap;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, legendX - 12, header + 4, legendWidth + 12, Math.min(legendHeight, contentHeight - 8), 10);
    ctx.fill();
    ctx.strokeStyle = "#E3EAE5";
    ctx.stroke();

    let y = header + 30;
    ctx.fillStyle = "#0B3D2E";
    ctx.font = "700 13px Inter, 'Segoe UI', sans-serif";
    ctx.fillText("Legend", legendX, y);
    y += 20;
    ctx.strokeStyle = "#E3EAE5";
    ctx.beginPath();
    ctx.moveTo(legendX, y);
    ctx.lineTo(legendX + legendWidth - 16, y);
    ctx.stroke();
    y += 16;

    blocks.slice(0, 26).forEach((block) => {
      const title = block.title.length > 34 ? `${block.title.slice(0, 32)}…` : block.title;
      ctx.fillStyle = "#18211E";
      ctx.font = "600 11px Inter, 'Segoe UI', sans-serif";
      ctx.fillText(title, legendX, y);
      ctx.fillStyle = "#708078";
      ctx.font = "500 9px Inter, 'Segoe UI', sans-serif";
      const metaWidth = ctx.measureText(block.meta || "").width;
      ctx.fillText(block.meta || "", legendX + legendWidth - 20 - metaWidth, y);
      y += 16;
      if (block.type === "continuous") {
        const gradient = ctx.createLinearGradient(legendX, 0, legendX + 180, 0);
        const colors = block.colors || ["#fff", "#000"];
        colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
        ctx.fillStyle = gradient;
        ctx.fillRect(legendX, y - 8, 180, 10);
        ctx.fillStyle = "#708078";
        ctx.font = "500 9px Inter, 'Segoe UI', sans-serif";
        ctx.fillText(formatNumber(block.min, 2), legendX, y + 12);
        ctx.fillText(formatNumber(block.max, 2), legendX + 146, y + 12);
        y += 22;
      } else {
        (block.rows || []).forEach((row) => {
          ctx.fillStyle = row.color;
          ctx.fillRect(legendX, y - 8, 12, 12);
          ctx.fillStyle = "#18211E";
          ctx.font = "500 10px Inter, 'Segoe UI', sans-serif";
          ctx.fillText(row.label, legendX + 20, y + 1);
          if (row.value) {
            ctx.fillStyle = "#708078";
            ctx.font = "500 9px Inter, 'Segoe UI', sans-serif";
            const valueWidth = ctx.measureText(row.value).width;
            ctx.fillText(row.value, legendX + legendWidth - 22 - valueWidth, y + 1);
          }
          y += 18;
        });
      }
      if (block.note) {
        ctx.fillStyle = "#8A9A90";
        ctx.font = "500 8px Inter, 'Segoe UI', sans-serif";
        ctx.fillText(block.note, legendX, y + 2);
        y += 16;
      }
      y += 6;
    });
    if (blocks.length > 26) {
      ctx.fillStyle = "#708078";
      ctx.font = "500 9px Inter, 'Segoe UI', sans-serif";
      ctx.fillText(`+ ${blocks.length - 26} more active layers`, legendX, y);
    }

    // North arrow
    const nx = pad + capture.width - 32;
    const ny = header + 26;
    ctx.fillStyle = "#0B3D2E";
    ctx.beginPath();
    ctx.moveTo(nx, ny - 16);
    ctx.lineTo(nx + 7, ny + 2);
    ctx.lineTo(nx, ny - 3);
    ctx.lineTo(nx - 7, ny + 2);
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 9px Inter, 'Segoe UI', sans-serif";
    ctx.fillText("N", nx - 3, ny + 14);

    // Scale bar
    const view = mapA.getView();
    const center = ol.proj.toLonLat(view.getCenter());
    const resolution = view.getResolution();
    const metersPerPixel = resolution * Math.cos((center[1] * Math.PI) / 180);
    const barMeters = niceDistance(metersPerPixel * 120);
    const barWidth = Math.max(40, barMeters / metersPerPixel);
    const sx = pad + 18;
    const sy = header + capture.height - 22;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(sx - 6, sy - 16, barWidth + 44, 26);
    ctx.strokeStyle = "#0B3D2E";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + barWidth, sy);
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, sy + 4);
    ctx.moveTo(sx + barWidth, sy - 4);
    ctx.lineTo(sx + barWidth, sy + 4);
    ctx.stroke();
    ctx.fillStyle = "#18211E";
    ctx.font = "600 9px Inter, 'Segoe UI', sans-serif";
    ctx.fillText(barMeters >= 1000 ? `${(barMeters / 1000).toFixed(1)} km` : `${Math.round(barMeters)} m`, sx + 4, sy - 8);

    // Attribution
    const attribution = basemapConfig[state.basemap]?.attribution || "";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "500 8px Inter, 'Segoe UI', sans-serif";
    const attributionWidth = ctx.measureText(attribution).width;
    ctx.fillRect(pad + capture.width - attributionWidth - 12, header + capture.height - 20, attributionWidth + 8, 14);
    ctx.fillStyle = "#4E5E55";
    ctx.fillText(attribution, pad + capture.width - attributionWidth - 8, header + capture.height - 10);

    // Footer
    ctx.fillStyle = "#708078";
    ctx.font = "500 9px Inter, 'Segoe UI', sans-serif";
    ctx.fillText("FM-GDSS · Forest Management Geospatial Decision Support System", pad, height - 16);
    ctx.textAlign = "right";
    ctx.fillText(`${state.forestName} · ${state.yearA ? `LULC ${state.yearA}` : "No LULC year selected"}`, width - pad, height - 16);
    ctx.textAlign = "left";

    return canvas;
  }

  async function exportMap(type) {
    closeMenus();
    toast("Preparing export…", "info");
    try {
      const canvas = await composeExport();
      if (type === "pdf") {
        const dataUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          toast("Pop-up blocked; allow pop-ups to print the map", "error");
          return;
        }
        printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(state.forestName)} — Web GIS</title><style>@page{size:A4 landscape;margin:8mm}body{margin:0;font-family:Inter,'Segoe UI',sans-serif}img{width:100%;height:auto}p{font-size:10px;color:#555;margin:4px 0}</style></head><body><img src="${dataUrl}" alt="Web GIS export"><p>${escapeHtml(state.forestName)} — FM-GDSS Web GIS · registered data only</p><script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
        printWindow.document.close();
        toast("Print dialog opened — choose “Save as PDF”", "success");
        return;
      }
      const filename = `fmgdss-webgis-${state.forest || "forest"}-${new Date().toISOString().slice(0, 10)}.png`;
      const blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("empty blob"))), "image/png");
        } catch (error) {
          reject(error);
        }
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("PNG export downloaded", "success");
    } catch (error) {
      console.error("FM-GDSS export failed", error);
      toast("Export blocked by basemap image permissions (CORS). Switch to OpenStreetMap or Light and retry.", "error");
    }
  }

  /* ---------------- Theme / panels ---------------- */
  function applyTheme(theme) {
    state.theme = theme;
    APP.dataset.theme = theme;
    try { localStorage.setItem("fmgdss-gis-theme", theme); } catch (error) { /* storage may be unavailable */ }
    if (els.themeToggle) {
      els.themeToggle.innerHTML = theme === "dark" ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
      els.themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      els.themeToggle.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
    renderInsightsDebounced();
  }

  function setPanelOpen(open, silent) {
    state.panelOpen = open;
    els.gisPanel.classList.toggle("is-collapsed", !open);
    els.panelToggle.setAttribute("aria-expanded", String(open));
    els.panelToggle.innerHTML = open ? '<i class="bi bi-layout-sidebar-inset"></i>' : '<i class="bi bi-layout-sidebar"></i>';
    if (!silent) setTimeout(() => mapA.updateSize(), 260);
  }

  function setLegendCollapsed(collapsed) {
    els.legendPanel.classList.toggle("is-collapsed", collapsed);
    const button = document.getElementById("legendCollapse");
    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.innerHTML = collapsed ? '<i class="bi bi-plus-lg"></i>' : '<i class="bi bi-dash-lg"></i>';
    }
  }

  function setInsightsCollapsed(collapsed) {
    els.insightsPanel.classList.toggle("is-collapsed", collapsed);
    const button = document.getElementById("insightsCollapse");
    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.innerHTML = collapsed ? '<i class="bi bi-plus-lg"></i>' : '<i class="bi bi-dash-lg"></i>';
    }
    els.insightsToggle.setAttribute("aria-expanded", String(!collapsed));
    if (!collapsed) {
      requestAnimationFrame(() => {
        renderInsights();
        Object.values(state.charts).forEach((chart) => chart.resize());
      });
    }
  }

  function toggleInsights() {
    const collapsed = !els.insightsPanel.classList.contains("is-collapsed");
    setInsightsCollapsed(collapsed);
    if (window.innerWidth <= 900) els.insightsPanel.classList.toggle("is-open", !collapsed);
    if (!collapsed) {
      renderInsights();
      requestAnimationFrame(() => Object.values(state.charts).forEach((chart) => chart.resize()));
    }
  }

  function enableLegendDrag() {
    const handle = document.getElementById("legendDrag");
    const panel = els.legendPanel;
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button") || window.innerWidth <= 900) return;
      const rect = panel.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.width = `${rect.width}px`;
      panel.style.maxHeight = `${Math.min(rect.height || 320, window.innerHeight - 20)}px`;
      panel.style.zIndex = "60";
      panel.classList.add("is-floating");
      state.legendFloating = true;
      drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const x = Math.min(Math.max(8, event.clientX - drag.dx), window.innerWidth - panel.offsetWidth - 8);
      const y = Math.min(Math.max(8, event.clientY - drag.dy), window.innerHeight - 60);
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    });
    const end = () => { drag = null; };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    handle.addEventListener("dblclick", () => {
      ["position", "left", "top", "right", "bottom", "width", "maxHeight", "zIndex"].forEach((property) => { panel.style[property] = ""; });
      panel.classList.remove("is-floating");
      state.legendFloating = false;
    });
  }

  /* ---------------- Forest loading ---------------- */
  function showProgress(show) {
    if (els.progress) els.progress.hidden = !show;
    if (els.skeleton) els.skeleton.hidden = !show;
  }

  function fitExtent(extent4326, animate) {
    if (!extent4326) return;
    const extent = ol.proj.transformExtent(extent4326, "EPSG:4326", "EPSG:3857");
    mapA.getView().fit(extent, {
      padding: [90, 130, 90, 130],
      maxZoom: 17,
      duration: REDUCED || !animate ? 0 : 650,
    });
  }

  function resetMapView() {
    const original = vectorSources.original.getExtent();
    if (vectorSources.original.getFeatures().length && !ol.extent.isEmpty(original)) {
      mapA.getView().fit(original, { padding: [80, 120, 80, 120], maxZoom: 17, duration: REDUCED ? 0 : 450 });
    } else if (state.extent4326) {
      fitExtent(state.extent4326, true);
    } else {
      mapA.getView().animate({ center: [0, 0], zoom: 2, duration: REDUCED ? 0 : 300 });
    }
  }

  async function loadForest(code) {
    if (!code) return;
    const token = ++state.loadToken;
    stopPlay();
    state.forest = code;
    state.loaded = false;
    showProgress(true);
    els.layerPanel.setAttribute("aria-busy", "true");
    setMessage("Loading registered layers…");
    try {
      const analyticsUrl = `/api/analytics/${encodeURIComponent(code)}/`;
      const [workspaceResponse, catalogueResponse, analytics] = await Promise.all([
        fetch(`/api/forests/${encodeURIComponent(code)}/workspace/`),
        fetch(`/api/rasters/?forest=${encodeURIComponent(code)}`),
        fetch(analyticsUrl).then((response) => (response.ok ? response.json() : null)).catch(() => null),
      ]);
      if (token !== state.loadToken) return;
      if (!workspaceResponse.ok) throw new Error(`workspace ${workspaceResponse.status}`);
      if (!catalogueResponse.ok) throw new Error(`raster catalogue ${catalogueResponse.status}`);
      const workspace = await workspaceResponse.json();
      const items = await catalogueResponse.json();
      if (!Array.isArray(items)) throw new Error("unexpected raster catalogue response");

      state.analytics = analytics;
      state.changeRows = analytics?.indicators?.["Forest change"] || [];
      state.structureRows = analytics?.indicators?.["Forest edge and core structure"] || [];
      state.pressureRows = analytics?.indicators?.["Remote-sensing anthropogenic pressure proxy"] || [];
      state.extent4326 = workspace.extent || null;
      if (analytics?.forest?.name) state.forestName = analytics.forest.name;

      Object.values(vectorSources).forEach((source) => source.clear());
      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(workspace, { featureProjection: "EPSG:3857" });
      const counts = { training: 0, validation: 0, "management-zone": 0 };
      features.forEach((feature) => {
        const key = feature.get("layer");
        if (vectorSources[key]) vectorSources[key].addFeature(feature);
        if (counts[key] !== undefined) counts[key] += 1;
      });
      state.vectorCounts = counts;
      applyVectorVisibility("A");
      applyVectorVisibility("B");

      state.items = items;
      state.visible = {};
      state.opacity = {};
      items.forEach((item) => { state.visible[item.id] = false; });

      const itemYears = [...new Set(items.filter(isLulcSeries).map((item) => Number(item.year)).filter((year) => Number.isFinite(year)))].sort((a, b) => a - b);
      const analyticsYears = analytics?.lulc?.years ? Object.keys(analytics.lulc.years).map(Number).sort((a, b) => a - b) : [];
      state.years = itemYears.length ? itemYears : analyticsYears;

      const preferred = items.find((item) => /lulc-2025$/i.test(item.slug)) || items.find(isLulcSeries);
      state.yearA = preferred ? Number(preferred.year) : (state.years[state.years.length - 1] ?? null);
      state.yearB = state.years.find((year) => year !== state.yearA) ?? state.yearA;
      state.lulcOn = Boolean(preferred);

      removeRasterLayersA();
      let insertAt = basemapLayersA.length;
      items.forEach((item) => {
        const layer = buildRasterLayer(item);
        if (!layer) return;
        layer.setVisible(itemVisibleOn("A", item));
        state.rasterA.push(layer);
        mapA.getLayers().insertAt(insertAt, layer);
        insertAt += 1;
      });
      rebuildRasterLayersB();

      buildPanel();
      updateYearUi();
      updateLegend();
      renderInsights();
      updateLayerCount();

      const chipName = document.querySelector(".gis-forest-chip span");
      const chipArea = document.querySelector(".gis-forest-chip small");
      if (chipName) chipName.textContent = state.forestName;
      if (chipArea) chipArea.textContent = analytics?.forest?.area_ha ? `${formatNumber(analytics.forest.area_ha, 2)} ha` : "";

      if (workspace.extent) fitExtent(workspace.extent, true);
      else {
        setMessage("Boundary not yet registered for this forest", true);
        resetMapView();
      }

      const url = new URL(window.location.href);
      url.searchParams.set("forest", code);
      window.history.replaceState({}, "", url.toString());

      setMessage(`${state.forestName} · ${state.rasterA.length} registered raster layers`);
      toast(`${state.forestName} layers ready`, "success");
    } catch (error) {
      if (token !== state.loadToken) return;
      console.error("FM-GDSS layer loading failed", error);
      setMessage(`Could not load layers for ${code}: ${error.message}`, true);
      toast(`Could not load layers: ${error.message}`, "error");
      els.layerPanel.innerHTML = "";
      const retry = el("button", "gis-retry", "Retry loading layers");
      retry.type = "button";
      retry.addEventListener("click", () => loadForest(code));
      els.layerPanel.appendChild(retry);
    } finally {
      if (token === state.loadToken) {
        showProgress(false);
        els.layerPanel.setAttribute("aria-busy", "false");
        state.loaded = true;
        mapA.updateSize();
      }
    }
  }

  /* ---------------- UI bindings ---------------- */
  function bindUi() {
    if (els.forestSelect?.dataset.selected) els.forestSelect.value = els.forestSelect.dataset.selected;
    els.forestSelect?.addEventListener("change", () => loadForest(els.forestSelect.value));

    document.getElementById("panelToggle")?.addEventListener("click", () => setPanelOpen(els.gisPanel.classList.contains("is-collapsed")));
    document.getElementById("panelCollapse")?.addEventListener("click", () => setPanelOpen(false));
    document.getElementById("expandAll")?.addEventListener("click", () => setAllGroups(true));
    document.getElementById("collapseAll")?.addEventListener("click", () => setAllGroups(false));
    els.layerSearch?.addEventListener("input", debounceFrame(() => applyFilter(els.layerSearch.value)));

    document.getElementById("zoomIn")?.addEventListener("click", () => mapA.getView().animate({ zoom: (mapA.getView().getZoom() || 2) + 1, duration: REDUCED ? 0 : 220 }));
    document.getElementById("zoomOut")?.addEventListener("click", () => mapA.getView().animate({ zoom: (mapA.getView().getZoom() || 2) - 1, duration: REDUCED ? 0 : 220 }));
    document.getElementById("zoomToForest")?.addEventListener("click", resetMapView);

    document.getElementById("locateMe")?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        toast("Geolocation is not available in this browser", "error");
        return;
      }
      toast("Locating…", "info");
      navigator.geolocation.getCurrentPosition((position) => {
        const coordinate = ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]);
        mapA.getView().animate({ center: coordinate, zoom: 15, duration: REDUCED ? 0 : 650, easing: ol.easing.easeOut });
        toast("Moved to your location", "success");
      }, () => toast("Location permission denied or unavailable", "error"));
    });

    document.getElementById("identifyToggle")?.addEventListener("click", () => {
      identifyMode = !identifyMode;
      const button = document.getElementById("identifyToggle");
      button.classList.toggle("is-active", identifyMode);
      button.setAttribute("aria-pressed", String(identifyMode));
      setMessage(identifyMode ? "Identify mode: click the map to sample raster values" : "");
      if (!identifyMode) hidePopup();
    });
    measureButtons.line?.addEventListener("click", () => startMeasure("line"));
    measureButtons.area?.addEventListener("click", () => startMeasure("area"));
    drawButton?.addEventListener("click", startDraw);
    clearButton?.addEventListener("click", clearMeasurement);

    document.getElementById("basemapToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(els.basemapMenu, document.getElementById("basemapToggle"));
    });
    document.getElementById("exportToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(els.exportMenu, document.getElementById("exportToggle"));
    });
    els.exportMenu?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-export]");
      if (button) exportMap(button.dataset.export);
    });

    document.getElementById("fullscreenToggle")?.addEventListener("click", () => {
      const stage = document.getElementById("gisStage");
      if (document.fullscreenElement) document.exitFullscreen();
      else stage?.requestFullscreen?.();
    });
    document.addEventListener("fullscreenchange", () => {
      const button = document.getElementById("fullscreenToggle");
      if (button) button.innerHTML = document.fullscreenElement ? '<i class="bi bi-fullscreen-exit"></i>' : '<i class="bi bi-fullscreen"></i>';
      setTimeout(() => {
        mapA.updateSize();
        if (state.mapB) state.mapB.updateSize();
      }, 180);
    });

    document.getElementById("legendCollapse")?.addEventListener("click", () => setLegendCollapsed(!els.legendPanel.classList.contains("is-collapsed")));
    document.getElementById("insightsCollapse")?.addEventListener("click", toggleInsights);
    els.insightsToggle?.addEventListener("click", toggleInsights);
    els.themeToggle?.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
    document.getElementById("legendPrint")?.addEventListener("click", () => exportMap("pdf"));

    els.yearPlay?.addEventListener("click", togglePlay);
    els.yearSelectA?.addEventListener("change", () => setYear(els.yearSelectA.value, "A", true));
    els.yearSelectB?.addEventListener("change", () => setYear(els.yearSelectB.value, "B", true));

    document.querySelectorAll(".gis-mode-switch button").forEach((button) => {
      button.addEventListener("click", () => setCompareMode(button.dataset.mode));
    });

    document.getElementById("mapPopupClose")?.addEventListener("click", hidePopup);
    document.getElementById("layerInfoClose")?.addEventListener("click", () => { els.layerInfo.hidden = true; });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".gis-toolbar")) closeMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeMenus();
      hidePopup();
      els.layerInfo.hidden = true;
      if (els.gisPanel.classList.contains("is-collapsed") === false && window.innerWidth <= 900) setPanelOpen(false);
    });

    mapA.on("pointermove", (event) => {
      const lonLat = ol.proj.toLonLat(event.coordinate);
      if (els.coordinates) els.coordinates.textContent = `${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`;
    });
    mapA.getView().on("change:resolution", () => {
      const zoom = mapA.getView().getZoom();
      if (els.zoom) els.zoom.textContent = zoom === undefined ? "—" : zoom.toFixed(1).replace(/\.0$/, "");
    });

    window.addEventListener("resize", () => {
      mapA.updateSize();
      if (state.mapB) state.mapB.updateSize();
      if (miniMap) miniMap.updateSize();
      Object.values(state.charts).forEach((chart) => chart.resize());
    });
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    let savedTheme = null;
    try { savedTheme = localStorage.getItem("fmgdss-gis-theme"); } catch (error) { savedTheme = null; }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
    buildBasemapMenu();
    bindUi();
    enableSwipeDrag();
    enableLegendDrag();
    createMiniMap();
    if (window.ResizeObserver && els.insightsPanel) {
      new ResizeObserver(() => {
        Object.values(state.charts).forEach((chart) => chart.resize());
      }).observe(els.insightsPanel);
    }
    if (window.innerWidth <= 900) setPanelOpen(false, true);
    if (window.innerWidth <= 900) setLegendCollapsed(true);
    if (window.innerWidth < 1100) setInsightsCollapsed(true);
    if (els.yearPlay) els.yearPlay.setAttribute("aria-pressed", "false");
    requestAnimationFrame(() => {
      mapA.updateSize();
      loadForest(els.forestSelect?.value || state.forest);
    });
  }

  boot();
})();
