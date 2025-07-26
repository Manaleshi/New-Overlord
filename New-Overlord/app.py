from flask import Flask, render_template, request, jsonify
import json
import os
import random
from datetime import datetime

# Movement Calculator Class
class MovementCalculator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.movement_data = None
        self.load_movement_data()
    
    def load_movement_data(self):
        try:
            filepath = os.path.join(self.config_dir, 'movement-system.json')
            with open(filepath, 'r') as f:
                self.movement_data = json.load(f)
        except FileNotFoundError:
            self.use_basic_movement_data()
    
    def use_basic_movement_data(self):
        self.movement_data = {
            "terrain_movement_costs": {
                "plains": {"base_exit_time": 2, "base_enter_time": 2, "passable": True},
                "hills": {"base_exit_time": 4, "base_enter_time": 4, "passable": True},
                "mountains": {"base_exit_time": 8, "base_enter_time": 8, "passable": False},
                "forests": {"base_exit_time": 5, "base_enter_time": 5, "passable": True},
                "swamps": {"base_exit_time": 7, "base_enter_time": 7, "passable": True},
                "deserts": {"base_exit_time": 6, "base_enter_time": 6, "passable": True}
            },
            "distance_variation": {"adjacent_hex": {"min_bonus": 0, "max_bonus": 3}}
        }
    
    def calculate_movement_time(self, from_terrain, to_terrain, movement_type="walking", from_coords=None, to_coords=None):
        if not self.movement_data:
            self.use_basic_movement_data()
        
        terrain_costs = self.movement_data["terrain_movement_costs"]
        from_data = terrain_costs.get(from_terrain, terrain_costs["plains"])
        to_data = terrain_costs.get(to_terrain, terrain_costs["plains"])
        
        if not to_data.get("passable", True):
            return {
                "days": None, "impassable": True,
                "reason": f"Impassable terrain: {to_terrain}",
                "requirements": to_data.get("special_requirements", [])
            }
        
        exit_time = from_data["base_exit_time"]
        enter_time = to_data["base_enter_time"]
        distance_var = self.movement_data.get("distance_variation", {}).get("adjacent_hex", {})
        min_distance = distance_var.get("min_bonus", 0)
        max_distance = distance_var.get("max_bonus", 3)
        
        base_min = exit_time + enter_time + min_distance
        base_max = exit_time + enter_time + max_distance
        
        # Calculate specific travel time (deterministic based on coordinates)
        if from_coords and to_coords:
            seed = hash(f"{from_coords[0]},{from_coords[1]}-{to_coords[0]},{to_coords[1]}") % 1000
            variation = seed % (base_max - base_min + 1)
            specific_time = base_min + variation
        else:
            # Fallback to middle of range if no coordinates
            specific_time = (base_min + base_max) // 2
        
        if movement_type == "flying":
            return {"days": 4, "impassable": False, "movement_type": "flying"}
        elif movement_type == "riding":
            ride_time = max(1, int(specific_time * 0.67))
            return {"days": ride_time, "impassable": False, "movement_type": "riding"}
        else:
            return {"days": specific_time, "impassable": False, "movement_type": "walking"}
    
    def get_hex_neighbors(self, x, y, width, height):
        neighbors = []
        if y % 2 == 0:  # Even row
            potential = [(x-1, y), (x+1, y), (x, y-1), (x+1, y-1), (x, y+1), (x+1, y+1)]
        else:  # Odd row  
            potential = [(x-1, y), (x+1, y), (x-1, y-1), (x, y-1), (x-1, y+1), (x, y+1)]
        
        for nx, ny in potential:
            if 0 <= nx < width and 0 <= ny < height:
                neighbors.append((nx, ny))
        return neighbors
    
    def get_direction_name(self, from_x, from_y, to_x, to_y):
        dx = to_x - from_x
        dy = to_y - from_y
        
        if from_y % 2 == 1:  # Odd row
            if dx == 0 and dy == -1: return "North"
            elif dx == 1 and dy == -1: return "Northeast" 
            elif dx == 1 and dy == 0: return "Southeast"
            elif dx == 0 and dy == 1: return "South"
            elif dx == -1 and dy == 1: return "Southwest"
            elif dx == -1 and dy == 0: return "Northwest"
        else:  # Even row
            if dx == 0 and dy == -1: return "North"
            elif dx == 1 and dy == -1: return "Northeast"
            elif dx == 1 and dy == 0: return "Southeast" 
            elif dx == 0 and dy == 1: return "South"
            elif dx == -1 and dy == 1: return "Southwest"
            elif dx == -1 and dy == 0: return "Northwest"
        return "Unknown"
    
    def calculate_all_directions(self, x, y, world_data):
        width = world_data["metadata"]["size"]["width"]
        height = world_data["metadata"]["size"]["height"]
        current_hex = world_data["hexes"].get(f"{x},{y}")
        
        if not current_hex:
            return []
        
        current_terrain = current_hex["terrain"]
        neighbors = self.get_hex_neighbors(x, y, width, height)
        directions = []
        
        for nx, ny in neighbors:
            neighbor_hex = world_data["hexes"].get(f"{nx},{ny}")
            if neighbor_hex:
                direction = self.get_direction_name(x, y, nx, ny)
                target_terrain = neighbor_hex["terrain"]
                target_name = neighbor_hex.get("geographic_name", f"{target_terrain.title()} Region")
                target_id = neighbor_hex.get("location_id", "L????")
                
                # Pass coordinates for deterministic travel times
                walking = self.calculate_movement_time(current_terrain, target_terrain, "walking", [x, y], [nx, ny])
                riding = self.calculate_movement_time(current_terrain, target_terrain, "riding", [x, y], [nx, ny]) 
                flying = self.calculate_movement_time(current_terrain, target_terrain, "flying", [x, y], [nx, ny])
                
                directions.append({
                    "direction": direction, "target_name": target_name, "target_id": target_id,
                    "target_terrain": target_terrain, "coordinates": [nx, ny],
                    "movement": {"walking": walking, "riding": riding, "flying": flying}
                })
        
        direction_order = ["North", "Northeast", "Southeast", "South", "Southwest", "Northwest"]
        directions.sort(key=lambda d: direction_order.index(d["direction"]) if d["direction"] in direction_order else 99)
        return directions
        
# Geographic Name Generator Class
class GeographicNameGenerator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.name_data = None
        self.used_names = set()
        self.load_name_data()
    
    def load_name_data(self):
        try:
            filepath = os.path.join(self.config_dir, 'geographic-names.json')
            with open(filepath, 'r') as f:
                self.name_data = json.load(f)
        except FileNotFoundError:
            self.use_basic_name_data()
    
    def use_basic_name_data(self):
        self.name_data = {
            "geographic_naming_styles": {
                "fantasy": {
                    "plains": {"prefixes": ["Golden", "Green", "Wind"], "suffixes": ["Plains", "Fields", "Meadows"]},
                    "hills": {"prefixes": ["Rolling", "Stone", "Copper"], "suffixes": ["Hills", "Downs", "Heights"]},
                    "mountains": {"prefixes": ["Iron", "Storm", "Dragon"], "suffixes": ["Mountains", "Peaks", "Range"]},
                    "forests": {"prefixes": ["Dark", "Ancient", "Deep"], "suffixes": ["Wood", "Forest", "Grove"]},
                    "swamps": {"prefixes": ["Shadow", "Mist", "Black"], "suffixes": ["Marshes", "Swamps", "Bogs"]},
                    "deserts": {"prefixes": ["Burning", "Red", "Endless"], "suffixes": ["Desert", "Sands", "Wastes"]}
                }
            },
            "terrain_cultural_preferences": {
                "plains": ["fantasy"], "hills": ["fantasy"], "mountains": ["fantasy"],
                "forests": ["fantasy"], "swamps": ["fantasy"], "deserts": ["fantasy"]
            }
        }
    
    def generate_geographic_name(self, terrain):
        if not self.name_data:
            self.use_basic_name_data()
        
        # Choose cultural style
        cultural_style = self.choose_cultural_style(terrain)
        style_data = self.name_data["geographic_naming_styles"].get(cultural_style, {})
        terrain_data = style_data.get(terrain, {})
        
        if not terrain_data:
            return self.create_basic_name(terrain)
        
        attempts = 0
        name = ""
        
        while attempts < 50:
            prefix = random.choice(terrain_data.get("prefixes", ["Great"]))
            suffix = random.choice(terrain_data.get("suffixes", ["Land"]))
            name = f"{prefix} {suffix}"
            
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
    
    def choose_cultural_style(self, terrain):
        preferences = self.name_data.get('terrain_cultural_preferences', {})
        if terrain in preferences:
            return random.choice(preferences[terrain])
        return 'fantasy'
    
    def create_basic_name(self, terrain):
        basic_names = {
            "plains": "Great Plains",
            "hills": "Rolling Hills", 
            "mountains": "High Mountains",
            "forests": "Deep Forest",
            "swamps": "Dark Marshes",
            "deserts": "Endless Desert"
        }
        return basic_names.get(terrain, "Unknown Land")
    
    def reset_used_names(self):
        self.used_names.clear()

# Terrain Clustering Algorithm
class TerrainClusterer:
    def __init__(self, world_data):
        self.world_data = world_data
        self.width = world_data["metadata"]["size"]["width"]
        self.height = world_data["metadata"]["size"]["height"]
        self.clusters = {}
        self.hex_to_cluster = {}
    
    def find_clusters(self):
        visited = set()
        cluster_id = 0
        
        for y in range(self.height):
            for x in range(self.width):
                hex_id = f"{x},{y}"
                if hex_id not in visited and hex_id in self.world_data["hexes"]:
                    terrain = self.world_data["hexes"][hex_id]["terrain"]
                    cluster = self.flood_fill(x, y, terrain, visited)
                    
                    if cluster:
                        self.clusters[cluster_id] = {
                            "terrain": terrain,
                            "hexes": cluster,
                            "name": None
                        }
                        
                        for hex_coord in cluster:
                            self.hex_to_cluster[hex_coord] = cluster_id
                        
                        cluster_id += 1
        
        return self.clusters
    
    def flood_fill(self, start_x, start_y, target_terrain, visited):
        stack = [(start_x, start_y)]
        cluster = []
        
        while stack:
            x, y = stack.pop()
            hex_id = f"{x},{y}"
            
            if (hex_id in visited or 
                hex_id not in self.world_data["hexes"] or
                self.world_data["hexes"][hex_id]["terrain"] != target_terrain):
                continue
            
            visited.add(hex_id)
            cluster.append(hex_id)
            
            # Check 6 neighbors (hex grid)
            neighbors = self.get_hex_neighbors(x, y)
            for nx, ny in neighbors:
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    neighbor_hex = f"{nx},{ny}"
                    if (neighbor_hex not in visited and 
                        neighbor_hex in self.world_data["hexes"] and
                        self.world_data["hexes"][neighbor_hex]["terrain"] == target_terrain):
                        stack.append((nx, ny))
        
        return cluster
    
    def get_hex_neighbors(self, x, y):
        # Hex grid neighbors (offset coordinates)
        if y % 2 == 0:  # Even row
            return [(x-1, y), (x+1, y), (x, y-1), (x+1, y-1), (x, y+1), (x+1, y+1)]
        else:  # Odd row
            return [(x-1, y), (x+1, y), (x-1, y-1), (x, y-1), (x-1, y+1), (x, y+1)]

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

@app.route('/api/geographic-names')
def get_geographic_names():
    """Get geographic name generation data"""
    try:
        with open(os.path.join(CONFIG_DIR, 'geographic-names.json'), 'r') as f:
            name_data = json.load(f)
        return jsonify(name_data)
    except FileNotFoundError:
        # Return basic name data if file doesn't exist
        default_names = {
            "geographic_naming_styles": {
                "fantasy": {
                    "plains": {"prefixes": ["Golden", "Green"], "suffixes": ["Plains", "Fields"]},
                    "hills": {"prefixes": ["Rolling", "Stone"], "suffixes": ["Hills", "Downs"]},
                    "mountains": {"prefixes": ["Iron", "Storm"], "suffixes": ["Mountains", "Peaks"]},
                    "forests": {"prefixes": ["Dark", "Ancient"], "suffixes": ["Wood", "Forest"]},
                    "swamps": {"prefixes": ["Shadow", "Mist"], "suffixes": ["Marshes", "Swamps"]},
                    "deserts": {"prefixes": ["Burning", "Red"], "suffixes": ["Desert", "Sands"]}
                }
            }
        }
        return jsonify(default_names)

@app.route('/api/hex-movement/<int:x>/<int:y>', methods=['POST'])
def get_hex_movement(x, y):
    """Get movement information for a specific hex"""
    try:
        world_data = request.json
        if not world_data:
            return jsonify({"error": "World data required"}), 400
        
        movement_calc = MovementCalculator(CONFIG_DIR)
        directions = movement_calc.calculate_all_directions(x, y, world_data)
        
        return jsonify({"directions": directions})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-world', methods=['POST'])
def generate_world():
    """Generate a new world based on parameters"""
    try:
        params = request.json
        width = params.get('width', 5)
        height = params.get('height', 5)
        terrain_types = params.get('terrain_types', ['plains', 'hills', 'forests'])
        population_density = params.get('population_density', 0.3)
        
        # Initialize name generators for this world
        settlement_generator = SettlementNameGenerator(CONFIG_DIR)
        settlement_generator.reset_used_names()
        
        geographic_generator = GeographicNameGenerator(CONFIG_DIR)
        geographic_generator.reset_used_names()
        
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
                terrain = random.choice(terrain_types)
                world_data["hexes"][hex_id] = {
                    "terrain": terrain,
                    "resources": get_terrain_resources(terrain),
                    "population_center": None,
                    "location_id": generate_random_id(),
                    "geographic_name": None  # Will be set after clustering
                }
        
        # Find terrain clusters and assign geographic names
        clusterer = TerrainClusterer(world_data)
        clusters = clusterer.find_clusters()
        
        # Assign geographic names to clusters
        for cluster_id, cluster_data in clusters.items():
            terrain = cluster_data["terrain"]
            geographic_name = geographic_generator.generate_geographic_name(terrain)
            cluster_data["name"] = geographic_name
            
            # Update all hexes in this cluster
            for hex_id in cluster_data["hexes"]:
                world_data["hexes"][hex_id]["geographic_name"] = geographic_name
        
        # Add population centers with proper names
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
                    settlement_name = settlement_generator.generate_name(hex_terrain, settlement_type)
                    
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

def generate_random_id():
    """Generate random location ID like L1847"""
    return f"L{random.randint(1000, 9999)}"

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
