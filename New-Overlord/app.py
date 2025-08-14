from flask import Flask, render_template, request, jsonify, session
import json
import os
import random
import hashlib
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'overlord_secret_key_change_in_production'

# Ensure directories exist
os.makedirs('config', exist_ok=True)
os.makedirs('worlds', exist_ok=True)

def get_hex_neighbors(x, y, width, height, wrap_east_west=True):
    """
    Get the 6 neighbors of a hex using proper hexagonal coordinates.
    Returns dict with direction names as keys and (x, y) coordinates as values.
    
    Proper hex directions: N, NE, SE, S, SW, NW
    """
    neighbors = {}
    
    # In a hexagonal grid, neighbor offsets depend on whether the row is even or odd
    # This is the "offset coordinate" system for hexagonal grids
    
    if y % 2 == 0:  # Even rows
        offsets = {
            'N':  (0, -1),   # North
            'NE': (1, -1),   # Northeast  
            'SE': (1, 0),    # Southeast
            'S':  (0, 1),    # South
            'SW': (-1, 0),   # Southwest
            'NW': (-1, -1)   # Northwest
        }
    else:  # Odd rows
        offsets = {
            'N':  (0, -1),   # North
            'NE': (1, 0),    # Northeast
            'SE': (1, 1),    # Southeast  
            'S':  (0, 1),    # South
            'SW': (-1, 1),   # Southwest
            'NW': (-1, 0)    # Northwest
        }
    
    for direction, (dx, dy) in offsets.items():
        new_x = x + dx
        new_y = y + dy
        
        # Handle north/south boundaries
        if new_y < 0 or new_y >= height:
            neighbors[direction] = None  # Impassable boundary
            continue
            
        # Handle east/west wrapping
        if wrap_east_west:
            if new_x < 0:
                new_x = width - 1  # Wrap to east edge
            elif new_x >= width:
                new_x = 0  # Wrap to west edge
        else:
            if new_x < 0 or new_x >= width:
                neighbors[direction] = None  # Impassable boundary
                continue
        
        neighbors[direction] = (new_x, new_y)
    
    return neighbors


class MovementCalculator:
    def __init__(self):
        # Base movement times by terrain (in days for walking)
        self.terrain_movement = {
            'plains': {'min': 4, 'max': 6},
            'hills': {'min': 6, 'max': 9}, 
            'mountains': {'min': 12, 'max': 15, 'impassable_walking': True},
            'forests': {'min': 8, 'max': 12},
            'swamps': {'min': 10, 'max': 15},
            'deserts': {'min': 6, 'max': 10},
            'water': {'impassable_walking': True, 'impassable_riding': True}
        }
        
        # Movement mode modifiers
        self.movement_modes = {
            'walking': 1.0,
            'riding': 0.67,  # 33% faster
            'flying': 4       # Fixed 4 days regardless of terrain
        }
    
    def calculate_movement_time(self, from_terrain, to_terrain, from_coords, to_coords):
        """
        Calculate specific movement time between two hexes.
        Returns dict with walking/riding/flying times, or indicates if impassable.
        """
        # Check if movement is possible
        if (self.terrain_movement.get(from_terrain, {}).get('impassable_walking') or
            self.terrain_movement.get(to_terrain, {}).get('impassable_walking')):
            return {
                'walking': 'impassable',
                'riding': 'impassable', 
                'flying': 4,
                'note': 'requires mountainwalk or flying'
            }
        
        # Get terrain movement ranges
        from_range = self.terrain_movement.get(from_terrain, {'min': 6, 'max': 9})
        to_range = self.terrain_movement.get(to_terrain, {'min': 6, 'max': 9})
        
        # Calculate base time (average of exit and entry terrain)
        from_time = (from_range['min'] + from_range['max']) / 2
        to_time = (to_range['min'] + to_range['max']) / 2
        base_time = (from_time + to_time) / 2
        
        # Add coordinate-based variation (deterministic but varies by route)
        route_seed = f"{from_coords[0]},{from_coords[1]}-{to_coords[0]},{to_coords[1]}"
        hash_val = int(hashlib.md5(route_seed.encode()).hexdigest()[:8], 16)
        variation = (hash_val % 7) - 3  # -3 to +3 variation
        
        walking_time = max(3, int(base_time + variation))
        
        # Calculate other movement modes
        riding_time = max(2, int(walking_time * self.movement_modes['riding']))
        flying_time = self.movement_modes['flying']
        
        return {
            'walking': walking_time,
            'riding': riding_time,
            'flying': flying_time
        }
    
    def calculate_all_directions(self, x, y, world_data):
        """
        Calculate movement times for all 6 directions from a hex.
        Returns dict with direction as key and movement data as value.
        """
        width = world_data['metadata']['size']['width']
        height = world_data['metadata']['size']['height']
        wrap_ew = world_data['metadata']['wrap']['east_west']
        
        current_hex = world_data['hexes'].get(f'{x},{y}')
        if not current_hex:
            return {}
        
        current_terrain = current_hex['terrain']
        neighbors = get_hex_neighbors(x, y, width, height, wrap_ew)
        
        directions = {}
        
        for direction, coords in neighbors.items():
            if coords is None:
                # Boundary hex
                directions[direction] = {
                    'destination': 'Impassable Boundary',
                    'terrain': 'boundary',
                    'location_id': None,
                    'movement': {
                        'walking': 'impassable',
                        'riding': 'impassable',
                        'flying': 'impassable'
                    }
                }
            else:
                neighbor_x, neighbor_y = coords
                neighbor_hex = world_data['hexes'].get(f'{neighbor_x},{neighbor_y}')
                
                if neighbor_hex:
                    movement_times = self.calculate_movement_time(
                        current_terrain, 
                        neighbor_hex['terrain'],
                        (x, y),
                        (neighbor_x, neighbor_y)
                    )
                    
                    directions[direction] = {
                        'destination': neighbor_hex.get('geographic_name', f'Hex {neighbor_x},{neighbor_y}'),
                        'terrain': neighbor_hex['terrain'],
                        'location_id': neighbor_hex.get('location_id'),
                        'movement': movement_times
                    }
        
        return directions


class SettlementNameGenerator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.name_data = self.load_settlement_names()
        self.used_names = set()
    
    def load_settlement_names(self):
        """Load settlement naming configuration"""
        config_file = os.path.join(self.config_dir, 'settlement-names.json')
        
        # Default settlement names if file doesn't exist
        default_names = {
            "cultural_naming_styles": {
                "fantasy": {
                    "prefixes": ["Golden", "Silver", "Shadow", "Bright", "Dark", "Crystal", "Ancient", "New", "Old", "Deep"],
                    "suffixes": ["haven", "ford", "bridge", "vale", "hill", "brook", "field", "wood", "shire", "ton"],
                    "patterns": ["prefix + suffix"]
                },
                "norse": {
                    "prefixes": ["Grim", "Thor", "Bjorn", "Erik", "Rag", "Sven", "Ulf", "Olaf", "Magnus", "Harald"],
                    "suffixes": ["by", "thorpe", "vik", "heim", "stad", "fjord", "borg", "havn", "land", "gard"],
                    "patterns": ["prefix + suffix"]
                },
                "celtic": {
                    "prefixes": ["Aber", "Bal", "Ben", "Caer", "Dun", "Glen", "Inver", "Kil", "Llan", "Pen"],
                    "suffixes": ["mor", "beg", "wyn", "goch", "du", "mawr", "bach", "fawr", "fach", "glas"],
                    "patterns": ["prefix + suffix"]
                },
                "germanic": {
                    "prefixes": ["Stein", "Berg", "Wald", "Gross", "Klein", "Neu", "Alt", "Hoch", "Tief", "Schwarz"],
                    "suffixes": ["burg", "dorf", "hausen", "feld", "wald", "berg", "tal", "bach", "brunn", "hof"],
                    "patterns": ["prefix + suffix"]
                }
            },
            "terrain_cultural_preferences": {
                "coast": ["norse", "fantasy"],
                "mountains": ["germanic", "fantasy"],
                "hills": ["celtic", "germanic"],
                "forests": ["celtic", "fantasy"],
                "plains": ["fantasy", "germanic"],
                "swamps": ["fantasy"],
                "deserts": ["fantasy"]
            }
        }
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        # Save default config
        with open(config_file, 'w') as f:
            json.dump(default_names, f, indent=2)
        
        return default_names
    
    def choose_cultural_style(self, terrain):
        """Choose cultural naming style based on terrain"""
        preferences = self.name_data['terrain_cultural_preferences'].get(terrain, ['fantasy'])
        return random.choice(preferences)
    
    def generate_settlement_name(self, terrain, settlement_type):
        """Generate a settlement name based on terrain and type"""
        cultural_style = self.choose_cultural_style(terrain)
        style_data = self.name_data['cultural_naming_styles'][cultural_style]
        
        max_attempts = 20
        for _ in range(max_attempts):
            prefix = random.choice(style_data['prefixes'])
            suffix = random.choice(style_data['suffixes'])
            name = f"{prefix}{suffix}"
            
            if name not in self.used_names:
                self.used_names.add(name)
                return name
        
        # Fallback if all names are used
        return f"{random.choice(style_data['prefixes'])}{settlement_type}{random.randint(1, 999)}"


class GeographicNameGenerator:
    def __init__(self, config_dir='config'):
        self.config_dir = config_dir
        self.name_data = self.load_geographic_names()
        self.used_names = set()
    
    def load_geographic_names(self):
        """Load geographic naming configuration"""
        config_file = os.path.join(self.config_dir, 'geographic-names.json')
        
        default_names = {
            "terrain_name_patterns": {
                "plains": {
                    "adjectives": ["Golden", "Wide", "Vast", "Rolling", "Windswept", "Endless", "Green", "Fertile"],
                    "nouns": ["Plains", "Fields", "Meadows", "Grasslands", "Steppes", "Prairie"]
                },
                "hills": {
                    "adjectives": ["Rolling", "Gentle", "Rocky", "Ancient", "Misty", "Verdant", "Steep"],
                    "nouns": ["Hills", "Highlands", "Downs", "Ridges", "Knolls", "Mounds"]
                },
                "mountains": {
                    "adjectives": ["Towering", "Jagged", "Snow-capped", "Ancient", "Mighty", "Forbidding", "Majestic"],
                    "nouns": ["Mountains", "Peaks", "Range", "Heights", "Crags", "Summits"]
                },
                "forests": {
                    "adjectives": ["Dark", "Ancient", "Whispering", "Deep", "Enchanted", "Shadowy", "Primeval"],
                    "nouns": ["Forest", "Woods", "Grove", "Thicket", "Woodland", "Copse"]
                },
                "swamps": {
                    "adjectives": ["Murky", "Fetid", "Treacherous", "Misty", "Haunted", "Boggy", "Dank"],
                    "nouns": ["Swamp", "Marsh", "Bog", "Mire", "Wetlands", "Fen"]
                },
                "deserts": {
                    "adjectives": ["Burning", "Endless", "Shifting", "Scorching", "Barren", "Vast", "Bleached"],
                    "nouns": ["Desert", "Wastes", "Dunes", "Sands", "Expanse", "Barrens"]
                }
            }
        }
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        with open(config_file, 'w') as f:
            json.dump(default_names, f, indent=2)
        
        return default_names
    
    def generate_geographic_name(self, terrain):
        """Generate a geographic name for a terrain cluster"""
        if terrain not in self.name_data['terrain_name_patterns']:
            terrain = 'plains'  # fallback
        
        pattern_data = self.name_data['terrain_name_patterns'][terrain]
        
        max_attempts = 20
        for _ in range(max_attempts):
            adjective = random.choice(pattern_data['adjectives'])
            noun = random.choice(pattern_data['nouns'])
            name = f"{adjective} {noun}"
            
            if name not in self.used_names:
                self.used_names.add(name)
                return name
        
        # Fallback
        return f"{random.choice(pattern_data['adjectives'])} {random.choice(pattern_data['nouns'])} {random.randint(1, 999)}"


def generate_terrain_for_hex(x, y, terrain_types, params):
    """Generate terrain for a specific hex coordinate"""
    # Simple terrain generation - can be enhanced with more sophisticated algorithms
    seed = params.get('seed', 12345)
    random.seed(seed + x * 1000 + y)
    
    # Weight terrain types (plains more common, mountains less common)
    weighted_terrains = []
    for terrain in terrain_types:
        if terrain == 'plains':
            weighted_terrains.extend([terrain] * 3)
        elif terrain == 'mountains':
            weighted_terrains.extend([terrain] * 1)
        else:
            weighted_terrains.extend([terrain] * 2)
    
    return random.choice(weighted_terrains)


def get_terrain_resources(terrain):
    """Get default resources for terrain type"""
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


def add_geographic_names(world_data):
    """Add geographic names to terrain clusters"""
    name_generator = GeographicNameGenerator()
    
    # Simple approach: assign random geographic names to each hex
    # In the future, this could be enhanced with terrain clustering
    for coord, hex_data in world_data['hexes'].items():
        if 'geographic_name' not in hex_data:
            hex_data['geographic_name'] = name_generator.generate_geographic_name(hex_data['terrain'])


def add_settlements(world_data, params):
    """Add settlements to the world"""
    name_generator = SettlementNameGenerator()
    
    settlement_density = params.get('settlement_density', 0.3)  # 30% chance per hex
    
    for coord, hex_data in world_data['hexes'].items():
        if hex_data['terrain'] in ['mountains', 'water', 'swamps']:
            continue  # Skip unsuitable terrain
        
        if random.random() < settlement_density:
            settlement_type = random.choice(['village', 'village', 'village', 'town', 'city'])
            population = {
                'village': random.randint(200, 800),
                'town': random.randint(800, 3000),
                'city': random.randint(3000, 10000)
            }[settlement_type]
            
            settlement_name = name_generator.generate_settlement_name(hex_data['terrain'], settlement_type)
            
            hex_data['population_center'] = {
                'name': settlement_name,
                'type': settlement_type,
                'population': population
            }


def generate_world(width, height, terrain_types, race_types, params):
    """Generate a complete world with proper hexagonal coordinates"""
    
    # Initialize world data
    world_data = {
        'metadata': {
            'name': params.get('name', 'Generated World'),
            'size': {'width': width, 'height': height},
            'wrap': {'east_west': True, 'north_south': False},
            'generation_date': datetime.now().isoformat()
        },
        'hexes': {},
        'population_centers': {}
    }
    
    # Generate terrain for each hex
    for y in range(height):
        for x in range(width):
            terrain = generate_terrain_for_hex(x, y, terrain_types, params)
            
            hex_data = {
                'terrain': terrain,
                'location_id': f'L{random.randint(1000, 9999)}',
                'coordinates': {'x': x, 'y': y},
                'resources': get_terrain_resources(terrain),
                'population_center': None
            }
            
            world_data['hexes'][f'{x},{y}'] = hex_data
    
    # Add geographic names
    add_geographic_names(world_data)
    
    # Add settlements
    add_settlements(world_data, params)
    
    return world_data


# Routes
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
    terrain_types = ['plains', 'hills', 'mountains', 'forests', 'swamps', 'deserts']
    return jsonify(terrain_types)


@app.route('/api/race-types')
def get_race_types():
    """Get available race types"""
    race_types = ['human', 'elf', 'dwarf', 'orc']
    return jsonify(race_types)


@app.route('/api/generate-world', methods=['POST'])
def api_generate_world():
    """Generate a new world"""
    try:
        data = request.get_json()
        
        width = data.get('width', 5)
        height = data.get('height', 5)
        terrain_types = data.get('terrain_types', ['plains', 'hills', 'forests'])
        race_types = data.get('race_types', ['human'])
        params = data.get('params', {})
        
        world_data = generate_world(width, height, terrain_types, race_types, params)
        
        # Store in session for movement calculations
        session['current_world'] = world_data
        
        return jsonify(world_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save-world', methods=['POST'])
def save_world():
    """Save world data to file"""
    try:
        data = request.get_json()
        world_data = data.get('world_data')
        filename = data.get('filename', f'world_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        
        if not filename.endswith('.json'):
            filename += '.json'
        
        filepath = os.path.join('worlds', filename)
        with open(filepath, 'w') as f:
            json.dump(world_data, f, indent=2)
        
        return jsonify({'success': True, 'filename': filename})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-world/<filename>')
def load_world(filename):
    """Load world data from file"""
    try:
        filepath = os.path.join('worlds', filename)
        with open(filepath, 'r') as f:
            world_data = json.load(f)
        
        # Store in session for movement calculations
        session['current_world'] = world_data
        
        return jsonify(world_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/list-worlds')
def list_worlds():
    """List all saved world files"""
    try:
        world_files = [f for f in os.listdir('worlds') if f.endswith('.json')]
        return jsonify(world_files)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/hex-movement/<int:x>/<int:y>', methods=['GET'])
def get_hex_movement(x, y):
    """Get movement data for a specific hex"""
    try:
        # Get the world data from session
        world_data = session.get('current_world')
        if not world_data:
            return jsonify({'error': 'No world data available'}), 400
        
        calculator = MovementCalculator()
        directions = calculator.calculate_all_directions(x, y, world_data)
        
        return jsonify({
            'coordinates': {'x': x, 'y': y},
            'directions': directions
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)

