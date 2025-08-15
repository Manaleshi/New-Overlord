/**
 * HexMap - Interactive hex grid display and manipulation
 */
class HexMap {
    constructor(containerId, width = 5, height = 5) {
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
        this.container.innerHTML = `
            <div class="hex-map-container">
                <div class="hex-grid" id="hex-grid"></div>
                <div class="hex-info-panel" id="hex-info">
                    <h3>Hex Information</h3>
                    <div id="hex-details">Select a hex to view details</div>
                </div>
            </div>
        `;
        
        this.hexGrid = document.getElementById('hex-grid');
        this.hexInfo = document.getElementById('hex-info');
        this.hexDetails = document.getElementById('hex-details');
        
        this.createGrid();
    }
    
    createGrid() {
        this.hexGrid.innerHTML = '';
        this.hexGrid.style.position = 'relative';
        this.hexGrid.style.width = `${this.width * this.hexSize * 1.8}px`;
        this.hexGrid.style.height = `${this.height * this.hexSize * 1.8}px`;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.createHex(x, y);
            }
        }
    }
    
    createHex(x, y) {
        const hex = document.createElement('div');
        hex.className = 'hex';
        hex.dataset.x = x;
        hex.dataset.y = y;
        
        // Calculate position for vertical column layout with odd columns offset
        const hexWidth = this.hexSize * 1.5;
        const hexHeight = this.hexSize * Math.sqrt(3);
        
        const posX = x * hexWidth;
        const posY = y * hexHeight + (x % 2) * (hexHeight / 2);
        
        hex.style.position = 'absolute';
        hex.style.left = `${posX}px`;
        hex.style.top = `${posY}px`;
        hex.style.width = `${this.hexSize * 2}px`;
        hex.style.height = `${this.hexSize * 2}px`;
        hex.style.border = '2px solid #333';
        hex.style.cursor = 'pointer';
        hex.style.display = 'flex';
        hex.style.alignItems = 'center';
        hex.style.justifyContent = 'center';
        hex.style.fontSize = '10px';
        hex.style.textAlign = 'center';
        hex.style.backgroundColor = this.terrainColors['plains'];
        
        // Create hexagonal shape with CSS
        hex.style.borderRadius = '50%';
        hex.style.transform = 'rotate(0deg)';
        
        hex.addEventListener('click', () => this.selectHex(x, y));
        
        this.hexGrid.appendChild(hex);
    }
    
    loadWorldData(worldData) {
        this.worldData = worldData;
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (!this.worldData) return;
        
        // Update each hex with world data
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const hex = this.getHexElement(x, y);
                const hexData = this.worldData.hexes[`${x},${y}`];
                
                if (hex && hexData) {
                    hex.style.backgroundColor = this.terrainColors[hexData.terrain] || '#DDD';
                    hex.innerHTML = `
                        <div style="text-align: center; line-height: 1.1;">
                            <div style="font-weight: bold; font-size: 8px;">${hexData.terrain}</div>
                            <div style="font-size: 7px;">${x},${y}</div>
                        </div>
                    `;
                }
            }
        }
    }
    
    getHexElement(x, y) {
        return this.hexGrid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    }
    
    selectHex(x, y) {
        // Clear previous selection
        if (this.selectedHex) {
            this.selectedHex.style.boxShadow = 'none';
        }
        
        // Select new hex
        const hex = this.getHexElement(x, y);
        if (hex) {
            hex.style.boxShadow = '0 0 10px 3px #FF6B6B';
            this.selectedHex = hex;
        }
        
        // Handle edit mode
        if (this.editMode && this.worldData) {
            this.changeHexTerrain(x, y, this.selectedTerrain);
        }
        
        // Display hex information
        this.displayHexInfo(x, y);
        
        // Load movement data
        this.loadMovementData(x, y);
    }
    
    changeHexTerrain(x, y, newTerrain) {
        if (!this.worldData) return;
        
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (hexData) {
            hexData.terrain = newTerrain;
            
            // Update resources based on new terrain
            hexData.resources = this.getTerrainResources(newTerrain);
            
            // Update display
            const hex = this.getHexElement(x, y);
            if (hex) {
                hex.style.backgroundColor = this.terrainColors[newTerrain] || '#DDD';
                hex.innerHTML = `
                    <div style="text-align: center; line-height: 1.1;">
                        <div style="font-weight: bold; font-size: 8px;">${newTerrain}</div>
                        <div style="font-size: 7px;">${x},${y}</div>
                    </div>
                `;
            }
            
            // Refresh hex info if this hex is selected
            if (this.selectedHex && this.selectedHex.dataset.x == x && this.selectedHex.dataset.y == y) {
                this.displayHexInfo(x, y);
            }
            
            // Update world data in session
            this.updateWorldDataInSession();
        }
    }
    
    getTerrainResources(terrain) {
        const resourceMap = {
            'plains': ['grain', 'horses'],
            'hills': ['stone', 'iron'],
            'mountains': ['stone', 'iron', 'gems'],
            'forests': ['wood', 'herbs'],
            'swamps': ['herbs', 'fish'],
            'deserts': ['stone', 'gems'],
            'water': ['fish']
        };
        return resourceMap[terrain] || [];
    }
    
    displayHexInfo(x, y) {
        if (!this.worldData) {
            this.hexDetails.innerHTML = 'No world data loaded';
            return;
        }
        
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (!hexData) {
            this.hexDetails.innerHTML = 'No data for this hex';
            return;
        }
        
        let infoHTML = `
            <div class="hex-info-content">
                <h4>${hexData.geographic_name || `Hex ${x},${y}`} [${hexData.location_id}]</h4>
                <p><strong>Terrain:</strong> ${hexData.terrain}</p>
                <p><strong>Coordinates:</strong> ${x}, ${y}</p>
                <p><strong>Resources:</strong> ${hexData.resources ? hexData.resources.join(', ') : 'None'}</p>
        `;
        
        // Add economic information
        if (hexData.economics) {
            const economics = hexData.economics;
            
            infoHTML += `<div class="economic-info">`;
            
            // Rural population and economics
            if (economics.rural) {
                infoHTML += `
                    <div class="rural-economics">
                        <p><strong>Rural Population:</strong> ${economics.rural.population}</p>
                        <p><strong>Rural Wages:</strong> $${economics.rural.wages}, taxes: $${economics.rural.taxes}</p>
                    </div>
                `;
            }
            
            // Settlement economics if present
            if (economics.settlement) {
                const settlement = economics.settlement;
                infoHTML += `
                    <div class="settlement-economics">
                        <p><strong>Settlement:</strong> ${settlement.name} (${settlement.type})</p>
                        <p><strong>Settlement Population:</strong> ${settlement.population}</p>
                        <p><strong>Settlement Wages:</strong> $${settlement.wages}, taxes: $${settlement.taxes}</p>
                    </div>
                `;
            }
            
            infoHTML += `</div>`;
        } else {
            infoHTML += `<p><strong>Population:</strong> ${hexData.population || 'Unknown'}</p>`;
        }
        
        // Add settlement info if present (for backwards compatibility)
        if (hexData.population_center) {
            const settlement = hexData.population_center;
            infoHTML += `
                <div class="settlement-info">
                    <h5>Settlement: ${settlement.name}</h5>
                    <p><strong>Type:</strong> ${settlement.type}</p>
                    <p><strong>Population:</strong> ${settlement.population}</p>
                </div>
            `;
        }
        
        infoHTML += `
                <div id="movement-info">
                    <h5>Movement Directions</h5>
                    <div id="movement-details">Loading movement data...</div>
                </div>
            </div>
        `;
        
        this.hexDetails.innerHTML = infoHTML;
    }
    
    async loadMovementData(x, y) {
        try {
            const response = await fetch(`/api/hex-movement/${x}/${y}`);
            if (response.ok) {
                const data = await response.json();
                this.displayMovementDirections(data.directions);
            } else {
                document.getElementById('movement-details').innerHTML = 'Movement data unavailable';
            }
        } catch (error) {
            console.error('Error loading movement data:', error);
            document.getElementById('movement-details').innerHTML = 'Error loading movement data';
        }
    }
    
    displayMovementDirections(directions) {
        const movementDetails = document.getElementById('movement-details');
        if (!movementDetails) return;
        
        let html = '<div class="movement-directions">';
        
        for (const [direction, data] of Object.entries(directions)) {
            html += `<div class="direction-info">`;
            html += `<strong>${direction}:</strong> `;
            
            if (data.movement.walking === 'impassable') {
                html += `<span class="impassable">Impassable</span>`;
                if (data.movement.note) {
                    html += ` (${data.movement.note})`;
                }
            } else {
                html += `<span class="destination">${data.destination}</span> [${data.location_id || 'Unknown'}]<br>`;
                html += `<span class="terrain">${data.terrain}</span>, `;
                
                // Display specific movement times
                html += `Walking: ${data.movement.walking} days, `;
                html += `Riding: ${data.movement.riding} days, `;
                html += `Flying: ${data.movement.flying} days`;
            }
            
            html += `</div>`;
        }
        
        html += '</div>';
        movementDetails.innerHTML = html;
    }
    
    setEditMode(enabled, selectedTerrain = 'plains') {
        this.editMode = enabled;
        this.selectedTerrain = selectedTerrain;
        
        // Update cursor style
        const hexes = this.hexGrid.querySelectorAll('.hex');
        hexes.forEach(hex => {
            hex.style.cursor = enabled ? 'crosshair' : 'pointer';
        });
    }
    
    async updateWorldDataInSession() {
        if (!this.worldData) return;
        
        try {
            const response = await fetch('/api/update-world-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    world_data: this.worldData
                })
            });
            
            if (!response.ok) {
                console.error('Failed to update world data in session');
            }
        } catch (error) {
            console.error('Error updating world data:', error);
        }
    }
    
    resize(newWidth, newHeight) {
        this.width = newWidth;
        this.height = newHeight;
        this.createGrid();
        if (this.worldData) {
            this.updateDisplay();
        }
    }
    
    exportWorldData() {
        return this.worldData;
    }
}

// CSS styles for economic information display
const economicStyles = `
    .economic-info {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 8px;
        margin: 8px 0;
    }
    
    .rural-economics {
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #ccc;
    }
    
    .settlement-economics {
        background-color: #e8f4fd;
        padding: 5px;
        border-radius: 3px;
    }
    
    .settlement-info {
        background-color: #f0f8ff;
        border: 1px solid #b0d4f1;
        border-radius: 5px;
        padding: 8px;
        margin: 8px 0;
    }
    
    .movement-directions {
        max-height: 200px;
        overflow-y: auto;
        font-size: 12px;
    }
    
    .direction-info {
        margin: 4px 0;
        padding: 4px;
        border-bottom: 1px solid #eee;
    }
    
    .destination {
        color: #2c5aa0;
        font-weight: bold;
    }
    
    .terrain {
        color: #666;
        font-style: italic;
    }
    
    .impassable {
        color: #cc0000;
        font-weight: bold;
    }
    
    .hex-info-content h4 {
        margin: 0 0 10px 0;
        color: #333;
        border-bottom: 2px solid #666;
        padding-bottom: 5px;
    }
    
    .hex-info-content h5 {
        margin: 10px 0 5px 0;
        color: #555;
    }
    
    .hex-info-content p {
        margin: 3px 0;
        font-size: 13px;
    }
`;

// Add the styles to the document
if (!document.getElementById('economic-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'economic-styles';
    styleSheet.textContent = economicStyles;
    document.head.appendChild(styleSheet);
}
