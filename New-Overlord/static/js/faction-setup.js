// Player Registration JavaScript
let startingTypes = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Player Registration initialized');
    
    await loadStartingTypes();
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

function setupEventListeners() {
    const form = document.getElementById('registration-form');
    if (form) {
        form.addEventListener('submit', handleRegistration);
    }
    
    const typeSelect = document.getElementById('starting-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleTypeChange);
    }
    
    ['player-name', 'email', 'password', 'confirm-password', 'starting-type'].forEach(id => {
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
    const playerName = document.getElementById('player-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const startingType = document.getElementById('starting-type').value;
    
    const registerBtn = document.getElementById('register-btn');
    
    const isValid = playerName && email && password.length >= 6 && 
                    password === confirmPassword && startingType;
    
    registerBtn.disabled = !isValid;
}

async function handleRegistration(event) {
    event.preventDefault();
    
    const playerName = document.getElementById('player-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const startingType = document.getElementById('starting-type').value;
    const startingElement = document.getElementById('starting-element').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }
    
    const registerBtn = document.getElementById('register-btn');
    const statusDiv = document.getElementById('registration-status');
    
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    statusDiv.classList.remove('hidden');
    statusDiv.textContent = 'Creating your player account...';
    statusDiv.className = 'status-message info';
    
    try {
        const response = await fetch('/api/register-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_name: playerName,
                email: email,
                password: password,
                starting_type: startingType,
                starting_element: startingElement || null
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to register');
        }
        
        const result = await response.json();
        console.log('Player registered:', result);
        
        statusDiv.innerHTML = `
            <strong>✅ Registration Complete!</strong><br><br>
            Your player account has been created.<br>
            You will receive your first turn report when the next turn processes.<br><br>
            <strong>Next Turn:</strong> ${result.next_turn_date || 'To be announced'}<br><br>
            Check your email or log in to view your report.
        `;
        statusDiv.className = 'status-message success';
        
        setTimeout(() => {
            window.location.href = '/';
        }, 5000);
        
    } catch (error) {
        console.error('Error registering player:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'status-message error';
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Player';
    }
}
