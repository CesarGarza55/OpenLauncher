"""
Resource Cache for OpenLauncher
Caches loaded images and pixmaps to improve performance
"""

from PyQt5.QtGui import QPixmap, QIcon
from PyQt5.QtCore import Qt

class ResourceCache:
    """Cache for loaded resources to avoid repeated file I/O"""
    
    _instance = None
    _cache = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ResourceCache, cls).__new__(cls)
            cls._instance._cache = {}
        return cls._instance
    
    def get_pixmap(self, path, width=None, height=None, keep_aspect=True):
        """Get a cached pixmap or load it if not in cache"""
        cache_key = f"{path}_{width}_{height}_{keep_aspect}"
        
        if cache_key not in self._cache:
            pixmap = QPixmap(path)
            if width and height:
                from PyQt5.QtCore import Qt
                if keep_aspect:
                    pixmap = pixmap.scaled(width, height, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
                else:
                    pixmap = pixmap.scaled(width, height, Qt.IgnoreAspectRatio, Qt.SmoothTransformation)
            self._cache[cache_key] = pixmap
        
        return self._cache[cache_key]
    
    def get_icon(self, path, size=None):
        """Get a cached icon or load it if not in cache.

        If size is provided (int or tuple), the icon pixmap will be scaled to that size
        before creating the QIcon. This prevents Qt from creating excessively large
        pixmaps that can exceed XCB request limits.
        """
        if isinstance(size, tuple) or isinstance(size, list):
            width, height = size
        else:
            width = height = size

        cache_key = f"icon_{path}_{width}x{height}"

        if cache_key not in self._cache:
            # Load original pixmap
            pixmap = QPixmap(path)
            if not pixmap.isNull() and width and height:
                # Scale keeping aspect ratio to avoid oversized pixmaps
                pixmap = pixmap.scaled(width, height, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                icon = QIcon(pixmap)
            else:
                # Fallback to creating icon directly from path
                icon = QIcon(path)

            self._cache[cache_key] = icon

        return self._cache[cache_key]
    
    def clear_cache(self):
        """Clear the entire cache"""
        self._cache.clear()
    
    def remove_from_cache(self, path):
        """Remove specific item from cache"""
        keys_to_remove = [key for key in self._cache.keys() if path in key]
        for key in keys_to_remove:
            del self._cache[key]


# Global instance
_resource_cache = ResourceCache()


def get_cached_pixmap(path, width=None, height=None, keep_aspect=True):
    """Global function to get cached pixmap"""
    return _resource_cache.get_pixmap(path, width, height, keep_aspect)


def get_cached_icon(path, size=None):
    """Global function to get cached icon"""
    return _resource_cache.get_icon(path, size)


def clear_resource_cache():
    """Global function to clear cache"""
    _resource_cache.clear_cache()
