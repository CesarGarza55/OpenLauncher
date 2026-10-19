/**
 * Minecraft icon options for Instances
 * Uses official textures extracted from the client JAR located in /mc_icons/
 */
export const MINECRAFT_INSTANCE_ICONS = [
  // Blocks
  { id: 'grass_block', name: 'Grass Block', src: '/mc_icons/grass_block_side.png' },
  { id: 'crafting_table', name: 'Crafting Table', src: '/mc_icons/crafting_table_top.png' },
  { id: 'furnace', name: 'Furnace', src: '/mc_icons/furnace_front_on.png' },
  { id: 'tnt', name: 'TNT', src: '/mc_icons/tnt_side.png' },
  { id: 'bookshelf', name: 'Bookshelf', src: '/mc_icons/bookshelf.png' },
  { id: 'enchanting_table', name: 'Enchanting Table', src: '/mc_icons/enchanting_table_top.png' },
  { id: 'beacon', name: 'Beacon', src: '/mc_icons/beacon.png' },
  { id: 'diamond_block', name: 'Diamond Block', src: '/mc_icons/diamond_block.png' },
  { id: 'emerald_block', name: 'Emerald Block', src: '/mc_icons/emerald_block.png' },
  { id: 'gold_block', name: 'Gold Block', src: '/mc_icons/gold_block.png' },
  { id: 'redstone_block', name: 'Redstone Block', src: '/mc_icons/redstone_block.png' },
  { id: 'obsidian', name: 'Obsidian', src: '/mc_icons/obsidian.png' },
  { id: 'crying_obsidian', name: 'Crying Obsidian', src: '/mc_icons/crying_obsidian.png' },
  { id: 'sculk', name: 'Sculk', src: '/mc_icons/sculk.png' },
  { id: 'command_block', name: 'Command Block', src: '/mc_icons/command_block_front.png' },
  { id: 'amethyst_block', name: 'Amethyst', src: '/mc_icons/amethyst_block.png' },
  { id: 'copper_block', name: 'Copper', src: '/mc_icons/copper_block.png' },
  { id: 'slime_block', name: 'Slime', src: '/mc_icons/slime_block.png' },
  { id: 'magma', name: 'Magma', src: '/mc_icons/magma.png' },
  { id: 'glowstone', name: 'Glowstone', src: '/mc_icons/glowstone.png' },

  // Items / Gear
  { id: 'diamond_sword', name: 'Diamond Sword', src: '/mc_icons/diamond_sword.png' },
  { id: 'diamond_pickaxe', name: 'Diamond Pickaxe', src: '/mc_icons/diamond_pickaxe.png' },
  { id: 'netherite_chestplate', name: 'Netherite Armor', src: '/mc_icons/netherite_chestplate.png' },
  { id: 'totem_of_undying', name: 'Totem of Undying', src: '/mc_icons/totem_of_undying.png' },
  { id: 'golden_apple', name: 'Golden Apple', src: '/mc_icons/golden_apple.png' },
  { id: 'ender_pearl', name: 'Ender Pearl', src: '/mc_icons/ender_pearl.png' },
  { id: 'enchanted_book', name: 'Enchanted Book', src: '/mc_icons/enchanted_book.png' },
  { id: 'potion', name: 'Potion', src: '/mc_icons/potion.png' },
  { id: 'bow', name: 'Bow', src: '/mc_icons/bow.png' },
  { id: 'netherite_ingot', name: 'Netherite Ingot', src: '/mc_icons/netherite_ingot.png' },
  { id: 'diamond', name: 'Diamond', src: '/mc_icons/diamond.png' },
  { id: 'redstone', name: 'Redstone', src: '/mc_icons/redstone.png' },
];

export function getInstanceIconSrc(iconId) {
  if (!iconId) return '/mc_icons/grass_block_side.png';
  const found = MINECRAFT_INSTANCE_ICONS.find(item => item.id === iconId);
  if (found) return found.src;
  
  // Legacy / fallback mappings
  if (iconId === 'sword') return '/mc_icons/diamond_sword.png';
  if (iconId === 'pickaxe') return '/mc_icons/diamond_pickaxe.png';
  if (iconId === 'potion') return '/mc_icons/potion.png';
  if (iconId === 'flame') return '/mc_icons/fire_charge.png';
  if (iconId === 'zap') return '/mc_icons/redstone.png';
  if (iconId === 'compass') return '/mc_icons/compass_00.png';
  if (iconId === 'sparkles') return '/mc_icons/totem_of_undying.png';
  if (iconId === 'cube' || iconId === 'box') return '/mc_icons/grass_block_side.png';

  // If already a path, data URI, or blob URL
  if (iconId.startsWith('/') || iconId.startsWith('http') || iconId.startsWith('data:image/') || iconId.startsWith('blob:')) {
    return iconId;
  }

  return '/mc_icons/grass_block_side.png';
}
