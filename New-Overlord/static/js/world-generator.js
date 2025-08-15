// Minimal, bulletproof WorldGenerator implementation
console.log('Loading minimal WorldGenerator...');

class WorldGenerator {
    constructor() {
        console.log('WorldGenerator constructor');
        this.hexMap = null;
        this.currentWorldData = null;
        this.init();
    }
    
    init() {
        console.log('WorldGenerator init');
        
        // Wait a moment for DOM to be ready
        setTimeout(() => {
            this.initializeHexMap();
            this.bindEvents();
            this.loadOptions();
        }, 100);
    }
    
    initializeHexMap() {
        console.log('Creating HexMap...');
        try {
            this.hexMap = new HexMap('hex-map', 5, 5);
            console.log('HexMap created successfully');
            this.showStatus('World Generator ready - click Generate World');
        } catch (error) {
            console.error('HexMap creation failed:', error);
            this.showStatus('ERROR: Failed to create hex map - ' + error.message);
        }
    }
    
    bindEvents() {
        console.log('Binding events...');
        
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.onclick = () => this.generateWorld();
            console.log('Generate button bound');
        } else {
            console.error('Generate button not found');
        }
        
        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.onclick = () => this.toggleEditMode();
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveWorld();
        }
        
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) {
            loadBtn.onclick = () => this.loadWorld();
        }
        
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportWorld();
        }
    }
    
    async loadOptions() {
        console.log('Loading options...');
        
        // Load terrain types
        try {
            const response = await fetch('/api/terrain-types');
            const terrainTypes = await response.json();
            
            const container = document.getElementById('terrain-checkboxes');
            if (container) {
                container.innerHTML = '';
                terrainTypes.forEach(terrain => {
                    const label = document.createElement('label');
                    label.innerHTML = `<input type="checkbox" value="${terrain}" checked> ${terrain} `;
                    container.appendChild(label);
                });
            }
        } catch (error) {
            console.error('Error loading terrain types:', error);
        }
        
        // Load race types
        try {
            const response = await fetch('/api/race-types');
            const raceTypes = await response.json();
            
            const container = document.getElementById('race-checkboxes');
            if (container) {
                container.innerHTML = '';
                raceTypes.forEach(race => {
                    const label = document.createElement('label');
                    label.innerHTML = `<input type="checkbox" value="${race}" ${race === 'human' ? 'checked' : ''}> ${race} `;
                    container.appendChild(label);
                });
            }
        } catch (error) {
            console.error('Error loading race types:', error);
        }
    }
    
    async generateWorld() {
        console.log('Generate world clicked');
        
        if (!this.hexMap) {
            this.showStatus('ERROR: HexMap not available');
            return;
        }
        
        this.showStatus('Generating world...');
        
        try {
            // Get simple values
            const width = parseInt(document.getElementById('world-width')?.value) || 5;
            const height = parseInt(document.getElementById('world-height')?.value) || 5;
            const worldName = document.getElementById('world-name')?.value || 'Test World';
            
            console.log('World parameters:', { width, height, worldName });
            
            // Get selected terrain types
            const terrainCheckboxes = document.querySelectorAll('#terrain-checkboxes input:checked');
            const terrainTypes = Array.from(terrainCheckboxes).map(cb => cb.value);
            
            if (terrainTypes.length === 0) {
                terrainTypes.push('plains', 'hills', 'forests'); // fallback
            }
            
            console.log('Terrain types:', terrainTypes);
            
            // Resize hex map
            this.hexMap.resize(width, height);
            
            // Generate world
            const response = await fetch('/api/generate-world', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    width: width,
                    height: height,
                    terrain_types: terrainTypes,
                    race_types: ['human'],
                    params: {
                        name: worldName,
                        settlement_density: 0.3,
                        seed: Math.floor(Math.random() * 10000)
                    }
                })
            });
            
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const worldData = await response.json();
                console.log('World data received, hexes count:', Object.keys(worldData.hexes || {}).length);
                
                this.currentWorldData = worldData;
                this.hexMap.loadWorldData(worldData);
                
                this.showStatus('World generated successfully! Click hexes to explore.');
            } else {
                const errorText = await response.text();
                console.error('API error:', errorText);
                this.showStatus('ERROR: Failed to generate world - ' + errorText);
            }
            
        } catch (error) {
            console.error('Generation error:', error);
            this.showStatus('ERROR: ' + error.message);
        }
    }
    
    toggleEditMode() {
        console.log('Toggle edit mode');
        this.showStatus('Edit mode toggled');
    }
    
    async saveWorld() {
        console.log('Save world');
        if (!this.currentWorldData) {
            this.showStatus('No world to save');
            return;
        }
        this.showStatus('World save functionality coming soon');
    }
    
    async loadWorld() {
        console.log('Load world');
        this.showStatus('World load functionality coming soon');
    }
    
    exportWorld() {
        console.log('Export world');
        if (!this.currentWorldData) {
            this.showStatus('No world to export');
            return;
        }
        
        const dataStr = JSON.stringify(this.currentWorldData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'world_export.json';
        link.click();
        
        this.showStatus('World exported successfully');
    }
    
    showStatus(message) {
        console.log('Status:', message);
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            if (message.startsWith('ERROR:')) {
                statusElement.innerHTML = `<div style="color: red; font-weight: bold; padding: 10px; border: 2px solid red; margin: 10px 0;">${message}</div>`;
            } else {
                statusElement.innerHTML = `<div style="color: green; font-weight: bold; padding: 10px; margin: 10px 0;">${message}</div>`;
            }
        }
    }
}

// Initialize when DOM is ready
console.log('Setting up initialization...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - creating WorldGenerator');
    try {
        window.worldGenerator = new WorldGenerator();
        console.log('WorldGenerator created successfully');
    } catch (error) {
        console.error('Failed to create WorldGenerator:', error);
        
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.innerHTML = `<div style="color: red; font-weight: bold;">FATAL ERROR: ${error.message}</div>`;
        }
    }
});

console.log('WorldGenerator script loaded');
