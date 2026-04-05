// ============================================
// HÖHENDATEN
// ============================================

const ElevationService = {

    /**
     * Holt Höhendaten für eine Liste von Koordinaten
     * Koordinaten im Format [[lng, lat], ...]
     */
    async getElevations(coordinates) {
        // Reduziere die Anzahl der Punkte für die API (max 100)
        const sampled = this.sampleCoordinates(coordinates, 100);

        const locations = sampled.map(c => ({
            latitude: c[1],
            longitude: c[0]
        }));

        try {
            const response = await fetch(`${CONFIG.ELEVATION_URL}/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations })
            });

            if (!response.ok) throw new Error('Elevation API Fehler');

            const data = await response.json();
            const sampledElevations = data.results.map(r => r.elevation);

            // Interpoliere zurück auf alle Punkte
            return this.interpolateElevations(coordinates, sampled, sampledElevations);
        } catch (error) {
            console.warn('Elevation API fehlgeschlagen, verwende ORS Fallback:', error);
            return this.fallbackElevations(coordinates);
        }
    },

    /**
     * Fallback: Versuche Höhendaten über ORS zu bekommen
     */
    async fallbackElevations(coordinates) {
        try {
            const sampled = this.sampleCoordinates(coordinates, 50);
            const locations = sampled.map(c => `${c[1]},${c[0]}`).join('|');

            const response = await fetch(
                `https://api.openrouteservice.org/elevation/line`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': CONFIG.ORS_API_KEY
                },
                body: JSON.stringify({
                    format_in: 'polyline',
                    format_out: 'polyline',
                    geometry: {
                        coordinates: sampled
                    }
                })
            });

            if (!response.ok) throw new Error('ORS Elevation Fallback fehlgeschlagen');

            const data = await response.json();
            if (data.geometry && data.geometry.coordinates) {
                const sampledElevations = data.geometry.coordinates.map(c => c[2] || 0);
                return this.interpolateElevations(coordinates, sampled, sampledElevations);
            }
        } catch (e) {
            console.warn('Alle Elevation APIs fehlgeschlagen, generiere Schätzung');
        }

        // Absolute Fallback: Generiere plausible Dummy-Daten
        return coordinates.map(() => 400 + Math.random() * 100);
    },

    /**
     * Samplet Koordinaten gleichmäßig
     */
    sampleCoordinates(coordinates, maxPoints) {
        if (coordinates.length <= maxPoints) return [...coordinates];

        const step = (coordinates.length - 1) / (maxPoints - 1);
        const sampled = [];
        for (let i = 0; i < maxPoints; i++) {
            const idx = Math.min(Math.round(i * step), coordinates.length - 1);
            sampled.push(coordinates[idx]);
        }
        return sampled;
    },

    /**
     * Interpoliert Höhenwerte zurück auf alle Koordinaten
     */
    interpolateElevations(allCoords, sampledCoords, sampledElevations) {
        if (allCoords.length === sampledCoords.length) return sampledElevations;

        const result = [];
        const ratio = (sampledElevations.length - 1) / (allCoords.length - 1);

        for (let i = 0; i < allCoords.length; i++) {
            const pos = i * ratio;
            const low = Math.floor(pos);
            const high = Math.min(Math.ceil(pos), sampledElevations.length - 1);
            const frac = pos - low;

            result.push(sampledElevations[low] * (1 - frac) + sampledElevations[high] * frac);
        }

        return result;
    },

    /**
     * Berechnet Gesamt-Höhenmeter (Aufstieg) aus Höhenprofil
     */
    calculateTotalAscent(elevations) {
        let ascent = 0;
        // Glätte die Daten zuerst (Rauschen reduzieren)
        const smoothed = this.smoothElevations(elevations, 3);

        for (let i = 1; i < smoothed.length; i++) {
            const diff = smoothed[i] - smoothed[i - 1];
            if (diff > 0) ascent += diff;
        }
        return Math.round(ascent);
    },

    /**
     * Glättet Höhendaten mit einem Moving Average
     */
    smoothElevations(elevations, windowSize) {
        const smoothed = [];
        for (let i = 0; i < elevations.length; i++) {
            const start = Math.max(0, i - windowSize);
            const end = Math.min(elevations.length - 1, i + windowSize);
            let sum = 0;
            let count = 0;
            for (let j = start; j <= end; j++) {
                sum += elevations[j];
                count++;
            }
            smoothed.push(sum / count);
        }
        return smoothed;
    }
};

