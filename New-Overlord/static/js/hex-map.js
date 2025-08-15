// Minimal, bulletproof HexMap implementation
console.log('Loading minimal HexMap...');

class HexMap {
    constructor(containerId, width = 5, height = 5) {
        console.log('HexMap constructor called');
        
        this.container = document.getElementById(containerId);
        this.width = width;
        this.height = height;
        this.hexSize = 30;
        this.worldData = null;
        this.selectedHex = null;
        this.editMode = false;
        this.selectedTerrain = 'plains';
        
        this.terrainColors = {
            'plains': '#90EE90',
            'hills': '#DEB887', 
            'mountains': '#8B7355',
            'forests': '#228B22',
            'swamps': '#556B2F',
            'deserts': '#F4A460',
            'water': '#4682B4'
        };
        
        this.init();
    }
    
    init() {
        console.log('HexMap init called');
        
        if (!this.container) {
            console.error('Container not found');
            return;
        }
        
        // Create basic structure
        this.container.innerHTML = `
            <div style="display: flex; gap: 20px;">
                <div id="hex-grid" style="border: 2px solid black; background: #f0f0f0; position: relative; width: 400px; height: 400px;"></div>
                <div id="hex-info" style="border: 2px solid black; padding: 10px; width: 300px;">
                    <h3>Hex Information</h3>
                    <div id="hex-details">Select a hex to view details</div>
                </div>
            </div>
        `;
        
        this.hexGrid = document.getElementById('hex-grid');
        this.hexInfo = document.getElementById('hex-info');
        this.hexDetails = document.getElementById('hex-details');
        
        this.createGrid();
        console.log('HexMap initialized successfully');
    }
    
    createGrid() {
        if (!this.hexGrid) return;
        
        console.log('Creating grid...');
        this.hexGrid.innerHTML = '';
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const hex = document.createElement('div');
                hex.style.position = 'absolute';
                hex.style.left = (x * 60) + 'px';
                hex.style.top = (y * 60) + 'px';
                hex.style.width = '50px';
                hex.style.height = '50px';
                hex.style.border = '2px solid black';
                hex.style.backgroundColor = this.terrainColors.plains;
                hex.style.cursor = 'pointer';
                hex.style.display = 'flex';
                hex.style.alignItems = 'center';
                hex.style.justifyContent = 'center';
                hex.style.fontSize = '10px';
                hex.textContent = `${x},${y}`;
                hex.dataset.x = x;
                hex.dataset.y = y;
                
                hex.addEventListener('click', () => {
                    console.log(`Hex clicked: ${x},${y}`);
                    this.selectHex(x, y);
                });
                
                this.hexGrid.appendChild(hex);
            }
        }
        console.log('Grid created with', this.width * this.height, 'hexes');
    }
    
    selectHex(x, y) {
        // Clear previous selection
        const allHexes = this.hexGrid.querySelectorAll('div');
        allHexes.forEach(h => h.style.boxShadow = 'none');
        
        // Select new hex
        const hex = this.hexGrid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (hex) {
            hex.style.boxShadow = '0 0 10px red';
        }
        
        this.displayHexInfo(x, y);
    }
    
    displayHexInfo(x, y) {
        if (!this.hexDetails) return;
        
        let info = `<h4>Hex ${x},${y}</h4>`;
        
        if (this.worldData && this.worldData.hexes) {
            const hexData = this.worldData.hexes[`${x},${y}`];
            if (hexData) {
                info += `<p><strong>Terrain:</strong> ${hexData.terrain}</p>`;
                info += `<p><strong>Location:</strong> ${hexData.geographic_name || 'Unknown'} [${hexData.location_id}]</p>`;
                
                if (hexData.economics) {
                    const econ = hexData.economics;
                    if (econ.rural) {
                        info += `<p><strong>Rural Population:</strong> ${econ.rural.population}</p>`;
                        info += `<p><strong>Rural Wages:</strong> $${econ.rural.wages}, taxes: $${econ.rural.taxes}</p>`;
                    }
                    if (econ.settlement) {
                        info += `<p><strong>Settlement:</strong> ${econ.settlement.name} (${econ.settlement.type})</p>`;
                        info += `<p><strong>Settlement Population:</strong> ${econ.settlement.population}</p>`;
                        info += `<p><strong>Settlement Wages:</strong> $${econ.settlement.wages}, taxes: $${econ.settlement.taxes}</p>`;
                    }
                }
            }
        } else {
            info += '<p>No world data loaded</p>';
        }
        
        this.hexDetails.innerHTML = info;
    }
    
    loadWorldData(worldData) {
        console.log('Loading world data:', worldData);
        this.worldData = worldData;
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (!this.worldData || !this.hexGrid) return;
        
        console.log('Updating display...');
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const hex = this.hexGrid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                const hexData = this.worldData.hexes[`${x},${y}`];
                
                if (hex && hexData) {
                    hex.style.backgroundColor = this.terrainColors[hexData.terrain] || '#DDD';
                    hex.innerHTML = `<div style="text-align: center; font-size: 8px;">${hexData.terrain}<br>${x},${y}</div>`;
                }
            }
        }
        console.log('Display updated');
    }
    
    resize(newWidth, newHeight) {
        console.log(`Resizing to ${newWidth}x${newHeight}`);
        this.width = newWidth;
        this.height = newHeight;
        this.createGrid();
        if (this.worldData) {
            this.updateDisplay();
        }
    }
    
    setEditMode(enabled, terrain) {
        this.editMode = enabled;
        this.selectedTerrain = terrain;
        console.log('Edit mode:', enabled, 'terrain:', terrain);
    }
    
    isInitialized() {
        return this.container && this.hexGrid && this.hexDetails;
    }
}

console.log('HexMap class defined successfully');
