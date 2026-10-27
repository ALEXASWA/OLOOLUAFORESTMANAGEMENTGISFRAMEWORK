(function () {
    const CLASS_COLORS = { Forest: "#006400", Grassland: "#90EE90", Quarry: "#A0522D", "Quarry / Bare land": "#A0522D", "Built-up": "#D73027" };
    const colorFor = (name) => CLASS_COLORS[name] || "#496d58";
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const formatArea = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });

    const charts = [];
    function initChart(id) {
        const element = document.getElementById(id);
        if (!element || typeof echarts === "undefined") return null;
        const chart = echarts.init(element);
        charts.push(chart);
        return chart;
    }
    window.addEventListener("resize", () => charts.forEach((chart) => chart.resize()));

    function showEmpty(chart, message) {
        if (!chart) return;
        chart.clear();
        chart.setOption({
            graphic: [{ type: "text", left: "center", top: "middle", style: { text: message, fill: "#7d8f85", fontSize: 13 } }],
        });
    }

    const analyticsUrl = window.FGMDSS_ANALYTICS_URL;
    if (!analyticsUrl) return;

    fetch(analyticsUrl).then((r) => {
        if (!r.ok) throw new Error("analytics " + r.status);
        return r.json();
    }).then((data) => {
        const lulc = data.lulc || {};
        renderComposition(lulc.years || {}, lulc.class_names || []);
        renderTrend(lulc.years || {});
    }).catch(() => {
        showEmpty(initChart("compositionChart"), "LULC statistics are not available for this forest.");
        showEmpty(initChart("trendChart"), "LULC statistics are not available for this forest.");
    });

    /* ---- Land-cover composition (single year, horizontal bars) ---- */
    let compositionYears = [];
    let compositionClasses = [];
    function renderComposition(years, configuredClasses) {
        const chart = initChart("compositionChart");
        const yearSelect = document.getElementById("compositionYear");
        compositionYears = Object.keys(years).sort();
        const observed = [...new Set(compositionYears.flatMap((year) => Object.keys(years[year] || {})))];
        compositionClasses = [...new Set([...(configuredClasses || []), ...observed])];
        if (!compositionYears.length) { showEmpty(chart, "No LULC statistics imported."); return; }
        compositionYears.forEach((year) => {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            yearSelect?.appendChild(option);
        });
        const initial = compositionYears[compositionYears.length - 1];
        if (yearSelect) yearSelect.value = initial;
        yearSelect?.addEventListener("change", () => drawComposition(chart, years, yearSelect.value));
        drawComposition(chart, years, initial);
    }

    function renderCompositionChips(year, yearData) {
        const host = document.getElementById("compositionClasses");
        if (!host) return;
        host.innerHTML = compositionClasses.map((name) => {
            const recorded = Number.isFinite(yearData[name]);
            return `<span class="class-chip ${recorded ? "" : "is-missing"}" title="${escapeHtml(name)}: ${recorded ? "recorded" : "no record"} for ${escapeHtml(year)}"><i style="background:${colorFor(name)}"></i>${escapeHtml(name)}${recorded ? "" : "<em>no record</em>"}</span>`;
        }).join("");
    }

    function drawComposition(chart, years, year) {
        if (!chart) return;
        const yearData = years[year] || {};
        renderCompositionChips(year, yearData);
        const rows = compositionClasses
            .map((name) => ({ name, area: Number.isFinite(yearData[name]) ? yearData[name] : null }))
            .sort((a, b) => (b.area ?? -1) - (a.area ?? -1));
        const title = document.getElementById("compositionTitle");
        if (title) title.textContent = "Land-cover composition | " + year;
        const note = document.getElementById("compositionNote");
        const missing = rows.filter((row) => row.area === null).map((row) => row.name);
        if (note) {
            note.hidden = missing.length === 0;
            note.textContent = missing.length
                ? `${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no recorded area in the ${year} imported statistics. Shown for class completeness; no value is inferred.`
                : "";
        }
        if (!rows.length) { showEmpty(chart, "No classes configured for this forest."); return; }
        chart.setOption({
            animationDuration: 300,
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params) => {
                    const point = params[0];
                    if (!point) return "";
                    const item = point.data;
                    const value = item.missing ? "No area recorded in the registered statistics" : `${formatArea(item.value)} ha`;
                    return `<div style="font-weight:700;margin-bottom:2px">${escapeHtml(point.name)}</div><div>${value}</div>`;
                },
            },
            grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
            xAxis: { type: "value", name: "Area (ha)", axisLabel: { color: "#7d8f85" } },
            yAxis: {
                type: "category",
                data: rows.map((row) => ({ value: row.name, textStyle: { color: row.area === null ? "#8a9992" : "#2f4a3e" } })),
            },
            series: [{
                type: "bar",
                data: rows.map((row) => ({
                    value: row.area ?? 0,
                    missing: row.area === null,
                    itemStyle: { color: row.area === null ? "rgba(112, 128, 120, .22)" : colorFor(row.name), borderRadius: [0, 5, 5, 0] },
                    label: { color: row.area === null ? "#8a9992" : "#2f4a3e" },
                })),
                label: { show: true, position: "right", formatter: (point) => point.data.missing ? "no record" : formatArea(point.value) },
                barWidth: "55%",
            }],
        }, true);
    }

    /* ---- LULC area by year (multi-line, ha / % toggle) ---- */
    let trendUnit = "ha";
    let trendYears = {};
    function renderTrend(years) {
        const chart = initChart("trendChart");
        trendYears = years;
        const yearList = Object.keys(years).sort();
        if (!yearList.length) { showEmpty(chart, "No LULC statistics imported."); return; }
        document.querySelectorAll("[data-unit]").forEach((button) => {
            button.addEventListener("click", () => {
                document.querySelectorAll("[data-unit]").forEach((b) => b.classList.remove("is-active"));
                button.classList.add("is-active");
                trendUnit = button.dataset.unit;
                drawTrend(chart, yearList);
            });
        });
        drawTrend(chart, yearList);
    }

    function drawTrend(chart, yearList) {
        if (!chart) return;
        const observed = [...new Set(yearList.flatMap((year) => Object.keys(trendYears[year])))];
        const classNames = [...new Set([...compositionClasses, ...observed])];
        const totals = {};
        yearList.forEach((year) => { totals[year] = Object.values(trendYears[year]).reduce((a, b) => a + b, 0); });
        const value = (year, name) => {
            const area = trendYears[year][name];
            if (!Number.isFinite(area)) return null;
            return trendUnit === "percent" && totals[year] ? +(area / totals[year] * 100).toFixed(2) : +area.toFixed(2);
        };
        chart.setOption({
            animationDuration: 300,
            tooltip: {
                trigger: "axis",
                formatter: (params) => `${escapeHtml(params[0]?.axisValue ?? "")}<br/>` + params.map((point) => `${point.marker}${escapeHtml(point.seriesName)}: ${point.value === null || point.value === undefined ? "not recorded" : trendUnit === "percent" ? point.value + "%" : formatArea(point.value) + " ha"}`).join("<br/>"),
            },
            legend: { data: classNames, bottom: 0, textStyle: { color: "#2f4a3e" } },
            grid: { left: 48, right: 20, top: 24, bottom: 48 },
            xAxis: { type: "category", data: yearList, boundaryGap: false, axisLabel: { color: "#7d8f85" } },
            yAxis: { type: "value", name: trendUnit === "percent" ? "%" : "ha", axisLabel: { color: "#7d8f85" } },
            series: classNames.map((name) => ({
                name, type: "line", smooth: true, symbolSize: 7, connectNulls: false,
                data: yearList.map((year) => value(year, name)),
                lineStyle: { width: 2.5, color: colorFor(name) }, itemStyle: { color: colorFor(name) },
            })),
        }, true);
    }

    /* ---- LULC transition matrix (heatmap) ---- */
    let matrixUnit = "percent";
    const transitionsUrl = window.FGMDSS_TRANSITIONS_URL;
    if (transitionsUrl) {
        fetch(transitionsUrl).then((r) => {
            if (!r.ok) throw new Error("transitions " + r.status);
            return r.json();
        }).then((rows) => {
            const chart = initChart("transitionChart");
            if (!rows.length) { showEmpty(chart, "No LULC transitions imported."); return; }
            document.querySelectorAll("[data-matrix-unit]").forEach((button) => {
                button.addEventListener("click", () => {
                    document.querySelectorAll("[data-matrix-unit]").forEach((b) => b.classList.remove("is-active"));
                    button.classList.add("is-active");
                    matrixUnit = button.dataset.matrixUnit;
                    drawMatrix(chart, rows);
                });
            });
            drawMatrix(chart, rows);
        }).catch(() => showEmpty(initChart("transitionChart"), "Transition data is not available."));
    }

    function drawMatrix(chart, rows) {
        if (!chart) return;
        const fromClasses = [...new Set(rows.map((r) => r.from_class))];
        const toClasses = [...new Set(rows.map((r) => r.to_class))];
        const total = rows.reduce((sum, r) => sum + r.area_ha, 0);
        const cellValue = (r) => matrixUnit === "percent" && total ? +(r.area_ha / total * 100).toFixed(2) : +r.area_ha.toFixed(2);
        const data = rows.map((r) => [toClasses.indexOf(r.to_class), fromClasses.indexOf(r.from_class), cellValue(r), r.area_ha]);
        const max = Math.max(...data.map((d) => d[2]));
        chart.setOption({
            animationDuration: 300,
            tooltip: {
                formatter: (p) => {
                    const raw = data[p.dataIndex];
                    return `${fromClasses[raw[1]]} → ${toClasses[raw[0]]}<br/>` +
                        (matrixUnit === "percent" ? raw[2] + "% of all change" : raw[3].toLocaleString(undefined, { maximumFractionDigits: 2 }) + " ha");
                },
            },
            grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
            xAxis: { type: "category", data: toClasses, name: "To", nameLocation: "middle", nameGap: 28, axisLabel: { color: "#2f4a3e" }, splitArea: { show: true } },
            yAxis: { type: "category", data: fromClasses, name: "From", axisLabel: { color: "#2f4a3e" }, splitArea: { show: true } },
            visualMap: {
                min: 0, max: max || 1, calculable: true, orient: "vertical", right: 0, top: "center",
                inRange: { color: ["#f1f6f1", "#a8d5b2", "#4c9a68", "#006400"] },
                textStyle: { color: "#7d8f85" },
            },
            series: [{
                type: "heatmap",
                data: data.map((d) => [d[0], d[1], d[2]]),
                label: { show: true, color: "#1f3329", fontSize: 11, formatter: (p) => p.data[2] },
                emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.25)" } },
            }],
        }, true);
    }
})();
