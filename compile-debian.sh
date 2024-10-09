#!/bin/bash
set -e

# Create the directory structure
DEST_DIR="compile-deb/usr/share/openlauncher"
mkdir -p "$DEST_DIR"

# Compile the source code if the binary does not exist
if [ ! -f "OpenLauncher.bin" ]; then
    echo "OpenLauncher.bin is not compiled yet and will be compiled now"
    chmod +x compile-linux.sh
    ./compile-linux.sh
    echo "OpenLauncher.bin is compiled successfully and ready to be packaged"
else
    rm OpenLauncher.bin
    echo "OpenLauncher.bin will be recompiled to ensure the latest version is packaged"
    chmod +x compile-linux.sh
    ./compile-linux.sh
    echo "OpenLauncher.bin is compiled successfully and ready to be packaged"
fi

# Copy the necessary files
cp OpenLauncher.bin "$DEST_DIR"

# Compile the deb package
dpkg-deb --build compile-deb "OpenLauncher.deb"