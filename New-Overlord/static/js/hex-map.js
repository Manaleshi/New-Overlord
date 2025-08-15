class HexMap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.worldData = null;
        this.selectedHex = null;
        
        // Hex display constants for vertical layout - BIGGER HEXES
        this.hexSize = 50;      // Increased from 40
        this.hexSpacing = 55;   // Increased from 45
        
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
        
        // Edit mode state
        this.editMode = false;
        this.editTerrain = null;
    }
    
    calculateHexPosition(x, y) {
        /**
         * Calculate positions for VERTICAL COLUMN hexagonal layout
         * 
         * Layout looks like vertical columns with odd columns shifted down:
         * hex     hex
         *   hex     hex  
         * hex     hex
         *   hex     hex
         * 
         * - Even columns (x=0,2,4...) are at normal position
         * - Odd columns (x=1,3,5...) are shifted DOWN by half a hex height
         */
        
        // Horizontal spacing between columns
        const posX = x * (this.hexSpacing * 0.75) + this.hexSize;
        
        // Vertical position with offset for odd columns
        const offsetY = (x % 2) * (this.hexSpacing / 2); // Odd columns shifted down
        const posY = y * this.hexSpacing + offsetY + this.hexSize;
        
        return { x: posX, y: posY };
    }
    
    loadWorld(worldData) {
        this.worldData = worldData;
        this.render();
    }
    
    render() {
        if (!this.worldData) return;
        
        const { width, height } = this.worldData.metadata.size;
        
        // Calculate container size for vertical column layout
        const containerWidth = width * (this.hexSpacing * 0.75) + this.hexSpacing + 100;
        const containerHeight = height * this.hexSpacing + (this.hexSpacing / 2) + 100;
        
        this.container.innerHTML = '';
        this.container.style.width = `${containerWidth}px`;
        this.container.style.height = `${containerHeight}px`;
        this.container.style.position = 'relative';
        
        // Render each hex - iterate by columns first, then rows for vertical layout
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
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
        hexElement.addEventListener('click', (e) => {
            if (this.editMode) {
                this.handleTerrainEdit(e);
            } else {
                this.selectHex(x, y);
            }
        });
        
        // Add hex content
        const content = document.createElement('div');
        content.className = 'hex-content';
        
        // Build content with settlement icon if present
        let hexContent = `
            <div class="hex-coords">${x},${y}</div>
            <div class="hex-terrain">${hexData.terrain}</div>
        `;
        
        // Add settlement icon if settlement exists
        if (hexData.population_center) {
            const settlementType = hexData.population_center.type;
            let icon = '🏘️'; // village default
            
            if (settlementType === 'city') {
                icon = '🏙️';
            } else if (settlementType === 'town') {
                icon = '🏘️';
            } else {
                icon = '🏠'; // village
            }
            
            hexContent += `<div class="settlement-icon">${icon}</div>`;
        }
        
        content.innerHTML = hexContent;
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
                // Fallback to basic display without movement
                this.updateHexInfoPanel(hexData, {});
            }
        } catch (error) {
            console.error('Error fetching movement data:', error);
            // Fallback to basic display without movement
            this.updateHexInfoPanel(hexData, {});
        }
    }
    
    updateHexInfoPanel(hexData, directions) {
        const infoPanel = document.getElementById('hex-info');
        if (!infoPanel) return;
        
        // Get geographic name or generate one
        const locationName = hexData.geographic_name || `${hexData.terrain} region`;
        const locationId = hexData.location_id || 'Unknown';
        
        // Calculate rural population (total - settlement bonus)
        let ruralPopulation = hexData.population || 0;
        let settlementPopulation = 0;
        
        if (hexData.population_center && hexData.population_center.population) {
            settlementPopulation = hexData.population_center.population;
            ruralPopulation = hexData.population - settlementPopulation;
        }
        
        // Build population info
        let populationInfo = `
            <div class="population-info">
                <strong>Population:</strong> ${ruralPopulation.toLocaleString()}
            </div>
        `;
        
        // Build settlement info
        let settlementInfo = '';
        if (hexData.population_center) {
            settlementInfo = `
                <div class="settlement-info">
                    <strong>Settlement:</strong> ${hexData.population_center.name} (${hexData.population_center.type}) - Population: ${settlementPopulation.toLocaleString()}
                </div>
            `;
        }
        
        // Build directions info with proper hex directions
        let directionsHtml = '<div class="directions"><h4>Directions:</h4>';
        
        if (Object.keys(directions).length > 0) {
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
        } else {
            directionsHtml += '<div class="direction">Movement data not available</div>';
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
            ${populationInfo}
            ${settlementInfo}
            ${directionsHtml}
        `;
    }
    
    // Terrain editing methods
    setTerrainEditMode(terrainType) {
        this.editMode = true;
        this.editTerrain = terrainType;
        this.container.style.cursor = 'crosshair';
        
        // Update edit mode indicator
        const editIndicator = document.getElementById('edit-mode-indicator');
        if (editIndicator) {
            editIndicator.textContent = `Edit Mode: ${terrainType}`;
            editIndicator.style.display = 'block';
        }
        
        console.log(`Edit mode enabled for terrain: ${terrainType}`);
    }
    
    handleTerrainEdit(event) {
        if (!this.editMode || !this.editTerrain) return;
        
        const hex = event.currentTarget;
        const x = parseInt(hex.dataset.x);
        const y = parseInt(hex.dataset.y);
        
        // Update terrain in data
        if (this.worldData.hexes[`${x},${y}`]) {
            const oldTerrain = this.worldData.hexes[`${x},${y}`].terrain;
            this.worldData.hexes[`${x},${y}`].terrain = this.editTerrain;
            
            // Update resources for new terrain
            this.worldData.hexes[`${x},${y}`].resources = this.getTerrainResources(this.editTerrain);
            
            // Update visual
            hex.className = `hex terrain-${this.editTerrain}`;
            if (hex.classList.contains('selected')) {
                hex.classList.add('selected');
            }
            
            // Update hex content (including settlement icon if present)
            this.updateHexVisual(hex, x, y);
            
            console.log(`Changed hex (${x},${y}) from ${oldTerrain} to ${this.editTerrain}`);
            
            // If this hex is selected, update the info panel immediately
            if (this.selectedHex && this.selectedHex.x === x && this.selectedHex.y === y) {
                this.displayHexDetails(x, y);
            }
            
            // Update the world data in the backend session
            this.updateWorldDataInBackend();
        }
    }
    
    updateHexVisual(hexElement, x, y) {
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (!hexData) return;
        
        // Update hex content including settlement icon
        const content = hexElement.querySelector('.hex-content');
        if (content) {
            let hexContent = `
                <div class="hex-coords">${x},${y}</div>
                <div class="hex-terrain">${hexData.terrain}</div>
            `;
            
            // Add settlement icon if settlement exists
            if (hexData.population_center) {
                const settlementType = hexData.population_center.type;
                let icon = '🏘️'; // village default
                
                if (settlementType === 'city') {
                    icon = '🏙️';
                } else if (settlementType === 'town') {
                    icon = '🏘️';
                } else {
                    icon = '🏠'; // village
                }
                
                hexContent += `<div class="settlement-icon">${icon}</div>`;
            }
            
            content.innerHTML = hexContent;
        }
    }
    
    async updateWorldDataInBackend() {
        // Send updated world data to backend so movement calculations reflect changes
        try {
            const response = await fetch('/api/update-world-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    world_data: this.worldData
                })
            });
            
            if (!response.ok) {
                console.warn('Failed to update world data in backend');
            }
        } catch (error) {
            console.warn('Error updating world data in backend:', error);
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
    
    exitEditMode() {
        this.editMode = false;
        this.editTerrain = null;
        this.container.style.cursor = 'default';
        
        // Update edit mode indicator
        const editIndicator = document.getElementById('edit-mode-indicator');
        if (editIndicator) {
            editIndicator.style.display = 'none';
        }
        
        console.log('Edit mode disabled');
    }
    
    // Utility methods
    getWorldData() {
        return this.worldData;
    }
    
    clearSelection() {
        const prevSelected = this.container.querySelector('.hex.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        this.selectedHex = null;
        
        const infoPanel = document.getElementById('hex-info');
        if (infoPanel) {
            infoPanel.innerHTML = '<p>Click on a hex to view details</p>';
        }
    }
}

// Initialize hex map when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.hexMap = new HexMap('hex-grid');
    console.log('HexMap initialized');
});
