#!/bin/bash
# Render one frame range of the 201 walkthrough with Blender Cycles and encode it as a near-lossless MP4 segment.
# usage: ./segment_cy.sh <walk|over> <startFrame> <endFrame>
set -e
cd "$(dirname "$0")"
python3 -c "import bpy" 2>/dev/null || pip install --break-system-packages -q bpy==5.2.2
python3 render_cycles.py --dir v2 --shot "$1" --start "$2" --end "$3" --out "out/$1_$2" --spp 20 --scale 0.833334
name=$(printf "%s_%05d_%05d" "$1" "$2" "$3")
mkdir -p segments
ffmpeg -y -loglevel error -framerate 24 -start_number $(($2 + 1)) -i "out/$1_$2/f_%05d.png" -frames:v $(($3 - $2)) \
  -c:v libx264 -preset medium -crf 10 -pix_fmt yuv444p "segments/$name.mp4"
echo "wrote segments/$name.mp4"
