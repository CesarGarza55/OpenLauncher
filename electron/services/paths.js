import { app } from 'electron';
import path from 'path';

export function getMinecraftRoot() {
  if (process.platform === 'win32') {
    const appDataDir = process.env.APPDATA || app.getPath('appData');
    return path.join(appDataDir, '.minecraft');
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
  }
  return path.join(app.getPath('home'), '.minecraft');
}

export function getMinecraftRoots() {
  return [getMinecraftRoot()];
}
