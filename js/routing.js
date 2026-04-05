// ============================================
// ROUTING ENGINE
// ============================================

const RoutingEngine = {

    /**
     * Geocoding: Adresse → Koordinaten
     */
    async geocode(address) {
        const response = await fetch(
            `${CONFIG.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=5&addressdetails=1`,
            { headers: { 'Accept-Language': 'de' } }
        );

        if (!response.ok) throw new Error('Geocoding fehlgeschlagen');
        const data = await response.json();

        if (data.length === 0) throw new Error('Adresse nicht gefunden');

        return data.map(item => ({
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            display: item.display_name
        }));
    },

    /**
     * Reverse Geocoding: Koordinaten → Adresse
     */
    async reverseGeocode(lat, lng) {
        const response = await fetch(
            `${CONFIG.NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
            { headers: { 'Accept-Language': 'de' } }
        );
        if (!response.ok) return 'Unbekannter Ort';
        const data = await response.json();
        return data.display_name || 'Unbekannter Ort';
    },

    /**
     * Generiert mehrere zufällige Routen
     */
    async generateRoutes(startLat, startLng, maxDistanceKm, maxElevation, profile, routeType) {
        const routes = [];
        const numRoutes = CONFIG.NUM_ROUTES;

        for (let i = 0; i < numRoutes; i++) {
            try {
                App.updateLoadingText(`Route ${i + 1} von ${numRoutes} wird berechnet...`);

                let waypoints;
                if (routeType === 'round') {
                    waypoints = this.generateRoundTripWaypoints(startLat, startLng, maxDistanceKm, profile, i);
                } else {
                    waypoints = this.generatePointToPointWaypoints(startLat, startLng, maxDistanceKm, profile, i);
                }

                const route = await this.calculateRoute(waypoints, routeType === 'round');

                if (route) {
                    routes.push({
                        index: i,
                        coordinates: route.coordinates,
                        distance: route.distance,
                        waypoints: waypoints,
                        routeType: routeType
                    });
                }

                // Rate Limiting
                if (i < numRoutes - 1) {
                    await this.delay(CONFIG.API_DELAY);
                }
            } catch (error) {
                console.error(`Fehler bei Route ${i + 1}:`, error);
            }
        }

        return routes;
    },

    /**
     * Generiert Wegpunkte für einen Rundkurs
     */
    generateRoundTripWaypoints(startLat, startLng, maxDistanceKm, profile, variation) {
        // Schätze den Radius basierend auf der maximalen Distanz
        // Ein Rundkurs mit N Wegpunkten hat ca. Umfang ≈ Distanz
        // Radius ≈ Distanz / (2 * PI) * Korrekturfaktor für Straßen
        const roadFactor = 1.3; // Straßen sind nicht gerade
        const effectiveRadius = (maxDistanceKm / (2 * Math.PI)) / roadFactor;

        // Konvertiere km in Grad (ungefähre Näherung)
        const radiusLat = effectiveRadius / 111.0;
        const radiusLng = effectiveRadius / (111.0 * Math.cos(startLat * Math.PI / 180));

        // Bestimme Anzahl Wegpunkte basierend auf Profil und Distanz
        let numPoints;
        switch (profile) {
            case 'flat':
                numPoints = 3 + Math.floor(maxDistanceKm / 40);
                break;
            case 'hilly':
                numPoints = 4 + Math.floor(maxDistanceKm / 35);
                break;
            case 'mountainous':
                numPoints = 3 + Math.floor(maxDistanceKm / 50);
                break;
            default:
                numPoints = 4;
        }
        numPoints = Math.min(Math.max(numPoints, 3), 8);

        // Generiere Punkte im Kreis mit Zufallsvariation
        const waypoints = [[startLng, startLat]];

        // Startwinkel variiert pro Route
        const baseAngle = (variation * 120 + Math.random() * 40) * (Math.PI / 180);

        // Form-Variation: Elliptisch bis kreisförmig
        const eccentricity = 0.5 + Math.random() * 0.5;

        for (let i = 0; i < numPoints; i++) {
            const angle = baseAngle + (2 * Math.PI * i / numPoints);

            // Zufällige Radiusvariation
            const rVariation = 0.6 + Math.random() * 0.8;

            let pointLat, pointLng;

            if (profile === 'flat') {
                // Flach: Punkte mehr in einer Ebene verteilen
                pointLat = startLat + radiusLat * rVariation * Math.sin(angle);
                pointLng = startLng + radiusLng * rVariation * eccentricity * Math.cos(angle);
            } else if (profile === 'mountainous') {
                // Bergig: Tendenziell in eine Richtung (zu Bergen hin)
                const stretch = (i < numPoints / 2) ? 1.2 : 0.6;
                pointLat = startLat + radiusLat * rVariation * stretch * Math.sin(angle);
                pointLng = startLng + radiusLng * rVariation * stretch * Math.cos(angle);
            } else {
                // Hügelig: Normale Verteilung
                pointLat = startLat + radiusLat * rVariation * Math.sin(angle);
                pointLng = startLng + radiusLng * rVariation * Math.cos(angle);
            }

            waypoints.push([pointLng, pointLat]);
        }

        // Zurück zum Start
        waypoints.push([startLng, startLat]);

        return waypoints;
    },

    /**
     * Generiert Wegpunkte für Punkt-zu-Punkt
     */
    generatePointToPointWaypoints(startLat, startLng, maxDistanceKm, profile, variation) {
        const roadFactor = 1.4;
        const straightLineDistance = maxDistanceKm / roadFactor;

        // Richtung variiert pro Route
        const bearing = (variation * 120 + 30 + Math.random() * 60) * (Math.PI / 180);

        // Konvertiere in Grad
        const distLat = (straightLineDistance / 111.0) * Math.cos(bearing);
        const distLng = (straightLineDistance / (111.0 * Math.cos(startLat * Math.PI / 180))) * Math.sin(bearing);

        const endLat = startLat + distLat;
        const endLng = startLng + distLng;

        // Zwischenpunkte generieren
        const numMidPoints = Math.max(1, Math.floor(maxDistanceKm / 30));
        const waypoints = [[startLng, startLat]];

        for (let i = 1; i <= numMidPoints; i++) {
            const fraction = i / (numMidPoints + 1);
            const midLat = startLat + (endLat - startLat) * fraction;
            const midLng = startLng + (endLng - startLng) * fraction;

            // Seitliche Abweichung
            const deviation = (Math.random() - 0.5) * 0.15;
            const perpLat = -Math.sin(bearing) * deviation;
            const perpLng = Math.cos(bearing) * deviation;

            if (profile === 'hilly') {
                // Mehr Abweichung bei hügeligem Profil
                waypoints.push([
                    midLng + perpLng * 2,
                    midLat + perpLat * 2
                ]);
            } else {
                waypoints.push([
                    midLng + perpLng,
                    midLat + perpLat
                ]);
            }
        }

        waypoints.push([endLng, endLat]);
        return waypoints;
    },

    /**
     * Berechnet eine Route über die ORS API
     */
    async calculateRoute(waypoints, isRoundTrip) {
        try {
            const body = {
                coordinates: waypoints,
                profile: 'cycling-road',
                format: 'geojson',
                preference: 'recommended',
                units: 'km',
                language: 'de',
                geometry: true,
                instructions: false,
            };

            // ORS Directions API
            const response = await fetch(
                `${CONFIG.ORS_URL}/v2/directions/cycling-road/geojson`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': CONFIG.ORS_API_KEY
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error('ORS API Fehler:', response.status, errData);
                throw new Error(`ORS API Fehler: ${response.status}`);
            }

            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                throw new Error('Keine Route gefunden');
            }

            const feature = data.features[0];
            const coordinates = feature.geometry.coordinates;
            const distance = (feature.properties.summary.distance).toFixed(1);

            return { coordinates, distance };
        } catch (error) {
            console.error('Route Berechnung fehlgeschlagen:', error);
            throw error;
        }
    },

    /**
     * ORS Round Trip API (Alternative für Rundkurse)
     */
    async calculateRoundTrip(startLng, startLat, targetDistance, profile, seed) {
        try {
            const body = {
                coordinates: [[startLng, startLat]],
                profile: 'cycling-road',
                format: 'geojson',
                options: {
                    round_trip: {
                        length: targetDistance * 1000, // in Metern
                        points: profile === 'flat' ? 5 : (profile === 'hilly' ? 8 : 4),
                        seed: seed || Math.floor(Math.random() * 99999)
                    }
                },
                units: 'km',
                geometry: true,
                instructions: false
            };

            const response = await fetch(
                `${CONFIG.ORS_URL}/v2/directions/cycling-road/geojson`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': CONFIG.ORS_API_KEY
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`ORS Round Trip Fehler: ${response.status}`);

            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                throw new Error('Kein Round Trip gefunden');
            }

            const feature = data.features[0];
            return {
                coordinates: feature.geometry.coordinates,
                distance: feature.properties.summary.distance.toFixed(1)
            };
        } catch (error) {
            console.error('Round Trip fehlgeschlagen:', error);
            throw error;
        }
    },

    /**
     * Generiert Routen - versucht zuerst die ORS Round Trip API
     */
    async generateSmartRoutes(startLat, startLng, maxDistanceKm, maxElevation, profile, routeType) {
        const routes = [];

        if (routeType === 'round') {
            // Verwende die ORS Round Trip API - viel bessere Ergebnisse
            for (let i = 0; i < CONFIG.NUM_ROUTES; i++) {
                try {
                    App.updateLoadingText(`Rundkurs ${i + 1} von ${CONFIG.NUM_ROUTES} wird berechnet...`);

                    // Variiere die Ziel-Distanz leicht
                    const distVariation = 0.75 + (i * 0.15); // 75%, 90%, 105%
                    const targetDist = maxDistanceKm * distVariation;

                    const route = await this.calculateRoundTrip(
                        startLng, startLat,
                        targetDist,
                        profile,
                        Math.floor(Math.random() * 99999) + i * 10000
                    );

                    if (route) {
                        routes.push({
                            index: i,
                            coordinates: route.coordinates,
                            distance: route.distance,
                            routeType: 'round'
                        });
                    }

                    if (i < CONFIG.NUM_ROUTES - 1) {
                        await this.delay(CONFIG.API_DELAY);
                    }
                } catch (error) {
                    console.warn(`Round Trip ${i + 1} fehlgeschlagen, versuche Fallback...`, error);

                    // Fallback: Manuelle Wegpunkte
                    try {
                        const waypoints = this.generateRoundTripWaypoints(
                            startLat, startLng, maxDistanceKm, profile, i
                        );
                        const route = await this.calculateRoute(waypoints, true);
                        if (route) {
                            routes.push({
                                index: i,
                                coordinates: route.coordinates,
                                distance: route.distance,
                                routeType: 'round'
                            });
                        }
                    } catch (fallbackError) {
                        console.error(`Route ${i + 1} komplett fehlgeschlagen:`, fallbackError);
                    }

                    if (i < CONFIG.NUM_ROUTES - 1) {
                        await this.delay(CONFIG.API_DELAY);
                    }
                }
            }
        } else {
            // Punkt-zu-Punkt: Verwende manuelle Wegpunkte
            for (let i = 0; i < CONFIG.NUM_ROUTES; i++) {
                try {
                    App.updateLoadingText(`Strecke ${i + 1} von ${CONFIG.NUM_ROUTES} wird berechnet...`);

                    const distVariation = 0.7 + (i * 0.2);
                    const waypoints = this.generatePointToPointWaypoints(
                        startLat, startLng,
                        maxDistanceKm * distVariation,
                        profile, i
                    );

                    const route = await this.calculateRoute(waypoints, false);

                    if (route) {
                        routes.push({
                            index: i,
                            coordinates: route.coordinates,
                            distance: route.distance,
                            routeType: 'point'
                        });
                    }

                    if (i < CONFIG.NUM_ROUTES - 1) {
                        await this.delay(CONFIG.API_DELAY);
                    }
                } catch (error) {
                    console.error(`Punkt-zu-Punkt Route ${i + 1} fehlgeschlagen:`, error);
                }
            }
        }

        return routes;
    },

    /**
     * Hilfsfunktion: Verzögerung
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Berechnet die Luftlinie zwischen zwei Punkten (Haversine)
     */
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
};

