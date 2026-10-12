#!/bin/bash
cd "$HOME/mnt/insta reels/_claude_analysis"
id="$1"; in="${2:-../$id.mp4}"
w="work/$id"; mkdir -p "$w/frames"
ffmpeg -nostdin -y -v info -i "$in" -filter_complex "[0:v]scale=270:480,split=2[a][b];[a]fps=2[f];[b]scdet=threshold=8[s]" \
  -map "[f]" -q:v 5 "$w/frames/%04d.jpg" \
  -map "[s]" -f null - \
  -map 0:a -ac 1 -c:a libopus -b:a 48k "$w/audio.opus" 2> "$w/ffmpeg.log"
grep -o "lavfi.scd.score: [0-9.]*, lavfi.scd.time: [0-9.]*" "$w/ffmpeg.log" | awk '{print $4, $2}' | tr -d ',' > "$w/scenes.txt"
tar -cf "pkg_$id.tar" -C work "$id/frames" "$id/audio.opus" "$id/scenes.txt"
echo "$id frames=$(ls $w/frames | wc -l) cuts=$(wc -l < $w/scenes.txt) tar=$(stat -c %s pkg_$id.tar)"
