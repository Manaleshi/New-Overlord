/**
 * Settlement Name Generator
 * Generates fantasy settlement names based on terrain and settlement type
 */
class SettlementNameGenerator {
    constructor() {
        this.nameData = null;
        this.usedNames = new Set();
        this.loadNameData();
    }
    
    async loadNameData() {
        try {
            const response = await fetch('/api/settlement-names');
            this.nameData = await response.json();
        } catch (error) {
            console.error('Failed to load settlement names data:', error);
            // Fallback to basic names if file doesn't load
            this.useBasicNameData();
        }
    }
    
    useBasicNameData() {
        this.nameData = {
            name_components: {
                prefixes: ["Gold", "Silver", "Stone", "River", "Green", "White", "Red", "Iron", "Oak", "Pine"],
                middle_parts: ["vale", "ford", "wood", "haven", "ridge", "brook", "hill", "dale", "field", "grove"],
                suffixes: ["ton", "ham", "shire", "port", "burg", "keep", "peak", "wood", "dale", "crest"]
            }
        };
    }
    
    generateName(terrain, settlementType) {
        if (!this.nameData) {
            this.useBasicNameData();
        }
        
        let attempts = 0;
        let name = "";
        
        // Try to generate a unique name
        do {
            name = this.createName(terrain, settlementType);
            attempts++;
        } while (this.usedNames.has(name) && attempts < 50);
        
        // If we couldn't find a unique name, add a number
        if (this.usedNames.has(name)) {
            let counter = 2;
            let baseName = name;
            do {
                name = `${baseName} ${counter}`;
                counter++;
            } while (this.usedNames.has(name) && counter < 100);
        }
        
        this.usedNames.add(name);
        return name;
    }
    
    createName(terrain, settlementType) {
        // Choose cultural naming style based on terrain
        const culturalStyle = this.chooseCulturalStyle(terrain);
        const styleData = this.nameData.cultural_naming_styles[culturalStyle];
        
        if (!styleData) {
            return this.createBasicName(terrain, settlementType);
        }
        
        // Check for special terrain-based names first
        if (this.nameData.special_names && this.nameData.special_names[terrain] && 
            this.nameData.special_names[terrain][culturalStyle]) {
            if (Math.random() < 0.3) { // 30% chance to use special name
                const specialNames = this.nameData.special_names[terrain][culturalStyle];
                return this.randomChoice(specialNames);
            }
        }
        
        // Check for unique city names
        if (settlementType === 'city' && this.nameData.unique_city_names && 
            this.nameData.unique_city_names[culturalStyle]) {
            if (Math.random() < 0.4) { // 40% chance for unique city name
                const cityNames = this.nameData.unique_city_names[culturalStyle];
                const unusedCityNames = cityNames.filter(name => !this.usedNames.has(name));
                if (unusedCityNames.length > 0) {
                    return this.randomChoice(unusedCityNames);
                }
            }
        }
        
        // Generate compound name using cultural style
        return this.generateCulturalName(terrain, settlementType, styleData, culturalStyle);
    }
    
    chooseCulturalStyle(terrain) {
        if (this.nameData.terrain_cultural_preferences && 
            this.nameData.terrain_cultural_preferences[terrain]) {
            const preferences = this.nameData.terrain_cultural_preferences[terrain];
            return this.randomChoice(preferences);
        }
        return 'fantasy'; // Default fallback
    }
    
    generateCulturalName(terrain, settlementType, styleData, culturalStyle) {
        const patterns = styleData.patterns || ['prefix + suffix'];
        const pattern = this.randomChoice(patterns);
        
        switch (pattern) {
            case 'prefix + suffix':
                return this.randomChoice(styleData.prefixes) + this.randomChoice(styleData.suffixes);
            case 'prefix + middle + suffix':
                if (styleData.middle_parts) {
                    return this.randomChoice(styleData.prefixes) + 
                           this.randomChoice(styleData.middle_parts) + 
                           this.randomChoice(styleData.suffixes);
                } else {
                    return this.randomChoice(styleData.prefixes) + this.randomChoice(styleData.suffixes);
                }
            default:
                return this.randomChoice(styleData.prefixes) + this.randomChoice(styleData.suffixes);
        }
    }
    
    createBasicName(terrain, settlementType) {
        // Fallback to basic fantasy naming if cultural data not available
        const prefixes = ["Gold", "Silver", "Stone", "River", "Green", "Iron"];
        const suffixes = ["vale", "ford", "wood", "haven", "ridge", "burg"];
        return this.randomChoice(prefixes) + this.randomChoice(suffixes);
    }
    
    generateCompoundName(terrain, settlementType, components) {
        const prefix = this.randomChoice(components.prefixes);
        
        // Get terrain-appropriate middle parts and suffixes
        let middleParts = components.middle_parts;
        let suffixes = components.suffixes;
        
        if (this.nameData.terrain_preferences && this.nameData.terrain_preferences[terrain]) {
            const terrainPrefs = this.nameData.terrain_preferences[terrain];
            if (terrainPrefs.preferred_middle && Math.random() < 0.7) {
                middleParts = terrainPrefs.preferred_middle;
            }
            if (terrainPrefs.preferred_suffixes && Math.random() < 0.7) {
                suffixes = terrainPrefs.preferred_suffixes;
            }
        }
        
        // Determine naming pattern based on settlement type
        const patterns = this.getNamePatterns(settlementType);
        const pattern = this.randomChoice(patterns);
        
        switch (pattern) {
            case 'prefix_only':
                return prefix;
            case 'prefix_middle':
                return prefix + this.randomChoice(middleParts);
            case 'prefix_suffix':
                return prefix + this.randomChoice(suffixes);
            case 'prefix_middle_suffix':
                return prefix + this.randomChoice(middleParts) + this.randomChoice(suffixes);
            case 'middle_suffix':
                return this.capitalize(this.randomChoice(middleParts)) + this.randomChoice(suffixes);
            default:
                return prefix + this.randomChoice(middleParts);
        }
    }
    
    getNamePatterns(settlementType) {
        const typeModifiers = this.nameData.settlement_type_modifiers;
        
        if (typeModifiers && typeModifiers[settlementType] && typeModifiers[settlementType].preferred_patterns) {
            return typeModifiers[settlementType].preferred_patterns;
        }
        
        // Default patterns based on settlement type
        switch (settlementType) {
            case 'village':
                return ['prefix_middle', 'prefix_suffix', 'middle_suffix'];
            case 'town':
                return ['prefix_middle_suffix', 'prefix_middle', 'prefix_suffix'];
            case 'city':
                return ['prefix_middle_suffix', 'prefix_suffix'];
            default:
                return ['prefix_middle', 'prefix_suffix'];
        }
    }
    
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    resetUsedNames() {
        this.usedNames.clear();
    }
    
    getUsedNames() {
        return Array.from(this.usedNames);
    }
}

// Export for use in world generator
window.SettlementNameGenerator = SettlementNameGenerator;
