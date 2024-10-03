#!/bin/bash
set -e

# Create the directory structure
DEST_DIR="compile-deb/usr/share/openlauncher"
mkdir -p "$DEST_DIR"

# Copy the necessary files
cp data/variables.py "$DEST_DIR"
cp data/updater.py "$DEST_DIR"
cp data/OpenLauncher.py "$DEST_DIR"
cp -r data/img "$DEST_DIR"

# Compile the deb package
dpkg-deb --build compile-deb "OpenLauncher.deb"