// World Generator JavaScript Functions
// Complete implementation for the New Overlord world generator

let currentWorldData = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('World Generator initialized');
    updateDensityDisplay();
    
    // Add event listener for density slider
    const densitySlider = document.getElementById('settlement-density');
    if (densitySlider) {
        densitySlider.addEventListener('input', updateDensityDisplay);
    }
});

function updateDensityDisplay() {
    const slider = document.getElementById('settlement-density');
    const display = document.getElementById('density-value');
    if (slider && display) {
        display.textContent = Math.round(slider.value * 100) + '%';
    }
}

async function generateWorld() {
    console.log('Generate World button clicked');
    
    try {
        // Get form values
        const worldName = document.getElementById('world-name').value || 'Generated World';
        let width = parseInt(document.getElementById('world-width').value) || 5;
        // Ensure width is even for proper hex layout
        if (width % 2 !== 0) {
            width += 1;
            document.getElementById('world-width').value = width; // Update the input
        }
        const height = parseInt(document.getElementById('world-height').value) || 5;
        const settlementDensity = parseFloat(document.getElementById('settlement-density').value) || 0.3;
        
        // Get selected terrain types
        const terrainCheckboxes = document.querySelectorAll('#terrain-types input[type="checkbox"]:checked');
        const terrainTypes = Array.from(terrainCheckboxes).map(cb => cb.value);
        
        if (terrainTypes.length === 0) {
            alert('Please select at least one terrain type.');
            return;
        }
        
        console.log(`Generating ${width}x${height} world with terrains:`, terrainTypes);
        
        // Prepare request data
        const requestData = {
            width: width,
            height: height,
            terrain_types: terrainTypes,
            race_types: ['human'], // Default for now
            params: {
                name: worldName,
                settlement_density: settlementDensity,
                seed: Math.floor(Math.random() * 100000)
            }
        };
        
        // Show loading state
        const generateBtn = document.querySelector('button[onclick="generateWorld()"]');
        if (generateBtn) {
            const originalText = generateBtn.textContent;
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;
        }
        
        // Make API call
        const response = await fetch('/api/generate-world', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
        }
        
        const worldData = await response.json();
        console.log('World generated successfully:', worldData);
        
        // Store and display the world
        currentWorldData = worldData;
        
        // Load the world into the hex map
        if (window.hexMap) {
            window.hexMap.loadWorld(worldData);
            console.log('World loaded into hex map');
        } else {
            console.error('HexMap not initialized');
            alert('Warning: HexMap not available. World data generated but not displayed.');
        }
        
        // Reset button
        if (generateBtn) {
            generateBtn.textContent = 'Generate World';
            generateBtn.disabled = false;
        }
        
        alert('World generated successfully!');
        
    } catch (error) {
        console.error('Error generating world:', error);
        alert('Error generating world: ' + error.message);
        
        // Reset button on error
        const generateBtn = document.querySelector('button[onclick="generateWorld()"]');
        if (generateBtn) {
            generateBtn.textContent = 'Generate World';
            generateBtn.disabled = false;
        }
    }
}

async function saveWorld() {
    if (!currentWorldData) {
        alert('No world data to save. Generate a world first.');
        return;
    }
    
    try {
        const filename = prompt('Enter filename (without .json extension):', 
                               currentWorldData.metadata.name.replace(/\s+/g, '_'));
        
        if (!filename) return;
        
        const response = await fetch('/api/save-world', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                world_data: currentWorldData,
                filename: filename
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
        }
        
        const result = await response.json();
        alert(`World saved as: ${result.filename}`);
        
    } catch (error) {
        console.error('Error saving world:', error);
        alert('Error saving world: ' + error.message);
    }
}

async function loadWorld() {
    try {
        // Get list of available worlds
        const response = await fetch('/api/list-worlds');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const worldFiles = await response.json();
        
        if (worldFiles.length === 0) {
            alert('No saved worlds found.');
            return;
        }
        
        // Create simple selection dialog
        let fileList = 'Available worlds:\n';
        worldFiles.forEach((file, index) => {
            fileList += `${index + 1}. ${file}\n`;
        });
        
        const selection = prompt(fileList + '\nEnter the number of the world to load:');
        if (!selection) return;
        
        const index = parseInt(selection) - 1;
        if (index < 0 || index >= worldFiles.length) {
            alert('Invalid selection.');
            return;
        }
        
        const filename = worldFiles[index];
        
        // Load the selected world
        const loadResponse = await fetch(`/api/load-world/${filename}`);
        if (!loadResponse.ok) {
            const errorData = await loadResponse.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${loadResponse.status}, message: ${errorData.error || 'Unknown error'}`);
        }
        
        const worldData = await loadResponse.json();
        currentWorldData = worldData;
        
        // Load into hex map
        if (window.hexMap) {
            window.hexMap.loadWorld(worldData);
        } else {
            console.error('HexMap not available');
        }
        
        // Update form fields
        const nameField = document.getElementById('world-name');
        const widthField = document.getElementById('world-width');
        const heightField = document.getElementById('world-height');
        
        if (nameField) nameField.value = worldData.metadata.name;
        if (widthField) widthField.value = worldData.metadata.size.width;
        if (heightField) heightField.value = worldData.metadata.size.height;
        
        alert(`World "${worldData.metadata.name}" loaded successfully!`);
        
    } catch (error) {
        console.error('Error loading world:', error);
        alert('Error loading world: ' + error.message);
    }
}

function exportWorld() {
    if (!currentWorldData) {
        alert('No world data to export. Generate a world first.');
        return;
    }
    
    try {
        // Create downloadable JSON file
        const dataStr = JSON.stringify(currentWorldData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        // Create download link
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentWorldData.metadata.name.replace(/\s+/g, '_')}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log('World exported successfully');
        
    } catch (error) {
        console.error('Error exporting world:', error);
        alert('Error exporting world: ' + error.message);
    }
}

// Terrain editing functions
function setEditTerrain(terrainType) {
    console.log(`Setting edit terrain to: ${terrainType}`);
    
    // Remove active class from all terrain buttons
    document.querySelectorAll('.terrain-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button (if event is available)
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find the button by text content
        document.querySelectorAll('.terrain-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(terrainType.toLowerCase())) {
                btn.classList.add('active');
            }
        });
    }
    
    // Set edit mode in hex map
    if (window.hexMap) {
        window.hexMap.setTerrainEditMode(terrainType);
    } else {
        console.error('HexMap not available for terrain editing');
        alert('HexMap not available for terrain editing. Make sure you have generated a world first.');
    }
}

function exitEditMode() {
    console.log('Exiting edit mode');
    
    // Remove active class from all terrain buttons
    document.querySelectorAll('.terrain-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Exit edit mode in hex map
    if (window.hexMap) {
        window.hexMap.exitEditMode();
    } else {
        console.error('HexMap not available');
    }
}

// Debug function to check if everything is loaded
function checkStatus() {
    console.log('=== World Generator Status ===');
    console.log('Current world data:', currentWorldData ? 'Available' : 'None');
    console.log('HexMap available:', window.hexMap ? 'Yes' : 'No');
    console.log('Generate button:', document.querySelector('button[onclick="generateWorld()"]') ? 'Found' : 'Not found');
    console.log('Terrain checkboxes:', document.querySelectorAll('#terrain-types input[type="checkbox"]').length);
}

async function lockWorldForGame() {
    if (!currentWorldData) {
        alert('No world to lock. Generate a world first.');
        return;
    }
    
    const confirmLock = confirm(
        'Lock this world for the game?\n\n' +
        '⚠️ WARNING: This cannot be undone!\n' +
        '- World will be locked permanently\n' +
        '- Players can create factions\n' +
        '- World generator will be disabled\n' +
        '- Game will begin\n\n' +
        'Are you sure?'
    );
    
    if (!confirmLock) return;
    
    try {
        const response = await fetch('/api/lock-world', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to lock world');
        }
        
        const result = await response.json();
        
        alert('✅ World Locked Successfully!\n\nGame is now ready for players to create factions.');
        
        // Disable the interface
        disableGeneratorInterface();
        
    } catch (error) {
        console.error('Error locking world:', error);
        alert('Error locking world: ' + error.message);
    }
}

function disableGeneratorInterface() {
    // Disable all generation buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.id !== 'lock-world-btn') {
            btn.disabled = true;
        }
    });
    
    // Change lock button text
    const lockBtn = document.getElementById('lock-world-btn');
    if (lockBtn) {
        lockBtn.textContent = '🔒 World Locked';
        lockBtn.disabled = true;
    }
    
    // Show locked message
    const container = document.querySelector('.generator-controls');
    if (container) {
        const lockedMsg = document.createElement('div');
        lockedMsg.style.cssText = 'background: #fff3cd; padding: 1rem; margin-top: 1rem; border-radius: 4px; border: 2px solid #ffc107;';
        lockedMsg.innerHTML = '<strong>🔒 World Locked for Active Game</strong><br>World generator is disabled. <a href="/">Return to Home</a>';
        container.appendChild(lockedMsg);
    }
}

async function checkIfWorldLocked() {
    try {
        const response = await fetch('/api/game-status');
        const status = await response.json();
        
        if (status.world_locked) {
            disableGeneratorInterface();
        }
    } catch (error) {
        console.error('Error checking game status:', error);
    }
}
