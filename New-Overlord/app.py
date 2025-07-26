from flask import Flask, render_template, request, jsonify
import json
import os
import random
from datetime import datetime

# Settlement Name Generator Class
class SettlementNameGenerator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.name_data = None
        self.used_names = set()
        self.load_name_data()
    
    def load_name_data(self):
        try:
            filepath = os.path.join(self.config_dir, 'settlement-names.json')
            with open(filepath, 'r') as f:
                self.name_data = json.load(f)
        except FileNotFoundError:
            self.use_basic_name_data()
    
    def use_basic_name_data(self):
        self.name_data = {
            "cultural_naming_styles": {
                "fantasy": {
                    "prefixes": ["Gold", "Silver", "Stone", "River", "Green", "Iron"],
                    "suffixes": ["vale", "ford", "wood", "haven", "ridge", "burg"],
                    "patterns": ["prefix + suffix"]
                }
            },
            "terrain_cultural_preferences": {
                "plains": ["fantasy"], "hills": ["fantasy"], "mountains": ["fantasy"],
                "forests": ["fantasy"], "swamps": ["fantasy"], "deserts": ["fantasy"]
            }
        }
    
    def generate_name(self, terrain, settlement_type):
        if not self.name_data:
            self.use_basic_name_data()
        
        attempts = 0
        name = ""
        
        while attempts < 50:
            name = self.create_name(terrain, settlement_type)
            if name not in self.used_names:
                break
            attempts += 1
        
        if name in self.used_names:
            counter = 2
            base_name = name
            while f"{base_name} {counter}" in self.used_names and counter < 100:
                counter += 1
            name = f"{base_name} {counter}"
        
        self.used_names.add(name)
        return name
    
    def create_name(self, terrain, settlement_type):
        cultural_style = self.choose_cultural_style(terrain)
        style_data = self.name_data["cultural_naming_styles"].get(cultural_style)
        
        if not style_data:
            return self.create_basic_name()
        
        if (settlement_type == 'city' and 
            'unique_city_names' in self.name_data and
            cultural_style in self.name_data['unique_city_names']):
            if random.random() < 0.4:
                city_names = self.name_data['unique_city_names'][cultural_style]
                unused_names = [n for n in city_names if n not in self.used_names]
                if unused_names:
                    return random.choice(unused_names)
        
        return self.generate_compound_name(style_data)
    
    def choose_cultural_style(self, terrain):
        preferences = self.name_data.get('terrain_cultural_preferences', {})
        if terrain in preferences:
            return random.choice(preferences[terrain])
        return 'fantasy'
    
    def generate_compound_name(self, style_data):
        patterns = style_data.get('patterns', ['prefix + suffix'])
        pattern = random.choice(patterns)
        
        prefixes = style_data.get('prefixes', ['New'])
        suffixes = style_data.get('suffixes', ['town'])
        
        if pattern == 'prefix + middle + suffix' and 'middle_parts' in style_data:
            middle_parts = style_data['middle_parts']
            return random.choice(prefixes) + random.choice(middle_parts) + random.choice(suffixes)
        else:
            return random.choice(prefixes) + random.choice(suffixes)
    
    def create_basic_name(self):
        prefixes = ["Gold", "Silver", "Stone", "River", "Green", "Iron"]
        suffixes = ["vale", "ford", "wood", "haven", "ridge", "burg"]
        return random.choice(prefixes) + random.choice(suffixes)
    
    def reset_used_names(self):
        self.used_names.clear()

app = Flask(__name__, static_folder='Static')

# Add CSP bypass for development
@app.after_request
def after_request(response):
    response.headers['Content-Security-Policy'] = "default-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    return response

# Configuration
WORLD_DATA_DIR = 'worlds'
CONFIG_DIR = 'config'

# Ensure directories exist
os.makedirs(WORLD_DATA_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

@app.route('/')
def index():
    """Main landing page"""
    return render_template('index.html')

@app.route('/world-generator')
def world_generator():
    """World generator interface"""
    return render_template('world-generator.html')

@app.route('/api/terrain-types')
def get_terrain_types():
    """Get available terrain types"""
    try:
        with open(os.path.join(CONFIG_DIR, 'terrain-types.json'), 'r') as f:
            terrain_data = json.load(f)
        return jsonify(terrain_data)
    except FileNotFoundError:
        # Return default terrain types if file doesn't exist
        default_terrain = {
            "terrain_types": {
                "plains": {"name": "Plains", "color": "#90EE90", "resources": ["grain", "horses"]},
                "hills": {"name": "Hills", "color": "#DEB887", "resources": ["stone", "iron"]},
                "mountains": {"name": "Mountains", "color": "#8B7355", "resources": ["stone", "iron", "gems"]},
                "forests": {"name": "Forests", "color": "#228B22", "resources": ["wood", "herbs"]},
                "swamps": {"name": "Swamps", "color": "#556B2F", "resources": ["herbs", "rare_materials"]},
                "deserts": {"name": "Deserts", "color": "#F4A460", "resources": ["rare_minerals"]}
            }
        }
        return jsonify(default_terrain)

@app.route('/api/race-types')
def get_race_types():
    """Get available race types"""
    try:
        with open(os.path.join(CONFIG_DIR, 'race-types.json'), 'r') as f:
            race_data = json.load(f)
        return jsonify(race_data)
    except FileNotFoundError:
        # Return default race types if file doesn't exist
        default_races = {
            "races": {
                "human": {
                    "name": "Human",
                    "preferred_terrain": ["plains", "hills"],
                    "settlement_types": ["village", "town", "city"]
                }
            }
        }
        return jsonify(default_races)

@app.route('/api/settlement-names')
def get_settlement_names():
    """Get settlement name generation data"""
    try:
        with open(os.path.join(CONFIG_DIR, 'settlement-names.json'), 'r') as f:
            name_data = json.load(f)
        return jsonify(name_data)
    except FileNotFoundError:
        # Return basic name data if file doesn't exist
        default_names = {
            "name_components": {
                "prefixes": ["Gold", "Silver", "Stone", "River", "Green", "White", "Red", "Iron", "Oak", "Pine"],
                "middle_parts": ["vale", "ford", "wood", "haven", "ridge", "brook", "hill", "dale", "field", "grove"],
                "suffixes": ["ton", "ham", "shire", "port", "burg", "keep", "peak", "wood", "dale", "crest"]
            }
        }
        return jsonify(default_names)

@app.route('/api/generate-world', methods=['POST'])
def generate_world():
    """Generate a new world based on parameters"""
    try:
        params = request.json
        width = params.get('width', 5)
        height = params.get('height', 5)
        terrain_types = params.get('terrain_types', ['plains', 'hills', 'forests'])
        population_density = params.get('population_density', 0.3)
        
        # Initialize name generator for this world
        name_generator = SettlementNameGenerator(CONFIG_DIR)
        name_generator.reset_used_names()
        
        # Generate basic world data
        world_data = {
            "metadata": {
                "name": f"Generated World {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "size": {"width": width, "height": height},
                "wrap": {"east_west": True, "north_south": False},
                "generated_at": datetime.now().isoformat()
            },
            "hexes": {},
            "population_centers": {}
        }
        
        # Generate terrain for each hex
        for y in range(height):
            for x in range(width):
                hex_id = f"{x},{y}"
                # Simple random terrain generation for now
                terrain = random.choice(terrain_types)
                world_data["hexes"][hex_id] = {
                    "terrain": terrain,
                    "resources": get_terrain_resources(terrain),
                    "population_center": None
                }
        
        # Add some population centers with proper names
        num_settlements = max(1, int(width * height * population_density))
        placed_settlements = 0
        attempts = 0
        
        while placed_settlements < num_settlements and attempts < 50:
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            hex_id = f"{x},{y}"
            
            # Don't place settlements on mountains or swamps
            hex_terrain = world_data["hexes"][hex_id]["terrain"]
            if hex_terrain not in ["mountains", "swamps"]:
                if world_data["hexes"][hex_id]["population_center"] is None:
                    settlement_id = f"settlement_{placed_settlements + 1}"
                    settlement_type = "city" if placed_settlements == 0 else "village"
                    
                    # Generate proper settlement name
                    settlement_name = name_generator.generate_name(hex_terrain, settlement_type)
                    
                    world_data["population_centers"][settlement_id] = {
                        "hex": hex_id,
                        "type": settlement_type,
                        "race": "human",
                        "population": 1000 if settlement_type == "city" else 500,
                        "name": settlement_name
                    }
                    
                    world_data["hexes"][hex_id]["population_center"] = {
                        "type": settlement_type,
                        "name": settlement_name,
                        "population": 1000 if settlement_type == "city" else 500
                    }
                    placed_settlements += 1
            
            attempts += 1
        
        return jsonify(world_data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-world', methods=['POST'])
def save_world():
    """Save world data to file"""
    try:
        world_data = request.json
        world_name = world_data.get('metadata', {}).get('name', 'unnamed_world')
        filename = f"{world_name.replace(' ', '_').lower()}.json"
        filepath = os.path.join(WORLD_DATA_DIR, filename)
        
        with open(filepath, 'w') as f:
            json.dump(world_data, f, indent=2)
        
        return jsonify({"message": "World saved successfully", "filename": filename})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/load-world/<filename>')
def load_world(filename):
    """Load world data from file"""
    try:
        filepath = os.path.join(WORLD_DATA_DIR, filename)
        with open(filepath, 'r') as f:
            world_data = json.load(f)
        return jsonify(world_data)
        
    except FileNotFoundError:
        return jsonify({"error": "World file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/list-worlds')
def list_worlds():
    """List all saved world files"""
    try:
        world_files = [f for f in os.listdir(WORLD_DATA_DIR) if f.endswith('.json')]
        return jsonify({"worlds": world_files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_terrain_resources(terrain_type):
    """Get default resources for a terrain type"""
    terrain_resources = {
        "plains": ["grain", "horses"],
        "hills": ["stone", "iron"],
        "mountains": ["stone", "iron", "gems"],
        "forests": ["wood", "herbs"],
        "swamps": ["herbs", "rare_materials"],
        "deserts": ["rare_minerals"]
    }
    return terrain_resources.get(terrain_type, [])

if __name__ == '__main__':
    # Use environment variable for port (required by Render)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
