from flask import Flask, render_template, request, jsonify, session
import json
import random
import os
import math
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'overlord_secret_key_for_sessions'

# ========== WORLD DATA ABSTRACTION LAYER ==========
# Add these functions right after your imports, before the NameGenerator class

def get_current_world():
    """
    Load the current active world from disk.
    Returns None if no active world exists.
    """
    try:
        filepath = 'worlds/active-world.json'
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, 'r') as f:
            world_data = json.load(f)
        
        return world_data
    except Exception as e:
        print(f"Error loading current world: {e}")
        return None


def set_current_world(world_data):
    """
    Save world data as the current active world.
    This automatically saves to worlds/active-world.json
    """
    try:
        # Ensure worlds directory exists
        os.makedirs('worlds', exist_ok=True)
        
        # Save as active world
        filepath = 'worlds/active-world.json'
        with open(filepath, 'w') as f:
            json.dump(world_data, f, indent=2)
        
        print(f"Active world saved successfully")
        return True
    except Exception as e:
        print(f"Error saving current world: {e}")
        return False


def has_current_world():
    """
    Check if there's an active world available.
    """
    return os.path.exists('worlds/active-world.json')

class NameGenerator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.settlement_data = None
        self.geographic_data = None
        self.used_names = set()
        self.load_name_data()
    
    def load_name_data(self):
        try:
            with open(os.path.join(self.config_dir, 'settlement-names.json'), 'r') as f:
                self.settlement_data = json.load(f)
            with open(os.path.join(self.config_dir, 'geographic-names.json'), 'r') as f:
                self.geographic_data = json.load(f)
        except FileNotFoundError as e:
            print(f"Warning: Could not load name data: {e}")
            self.settlement_data = {"cultural_naming_styles": {}, "terrain_cultural_preferences": {}}
            self.geographic_data = {"geographic_features": {}}
    
    def generate_settlement_name(self, terrain_type, settlement_type):
        if not self.settlement_data:
            return f"Settlement_{random.randint(1000, 9999)}"
        
        # Get cultural preferences for terrain
        cultural_preferences = self.settlement_data.get("terrain_cultural_preferences", {})
        possible_cultures = cultural_preferences.get(terrain_type, ["fantasy"])
        
        if not possible_cultures:
            possible_cultures = ["fantasy"]
        
        # Choose a random culture
        culture = random.choice(possible_cultures)
        
        # Get naming style for culture
        naming_styles = self.settlement_data.get("cultural_naming_styles", {})
        style_data = naming_styles.get(culture, {})
        
        if not style_data:
            return f"Settlement_{random.randint(1000, 9999)}"
        
        # Generate name based on pattern
        patterns = style_data.get("patterns", ["prefix + suffix"])
        pattern = random.choice(patterns)
        
        prefixes = style_data.get("prefixes", ["New"])
        suffixes = style_data.get("suffixes", ["town"])
        
        if pattern == "prefix + suffix":
            name = random.choice(prefixes) + random.choice(suffixes)
        elif pattern == "suffix only":
            name = random.choice(suffixes)
        elif pattern == "prefix only":
            name = random.choice(prefixes)
        else:
            name = random.choice(prefixes) + random.choice(suffixes)
        
        # Ensure uniqueness
        original_name = name
        counter = 1
        while name in self.used_names:
            name = f"{original_name}_{counter}"
            counter += 1
        
        self.used_names.add(name)
        return name
    
    def generate_geographic_name(self, terrain_type, cluster_size=1):
        if not self.geographic_data:
            return f"{terrain_type.title()} Region"
        
        features = self.geographic_data.get("geographic_features", {})
        terrain_features = features.get(terrain_type, {})
        
        if not terrain_features:
            return f"{terrain_type.title()} Region"
        
        # Choose feature type based on cluster size
        if cluster_size >= 5:
            feature_types = terrain_features.get("large", terrain_features.get("medium", terrain_features.get("small", ["Region"])))
        elif cluster_size >= 3:
            feature_types = terrain_features.get("medium", terrain_features.get("small", ["Region"]))
        else:
            feature_types = terrain_features.get("small", ["Region"])
        
        feature_type = random.choice(feature_types)
        
        # Generate descriptive name
        descriptors = terrain_features.get("descriptors", ["Great", "Ancient"])
        descriptor = random.choice(descriptors)
        
        name = f"{descriptor} {feature_type}"
        
        # Ensure uniqueness
        original_name = name
        counter = 1
        while name in self.used_names:
            name = f"{original_name} {counter}"
            counter += 1
        
        self.used_names.add(name)
        return name

class TerrainClusterer:
    def __init__(self, world_data):
        self.world_data = world_data
        self.width = world_data['metadata']['size']['width']
        self.height = world_data['metadata']['size']['height']
        self.wrap_ew = world_data['metadata']['wrap']['east_west']
        
    def get_neighbors(self, x, y):
        neighbors = []
        
        # Hexagonal neighbors for vertical column layout
        if x % 2 == 0:  # Even column
            deltas = [(-1, -1), (-1, 0), (0, -1), (0, 1), (1, -1), (1, 0)]
        else:  # Odd column
            deltas = [(-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0), (1, 1)]
        
        for dx, dy in deltas:
            nx, ny = x + dx, y + dy
            
            # Handle east-west wrapping
            if self.wrap_ew:
                nx = nx % self.width
            
            # Check bounds
            if 0 <= nx < self.width and 0 <= ny < self.height:
                neighbors.append((nx, ny))
        
        return neighbors
    
    def find_clusters(self):
        visited = set()
        clusters = []
        
        for x in range(self.width):
            for y in range(self.height):
                if (x, y) not in visited:
                    hex_data = self.world_data['hexes'].get(f"{x},{y}")
                    if hex_data:
                        terrain = hex_data['terrain']
                        cluster = self.flood_fill(x, y, terrain, visited)
                        if cluster:
                            clusters.append({
                                'terrain': terrain,
                                'hexes': cluster,
                                'size': len(cluster)
                            })
        
        return clusters
    
    def flood_fill(self, start_x, start_y, target_terrain, visited):
        stack = [(start_x, start_y)]
        cluster = []
        
        while stack:
            x, y = stack.pop()
            
            if (x, y) in visited:
                continue
            
            hex_data = self.world_data['hexes'].get(f"{x},{y}")
            if not hex_data or hex_data['terrain'] != target_terrain:
                continue
            
            visited.add((x, y))
            cluster.append((x, y))
            
            # Add neighbors to stack
            for nx, ny in self.get_neighbors(x, y):
                if (nx, ny) not in visited:
                    stack.append((nx, ny))
        
        return cluster

class MovementCalculator:
    def __init__(self):
        # Use built-in default data instead of trying to load file
        self.movement_data = {
            "base_movement": {
                "plains": {"exit": 1, "enter": 1},
                "hills": {"exit": 2, "enter": 2},
                "mountains": {"exit": 3, "enter": 4},
                "forests": {"exit": 2, "enter": 3},
                "swamps": {"exit": 3, "enter": 4},
                "deserts": {"exit": 2, "enter": 3},
                "water": {"exit": 0, "enter": 0}
            },
            "movement_modes": {
                "walking": {"multiplier": 1.0},
                "riding": {"multiplier": 0.67},
                "flying": {"base_time": 4}
            }
        }
    
    def calculate_movement_time(self, from_terrain, to_terrain, mode='walking'):
        base_data = self.movement_data['base_movement']
        mode_data = self.movement_data['movement_modes']
        
        # Handle impassable terrain
        if (from_terrain == 'water' or to_terrain == 'water') and mode != 'flying':
            return 'impassable'
        
        # Calculate base time
        exit_time = base_data.get(from_terrain, {}).get('exit', 2)
        enter_time = base_data.get(to_terrain, {}).get('enter', 2)
        base_time = exit_time + enter_time
        
        # Add random variation
        variation = random.randint(-1, 2)
        total_time = max(1, base_time + variation)
        
        # Apply movement mode
        if mode == 'flying':
            return mode_data['flying']['base_time']
        elif mode == 'riding':
            return max(1, int(total_time * mode_data['riding']['multiplier']))
        else:  # walking
            return total_time
            
class EconomicCalculator:
    def __init__(self):
        self.base_wage = 10
        self.base_tax_rate = 0.15
        
    def calculate_economics(self, population, settlement_data=None, terrain='plains'):
        """Calculate wages and taxes for a hex"""
        
        # Base rural economics
        rural_population = population
        settlement_population = 0
        
        if settlement_data:
            settlement_population = settlement_data.get('population', 0)
            rural_population = max(0, population - settlement_population)
        
        # Calculate rural wages (affected by total population density)
        total_pop = population
        if total_pop < 100:
            wage_modifier = 1.3  # Higher wages in low population areas
        elif total_pop < 500:
            wage_modifier = 1.1
        elif total_pop < 2000:
            wage_modifier = 1.0
        elif total_pop < 5000:
            wage_modifier = 0.9
        else:
            wage_modifier = 0.8  # Lower wages in crowded areas
        
        # Terrain affects wages
        terrain_modifiers = {
            'plains': 1.0,
            'hills': 1.1,
            'mountains': 1.2,
            'forests': 1.1,
            'swamps': 1.3,
            'deserts': 1.4,
            'water': 1.0
        }
        
        terrain_mod = terrain_modifiers.get(terrain, 1.0)
        rural_wages = int(self.base_wage * wage_modifier * terrain_mod)
        
        # Calculate rural taxes
        rural_taxes = int(rural_population * rural_wages * self.base_tax_rate)
        
        # Settlement economics (if present)
        settlement_wages = None
        settlement_taxes = None
        
        if settlement_data:
            settlement_type = settlement_data.get('type', 'village')
            
            # Settlement wage bonuses
            settlement_wage_bonus = {
                'village': 1.2,
                'town': 1.5,
                'city': 2.0
            }
            
            bonus = settlement_wage_bonus.get(settlement_type, 1.2)
            settlement_wages = int(rural_wages * bonus)
            
            # Settlement tax efficiency (better infrastructure = higher tax rate)
            settlement_tax_efficiency = {
                'village': 0.18,
                'town': 0.22,
                'city': 0.28
            }
            
            tax_rate = settlement_tax_efficiency.get(settlement_type, 0.18)
            settlement_taxes = int(settlement_population * settlement_wages * tax_rate)
        
        return {
            'rural': {
                'population': rural_population,
                'wages': rural_wages,
                'taxes': rural_taxes
            },
            'settlement': {
                'population': settlement_population,
                'wages': settlement_wages,
                'taxes': settlement_taxes,
                'type': settlement_data.get('type') if settlement_data else None,
                'name': settlement_data.get('name') if settlement_data else None
            } if settlement_data else None
        }

# Initialize global instances
name_generator = NameGenerator()
economic_calculator = EconomicCalculator()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/world-generator')
def world_generator():
    return render_template('world-generator.html')

@app.route('/api/terrain-types')
def get_terrain_types():
    try:
        with open('config/terrain-types.json', 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        default_terrain = {
            "terrain_types": {
                "plains": {"color": "#90EE90", "resources": ["grain", "horses"]},
                "hills": {"color": "#DEB887", "resources": ["stone", "iron"]},
                "mountains": {"color": "#A0A0A0", "resources": ["stone", "iron", "gems"]},
                "forests": {"color": "#228B22", "resources": ["wood", "herbs"]},
                "swamps": {"color": "#556B2F", "resources": ["herbs", "fish"]},
                "deserts": {"color": "#F4A460", "resources": ["stone", "gems"]},
                "water": {"color": "#4169E1", "resources": ["fish"]}
            }
        }
        return jsonify(default_terrain)

@app.route('/api/race-types')
def get_race_types():
    try:
        with open('config/race-types.json', 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        default_races = {
            "race_types": {
                "human": {
                    "name": "Human",
                    "terrain_preferences": ["plains", "hills", "forests"],
                    "settlement_types": ["village", "town", "city"]
                }
            }
        }
        return jsonify(default_races)

@app.route('/api/settlement-names')
def get_settlement_names():
    try:
        with open('config/settlement-names.json', 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "Settlement names configuration not found"}), 404

def assign_location_ids(world_data):
    """Assign unique location IDs to each hex"""
    location_counter = 1000 + random.randint(0, 8000)
    
    for hex_key in world_data['hexes']:
        world_data['hexes'][hex_key]['location_id'] = f"L{location_counter}"
        location_counter += 1
    
    return world_data

def generate_population(terrain, settlement_data):
    """Generate population for a hex based on terrain and settlement"""
    
    # Base rural population by terrain
    base_population = {
        'plains': random.randint(100, 800),
        'hills': random.randint(50, 400),
        'mountains': random.randint(20, 200),
        'forests': random.randint(80, 500),
        'swamps': random.randint(10, 150),
        'deserts': random.randint(5, 100),
        'water': 0
    }
    
    rural_pop = base_population.get(terrain, 100)
    
    # Add settlement population
    total_population = rural_pop
    if settlement_data:
        total_population += settlement_data['population']
    
    return total_population

@app.route('/api/generate-world', methods=['POST'])
def generate_world():
    try:
        data = request.get_json()
        width = data.get('width', 5)
        # Ensure width is even for proper hex layout
        if width % 2 != 0:
            width += 1  # Round up to next even number
        height = data.get('height', 5)
        terrain_types = data.get('terrain_types', ['plains', 'hills', 'forests'])
        params = data.get('params', {})
        
        # Initialize world structure
        world_data = {
            'metadata': {
                'name': params.get('name', 'Generated World'),
                'size': {'width': width, 'height': height},
                'wrap': {'east_west': True, 'north_south': False},
                'generated_at': datetime.now().isoformat()
            },
            'hexes': {}
        }
        
        # Generate terrain for each hex
        for x in range(width):
            for y in range(height):
                terrain = random.choice(terrain_types)
                world_data['hexes'][f'{x},{y}'] = {
                    'coordinates': {'x': x, 'y': y},
                    'terrain': terrain,
                    'resources': get_terrain_resources(terrain),
                    'resource_quantities': generate_resource_quantities(terrain)
                }
        
        # Run terrain clustering for geographic names
        clusterer = TerrainClusterer(world_data)
        clusters = clusterer.find_clusters()
        
        # Assign geographic names to clusters
        cluster_assignments = {}
        for cluster in clusters:
            cluster_name = name_generator.generate_geographic_name(
                cluster['terrain'], 
                cluster['size']
            )
            for x, y in cluster['hexes']:
                cluster_assignments[f'{x},{y}'] = cluster_name
        
        # Assign geographic names and generate settlements
        settlement_density = params.get('settlement_density', 0.3)
        total_hexes = width * height
        target_settlements = max(1, int(total_hexes * settlement_density))
        settlements_placed = 0
        
        for hex_key, hex_data in world_data['hexes'].items():
            # Assign geographic name
            hex_data['geographic_name'] = cluster_assignments.get(hex_key, f"{hex_data['terrain'].title()} Region")
            
            # Generate settlement (probabilistic)
            if settlements_placed < target_settlements:
                settlement_chance = settlement_density * 1.5  # Boost chance for remaining slots
                # Skip water hexes - no settlements on water
                if hex_data['terrain'] == 'water':
                    continue
                if random.random() < settlement_chance:
                    # Determine settlement type
                    settlement_type = random.choices(
                        ['village', 'town', 'city'],
                        weights=[0.7, 0.25, 0.05]
                    )[0]
                    
                    # Settlement population
                    if settlement_type == 'village':
                        settlement_pop = random.randint(200, 800)
                    elif settlement_type == 'town':
                        settlement_pop = random.randint(800, 3000)
                    else:  # city
                        settlement_pop = random.randint(3000, 10000)
                    
                    settlement_name = name_generator.generate_settlement_name(
                        hex_data['terrain'], 
                        settlement_type
                    )
                    
                    hex_data['population_center'] = {
                        'name': settlement_name,
                        'type': settlement_type,
                        'population': settlement_pop
                    }
                    settlements_placed += 1
            
            # Generate total population (rural + settlement)
            settlement_data = hex_data.get('population_center')
            hex_data['population'] = generate_population(hex_data['terrain'], settlement_data)
            
            # Calculate economics for this hex
            economics = economic_calculator.calculate_economics(
                hex_data['population'],
                settlement_data,
                hex_data['terrain']
            )
            
            # Store economic data in hex
            hex_data['economics'] = economics
        
        # Assign location IDs
        world_data = assign_location_ids(world_data)
        
        # Store in session for movement calculations
        set_current_world(world_data)
        
        return jsonify(world_data)
        
    except Exception as e:
        print(f"Error generating world: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hex-movement/<int:x>/<int:y>')
def get_hex_movement(x, y):
    try:
       world_data = get_current_world()
       if not world_data:
          return jsonify({'error': 'No active world loaded'}), 400
        
        clusterer = TerrainClusterer(world_data)
        neighbors = clusterer.get_neighbors(x, y)
        
        current_hex = world_data['hexes'].get(f'{x},{y}')
        if not current_hex:
            return jsonify({'error': 'Hex not found'}), 404
        
        current_terrain = current_hex['terrain']
        calculator = MovementCalculator()
        
        # Direction mapping for hexagonal layout
        direction_map = {}
        all_possible_directions = ['NW', 'N', 'NE', 'SE', 'S', 'SW']

        # Calculate all 6 potential neighbor positions
        potential_neighbors = []
        if x % 2 == 0:  # Even column
            deltas = [(-1, -1), (0, -1), (1, -1), (1, 0), (0, 1), (-1, 0)]
        else:  # Odd column
            deltas = [(-1, 0), (0, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]

        for i, (dx, dy) in enumerate(deltas):
            nx, ny = x + dx, y + dy
            direction = all_possible_directions[i]
    
            # Handle east-west wrapping
            if world_data['metadata']['wrap']['east_west']:
                nx = nx % world_data['metadata']['size']['width']
    
            # Check if neighbor exists
            if (0 <= nx < world_data['metadata']['size']['width'] and 
                0 <= ny < world_data['metadata']['size']['height']):
                neighbor_hex = world_data['hexes'].get(f'{nx},{ny}')
        
                if neighbor_hex:
                    neighbor_terrain = neighbor_hex['terrain']
            
                    # Calculate movement times
                    walking_time = calculator.calculate_movement_time(current_terrain, neighbor_terrain, 'walking')
                    riding_time = calculator.calculate_movement_time(current_terrain, neighbor_terrain, 'riding')
                    flying_time = calculator.calculate_movement_time(current_terrain, neighbor_terrain, 'flying')
            
                    direction_map[direction] = {
                        'destination': neighbor_hex.get('geographic_name', f'{neighbor_terrain} region'),
                        'location_id': neighbor_hex.get('location_id', 'Unknown'),
                        'terrain': neighbor_terrain,
                        'movement': {
                            'walking': walking_time,
                            'riding': riding_time,
                            'flying': flying_time
                        }
                    }
            else:
                # No neighbor exists - mark as impassable
                direction_map[direction] = {
                    'destination': 'World Edge',
                    'location_id': 'N/A',
                    'terrain': 'boundary',
                    'movement': {
                        'walking': 'impassable',
                        'riding': 'impassable', 
                        'flying': 'impassable',
                        'note': 'World boundary'
                    }
                }
            
            
        
        return jsonify({
            'hex': f'{x},{y}',
            'terrain': current_terrain,
            'directions': direction_map
        })
        
    except Exception as e:
        print(f"Error calculating movement: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/update-world-data', methods=['POST'])
def update_world_data():
    try:
        data = request.get_json()
        world_data = data.get('world_data')
        
        if world_data:
            set_current_world(world_data)
            return jsonify({'status': 'success'})
        else:
            return jsonify({'error': 'No world data provided'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-world', methods=['POST'])
def save_world():
    try:
        data = request.get_json()
        world_data = data.get('world_data')
        filename = data.get('filename', 'world')
        
        if not world_data:
            return jsonify({'error': 'No world data provided'}), 400
        
        # Ensure worlds directory exists
        os.makedirs('worlds', exist_ok=True)
        
        # Save file
        filepath = f'worlds/{filename}.json'
        with open(filepath, 'w') as f:
            json.dump(world_data, f, indent=2)
        
        return jsonify({'status': 'success', 'filename': f'{filename}.json'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/load-world/<filename>')
def load_world(filename):
    try:
        filepath = f'worlds/{filename}'
        with open(filepath, 'r') as f:
            world_data = json.load(f)
        
        # Store in session
        set_current_world(world_data)
        
        return jsonify(world_data)
        
    except FileNotFoundError:
        return jsonify({'error': 'World file not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/list-worlds')
def list_worlds():
    try:
        worlds_dir = 'worlds'
        if not os.path.exists(worlds_dir):
            return jsonify([])
        
        files = [f for f in os.listdir(worlds_dir) if f.endswith('.json')]
        return jsonify(files)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_terrain_resources(terrain):
    resource_map = {
        'plains': ['grain', 'horses'],
        'hills': ['stone', 'iron'],
        'mountains': ['stone', 'iron', 'gems'],
        'forests': ['wood', 'herbs'],
        'swamps': ['herbs', 'fish'],
        'deserts': ['stone', 'gems'],
        'water': ['fish']
    }
    return resource_map.get(terrain, [])

def generate_resource_quantities(terrain):
    """Generate monthly resource production quantities by terrain type"""
    
    resource_ranges = {
        'plains': {
            'grain': (8, 25),
            'horses': (0, 18), 
            'stone': (0, 5)
        },
        'hills': {
            'stone': (5, 20),
            'iron': (2, 12),
            'grain': (0, 8)
        },
        'mountains': {
            'stone': (15, 40),
            'iron': (8, 25),
            'gems': (0, 3)
        },
        'forests': {
            'wood': (10, 35),
            'herbs': (3, 15),
            'stone': (0, 5)
        },
        'swamps': {
            'herbs': (5, 20),
            'fish': (2, 12),
            'wood': (0, 8)
        },
        'deserts': {
            'stone': (3, 15),
            'gems': (0, 5)
        },
        'water': {
            'fish': (12, 30)
        }
    }
    
    ranges = resource_ranges.get(terrain, {})
    quantities = {}
    
    for resource, (min_qty, max_qty) in ranges.items():
        quantities[resource] = random.randint(min_qty, max_qty)
    
    return quantities

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)















