/**
 * HexMap - Interactive hex grid display and manipulation
 */
class HexMap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.worldData = null;
        this.selectedHex = null;
        
        // Hex display constants
        this.hexSize = 40;
        this.hexSpacing = 45;
        
        // Proper hexagonal directions in display order
        this.directionOrder = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
        this.directionNames = {
            'N': 'North',
            'NE': 'Northeast', 
            'SE': 'Southeast',
            'S': 'South',
            'SW': 'Southwest',
            'NW': 'Northwest'
        };
    }
    
    calculateHexPosition(x, y) {
        /**
         * Calculate proper hexagonal grid positions
         * In a hex grid, odd rows are offset by half a hex width
         */
        const offsetX = (y % 2) * (this.hexSpacing / 2);
        const posX = x * this.hexSpacing + offsetX + this.hexSize;
        const posY = y * (this.hexSpacing * 0.75) + this.hexSize;
        
        return { x: posX, y: posY };
    }
    
    loadWorld(worldData) {
        this.worldData = worldData;
        this.render();
    }
    
    render() {
        if (!this.worldData) return;
        
        const { width, height } = this.worldData.metadata.size;
        
        // Calculate container size for proper hex layout
        const containerWidth = width * this.hexSpacing + this.hexSpacing;
        const containerHeight = height * (this.hexSpacing * 0.75) + this.hexSpacing;
        
        this.container.innerHTML = '';
        this.container.style.width = `${containerWidth}px`;
        this.container.style.height = `${containerHeight}px`;
        this.container.style.position = 'relative';
        
        // Render each hex
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.renderHex(x, y);
            }
        }
    }
    
    renderHex(x, y) {
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (!hexData) return;
        
        const position = this.calculateHexPosition(x, y);
        
        // Create hex element
        const hexElement = document.createElement('div');
        hexElement.className = `hex terrain-${hexData.terrain}`;
        hexElement.style.position = 'absolute';
        hexElement.style.left = `${position.x - this.hexSize/2}px`;
        hexElement.style.top = `${position.y - this.hexSize/2}px`;
        hexElement.style.width = `${this.hexSize}px`;
        hexElement.style.height = `${this.hexSize}px`;
        hexElement.style.cursor = 'pointer';
        
        // Add coordinates as data attributes
        hexElement.dataset.x = x;
        hexElement.dataset.y = y;
        
        // Add click handler
        hexElement.addEventListener('click', () => this.selectHex(x, y));
        
        // Add hex content
        const content = document.createElement('div');
        content.className = 'hex-content';
        content.innerHTML = `
            <div class="hex-coords">${x},${y}</div>
            <div class="hex-terrain">${hexData.terrain}</div>
        `;
        
        hexElement.appendChild(content);
        this.container.appendChild(hexElement);
    }
    
    async selectHex(x, y) {
        // Remove previous selection
        const prevSelected = this.container.querySelector('.hex.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        
        // Add selection to new hex
        const hexElement = this.container.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (hexElement) {
            hexElement.classList.add('selected');
        }
        
        this.selectedHex = { x, y };
        
        // Load and display hex details
        await this.displayHexDetails(x, y);
    }
    
    async displayHexDetails(x, y) {
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (!hexData) return;
        
        try {
            // Get movement data from backend
            const response = await fetch(`/api/hex-movement/${x}/${y}`);
            const movementData = await response.json();
            
            if (response.ok) {
                this.updateHexInfoPanel(hexData, movementData.directions);
            } else {
                console.error('Error loading movement data:', movementData.error);
            }
        } catch (error) {
            console.error('Error fetching movement data:', error);
        }
    }
    
    updateHexInfoPanel(hexData, directions) {
        const infoPanel = document.getElementById('hex-info');
        if (!infoPanel) return;
        
        // Get geographic name or generate one
        const locationName = hexData.geographic_name || `${hexData.terrain} region`;
        const locationId = hexData.location_id || 'Unknown';
        
        // Build settlement info
        let settlementInfo = '';
        if (hexData.population_center) {
            settlementInfo = `
                <div class="settlement-info">
                    <strong>Settlement:</strong> ${hexData.population_center.name} (${hexData.population_center.type})
                    <br><strong>Population:</strong> ${hexData.population_center.population || 'Unknown'}
                </div>
            `;
        }
        
        // Build directions info with proper hex directions
        let directionsHtml = '<div class="directions"><h4>Directions:</h4>';
        
        for (const direction of this.directionOrder) {
            if (directions[direction]) {
                const dirData = directions[direction];
                const directionName = this.directionNames[direction];
                
                if (dirData.movement.walking === 'impassable') {
                    directionsHtml += `
                        <div class="direction">
                            <strong>${directionName}</strong>, to ${dirData.destination}, ${dirData.terrain} 
                            <span class="impassable">Impassable</span>
                            ${dirData.movement.note ? ` (${dirData.movement.note})` : ''}
                        </div>
                    `;
                } else {
                    // Show specific calculated times
                    const walkTime = dirData.movement.walking;
                    const rideTime = dirData.movement.riding;
                    const flyTime = dirData.movement.flying;
                    
                    directionsHtml += `
                        <div class="direction">
                            <strong>${directionName}</strong>, to ${dirData.destination} [${dirData.location_id || 'Unknown'}], ${dirData.terrain}
                            <br>&nbsp;&nbsp;&nbsp;&nbsp;Walking: ${walkTime} days, Riding: ${rideTime} days, Flying: ${flyTime} days
                        </div>
                    `;
                }
            }
        }
        directionsHtml += '</div>';
        
        // Update the info panel
        infoPanel.innerHTML = `
            <h3>${locationName} [${locationId}]</h3>
            <div class="hex-details">
                <strong>Terrain:</strong> ${hexData.terrain.charAt(0).toUpperCase() + hexData.terrain.slice(1)}
                <br><strong>Coordinates:</strong> (${hexData.coordinates.x}, ${hexData.coordinates.y})
                <br><strong>Resources:</strong> ${hexData.resources ? hexData.resources.join(', ') : 'None'}
            </div>
            ${settlementInfo}
            ${directionsHtml}
        `;
    }
    
    // Terrain editing methods
    setTerrainEditMode(terrainType) {
        this.editMode = true;
        this.editTerrain = terrainType;
        this.container.style.cursor = 'crosshair';
        
        // Add click handlers for terrain editing
        const hexes = this.container.querySelectorAll('.hex');
        hexes.forEach(hex => {
            hex.addEventListener('click', this.handleTerrainEdit.bind(this));
        });
    }
    
    handleTerrainEdit(event) {
        if (!this.editMode) return;
        
        const hex = event.currentTarget;
        const x = parseInt(hex.dataset.x);
        const y = parseInt(hex.dataset.y);
        
        // Update terrain in data
        if (this.worldData.hexes[`${x},${y}`]) {
            this.worldData.hexes[`${x},${y}`].terrain = this.editTerrain;
            
            // Update visual
            hex.className = `hex terrain-${this.editTerrain}`;
            
            // Update hex content
            const terrainDiv = hex.querySelector('.hex-terrain');
            if (terrainDiv) {
                terrainDiv.textContent = this.editTerrain;
            }
        }
    }
    
    exitEditMode() {
        this.editMode = false;
        this.editTerrain = null;
        this.container.style.cursor = 'default';
    }
}

// Initialize hex map when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.hexMap = new HexMap('hex-grid');
});
