class WorldGenerator {
    constructor() {
        console.log('WorldGenerator constructor called');
        
        this.hexMap = null;
        this.currentWorldData = null;
        this.editMode = false;
        
        this.init();
    }
    
    init() {
        console.log('WorldGenerator init() called');
        
        // Check if HexMap is available
        if (typeof HexMap === 'undefined') {
            console.error('HexMap class is not available!');
            this.showError('HexMap class not loaded. Check hex-map.js file.');
            return;
        }
        
        try {
            // Initialize UI elements first
            this.initializeUI();
            this.loadTerrainTypes();
            this.loadRaceTypes();
            this.loadWorldFiles();
            
            // Initialize hex map after UI is ready
            this.initializeHexMap();
            
            console.log('WorldGenerator initialization complete');
        } catch (error) {
            console.error('Error in WorldGenerator init:', error);
            this.showError(`Initialization error: ${error.message}`);
        }
    }
    
    initializeHexMap() {
        try {
            console.log('Initializing HexMap...');
            this.hexMap = new HexMap('hex-map', 5, 5);
            
            if (this.hexMap && this.hexMap.isInitialized()) {
                console.log('HexMap successfully created and initialized');
            } else {
                throw new Error('HexMap created but not properly initialized');
            }
        } catch (error) {
            console.error('Failed to initialize HexMap:', error);
            this.showError(`HexMap initialization failed: ${error.message}`);
        }
    }
    
    showError(message) {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.innerHTML = `<div style="color: red; font-weight: bold; padding: 10px; border: 1px solid red; margin: 10px 0;">${message}</div>`;
        }
        console.error(message);
    }
    
    initializeUI() {
        console.log('Initializing UI elements...');
        
        // Check if required elements exist
        const requiredElements = [
            'generate-btn', 'edit-btn', 'save-btn', 'load-btn', 'export-btn',
            'world-width', 'world-height', 'settlement-density', 'world-name'
        ];
        
        for (const elementId of requiredElements) {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`Required element not found: ${elementId}`);
            }
        }
        
        // Bind event handlers
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateWorld());
        }
        
        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleEditMode());
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveWorld());
        }
        
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadWorld());
        }
        
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportWorld());
        }
        
        // Settlement density slider
        const densitySlider = document.getElementById('settlement-density');
        const densityValue = document.getElementById('settlement-density-value');
        if (densitySlider && densityValue) {
            densitySlider.addEventListener('input', (e) => {
                densityValue.textContent = `${Math.round(e.target.value * 100)}%`;
            });
        }
        
        console.log('UI initialization complete');
    }
    
    async loadTerrainTypes() {
        try {
            const response = await fetch('/api/terrain-types');
            const terrainTypes = await response.json();
            
            const container = document.getElementById('terrain-checkboxes');
            if (container) {
                container.innerHTML = '';
                
                terrainTypes.forEach(terrain => {
                    const label = document.createElement('label');
                    label.innerHTML = `
                        <input type="checkbox" value="${terrain}" checked> ${terrain}
                    `;
                    container.appendChild(label);
                });
            }
        } catch (error) {
            console.error('Error loading terrain types:', error);
        }
    }
    
    async loadRaceTypes() {
        try {
            const response = await fetch('/api/race-types');
            const raceTypes = await response.json();
            
            const container = document.getElementById('race-checkboxes');
            if (container) {
                container.innerHTML = '';
                
                raceTypes.forEach(race => {
                    const label = document.createElement('label');
                    label.innerHTML = `
                        <input type="checkbox" value="${race}" ${race === 'human' ? 'checked' : ''}> ${race}
                    `;
                    container.appendChild(label);
                });
            }
        } catch (error) {
            console.error('Error loading race types:', error);
        }
    }
    
    async loadWorldFiles() {
        try {
            const response = await fetch('/api/list-worlds');
            const files = await response.json();
            
            const select = document.getElementById('world-files');
            if (select) {
                select.innerHTML = '<option value="">Select a world file...</option>';
                
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    option.textContent = file;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading world files:', error);
        }
    }
    
    async generateWorld() {
        console.log('generateWorld() called');
        
        // Check if HexMap is properly initialized
        if (!this.hexMap) {
            this.showError('HexMap not created. Cannot generate world.');
            return;
        }
        
        if (!this.hexMap.isInitialized()) {
            this.showError('HexMap not initialized. Cannot generate world.');
            return;
        }
        
        this.showStatus('Generating world...');
        
        try {
            // Get form values
            const width = parseInt(document.getElementById('world-width').value) || 5;
            const height = parseInt(document.getElementById('world-height').value) || 5;
            const worldName = document.getElementById('world-name').value || 'Generated World';
            const settlementDensity = parseFloat(document.getElementById('settlement-density').value) || 0.3;
            
            // Get selected terrain types
            const terrainCheckboxes = document.querySelectorAll('#terrain-checkboxes input[type="checkbox"]:checked');
            const terrainTypes = Array.from(terrainCheckboxes).map(cb => cb.value);
            
            if (terrainTypes.length === 0) {
                this.showError('Please select at least one terrain type.');
                return;
            }
            
            // Get selected race types
            const raceCheckboxes = document.querySelectorAll('#race-checkboxes input[type="checkbox"]:checked');
            const raceTypes = Array.from(raceCheckboxes).map(cb => cb.value);
            
            if (raceTypes.length === 0) {
                this.showError('Please select at least one race type.');
                return;
            }
            
            console.log('Generation parameters:', { width, height, terrainTypes, raceTypes, settlementDensity });
            
            // Update hex map size first
            this.hexMap.resize(width, height);
            
            // Generate world
            const response = await fetch('/api/generate-world', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    width,
                    height,
                    terrain_types: terrainTypes,
                    race_types: raceTypes,
                    params: {
                        name: worldName,
                        settlement_density: settlementDensity,
                        seed: Math.floor(Math.random() * 10000)
                    }
                })
            });
            
            if (response.ok) {
                const worldData = await response.json();
                console.log('World data received:', worldData);
                
                this.currentWorldData = worldData;
                this.hexMap.loadWorldData(worldData);
                
                this.showStatus('World generated successfully! Click on hexes to view details.');
            } else {
                const errorData = await response.json();
                this.showError(`Generation failed: ${errorData.error}`);
            }
            
        } catch (error) {
            console.error('Error generating world:', error);
            this.showError(`Generation error
