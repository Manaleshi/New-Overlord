/**
 * HexMap - Interactive hex grid display and manipulation
 */
class HexMap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = 5;
        this.height = 5;
        this.hexes = {};
        this.terrainTypes = {};
        this.selectedHex = null;
        this.showCoordinates = false;
        this.showResources = false;
        
        this.initializeDefaultTerrain();
        this.setupEventListeners();
    }
    
    initializeDefaultTerrain() {
        this.terrainTypes = {
            "plains": { name: "Plains", color: "#90EE90", resources: ["grain", "horses"] },
            "hills": { name: "Hills", color: "#DEB887", resources: ["stone", "iron"] },
            "mountains": { name: "Mountains", color: "#8B7355", resources: ["stone", "iron", "gems"] },
            "forests": { name: "Forests", color: "#228B22", resources: ["wood", "herbs"] },
            "swamps": { name: "Swamps", color: "#556B2F", resources: ["herbs", "rare_materials"] },
            "deserts": { name: "Deserts", color: "#F4A460", resources: ["rare_minerals"] }
        };
    }
    
    setupEventListeners() {
        document.getElementById('show-coordinates').addEventListener('change', (e) => {
            this.showCoordinates = e.target.checked;
            this.render();
        });
        
        document.getElementById('show-resources').addEventListener('change', (e) => {
            this.showResources = e.target.checked;
            this.render();
        });
    }
    
    setSize(width, height) {
        this.width = parseInt(width);
        this.height = parseInt(height);
        this.initializeEmptyWorld();
        this.render();
    }
    
    initializeEmptyWorld() {
        this.hexes = {};
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const hexId = `${x},${y}`;
                this.hexes[hexId] = {
                    terrain: 'plains',
                    resources: ['grain', 'horses'],
                    population_center: null
                };
            }
        }
    }
    
    loadWorldData(worldData) {
        if (worldData.metadata && worldData.metadata.size) {
            this.width = worldData.metadata.size.width;
            this.height = worldData.metadata.size.height;
        }
        
        this.hexes = worldData.hexes || {};
        this.render();
        this.updateLegend();
    }
    
    getWorldData() {
        return {
            metadata: {
                name: document.getElementById('world-name').value || 'Unnamed World',
                size: { width: this.width, height: this.height },
                wrap: { east_west: true, north_south: false },
                generated_at: new Date().toISOString()
            },
            hexes: this.hexes,
            population_centers: this.getPopulationCenters()
        };
    }
    
    getPopulationCenters() {
        const centers = {};
        let centerId = 1;
        
        Object.entries(this.hexes).forEach(([hexId, hexData]) => {
            if (hexData.population_center) {
                const settlementId = `settlement_${centerId}`;
                centers[settlementId] = {
                    hex: hexId,
                    type: hexData.population_center.type || 'village',
                    race: 'human',
                    population: hexData.population_center.population || 500,
                    name: hexData.population_center.name || `Settlement ${centerId}`
                };
                centerId++;
            }
        });
        
        return centers;
    }
    
    render() {
        this.container.innerHTML = '';
        
        if (Object.keys(this.hexes).length === 0) {
            this.container.innerHTML = '<div class="empty-map">Generate a world to see the hex map</div>';
            return;
        }
        
        const hexGrid = document.createElement('div');
        hexGrid.className = 'hex-grid';
        
        for (let y = 0; y < this.height; y++) {
            const row = document.createElement('div');
            row.className = 'hex-row';
            
            for (let x = 0; x < this.width; x++) {
                const hexId = `${x},${y}`;
                const hexData = this.hexes[hexId];
                
                if (hexData) {
                    const hex = this.createHexElement(x, y, hexData);
                    row.appendChild(hex);
                }
            }
            
            hexGrid.appendChild(row);
        }
        
        this.container.appendChild(hexGrid);
        this.updateLegend();
    }
    
    createHexElement(x, y, hexData) {
        const hex = document.createElement('div');
        hex.className = 'hex';
        hex.dataset.x = x;
        hex.dataset.y = y;
        
        const hexContent = document.createElement('div');
        hexContent.className = 'hex-content';
        
        // Set terrain color
        const terrain = this.terrainTypes[hexData.terrain];
        if (terrain) {
            hexContent.style.backgroundColor = terrain.color;
        }
        
        // Add coordinates if enabled
        if (this.showCoordinates) {
            const coords = document.createElement('div');
            coords.className = 'hex-coordinates';
            coords.textContent = `${x},${y}`;
            hexContent.appendChild(coords);
        }
        
        // Add terrain name
        const terrainLabel = document.createElement('div');
        terrainLabel.className = 'hex-terrain';
        terrainLabel.textContent = terrain ? terrain.name.substr(0, 4) : 'UNK';
        hexContent.appendChild(terrainLabel);
        
        // Add population center marker
        if (hexData.population_center) {
            const population = document.createElement('div');
            population.className = 'hex-population';
            population.textContent = hexData.population_center.type === 'city' ? '🏰' : '🏘️';
            hexContent.appendChild(population);
        }
        
        // Add resources if enabled
        if (this.showResources && hexData.resources && hexData.resources.length > 0) {
            const resources = document.createElement('div');
            resources.className = 'hex-resources';
            resources.textContent = hexData.resources.slice(0, 2).join(',').substr(0, 8);
            hexContent.appendChild(resources);
        }
        
        hex.appendChild(hexContent);
        
        // Add click handler
        hex.addEventListener('click', () => this.selectHex(x, y));
        
        return hex;
    }
    
    selectHex(x, y) {
        // Remove previous selection
        const prevSelected = this.container.querySelector('.hex.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        
        // Select new hex
        const hexElement = this.container.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (hexElement) {
            hexElement.classList.add('selected');
        }
        
        this.selectedHex = { x, y };
        this.updateHexInfo(x, y);
    }
    
    updateHexInfo(x, y) {
        const hexId = `${x},${y}`;
        const hexData = this.hexes[hexId];
        const infoElement = document.getElementById('hex-info');
        
        if (!hexData || !infoElement) return;
        
        const terrain = this.terrainTypes[hexData.terrain];
        const locationId = hexData.location_id || 'L????';
        const geographicName = hexData.geographic_name || 'Unknown Region';
        
        let infoHtml = `
            <h4>${geographicName} [${locationId}]</h4>
            <p><strong>Terrain:</strong> ${terrain ? terrain.name : 'Unknown'}</p>
            <p><strong>Coordinates:</strong> (${x}, ${y})</p>
            <p><strong>Resources:</strong> ${hexData.resources ? hexData.resources.join(', ') : 'None'}</p>
        `;
        
        if (hexData.population_center) {
            infoHtml += `
                <p><strong>Settlement:</strong> ${hexData.population_center.name || 'Unnamed'}</p>
                <p><strong>Type:</strong> ${hexData.population_center.type || 'village'}</p>
                <p><strong>Population:</strong> ${hexData.population_center.population || 500}</p>
            `;
        }
        
        // Add terrain editing section
        infoHtml += '<div class="terrain-editing"><h5>Terrain Editing</h5><div class="terrain-buttons">';
        Object.entries(this.terrainTypes).forEach(([key, terrain]) => {
            infoHtml += `<button class="btn btn-small terrain-btn" data-terrain="${key}" style="background-color: ${terrain.color};">${terrain.name}</button>`;
        });
        infoHtml += '</div></div>';
        
        infoElement.innerHTML = infoHtml;
        
        // Add event listeners for terrain buttons
        infoElement.querySelectorAll('.terrain-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.changeHexTerrain(x, y, btn.dataset.terrain);
            });
        });
    }.dataset.terrain);
            });
        });
    }
    
    changeHexTerrain(x, y, newTerrain) {
        const hexId = `${x},${y}`;
        if (this.hexes[hexId] && this.terrainTypes[newTerrain]) {
            this.hexes[hexId].terrain = newTerrain;
            this.hexes[hexId].resources = this.terrainTypes[newTerrain].resources || [];
            this.render();
            this.selectHex(x, y); // Re-select to update info
        }
    }
    
    updateLegend() {
        const legendElement = document.getElementById('terrain-legend');
        if (!legendElement) return;
        
        legendElement.innerHTML = '';
        
        Object.entries(this.terrainTypes).forEach(([key, terrain]) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${terrain.color};"></div>
                <span>${terrain.name}</span>
            `;
            
            legendElement.appendChild(legendItem);
        });
    }
    
    clear() {
        this.hexes = {};
        this.selectedHex = null;
        this.container.innerHTML = '<div class="empty-map">Generate a world to see the hex map</div>';
        
        const infoElement = document.getElementById('hex-info');
        if (infoElement) {
            infoElement.innerHTML = '<p>Click on a hex to see details or edit terrain</p>';
        }
    }
    
    setTerrainTypes(terrainTypes) {
        this.terrainTypes = terrainTypes;
        this.updateLegend();
    }
}

// Export for use in other scripts
window.HexMap = HexMap;
