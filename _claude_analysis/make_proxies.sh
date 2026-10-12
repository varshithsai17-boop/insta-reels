#!/bin/bash
cd "$HOME/mnt/insta reels"
for f in *.mp4; do
  b="${f%.mp4}"
  out="_claude_analysis/proxies/${b}.mp4"
  [ -s "$out" ] && continue
  ffmpeg -nostdin -y -v error -i "$f" -vf "scale=360:640" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 160k "$out.tmp.mp4" && mv "$out.tmp.mp4" "$out"
  echo "done $b $(date +%T)"
done
echo ALLDONE
