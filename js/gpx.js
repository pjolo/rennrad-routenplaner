// ============================================
// GPX EXPORT
// ============================================

const GPXExport = {
    /**
     * Erstellt eine GPX-Datei aus Koordinaten mit Höhendaten
     */
    generate(coordinates, elevations, name, stats) {
        const timestamp = new Date().toISOString();

        let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" 
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" 
     version="1.1" 
     creator="Rennrad Routenplaner">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <desc>Distanz: ${stats.distance} km | Höhenmeter: ${stats.elevation} hm</desc>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>
    <type>cycling</type>
    <trkseg>
`;

        coordinates.forEach((coord, i) => {
            const ele = elevations && elevations[i] !== undefined ? elevations[i] : 0;
            gpx += `      <trkpt lat="${coord[1].toFixed(6)}" lon="${coord[0].toFixed(6)}">
        <ele>${ele.toFixed(1)}</ele>
      </trkpt>\n`;
        });

        gpx += `    </trkseg>
  </trk>
</gpx>`;

        return gpx;
    },

    /**
     * Löst den Download einer GPX-Datei aus
     */
    download(gpxContent, filename) {
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
};

