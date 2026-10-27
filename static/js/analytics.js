const CLASS_COLORS = { Forest: "#006400", Grassland: "#90EE90", Quarry: "#A0522D", "Quarry / Bare land": "#A0522D", "Built-up": "#D73027" };
const classColor = (name) => CLASS_COLORS[name] || "#496d58";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function renderClassCoverage(data) {
    const host = document.getElementById("lulcClassCoverage");
    if (!host || !data.lulc) return;
    const years = Object.keys(data.lulc.years).sort();
    const observed = [...new Set(years.flatMap((year) => Object.keys(data.lulc.years[year] || {})))];
    const classes = [...new Set([...(data.lulc.class_names || []), ...observed])];
    const badge = document.getElementById("lulcCoverageBadge");
    if (badge) badge.textContent = `${classes.length} configured classes`;
    host.innerHTML = classes.map((name) => {
        const recorded = years.filter((year) => Number.isFinite(data.lulc.years[year][name]));
        const missing = years.filter((year) => !Number.isFinite(data.lulc.years[year][name]));
        return `<article class="coverage-card">
            <header><span class="coverage-swatch" style="background:${classColor(name)}"></span><h3>${escapeHtml(name)}</h3><span class="coverage-count">${recorded.length}/${years.length}</span></header>
            <div class="coverage-years">${years.map((year) => `<span class="coverage-year ${recorded.includes(year) ? "is-recorded" : "is-missing"}">${escapeHtml(year)}</span>`).join("")}</div>
            <p>${missing.length ? `No record in ${escapeHtml(missing.join(", "))}` : "Recorded in every registered epoch"}</p>
        </article>`;
    }).join("");
}

(async function () {
    const url = window.FGMDSS_ANALYTICS_URL;
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    const section = window.FGMDSS_SECTION;
    if (section === "ecology") data.indicators = { "Forest edge and core structure": data.core_edge || [] };
    if (section === "pressure") data.indicators = { "Remote-sensing anthropogenic pressure proxy": data.rows || [] };
    if (section === "conservation") data.indicators = { "Management indices": data.rows || [] };
    if (section === "management") data.management_zones = data.zones || [];
    renderClassCoverage(data);
    document.querySelectorAll("[data-chart]").forEach((element) => {
        const chart = echarts.init(element);
        const chartKey = element.dataset.chart;
        let option = { animationDuration: 300, tooltip: { trigger: "axis" }, grid: { left: 48, right: 20, top: 24, bottom: 40 } };
        if (chartKey === "lulc") {
            const years = Object.keys(data.lulc.years).sort();
            const observed = [...new Set(years.flatMap((year) => Object.keys(data.lulc.years[year])))];
            const classes = [...new Set([...(data.lulc.class_names || []), ...observed])];
            option = {
                ...option,
                animationDuration: 320,
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    formatter: (params) => `${escapeHtml(params[0]?.axisValue ?? "")}<br/>` + params.map((point) => `${point.marker}${escapeHtml(point.seriesName)}: ${point.value === null || point.value === undefined ? "not recorded" : Number(point.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " ha"}`).join("<br/>"),
                },
                legend: { data: classes },
                xAxis: { type: "category", data: years },
                yAxis: { type: "value", name: "ha" },
                series: classes.map((name) => ({
                    name, type: "bar", stack: "area",
                    itemStyle: { color: classColor(name) },
                    data: years.map((year) => Number.isFinite(data.lulc.years[year][name]) ? data.lulc.years[year][name] : null),
                })),
            };
        } else if (chartKey === "lulc-transitions") {
            const url = window.FGMDSS_TRANSITIONS_URL;
            if (!url) return;
            fetch(url).then((r) => {
                if (!r.ok) throw new Error("transitions " + r.status);
                return r.json();
            }).then((rows) => {
                if (!rows.length) {
                    chart.setOption({ graphic: [{ type: "text", left: "center", top: "middle", style: { text: "No LULC transitions imported.", fill: "#7d8f85", fontSize: 13 } }] });
                    return;
                }
                let unit = "percent";
                const draw = () => {
                    const fromClasses = [...new Set(rows.map((r) => r.from_class))];
                    const toClasses = [...new Set(rows.map((r) => r.to_class))];
                    const total = rows.reduce((sum, r) => sum + r.area_ha, 0);
                    const cellValue = (r) => unit === "percent" && total ? +(r.area_ha / total * 100).toFixed(2) : +r.area_ha.toFixed(2);
                    const cells = rows.map((r) => [toClasses.indexOf(r.to_class), fromClasses.indexOf(r.from_class), cellValue(r), r.area_ha]);
                    const max = Math.max(...cells.map((d) => d[2]));
                    chart.setOption({
                        animationDuration: 300,
                        tooltip: {
                            formatter: (p) => {
                                const raw = cells[p.dataIndex];
                                return `${fromClasses[raw[1]]} → ${toClasses[raw[0]]}<br/>` +
                                    (unit === "percent" ? raw[2] + "% of all change" : raw[3].toLocaleString(undefined, { maximumFractionDigits: 2 }) + " ha");
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
                            data: cells.map((d) => [d[0], d[1], d[2]]),
                            label: { show: true, color: "#1f3329", fontSize: 11, formatter: (p) => p.data[2] },
                            emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.25)" } },
                        }],
                    }, true);
                };
                document.querySelectorAll("[data-matrix-unit]").forEach((button) => {
                    button.addEventListener("click", () => {
                        document.querySelectorAll("[data-matrix-unit]").forEach((b) => b.classList.remove("is-active"));
                        button.classList.add("is-active");
                        unit = button.dataset.matrixUnit;
                        draw();
                    });
                });
                draw();
            }).catch(() => chart.setOption({ graphic: [{ type: "text", left: "center", top: "middle", style: { text: "Transition data is not available.", fill: "#7d8f85", fontSize: 13 } }] }));
            return;
        } else if (chartKey === "ecology-core-edge") {
            const rows = data.indicators["Forest edge and core structure"] || [];
            option = { ...option, xAxis: { type: "category", data: rows.map((row) => row.Structure || row.structure || "Indicator") }, yAxis: { type: "value", name: "ha" }, series: [{ type: "bar", data: rows.map((row) => Number(row.Area_ha || row.area_ha || 0)), itemStyle: { color: "#2d7253" } }] };
        } else if (section === "pressure") {
            const rows = data.indicators["Remote-sensing anthropogenic pressure proxy"] || [];
            option = { ...option, xAxis: { type: "category", data: rows.map((row) => row.Indicator || "Indicator") }, yAxis: { type: "value", name: "ha" }, series: [{ type: "bar", data: rows.map((row) => Number(row.Area_ha || 0)), itemStyle: { color: "#c78a2c" } }] };
        } else if (section === "conservation") {
            const rows = data.indicators["Management indices"] || [];
            option = { ...option, xAxis: { type: "category", data: rows.map((row) => row.Indicator || "Index") }, yAxis: { type: "value" }, series: [{ type: "bar", data: rows.map((row) => Number(row.Mean || 0)), itemStyle: { color: "#496d58" } }] };
        } else if (section === "management") {
            option = { ...option, tooltip: { trigger: "item" }, series: [{ type: "pie", radius: ["35%", "68%"], data: data.management_zones.map((row) => ({ name: row.zone_name, value: row.area_ha })) }] };
        } else if (section === "overview-management") {
            option = { ...option, tooltip: { trigger: "item" }, series: [{ type: "pie", radius: ["35%", "68%"], data: data.management_zones.map((row) => ({ name: row.zone_name, value: row.area_ha })) }] };
        } else if (section === "training") {
            option = { ...option, xAxis: { type: "category", data: data.training.datasets.map((row) => row.name) }, yAxis: { type: "value", name: "samples" }, series: [{ name: "Training", type: "bar", data: data.training.datasets.map((row) => row.training_count) }, { name: "Validation", type: "bar", data: data.training.datasets.map((row) => row.validation_count) }] };
        }
        chart.setOption(option);
        window.addEventListener("resize", () => chart.resize());
    });
    const table = document.getElementById("metadata-table");
    if (table) {
        const rows = section === "metadata" ? data.rasters : data.products;
        table.innerHTML = rows.length ? `<table class="professional-table"><thead><tr><th>Name</th><th>Year</th><th>Source</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.name || row.title}</td><td>${row.year || "-"}</td><td>${row.source || "-"}</td><td>${row.publication_status || (row.active ? "Available" : "Registered")}</td></tr>`).join("")}</tbody></table>` : '<p class="table-empty">No records are currently registered.</p>';
    }
})();