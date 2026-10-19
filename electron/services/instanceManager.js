import fs from 'fs';
import path from 'path';
import { getMinecraftRoot, getInstancesDir, getInstanceDir } from './paths.js';

export const DEFAULT_INSTANCE_ICON = 'grass';

export async function ensureInstancesDir() {
  const dir = getInstancesDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

export function sanitizeInstanceId(name) {
  const sanitized = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || `instance-${Date.now()}`;
}

export function detectLoaderFromVersion(version) {
  if (!version) return 'vanilla';
  const lower = String(version).toLowerCase();
  if (lower.includes('fabric')) return 'fabric';
  if (lower.includes('neoforge')) return 'neoforge';
  if (lower.includes('forge')) return 'forge';
  if (lower.includes('quilt')) return 'quilt';
  return 'vanilla';
}

export async function getCustomIconDataUri(instancePath) {
  try {
    const iconFiles = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp', 'icon.svg'];
    for (const name of iconFiles) {
      const fullPath = path.join(instancePath, name);
      if (fs.existsSync(fullPath)) {
        const ext = path.extname(name).slice(1).toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const buf = await fs.promises.readFile(fullPath);
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    }
  } catch (err) {
    console.error('Error reading custom instance icon:', err);
  }
  return null;
}

export async function saveCustomIconFile(instancePath, customIconData) {
  if (!customIconData || typeof customIconData !== 'string') return;
  // Match data URI: data:image/png;base64,...
  const match = customIconData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return;

  const rawExt = match[1].toLowerCase();
  let ext = 'png';
  if (rawExt.includes('jpeg') || rawExt.includes('jpg')) ext = 'jpg';
  else if (rawExt.includes('webp')) ext = 'webp';
  else if (rawExt.includes('svg')) ext = 'svg';

  const buffer = Buffer.from(match[2], 'base64');

  // Remove any previous custom icon files in instance
  const possibleIcons = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp', 'icon.svg'];
  for (const name of possibleIcons) {
    const existing = path.join(instancePath, name);
    if (fs.existsSync(existing)) {
      try { await fs.promises.unlink(existing); } catch {}
    }
  }

  const dest = path.join(instancePath, `icon.${ext}`);
  await fs.promises.writeFile(dest, buffer);
}

export async function readAllInstances() {
  await ensureInstancesDir();
  const baseDir = getInstancesDir();
  const instances = [];

  try {
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const instancePath = path.join(baseDir, id);
      const configPath = path.join(instancePath, 'instance.json');

      let config = null;
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8');
        config = JSON.parse(raw);
      } catch {
        // If no instance.json, construct a fallback
        config = {
          id,
          name: id,
          version: '1.21.1',
          loader: 'vanilla',
          icon: DEFAULT_INSTANCE_ICON,
          ram: 4,
          created: Date.now(),
        };
      }

      // Count mods in this instance
      let modsCount = 0;
      try {
        const modsDir = path.join(instancePath, 'mods');
        const modFiles = await fs.promises.readdir(modsDir);
        modsCount = modFiles.filter(f => f.endsWith('.jar') || f.endsWith('.olpkg')).length;
      } catch {}

      const ver = config.version || '1.21.1';
      const inferred = detectLoaderFromVersion(ver);
      const finalLoader = config.loader && config.loader !== 'vanilla' ? config.loader : inferred;

      // Check if instance has a custom stored icon file
      let iconValue = config.icon || DEFAULT_INSTANCE_ICON;
      if (iconValue === 'custom' || iconValue.startsWith('data:image/')) {
        const customDataUri = await getCustomIconDataUri(instancePath);
        if (customDataUri) {
          iconValue = customDataUri;
        }
      }

      instances.push({
        id,
        path: instancePath,
        name: config.name || id,
        version: ver,
        loader: finalLoader, // vanilla | fabric | forge | neoforge | quilt
        icon: iconValue,
        ram: typeof config.ram === 'number' ? config.ram : 4,
        jvmArguments: config.jvmArguments || '',
        javaPath: config.javaPath || '',
        created: config.created || Date.now(),
        lastPlayed: config.lastPlayed || null,
        modsCount,
      });
    }
  } catch (err) {
    console.error('Error reading instances:', err);
  }

  // Sort by lastPlayed desc, then created desc
  instances.sort((a, b) => (b.lastPlayed || b.created || 0) - (a.lastPlayed || a.created || 0));
  return instances;
}

export async function createInstance({
  name,
  version,
  loader = 'vanilla',
  icon = DEFAULT_INSTANCE_ICON,
  customIconData = null,
  ram = 4,
  jvmArguments = '',
  javaPath = '',
}) {
  await ensureInstancesDir();
  const baseId = sanitizeInstanceId(name);
  let id = baseId;
  let counter = 1;

  while (fs.existsSync(getInstanceDir(id))) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  const instancePath = getInstanceDir(id);
  await fs.promises.mkdir(instancePath, { recursive: true });
  await fs.promises.mkdir(path.join(instancePath, 'mods'), { recursive: true });
  await fs.promises.mkdir(path.join(instancePath, 'shaderpacks'), { recursive: true });
  await fs.promises.mkdir(path.join(instancePath, 'resourcepacks'), { recursive: true });
  await fs.promises.mkdir(path.join(instancePath, 'saves'), { recursive: true });

  const rawVer = String(version || '1.21.1').trim();
  const detected = detectLoaderFromVersion(rawVer);
  const finalLoader = detected !== 'vanilla' ? detected : (String(loader || 'vanilla').toLowerCase().trim());

  let finalIcon = icon || DEFAULT_INSTANCE_ICON;
  if (customIconData) {
    await saveCustomIconFile(instancePath, customIconData);
    finalIcon = 'custom';
  } else if (finalIcon.startsWith('data:image/')) {
    await saveCustomIconFile(instancePath, finalIcon);
    finalIcon = 'custom';
  }

  const config = {
    id,
    name: name.trim(),
    version: rawVer,
    loader: finalLoader,
    icon: finalIcon,
    ram: Number(ram) || 4,
    jvmArguments: String(jvmArguments || '').trim(),
    javaPath: String(javaPath || '').trim(),
    created: Date.now(),
    lastPlayed: null,
  };

  await fs.promises.writeFile(
    path.join(instancePath, 'instance.json'),
    JSON.stringify(config, null, 2),
    'utf8'
  );

  const resolvedIcon = finalIcon === 'custom'
    ? ((await getCustomIconDataUri(instancePath)) || customIconData || finalIcon)
    : finalIcon;

  return { ok: true, instance: { ...config, icon: resolvedIcon, path: instancePath, modsCount: 0 } };
}

export async function updateInstance(id, updates) {
  const instancePath = getInstanceDir(id);
  const configPath = path.join(instancePath, 'instance.json');
  if (!fs.existsSync(configPath)) {
    return { error: 'NotFound', message: `Instance ${id} not found` };
  }

  try {
    const raw = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    const { customIconData, ...restUpdates } = updates || {};
    let newIcon = restUpdates.icon !== undefined ? restUpdates.icon : config.icon;

    if (customIconData) {
      await saveCustomIconFile(instancePath, customIconData);
      newIcon = 'custom';
    } else if (typeof newIcon === 'string' && newIcon.startsWith('data:image/')) {
      await saveCustomIconFile(instancePath, newIcon);
      newIcon = 'custom';
    } else if (newIcon && newIcon !== 'custom' && config.icon === 'custom') {
      // If user switched back to standard Minecraft icon, delete custom icon file
      const possibleIcons = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp', 'icon.svg'];
      for (const name of possibleIcons) {
        const existing = path.join(instancePath, name);
        if (fs.existsSync(existing)) {
          try { await fs.promises.unlink(existing); } catch {}
        }
      }
    }

    const updated = {
      ...config,
      ...restUpdates,
      icon: newIcon,
      id, // do not change id
    };

    await fs.promises.writeFile(configPath, JSON.stringify(updated, null, 2), 'utf8');

    const resolvedIcon = updated.icon === 'custom'
      ? ((await getCustomIconDataUri(instancePath)) || customIconData || updated.icon)
      : updated.icon;

    return { ok: true, instance: { ...updated, icon: resolvedIcon } };
  } catch (err) {
    return { error: 'UpdateFailed', message: err.message };
  }
}

export async function deleteInstance(id) {
  const instancePath = getInstanceDir(id);
  if (!fs.existsSync(instancePath)) {
    return { error: 'NotFound', message: `Instance ${id} not found` };
  }

  try {
    await fs.promises.rm(instancePath, { recursive: true, force: true });
    return { ok: true, id };
  } catch (err) {
    return { error: 'DeleteFailed', message: err.message };
  }
}

/**
 * Scans the root .minecraft directory to detect existing mods, configs, saves, shaders, etc.
 */
export async function scanBaseDirectory() {
  const baseDir = getMinecraftRoot();
  const summary = {
    modsCount: 0,
    shaderpacksCount: 0,
    resourcepacksCount: 0,
    savesCount: 0,
    hasConfig: false,
    hasOptions: false,
  };

  const countDir = async (sub) => {
    try {
      const p = path.join(baseDir, sub);
      const items = await fs.promises.readdir(p);
      return items.filter(i => !i.startsWith('.')).length;
    } catch {
      return 0;
    }
  };

  summary.modsCount = await countDir('mods');
  summary.shaderpacksCount = await countDir('shaderpacks');
  summary.resourcepacksCount = await countDir('resourcepacks');
  summary.savesCount = await countDir('saves');

  try {
    const configPath = path.join(baseDir, 'config');
    summary.hasConfig = fs.existsSync(configPath);
  } catch {}

  try {
    const optionsPath = path.join(baseDir, 'options.txt');
    summary.hasOptions = fs.existsSync(optionsPath);
  } catch {}

  return summary;
}

/**
 * Recursively copies a directory or file
 */
async function copyRecursive(src, dest) {
  const stat = await fs.promises.stat(src);
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
  }
}

/**
 * Moves a directory or file (renames with fallback copy+remove for cross-device)
 */
async function moveRecursive(src, dest) {
  try {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.rename(src, dest);
  } catch {
    await copyRecursive(src, dest);
    await fs.promises.rm(src, { recursive: true, force: true });
  }
}

/**
 * Migrates (copies or moves) data from root .minecraft into a new instance
 * @param {Object} options
 * @param {string} options.name
 * @param {string} options.version
 * @param {string} options.loader
 * @param {string} options.icon
 * @param {number} options.ram
 * @param {boolean} options.move - true to convert (move files), false to copy
 * @param {Array<string>} options.include - e.g. ['mods', 'config', 'shaderpacks', 'resourcepacks', 'saves', 'options']
 */
export async function migrateBaseToInstance({
  name = 'Migrated Instance',
  version = '1.21.1',
  loader = 'vanilla',
  icon = DEFAULT_INSTANCE_ICON,
  ram = 4,
  move = false, // false = copy, true = convert (move)
  include = ['mods', 'config', 'shaderpacks', 'resourcepacks', 'saves', 'options'],
}) {
  const baseDir = getMinecraftRoot();
  const createdRes = await createInstance({
    name,
    version,
    loader,
    icon,
    ram,
  });

  if (!createdRes.ok) {
    return createdRes;
  }

  const instance = createdRes.instance;
  const instancePath = instance.path;

  const foldersToMigrate = [
    { key: 'mods', name: 'mods', isDir: true },
    { key: 'config', name: 'config', isDir: true },
    { key: 'defaultconfigs', name: 'defaultconfigs', isDir: true },
    { key: 'shaderpacks', name: 'shaderpacks', isDir: true },
    { key: 'resourcepacks', name: 'resourcepacks', isDir: true },
    { key: 'saves', name: 'saves', isDir: true },
    { key: 'options', name: 'options.txt', isDir: false },
    { key: 'options', name: 'optionsshaders.txt', isDir: false },
  ];

  for (const item of foldersToMigrate) {
    if (!include.includes(item.key)) continue;
    const srcPath = path.join(baseDir, item.name);
    const destPath = path.join(instancePath, item.name);

    if (fs.existsSync(srcPath)) {
      try {
        if (move) {
          await moveRecursive(srcPath, destPath);
        } else {
          await copyRecursive(srcPath, destPath);
        }
      } catch (err) {
        console.error(`Failed to migrate ${item.name}:`, err);
      }
    }
  }

  // Recount mods
  let modsCount = 0;
  try {
    const modFiles = await fs.promises.readdir(path.join(instancePath, 'mods'));
    modsCount = modFiles.filter(f => f.endsWith('.jar') || f.endsWith('.olpkg')).length;
  } catch {}

  await updateInstance(instance.id, { modsCount });

  return {
    ok: true,
    instance: {
      ...instance,
      modsCount,
    },
    mode: move ? 'converted' : 'copied',
  };
}
