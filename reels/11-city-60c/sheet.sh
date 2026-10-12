#!/bin/bash
# contact sheet of preview frames: ./sheet.sh <dir> <columns> [out.jpg]
d="$1"; c="${2:-4}"; out="${3:-$d/sheet.jpg}"
files=$(ls "$d"/f_*.jpg | sort)
n=$(echo "$files" | wc -l); rows=$(( (n + c - 1) / c ))
args=(); for f in $files; do args+=(-i "$f"); done
filter=""; i=0; for f in $files; do filter+="[$i:v]scale=360:640,drawtext=text='$(basename $f .jpg | sed 's/f_//')':x=10:y=10:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.5[v$i];"; i=$((i+1)); done
inputs=""; for ((k=0;k<n;k++)); do inputs+="[v$k]"; done
layout=""; for ((k=0;k<n;k++)); do x=$(( (k % c) * 360 )); y=$(( (k / c) * 640 )); layout+="${x}_${y}|"; done
ffmpeg -v error -y "${args[@]}" -filter_complex "${filter}${inputs}xstack=inputs=$n:layout=${layout%|}:fill=black" -q:v 3 "$out" && echo "$out"
