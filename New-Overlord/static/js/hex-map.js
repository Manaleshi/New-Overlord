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
        
        // Get economics data
        const economics = hexData.economics;
        
        // Build economic info display
        let economicInfo = '';
        if (economics) {
            const rural = economics.rural;
            const settlement = economics.settlement;
            
            // Rural economics (always present)
            economicInfo = `
                <div class="economic-info">
                    <strong>Population:</strong> ${rural.population.toLocaleString()}
                    <br><strong>Wages:</strong> ${rural.wages}, <strong>taxes:</strong> ${rural.taxes}
                </div>
            `;
            
            // Settlement economics (if present)
            if (settlement && settlement.population > 0) {
                economicInfo += `
                    <div class="settlement-economic-info">
                        <strong>Settlement:</strong> ${settlement.name} (${settlement.type}) - Population: ${settlement.population.toLocaleString()}
                        <br><strong>Settlement Wages:</strong> ${settlement.wages}, <strong>taxes:</strong> ${settlement.taxes}
                    </div>
                `;
            }
        } else {
            // Fallback if no economics data
            const totalPop = hexData.population || 0;
            economicInfo = `
                <div class="economic-info">
                    <strong>Population:</strong> ${totalPop.toLocaleString()}
                    <br><em>Economic data not available</em>
                </div>
            `;
        }
        
        // Build settlement basic info (separate from economics)
        let settlementInfo = '';
        if (hexData.population_center) {
            settlementInfo = `
                <div class="settlement-info">
                    <strong>Settlement:</strong> ${hexData.population_center.name} (${hexData.population_center.type})
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
                <br><strong>Resources:</strong> ${this.formatResourcesWithQuantities(hexData)}
            </div>
            ${economicInfo}
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
            
            // Recalculate economics for new terrain
            this.recalculateHexEconomics(x, y);
            
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
    
    recalculateHexEconomics(x, y) {
        const hexData = this.worldData.hexes[`${x},${y}`];
        if (!hexData) return;
        
        // Simple client-side economic recalculation for terrain changes
        const population = hexData.population || 0;
        const settlement = hexData.population_center;
        const terrain = hexData.terrain;
        
        // Simplified economics calculation (matches backend logic)
        let rural_population = population;
        let settlement_population = 0;
        
        if (settlement) {
            settlement_population = settlement.population;
            rural_population = Math.max(0, population - settlement_population);
        }
        
        // Base wage calculation with terrain modifier
        const base_wage = 10;
        const terrain_modifiers = {
            'plains': 1.0,
            'hills': 1.1,
            'mountains': 1.2,
            'forests': 1.1,
            'swamps': 1.3,
            'deserts': 1.4,
            'water': 1.0
        };
        
        let wage_modifier = 1.0;
        if (population < 100) wage_modifier = 1.3;
        else if (population < 500) wage_modifier = 1.1;
        else if (population < 2000) wage_modifier = 1.0;
        else if (population < 5000) wage_modifier = 0.9;
        else wage_modifier = 0.8;
        
        const terrain_mod = terrain_modifiers[terrain] || 1.0;
        const rural_wages = Math.floor(base_wage * wage_modifier * terrain_mod);
        const rural_taxes = Math.floor(rural_population * rural_wages * 0.15);
        
        // Update economics data
        hexData.economics = {
            rural: {
                population: rural_population,
                wages: rural_wages,
                taxes: rural_taxes
            },
            settlement: settlement ? {
                population: settlement_population,
                wages: settlement.type === 'city' ? rural_wages * 2 : 
                       settlement.type === 'town' ? Math.floor(rural_wages * 1.5) : 
                       Math.floor(rural_wages * 1.2),
                taxes: settlement.type === 'city' ? Math.floor(settlement_population * rural_wages * 2 * 0.28) :
                       settlement.type === 'town' ? Math.floor(settlement_population * rural_wages * 1.5 * 0.22) :
                       Math.floor(settlement_population * rural_wages * 1.2 * 0.18),
                type: settlement.type,
                name: settlement.name
            } : null
        };
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

formatResourcesWithQuantities(hexData) {
    if (!hexData.resources || hexData.resources.length === 0) {
        return 'None';
    }
    
    const quantities = hexData.resource_quantities || {};
    
    return hexData.resources.map(resource => {
        const qty = quantities[resource];
        return qty ? `${qty} ${resource}` : resource;
    }).join(', ');
}

// Initialize hex map when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.hexMap = new HexMap('hex-grid');
    console.log('HexMap initialized');
});
