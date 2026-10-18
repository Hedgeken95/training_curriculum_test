#!/bin/bash
# Render one frame range of the 201 walkthrough and encode it as an MP4 segment.
# usage: ./segment.sh <walk|over> <startFrame> <endFrame>
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --no-audit --no-fund
node render.mjs "out/$1" "$1" 30 "$2" "$3"
name=$(printf "%s_%05d_%05d" "$1" "$2" "$3")
mkdir -p segments
ffmpeg -y -loglevel error -framerate 30 -start_number "$2" -i "out/$1/%05d.jpg" -frames:v $(($3 - $2)) \
  -c:v libx264 -preset medium -crf 12 -pix_fmt yuv420p "segments/$name.mp4"
echo "wrote segments/$name.mp4"
