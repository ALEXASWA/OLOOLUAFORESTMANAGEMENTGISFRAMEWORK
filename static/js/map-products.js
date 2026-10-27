(async function () {
    const gallery = document.getElementById("product-gallery");
    const downloads = document.getElementById("product-downloads");
    const count = document.getElementById("product-count");
    const year = document.getElementById("product-year");
    const type = document.getElementById("product-type");
    const search = document.getElementById("product-search");
    const chips = document.getElementById("product-chips");
    const lightbox = document.getElementById("product-lightbox");
    const image = document.getElementById("lightbox-image");
    const empty = document.getElementById("lightbox-empty");
    const loading = document.getElementById("lightbox-loading");
    const closeButton = document.querySelector(".lightbox-close");

    const FAMILY_ORDER = { "Land cover": 0, "Forest structure": 1, "Pressure": 2, "Management": 3, "Documentation": 4, "QGIS project": 5 };
    const FAMILY_TONES = { "Land cover": "#0f6b3f", "Forest structure": "#0f766e", "Pressure": "#b45309", "Management": "#2d5f9e", "Documentation": "#6b7280", "QGIS project": "#7c3aed" };
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const formatSize = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
    const familyOf = (product) => product.category || "Research map";
    const toneFor = (product) => FAMILY_TONES[familyOf(product)] || "#2d7253";

    let products = [];
    let filtered = [];
    let activeFamily = "";
    let current = 0;
    let lastFocused = null;

    try {
        const response = await fetch(window.FGMDSS_PRODUCTS_URL);
        if (!response.ok) throw new Error("map products " + response.status);
        products = await response.json();
        if (!Array.isArray(products)) throw new Error("Unexpected map products payload");
    } catch (error) {
        renderError();
        return;
    }

    const sortProducts = (a, b) => {
        const familyA = FAMILY_ORDER[familyOf(a)] ?? 9;
        const familyB = FAMILY_ORDER[familyOf(b)] ?? 9;
        if (familyA !== familyB) return familyA - familyB;
        if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
        return (a.title || "").localeCompare(b.title || "");
    };

    const TYPE_MATCHERS = {
        lulc: (product) => /lulc|land cover/i.test(`${product.category || ""} ${product.title || ""}`),
        density: (product) => /density/i.test(product.title || ""),
        fragmentation: (product) => /fragment/i.test(product.title || ""),
        pressure: (product) => /pressure/i.test(product.title || ""),
        management: (product) => /management/i.test(product.title || ""),
        rehabilitation: (product) => /rehabilitat/i.test(product.title || ""),
        methodology: (product) => /methodolog/i.test(product.title || ""),
        qgis: (product) => String(product.type || "").toLowerCase() === "qgis",
    };

    const matches = (product) => {
        const searchText = `${product.category || ""} ${product.title || ""} ${product.description || ""}`.toLowerCase();
        const typeMatcher = TYPE_MATCHERS[type.value];
        return (!year.value || String(product.year) === year.value) &&
            (!type.value || (typeMatcher ? typeMatcher(product) : searchText.includes(type.value))) &&
            (!activeFamily || familyOf(product) === activeFamily) &&
            (!search.value || searchText.includes(search.value.toLowerCase()));
    };

    const imageProducts = () => filtered.filter((product) => product.type === "image");

    const renderStats = () => {
        const images = products.filter((product) => product.type === "image");
        const epochs = [...new Set(products.filter((product) => product.year).map((product) => product.year))];
        const formats = [...new Set(products.map((product) => product.type))];
        document.getElementById("mpStatMaps").textContent = images.length;
        document.getElementById("mpStatEpochs").textContent = epochs.length;
        document.getElementById("mpStatFormats").textContent = formats.length;
    };

    const renderChips = () => {
        const families = [...new Set(products.map(familyOf))].sort((a, b) => (FAMILY_ORDER[a] ?? 9) - (FAMILY_ORDER[b] ?? 9));
        const entries = [{ label: "All maps", value: "", total: products.length }].concat(
            families.map((family) => ({ label: family, value: family, total: products.filter((product) => familyOf(product) === family).length }))
        );
        chips.innerHTML = entries.map((entry) => `<button type="button" class="mp-chip" data-family="${escapeHtml(entry.value)}" aria-pressed="false"><span>${escapeHtml(entry.label)}</span><b>${entry.total}</b></button>`).join("");
        updateChipState();
    };

    const updateChipState = () => {
        chips.querySelectorAll("[data-family]").forEach((button) => {
            const active = button.dataset.family === activeFamily;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    };

    const cardMarkup = (product, index) => {
        const title = escapeHtml(product.title);
        const thumb = product.thumbnail_url
            ? `<img loading="lazy" decoding="async" src="${escapeHtml(product.thumbnail_url)}" alt="${title}">`
            : `<span class="product-preview-fallback"><i class="bi bi-map"></i></span>`;
        return `<article class="product-card" style="--stagger:${Math.min(index * 55, 440)}ms;--accent:${toneFor(product)}">
            <button class="product-preview" type="button" data-view="${index}" aria-label="Open ${title}">
                ${thumb}
                <span class="product-family">${escapeHtml(familyOf(product))}</span>
                <span class="product-year">${product.year || "Output"}</span>
                <span class="product-open"><i class="bi bi-arrows-fullscreen"></i> Open map</span>
            </button>
            <div class="product-body">
                <div class="product-card-meta"><span>${escapeHtml(familyOf(product))}</span><span>${escapeHtml(String(product.type || "image").toUpperCase())} &middot; ${formatSize(product.size)}</span></div>
                <h3>${title}</h3>
                <p>${escapeHtml(product.description || "Exported map product, registered for this forest.")}</p>
                <div class="product-actions">
                    <button type="button" data-view="${index}"><i class="bi bi-eye"></i> Preview</button>
                    <button type="button" data-fullscreen="${index}"><i class="bi bi-fullscreen"></i> Fullscreen</button>
                    <a href="${escapeHtml(product.original_url)}" download><i class="bi bi-download"></i> Download</a>
                </div>
            </div>
        </article>`;
    };

    const emptyMarkup = () => `<div class="empty-state product-empty"><div class="empty-state-icon"><i class="bi bi-map"></i></div><span class="muted-label">No matching maps</span><h2>Adjust the collection filters</h2><p>No image products match the current year, type, family or search. Project files that match remain available below.</p><button type="button" class="btn btn-forest" data-clear-filters>Clear filters</button></div>`;

    const render = () => {
        filtered = products.filter(matches).sort(sortProducts);
        const images = imageProducts();
        count.textContent = `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`;
        gallery.setAttribute("aria-busy", "false");
        gallery.innerHTML = images.map(cardMarkup).join("") || emptyMarkup();
        downloads.innerHTML = filtered.filter((product) => product.type !== "image").map((product) => `<a class="download-item" href="${escapeHtml(product.original_url)}" download><span class="download-icon"><i class="bi ${product.type === "qgis" ? "bi-map" : "bi-file-earmark-pdf"}"></i></span><span class="download-copy"><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(familyOf(product))} &middot; ${escapeHtml(String(product.type).toUpperCase())} &middot; ${formatSize(product.size)} &middot; registered export</small></span><span class="download-cta"><i class="bi bi-download"></i></span></a>`).join("") || '<p class="table-empty">No QGIS or PDF downloads match the current filters.</p>';
    };

    function renderError() {
        if (gallery) {
            gallery.setAttribute("aria-busy", "false");
            gallery.innerHTML = '<div class="empty-state product-empty"><div class="empty-state-icon"><i class="bi bi-cloud-slash"></i></div><span class="muted-label">Catalogue unavailable</span><h2>Map products could not be loaded</h2><p>The registered product catalogue did not respond. Refresh the page or check the data connection.</p></div>';
        }
        if (downloads) downloads.innerHTML = '<p class="table-empty">Downloads are temporarily unavailable.</p>';
        if (count) count.textContent = "Unavailable";
        ["mpStatMaps", "mpStatEpochs", "mpStatFormats"].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.textContent = "—";
        });
    }

    const openViewer = (index, fullscreen, trigger) => {
        const images = imageProducts();
        const product = images[index];
        if (!product) return;
        current = index;
        if (lightbox.hidden) lastFocused = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        image.hidden = true;
        empty.hidden = true;
        if (loading) loading.hidden = false;
        image.alt = product.title;
        const settle = () => {
            image.hidden = false;
            if (loading) loading.hidden = true;
        };
        image.onload = settle;
        image.onerror = () => {
            image.hidden = true;
            if (loading) loading.hidden = true;
            empty.hidden = false;
        };
        image.src = product.preview_url || product.original_url;
        if (image.complete && image.naturalWidth) settle();
        document.getElementById("lightbox-title").textContent = product.title;
        document.getElementById("lightbox-description").textContent = product.description || "Exported map product registered for this forest.";
        document.getElementById("lightbox-type").textContent = `${familyOf(product)}${product.year ? " · " + product.year : ""}`;
        document.getElementById("lightbox-download").href = product.original_url;
        lightbox.hidden = false;
        document.body.classList.add("lightbox-open");
        requestAnimationFrame(() => {
            lightbox.classList.add("is-open");
            closeButton?.focus({ preventScroll: true });
        });
        if (fullscreen) {
            const request = lightbox.requestFullscreen?.();
            if (request?.catch) request.catch(() => { });
        }
    };

    const closeViewer = () => {
        if (lightbox.hidden) return;
        lightbox.classList.remove("is-open");
        document.body.classList.remove("lightbox-open");
        const finish = () => {
            lightbox.hidden = true;
            image.removeAttribute("src");
            image.hidden = false;
            empty.hidden = true;
            if (loading) loading.hidden = true;
            if (lastFocused?.isConnected) lastFocused.focus({ preventScroll: true });
        };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
        else setTimeout(finish, 200);
        if (document.fullscreenElement) {
            const exit = document.exitFullscreen?.();
            if (exit?.catch) exit.catch(() => { });
        }
    };

    const move = (step) => {
        const images = imageProducts();
        if (!images.length) return;
        current = (current + step + images.length) % images.length;
        openViewer(current, false);
    };

    const resetFilters = () => {
        year.value = "";
        type.value = "";
        search.value = "";
        activeFamily = "";
        updateChipState();
        render();
    };

    const preloaded = new Set();
    gallery.addEventListener("pointerover", (event) => {
        const view = event.target.closest("[data-view]");
        if (!view) return;
        const product = imageProducts()[Number(view.dataset.view)];
        if (!product || !product.preview_url || preloaded.has(product.id)) return;
        preloaded.add(product.id);
        new Image().src = product.preview_url;
    });

    gallery.addEventListener("click", (event) => {
        const clear = event.target.closest("[data-clear-filters]");
        if (clear) { resetFilters(); return; }
        const view = event.target.closest("[data-view]");
        if (view) { openViewer(Number(view.dataset.view), false, view); return; }
        const fullscreen = event.target.closest("[data-fullscreen]");
        if (fullscreen) openViewer(Number(fullscreen.dataset.fullscreen), true, fullscreen);
    });

    chips.addEventListener("click", (event) => {
        const button = event.target.closest("[data-family]");
        if (!button) return;
        activeFamily = button.dataset.family;
        type.value = "";
        updateChipState();
        render();
    });

    year.addEventListener("change", render);
    type.addEventListener("change", () => { activeFamily = ""; updateChipState(); render(); });
    search.addEventListener("input", render);
    document.querySelector(".lightbox-close").addEventListener("click", closeViewer);
    document.querySelector(".lightbox-prev").addEventListener("click", () => move(-1));
    document.querySelector(".lightbox-next").addEventListener("click", () => move(1));
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeViewer(); });
    document.addEventListener("keydown", (event) => {
        if (lightbox.hidden) return;
        if (event.key === "Escape") { event.preventDefault(); closeViewer(); return; }
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); return; }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); return; }
        if (event.key === "Tab") {
            const focusable = [...lightbox.querySelectorAll('button, a[href]')].filter((element) => !element.hidden);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    renderStats();
    renderChips();
    render();
})();
