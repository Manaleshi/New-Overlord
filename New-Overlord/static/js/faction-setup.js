// Faction Setup JavaScript
let selectedLocation = null;
let startingTypes = null;
let worldData = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Faction Setup initialized');
    
    // Load starting types
    await loadStartingTypes();
    
    // Load world and initialize hex map
    await loadWorld();
    
    // Setup event listeners
    setupEventListeners();
});

async function loadStartingTypes() {
    try {
        const response = await fetch('/api/starting-types');
        if (!response.ok) {
            throw new Error('Failed to load starting types');
        }
        startingTypes = await response.json();
        console.log('Starting types loaded:', startingTypes);
    } catch (error) {
        console.error('Error loading starting types:', error);
        alert('Error loading game data. Please refresh the page.');
    }
}

async function loadWorld() {
    try {
        const response = await fetch('/api/current-world');
        if (!response.ok) {
            alert('No world has been generated yet. Redirecting to home...');
            window.location.href = '/';
            return;
        }
        
        worldData = await response.json();
        console.log('World loaded:', worldData);
        
        // Initialize hex map in selection mode
        if (window.hexMap) {
            window.hexMap.loadWorld(worldData);
            window.hexMap.setSelectionMode('settlement');
        }
        
    } catch (error) {
        console.error('Error loading world:', error);
        alert('Error loading world. Please try again.');
    }
}

function setupEventListeners() {
    const typeSelect = document.getElementById('starting-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleTypeChange);
    }
    
    const createBtn = document.getElementById('create-faction-btn');
    if (createBtn) {
        createBtn.addEventListener('click', createFaction);
    }
    
    ['faction-name', 'hero-name', 'starting-type'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', validateForm);
        }
    });
}

function handleTypeChange(event) {
    const selectedType = event.target.value;
    
    if (!selectedType || !startingTypes) return;
    
    const typeData = startingTypes.starting_types[selectedType];
    if (!typeData) return;
    
    const descContainer = document.getElementById('type-description');
    const typeName = document.getElementById('type-name');
    const typeDesc = document.getElementById('type-desc');
    const typeDetails = document.getElementById('type-details');
    const typeFlavor = document.getElementById('type-flavor');
    
    typeName.textContent = typeData.name;
    typeDesc.textContent = typeData.description;
    typeFlavor.textContent = typeData.flavor_text;
    
    let detailsHTML = '<strong>Starting Skills:</strong><ul>';
    for (const [skill, data] of Object.entries(typeData.starting_skills)) {
        detailsHTML += `<li>${skill} (Level ${data.level})</li>`;
    }
    detailsHTML += '</ul>';
    
    detailsHTML += '<strong>Starting Items:</strong><ul>';
    for (const [item, qty] of Object.entries(typeData.starting_items)) {
        detailsHTML += `<li>${qty} ${item}</li>`;
    }
    detailsHTML += '</ul>';
    
    typeDetails.innerHTML = detailsHTML;
    descContainer.classList.remove('hidden');
    
    const elementChoice = document.getElementById('element-choice');
    if (selectedType === 'mage') {
        elementChoice.classList.remove('hidden');
    } else {
        elementChoice.classList.add('hidden');
    }
    
    validateForm();
}

function validateForm() {
    const factionName = document.getElementById('faction-name').value.trim();
    const heroName = document.getElementById('hero-name').value.trim();
    const startingType = document.getElementById('starting-type').value;
    
    const createBtn = document.getElementById('create-faction-btn');
    const isValid = factionName && heroName && startingType && selectedLocation;
    createBtn.disabled = !isValid;
}

window.onHexSelected = function(x, y) {
    const hexData = worldData.hexes[`${x},${y}`];
    
    if (!hexData.population_center) {
        alert('You must start in a settlement (village, town, or city).');
        return;
    }
    
    selectedLocation = {
        x: x,
        y: y,
        location_id: hexData.location_id,
        settlement: hexData.population_center,
        terrain: hexData.terrain
    };
    
    displayLocationInfo(hexData);
    
    document.getElementById('setup-form-container').classList.remove('hidden');
    document.getElementById('no-location-msg').classList.add('hidden');
    
    validateForm();
};

function displayLocationInfo(hexData) {
    const locationInfo = document.getElementById('location-info');
    const settlement = hexData.population_center;
    
    let icon = settlement.type === 'city' ? '🏙️' : settlement.type === 'town' ? '🏘️' : '🏠';
    
    locationInfo.innerHTML = `
        <h3>Selected Starting Location</h3>
        <div class="location-details">
            <p><strong>${icon} ${settlement.name}</strong> [${hexData.location_id}]</p>
            <p>Type: ${settlement.type.charAt(0).toUpperCase() + settlement.type.slice(1)}</p>
            <p>Population: ${settlement.population.toLocaleString()}</p>
            <p>Terrain: ${hexData.terrain.charAt(0).toUpperCase() + hexData.terrain.slice(1)}</p>
            <p class="success">✓ Valid starting location</p>
        </div>
    `;
}

async function createFaction() {
    const factionName = document.getElementById('faction-name').value.trim();
    const heroName = document.getElementById('hero-name').value.trim();
    const startingType = document.getElementById('starting-type').value;
    const startingElement = document.getElementById('starting-element').value;
    
    if (!selectedLocation) {
        alert('Please select a starting location');
        return;
    }
    
    const createBtn = document.getElementById('create-faction-btn');
    const statusDiv = document.getElementById('creation-status');
    
    createBtn.disabled = true;
    createBtn.textContent = 'Creating Faction...';
    statusDiv.classList.remove('hidden');
    statusDiv.textContent = 'Building your empire...';
    statusDiv.className = 'status-message info';
    
    try {
        const response = await fetch('/api/create-faction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                faction_name: factionName,
                hero_name: heroName,
                starting_type: startingType,
                starting_element: startingElement || null,
                starting_location: selectedLocation
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create faction');
        }
        
        const result = await response.json();
        console.log('Faction created:', result);
        
        statusDiv.textContent = `Faction created successfully! Faction ID: ${result.faction_id}`;
        statusDiv.className = 'status-message success';
        
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating faction:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'status-message error';
        createBtn.disabled = false;
        createBtn.textContent = 'Create Faction';
    }
}
