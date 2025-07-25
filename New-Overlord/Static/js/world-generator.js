/**
 * World Generator - Main application logic
 */
class WorldGenerator {
    constructor() {
        this.hexMap = new HexMap('hex-map');
        this.nameGenerator = new SettlementNameGenerator();
        this.terrainTypes = {};
        this.raceTypes = {};
        
        this.initializeEventListeners();
        this.loadTerrainTypes();
        this.loadRaceTypes();
        this.updateDensityDisplay();
    }
    
    initializeEventListeners() {
        // World size controls
        document.getElementById('world-width').addEventListener('change', () => this.updateMapSize());
        document.getElementById('world-height').addEventListener('change', () => this.updateMapSize());
        
        // Population density slider
        document.getElementById('population-density').addEventListener('input', () => this.updateDensityDisplay());
        
        // Action buttons
        document.getElementById('generate-btn').addEventListener('click', () => this.generateWorld());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearMap());
        document.getElementById('save-btn').addEventListener('click', () => this.saveWorld());
        document.getElementById('load-btn').addEventListener('click', () => this.showLoadModal());
        document.getElementById('export-btn').addEventListener('click', () => this.exportWorld());
        
        // Export controls
        document.getElementById('copy-export').addEventListener('click', () => this.copyExportData());
        
        // Modal controls
        const modal = document.getElementById('load-modal');
        modal.querySelector('.modal-close').addEventListener('click', () => this.hideLoadModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideLoadModal();
        });
        
        // Status message close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('status-close')) {
                e.target.parentElement.style.display = 'none';
            }
        });
    }
    
    async loadTerrainTypes() {
        try {
            const response = await fetch('/api/terrain-types');
            const data = await response.json();
            this.terrainTypes = data.terrain_types || {};
            this.updateTerrainCheckboxes();
            this.hexMap.setTerrainTypes(this.terrainTypes);
        } catch (error) {
            console.error('Failed to load terrain types:', error);
            this.showStatus('Failed to load terrain types', 'error');
        }
    }
    
    async loadRaceTypes() {
        try {
            const response = await fetch('/api/race-types');
            const data = await response.json();
            this.raceTypes = data.races || {};
            this.updateRaceCheckboxes();
        } catch (error) {
            console.error('Failed to load race types:', error);
            this.showStatus('Failed to load race types', 'error');
        }
    }
    
    updateTerrainCheckboxes() {
        const container = document.getElementById('terrain-types');
        container.innerHTML = '';
        
        Object.entries(this.terrainTypes).forEach(([key, terrain]) => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${key}" checked> ${terrain.name}
            `;
            container.appendChild(label);
        });
    }
    
    updateRaceCheckboxes() {
        const container = document.getElementById('race-types');
        container.innerHTML = '';
        
        Object.entries(this.raceTypes).forEach(([key, race]) => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${key}" checked> ${race.name}
            `;
            container.appendChild(label);
        });
    }
    
    updateDensityDisplay() {
        const slider = document.getElementById('population-density');
        const display = document.getElementById('density-value');
        const percentage = Math.round(slider.value * 100);
        display.textContent = `${percentage}%`;
    }
    
    updateMapSize() {
        const width = document.getElementById('world-width').value;
        const height = document.getElementById('world-height').value;
        this.hexMap.setSize(width, height);
    }
    
    getSelectedTerrainTypes() {
        const checkboxes = document.querySelectorAll('#terrain-types input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    getSelectedRaceTypes() {
        const checkboxes = document.querySelectorAll('#race-types input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    async generateWorld() {
        const generateBtn = document.getElementById('generate-btn');
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        
        try {
            const params = {
                width: parseInt(document.getElementById('world-width').value),
                height: parseInt(document.getElementById('world-height').value),
                terrain_types: this.getSelectedTerrainTypes(),
                race_types: this.getSelectedRaceTypes(),
                population_density: parseFloat(document.getElementById('population-density').value)
            };
            
            const response = await fetch('/api/generate-world', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const worldData = await response.json();
            this.hexMap.loadWorldData(worldData);
            this.showStatus('World generated successfully!');
            
        } catch (error) {
            console.error('Failed to generate world:', error);
            this.showStatus('Failed to generate world: ' + error.message, 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate World';
        }
    }
    
    clearMap() {
        if (confirm('Are you sure you want to clear the map?')) {
            this.hexMap.clear();
            this.showStatus('Map cleared');
        }
    }
    
    async saveWorld() {
        const worldData = this.hexMap.getWorldData();
        const worldName = document.getElementById('world-name').value;
        
        if (worldName) {
            worldData.metadata.name = worldName;
        }
        
        try {
            const response = await fetch('/api/save-world', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(worldData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.showStatus(`World saved as ${result.filename}`);
            
        } catch (error) {
            console.error('Failed to save world:', error);
            this.showStatus('Failed to save world: ' + error.message, 'error');
        }
    }
    
    async showLoadModal() {
        try {
            const response = await fetch('/api/list-worlds');
            const data = await response.json();
            
            const worldList = document.getElementById('world-list');
            worldList.innerHTML = '';
            
            if (data.worlds && data.worlds.length > 0) {
                data.worlds.forEach(filename => {
                    const button = document.createElement('button');
                    button.className = 'btn btn-secondary';
                    button.textContent = filename.replace('.json', '');
                    button.style.display = 'block';
                    button.style.width = '100%';
                    button.style.marginBottom = '10px';
                    button.addEventListener('click', () => this.loadWorld(filename));
                    worldList.appendChild(button);
                });
            } else {
                worldList.innerHTML = '<p>No saved worlds found.</p>';
            }
            
            document.getElementById('load-modal').style.display = 'flex';
            
        } catch (error) {
            console.error('Failed to load world list:', error);
            this.showStatus('Failed to load world list: ' + error.message, 'error');
        }
    }
    
    hideLoadModal() {
        document.getElementById('load-modal').style.display = 'none';
    }
    
    async loadWorld(filename) {
        try {
            const response = await fetch(`/api/load-world/${filename}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const worldData = await response.json();
            this.hexMap.loadWorldData(worldData);
            
            // Update form fields
            if (worldData.metadata) {
                if (worldData.metadata.name) {
                    document.getElementById('world-name').value = worldData.metadata.name;
                }
                if (worldData.metadata.size) {
                    document.getElementById('world-width').value = worldData.metadata.size.width;
                    document.getElementById('world-height').value = worldData.metadata.size.height;
                }
            }
            
            this.hideLoadModal();
            this.showStatus(`Loaded world: ${filename.replace('.json', '')}`);
            
        } catch (error) {
            console.error('Failed to load world:', error);
            this.showStatus('Failed to load world: ' + error.message, 'error');
        }
    }
    
    exportWorld() {
        const worldData = this.hexMap.getWorldData();
        const worldName = document.getElementById('world-name').value;
        
        if (worldName) {
            worldData.metadata.name = worldName;
        }
        
        const exportText = JSON.stringify(worldData, null, 2);
        document.getElementById('export-text').value = exportText;
        document.getElementById('export-output').style.display = 'block';
        this.showStatus('World data exported to JSON');
    }
    
    copyExportData() {
        const exportText = document.getElementById('export-text');
        exportText.select();
        exportText.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            this.showStatus('Export data copied to clipboard');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showStatus('Failed to copy to clipboard', 'error');
        }
    }
    
    showStatus(message, type = 'success') {
        const statusElement = document.getElementById('status-message');
        const statusText = document.getElementById('status-text');
        
        statusText.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

// Initialize the world generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.worldGenerator = new WorldGenerator();
});
