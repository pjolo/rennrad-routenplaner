// ============================================
// HAUPTANWENDUNG
// ============================================

const App = {
    map: null,
    routeLayers: [],
    startMarker: null,
    elevationChart: null,
    routes: [],
    selectedRoute: -1,
    startCoords: null,

    // State
    routeType: 'round',
    terrainProfile: 'flat',

    /**
     * Initialisierung
     */
    init() {
        this.initMap();
        this.bindEvents();
        this.checkApiKey();
    },

    /**
     * Prüft ob ein API-Key gesetzt ist
     */
    checkApiKey() {
        if (CONFIG.ORS_API_KEY === 'DEIN_API_KEY_HIER' || !CONFIG.ORS_API_KEY) {
            this.showApiKeyPrompt();
        }
    },

    /**
     * Zeigt einen Dialog zur API-Key Eingabe
     */
    showApiKeyPrompt() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'api-key-overlay';
        overlay.innerHTML = `
            <div class="loading-content" style="max-width: 450px; text-align: left;">
                <h2 style="color: var(--primary); margin-bottom: 1rem; text-align: center;">
                    <i class="fas fa-key"></i> API-Key benötigt
                </h2>
                <p style="margin-bottom: 0.8rem; font-size: 0.9rem; color: var(--text-secondary);">
                    Diese App benötigt einen kostenlosen OpenRouteService API-Key.
                </p>
                <ol style="margin-bottom: 1rem; padding-left: 1.2rem; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
                    <li>Gehe zu <a href="https://openrouteservice.org/dev/#/signup" target="_blank" 
                        style="color: var(--primary);">openrouteservice.org</a></li>
                    <li>Erstelle einen kostenlosen Account</li>
                    <li>Kopiere deinen API-Key</li>
                    <li>Füge ihn unten ein</li>
                </ol>
                <input type="text" id="api-key-input" placeholder="API-Key hier einfügen..." 
                    style="width: 100%; padding: 0.7rem; margin-bottom: 0.8rem; background: var(--bg-input); 
                    border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); 
                    font-family: monospace; font-size: 0.85rem;">
                <button onclick="App.saveApiKey()" 
                    style="width: 100%; padding: 0.7rem; background: var(--primary); border: none; 
                    border-radius: 8px; color: white; font-weight: 600; cursor: pointer; font-size: 0.95rem;
                    font-family: inherit;">
                    Speichern & Starten
                </button>
                <p style="margin-top: 0.6rem; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
                    Der Key wird nur lokal in deinem Browser gespeichert.
                </p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Prüfe ob ein Key im localStorage ist
        const savedKey = localStorage.getItem('ors_api_key');
        if (savedKey) {
            CONFIG.ORS_API_KEY = savedKey;
            overlay.remove();
        }
    },

    /**
     * Speichert den API Key
     */
    saveApiKey() {
        const input = document.getElementById('api-key-input');
        const key = input.value.trim();

        if (key.length < 10) {
            input.style.borderColor = 'var(--primary)';
            return;
        }

        CONFIG.ORS_API_KEY = key;
        localStorage.setItem('ors_api_key', key);

        const overlay = document.getElementById('api-key-overlay');
        if (overlay) overlay.remove();

        this.showToast('API-Key gespeichert!', 'success');
    },

    /**
     * Karte initialisieren
     */
    initMap() {
        this.map = L.map('map', {
            center: CONFIG.DEFAULT_CENTER,
            zoom: CONFIG.DEFAULT_ZOOM,
            zoomControl: true
        });

        L.tileLayer(CONFIG.TILE_URL, {
            attribution: CONFIG.TILE_ATTRIBUTION,
            maxZoom: 18
        }).addTo(this.map);

        // Kartengröße anpassen
        setTimeout(() => this.map.invalidateSize(), 100);
        window.addEventListener('resize', () => this.map.invalidateSize());
    },

    /**
     * Event-Listener binden
     */
    bindEvents() {
        // Adresssuche
        const addressInput = document.getElementById('address');
        let searchTimeout;

        addressInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchAddress(), 400);
        });

        addressInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchAddress();
            }
        });

        // Standort-Button
        document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());

        // Routentyp Toggle
        document.getElementById('toggle-round').addEventListener('click', () => {
            this.routeType = 'round';
            document.getElementById('toggle-round').classList.add('active');
            document.getElementById('toggle-point').classList.remove('active');
        });

        document.getElementById('toggle-point').addEventListener('click', () => {
            this.routeType = 'point';
            document.getElementById('toggle-point').classList.add('active');
            document.getElementById('toggle-round').classList.remove('active');
        });

        // Distanz Slider
        const distSlider = document.getElementById('max-distance');
        distSlider.addEventListener('input', () => {
            document.getElementById('distance-value').textContent = `${distSlider.value} km`;
        });

        // Höhenmeter Slider
        const eleSlider = document.getElementById('max-elevation');
        eleSlider.addEventListener('input', () => {
            document.getElementById('elevation-value').textContent = `${eleSlider.value} hm`;
        });

        // Gelände-Profil Buttons
        document.querySelectorAll('.profile-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.terrainProfile = btn.dataset.profile;
            });
        });

        // Generieren Button
        document.getElementById('btn-generate').addEventListener('click', () => this.generateRoutes());

        // Klick außerhalb der Suggestions schließt sie
        document.addEventListener('click', (e) => {
            const suggestions = document.getElementById('address-suggestions');
            if (!e.target.closest('.input-group')) {
                suggestions.innerHTML = '';
            }
        });
    },

    /**
     * Adresssuche mit Autocomplete
     */
    async searchAddress() {
        const query = document.getElementById('address').value.trim();
        const suggestionsDiv = document.getElementById('address-suggestions');

        if (query.length < 3) {
            suggestionsDiv.innerHTML = '';
            return;
        }

        try {
            const results = await RoutingEngine.geocode(query);
            suggestionsDiv.innerHTML = '';

            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = result.display;
                item.addEventListener('click', () => {
                    document.getElementById('address').value = result.display;
                    suggestionsDiv.innerHTML = '';
                    this.setStartPoint(result.lat, result.lng);
                });
                suggestionsDiv.appendChild(item);
            });
        } catch (error) {
            console.error('Suche fehlgeschlagen:', error);
        }
    },

    /**
     * Setzt den Startpunkt auf der Karte
     */
    setStartPoint(lat, lng) {
        this.startCoords = { lat, lng };

        // Marker setzen
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        const startIcon = L.divIcon({
            className: 'custom-start-marker',
            iconSize: [16, 16]
        });

        this.startMarker = L.marker([lat, lng], { icon: startIcon })
            .addTo(this.map)
            .bindPopup('<strong>Startpunkt</strong>')
            .openPopup();

        this.map.setView([lat, lng], 12);
    },

    /**
     * Standort des Users verwenden
     */
    locateUser() {
        if (!navigator.geolocation) {
            this.showToast('Geolocation wird nicht unterstützt', 'error');
            return;
        }

        this.showToast('Standort wird ermittelt...', 'success');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                this.setStartPoint(lat, lng);

                try {
                    const address = await RoutingEngine.reverseGeocode(lat, lng);
                    document.getElementById('address').value = address;
                } catch (e) {
                    document.getElementById('address').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                }
            },
            (error) => {
                this.showToast('Standort konnte nicht ermittelt werden', 'error');
                console.error('Geolocation Fehler:', error);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    /**
     * Hauptfunktion: Routen generieren
     */
    async generateRoutes() {
        // Validierung
        if (!this.startCoords) {
            // Versuche die aktuelle Adresse zu geocoden
            const address = document.getElementById('address').value.trim();
            if (!address) {
                this.showToast('Bitte gib eine Startadresse ein', 'error');
                return;
            }

            try {
                const results = await RoutingEngine.geocode(address);
                if (results.length > 0) {
                    this.setStartPoint(results[0].lat, results[0].lng);
                    document.getElementById('address-suggestions').innerHTML = '';
                } else {
                    this.showToast('Adresse nicht gefunden', 'error');
                    return;
                }
            } catch (error) {
                this.showToast('Adresse nicht gefunden', 'error');
                return;
            }
        }

        const maxDistance = parseInt(document.getElementById('max-distance').value);
        const maxElevation = parseInt(document.getElementById('max-elevation').value);

        // UI
        this.showLoading(true);
        this.clearRoutes();
        document.getElementById('btn-generate').disabled = true;

        try {
            // Routen berechnen
            const routes = await RoutingEngine.generateSmartRoutes(
                this.startCoords.lat,
                this.startCoords.lng,
                maxDistance,
                maxElevation,
                this.terrainProfile,
                this.routeType
            );

            if (routes.length === 0) {
                this.showToast('Keine Routen gefunden. Versuche andere Parameter.', 'error');
                this.showLoading(false);
                document.getElementById('btn-generate').disabled = false;
                return;
            }

            // Höhendaten laden
            this.updateLoadingText('Höhendaten werden geladen...');

            for (let i = 0; i < routes.length; i++) {
                this.updateLoadingText(`Höhenprofil ${i + 1} von ${routes.length}...`);

                try {
                    const elevations = await ElevationService.getElevations(routes[i].coordinates);
                    routes[i].elevations = elevations;
                    routes[i].totalAscent = ElevationService.calculateTotalAscent(elevations);
                } catch (e) {
                    console.warn('Höhendaten fehlgeschlagen für Route', i);
                    routes[i].elevations = [];
                    routes[i].totalAscent = 0;
                }

                if (i < routes.length - 1) {
                    await RoutingEngine.delay(500);
                }
            }

            // Filtere nach max Höhenmeter (weich - zeige alle, markiere aber)
            this.routes = routes;

            // Routen anzeigen
            this.displayRoutes();
            this.showLoading(false);

            this.showToast(`${routes.length} Routen generiert!`, 'success');

        } catch (error) {
            console.error('Fehler beim Generieren:', error);
            this.showToast('Fehler beim Generieren der Routen: ' + error.message, 'error');
            this.showLoading(false);
        }

        document.getElementById('btn-generate').disabled = false;
    },

    /**
     * Zeigt die generierten Routen an
     */
    displayRoutes() {
        const maxElevation = parseInt(document.getElementById('max-elevation').value);

        // Routen auf der Karte anzeigen
        const bounds = L.latLngBounds();

        this.routes.forEach((route, i) => {
            const latLngs = route.coordinates.map(c => [c[1], c[0]]);
            const color = CONFIG.ROUTE_COLORS[i % CONFIG.ROUTE_COLORS.length];

            // Route als Polyline
            const polyline = L.polyline(latLngs, {
                color: color,
                weight: 4,
                opacity: 0.8,
                lineJoin: 'round'
            }).addTo(this.map);

            polyline.on('click', () => this.selectRoute(i));
            this.routeLayers.push(polyline);

            latLngs.forEach(ll => bounds.extend(ll));
        });

        // Karte auf alle Routen zoomen
        if (this.startMarker) {
            bounds.extend(this.startMarker.getLatLng());
        }
        this.map.fitBounds(bounds, { padding: [50, 50] });

        // Routen-Liste im Sidebar anzeigen
        const resultPanel = document.getElementById('results-panel');
        const routeList = document.getElementById('route-list');
        resultPanel.style.display = 'block';
        routeList.innerHTML = '';

        this.routes.forEach((route, i) => {
            const color = CONFIG.ROUTE_COLORS[i % CONFIG.ROUTE_COLORS.length];
            const exceedsElevation = route.totalAscent > maxElevation;

            const card = document.createElement('div');
            card.className = 'route-card';
            card.dataset.index = i;

            card.innerHTML = `
                <div class="route-card-header">
                    <div class="route-card-title">
                        <span class="route-number" style="background: ${color};">${i + 1}</span>
                        Route ${i + 1} ${route.routeType === 'round' ? '(Rundkurs)' : '(Einweg)'}
                    </div>
                </div>
                <div class="route-card-stats">
                    <div class="route-stat">
                        <i class="fas fa-road"></i>
                        <span>${route.distance} km</span>
                    </div>
                    <div class="route-stat" style="${exceedsElevation ? 'color: var(--warning);' : ''}">
                        <i class="fas fa-mountain"></i>
                        <span>${route.totalAscent} hm ${exceedsElevation ? '⚠️' : ''}</span>
                    </div>
                    <div class="route-stat">
                        <i class="fas fa-clock"></i>
                        <span>~${this.estimateTime(route.distance, route.totalAscent)}</span>
                    </div>
                </div>
                <div class="route-card-actions">
                    <button class="btn-small" onclick="App.selectRoute(${i}); event.stopPropagation();">
                        <i class="fas fa-eye"></i> Anzeigen
                    </button>
                    <button class="btn-small btn-export" onclick="App.exportRoute(${i}); event.stopPropagation();">
                        <i class="fas fa-download"></i> GPX Export
                    </button>
                </div>
            `;

            card.addEventListener('click', () => this.selectRoute(i));
            routeList.appendChild(card);
        });

        // Erste Route automatisch auswählen
        this.selectRoute(0);
    },

    /**
     * Route auswählen und hervorheben
     */
    selectRoute(index) {
        this.selectedRoute = index;

        // Alle Routen dimmen, ausgewählte hervorheben
        this.routeLayers.forEach((layer, i) => {
            if (i === index) {
                layer.setStyle({ weight: 6, opacity: 1 });
                layer.bringToFront();
            } else {
                layer.setStyle({ weight: 3, opacity: 0.35 });
            }
        });

        // Route-Cards aktualisieren
        document.querySelectorAll('.route-card').forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });

        // Höhenprofil anzeigen
        this.showElevationChart(this.routes[index]);
    },

    /**
     * Höhenprofil-Chart anzeigen
     */
    showElevationChart(route) {
        const container = document.getElementById('elevation-chart-container');
        container.style.display = 'block';

        const canvas = document.getElementById('elevation-chart');

        // Bestehenden Chart zerstören
        if (this.elevationChart) {
            this.elevationChart.destroy();
        }

        const elevations = route.elevations || [];
        if (elevations.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Distanz-Labels berechnen
        const totalDist = parseFloat(route.distance);
        const step = totalDist / (elevations.length - 1);
        const labels = elevations.map((_, i) => (i * step).toFixed(1));

        const color = CONFIG.ROUTE_COLORS[route.index % CONFIG.ROUTE_COLORS.length];

        this.elevationChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Höhe (m)',
                    data: elevations.map(e => Math.round(e)),
                    borderColor: color,
                    backgroundColor: color + '20',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHitRadius: 10,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(26, 35, 50, 0.95)',
                        titleColor: '#f1faee',
                        bodyColor: '#a8b2c1',
                        borderColor: '#2a3a4e',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => `km ${items[0].label}`,
                            label: (item) => `${item.raw} m ü. M.`
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Distanz (km)',
                            color: '#6b7a8d',
                            font: { size: 10 }
                        },
                        ticks: {
     
