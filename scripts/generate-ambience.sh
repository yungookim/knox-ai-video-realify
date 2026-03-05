#!/bin/bash
# Generate placeholder ambience audio files using ffmpeg.
# These are synthetic approximations - replace with real recordings for production.

set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)/ambience"
mkdir -p "$DIR"

DURATION=180  # 3 minutes (loops will be trimmed to video length)

echo "Generating room-tone.mp3 (brown noise, low volume)..."
ffmpeg -y -f lavfi -i "anoisesrc=d=$DURATION:c=brown:r=44100:a=0.02" \
  -af "highpass=f=80,lowpass=f=500" \
  -codec:a libmp3lame -b:a 128k \
  "$DIR/room-tone.mp3" 2>/dev/null

echo "Generating coffee-shop.mp3 (pink noise with slight variation)..."
ffmpeg -y -f lavfi -i "anoisesrc=d=$DURATION:c=pink:r=44100:a=0.03" \
  -af "highpass=f=100,lowpass=f=4000,tremolo=f=0.5:d=0.3" \
  -codec:a libmp3lame -b:a 128k \
  "$DIR/coffee-shop.mp3" 2>/dev/null

echo "Generating street.mp3 (white noise filtered to sound like distant traffic)..."
ffmpeg -y -f lavfi -i "anoisesrc=d=$DURATION:c=white:r=44100:a=0.025" \
  -af "highpass=f=60,lowpass=f=2000,tremolo=f=0.2:d=0.4" \
  -codec:a libmp3lame -b:a 128k \
  "$DIR/street.mp3" 2>/dev/null

echo "Done! Ambience files generated in $DIR"
ls -lh "$DIR"/*.mp3
