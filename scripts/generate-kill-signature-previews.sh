#!/bin/zsh
set -euo pipefail
setopt null_glob

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"
OUT_DIR="${ROOT_DIR}/sounds/kill-signature-previews"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gg-kill-preview.XXXXXX")"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}"/*.wav

render() {
  local name="$1"
  shift
  ffmpeg -hide_banner -loglevel error -y "$@" "${OUT_DIR}/${name}.wav"
}

# Rhombus: crystalline, bright, prismatic. These should feel sharp but not tiny.
render rhombus_kill_01 \
  -f lavfi -i "aevalsrc=0.18*sin(2*PI*(1180+920*exp(-6*t))*t)*exp(-7*t):s=48000:d=0.52" \
  -f lavfi -i "aevalsrc=0.08*sin(2*PI*(2520+1600*exp(-9*t))*t)*exp(-12*t):s=48000:d=0.40" \
  -f lavfi -i "anoisesrc=color=white:duration=0.24:sample_rate=48000:amplitude=0.18" \
  -filter_complex "[0:a]highpass=f=420,chorus=0.45:0.6:38:0.28:0.22:0.18[b];[1:a]highpass=f=1600,volume=0.85[g];[2:a]highpass=f=2800,lowpass=f=11000,volume=0.42,afade=t=out:st=0:d=0.24[a];[b][g][a]amix=inputs=3:normalize=0,acompressor=threshold=0.18:ratio=2.5:attack=5:release=120,aecho=0.8:0.45:46:0.28,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render rhombus_kill_02 \
  -f lavfi -i "aevalsrc=0.16*sin(2*PI*(960+1350*exp(-5.5*t))*t)*exp(-6.5*t):s=48000:d=0.58" \
  -f lavfi -i "aevalsrc=0.09*sin(2*PI*(3120-1400*t)*t)*exp(-10*t):s=48000:d=0.34" \
  -f lavfi -i "anoisesrc=color=white:duration=0.20:sample_rate=48000:amplitude=0.14" \
  -filter_complex "[0:a]highpass=f=380,aphaser=in_gain=0.5:out_gain=0.8:delay=2.2:decay=0.35:speed=0.8:type=t,volume=1.05[b];[1:a]highpass=f=2000,volume=0.75[g];[2:a]bandpass=f=5400:w=5400,volume=0.30,afade=t=out:st=0:d=0.20[a];[b][g][a]amix=inputs=3:normalize=0,acompressor=threshold=0.2:ratio=2.2:attack=4:release=140,aecho=0.75:0.35:58:0.26,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render rhombus_kill_03 \
  -f lavfi -i "aevalsrc=0.17*sin(2*PI*(1420+700*cos(2*PI*7*t))*t)*exp(-7.8*t):s=48000:d=0.48" \
  -f lavfi -i "aevalsrc=0.06*sin(2*PI*(4100-2200*t)*t)*exp(-18*t):s=48000:d=0.26" \
  -f lavfi -i "anoisesrc=color=white:duration=0.18:sample_rate=48000:amplitude=0.16" \
  -filter_complex "[0:a]highpass=f=500,chorus=0.4:0.55:26:0.22:0.18:0.16[b];[1:a]highpass=f=2400,volume=0.95[g];[2:a]highpass=f=3200,lowpass=f=10000,volume=0.34,afade=t=out:st=0:d=0.18[a];[b][g][a]amix=inputs=3:normalize=0,aecho=0.8:0.32:34:0.24,alimiter=limit=0.92" \
  -ar 48000 -ac 1

# Square: dense impact with structural breakup and a secondary child-split pop.
render square_kill_01 \
  -f lavfi -i "aevalsrc=0.24*sin(2*PI*130*t)*exp(-4.2*t)+0.14*sin(2*PI*260*t)*exp(-5.1*t):s=48000:d=0.66" \
  -f lavfi -i "anoisesrc=color=pink:duration=0.38:sample_rate=48000:amplitude=0.24" \
  -f lavfi -i "aevalsrc=0.08*sin(2*PI*920*t)*exp(-85*abs(t-0.11))+0.06*sin(2*PI*1180*t)*exp(-85*abs(t-0.18)):s=48000:d=0.40" \
  -filter_complex "[0:a]lowpass=f=1800,volume=1.15[b];[1:a]highpass=f=120,lowpass=f=2600,volume=0.55,afade=t=out:st=0:d=0.38[d];[2:a]highpass=f=700,volume=0.72[p];[b][d][p]amix=inputs=3:normalize=0,acompressor=threshold=0.16:ratio=3.0:attack=5:release=170,aecho=0.65:0.28:52:0.16,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render square_kill_02 \
  -f lavfi -i "aevalsrc=0.22*sin(2*PI*110*t)*exp(-3.7*t)+0.10*sin(2*PI*220*t)*exp(-4.8*t):s=48000:d=0.74" \
  -f lavfi -i "anoisesrc=color=white:duration=0.34:sample_rate=48000:amplitude=0.22" \
  -f lavfi -i "aevalsrc=0.07*sin(2*PI*760*t)*exp(-75*abs(t-0.09))+0.06*sin(2*PI*980*t)*exp(-80*abs(t-0.16))+0.05*sin(2*PI*1230*t)*exp(-86*abs(t-0.24)):s=48000:d=0.44" \
  -filter_complex "[0:a]lowpass=f=1500,aphaser=in_gain=0.35:out_gain=0.7:delay=1.7:decay=0.25:speed=0.4:type=t,volume=1.18[b];[1:a]highpass=f=110,lowpass=f=2200,volume=0.58,afade=t=out:st=0:d=0.34[d];[2:a]highpass=f=650,volume=0.78[p];[b][d][p]amix=inputs=3:normalize=0,acompressor=threshold=0.15:ratio=3.3:attack=4:release=190,aecho=0.7:0.32:66:0.14,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render square_kill_03 \
  -f lavfi -i "aevalsrc=0.20*sin(2*PI*150*t)*exp(-4.6*t)+0.10*sin(2*PI*305*t)*exp(-5.4*t):s=48000:d=0.60" \
  -f lavfi -i "anoisesrc=color=pink:duration=0.32:sample_rate=48000:amplitude=0.26" \
  -f lavfi -i "aevalsrc=0.08*sin(2*PI*1040*t)*exp(-90*abs(t-0.10))+0.04*sin(2*PI*1560*t)*exp(-100*abs(t-0.20)):s=48000:d=0.34" \
  -filter_complex "[0:a]lowpass=f=1700,volume=1.08[b];[1:a]bandpass=f=900:w=2200,volume=0.60,afade=t=out:st=0:d=0.32[d];[2:a]highpass=f=900,volume=0.68[p];[b][d][p]amix=inputs=3:normalize=0,acompressor=threshold=0.17:ratio=2.8:attack=5:release=150,alimiter=limit=0.92" \
  -ar 48000 -ac 1

# Pinwheel: spark attack, rotational wobble, falling/tumbling after-ring.
render pinwheel_kill_01 \
  -f lavfi -i "aevalsrc=0.14*sin(2*PI*(1480-920*t)*t)*exp(-4.6*t):s=48000:d=0.64" \
  -f lavfi -i "aevalsrc=0.08*sin(2*PI*(620+240*sin(2*PI*8*t))*t)*exp(-4.4*t):s=48000:d=0.62" \
  -f lavfi -i "anoisesrc=color=white:duration=0.18:sample_rate=48000:amplitude=0.22" \
  -filter_complex "[0:a]tremolo=f=17:d=0.85,highpass=f=300[s1];[1:a]tremolo=f=8:d=0.7,bandpass=f=880:w=1500,volume=0.9[s2];[2:a]highpass=f=3200,lowpass=f=11000,volume=0.34,afade=t=out:st=0:d=0.18[sp];[s1][s2][sp]amix=inputs=3:normalize=0,acompressor=threshold=0.2:ratio=2.4:attack=5:release=140,aecho=0.72:0.25:48:0.14,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render pinwheel_kill_02 \
  -f lavfi -i "aevalsrc=0.15*sin(2*PI*(1820-1250*t)*t)*exp(-4.2*t):s=48000:d=0.70" \
  -f lavfi -i "aevalsrc=0.09*sin(2*PI*(760+280*sin(2*PI*10*t))*t)*exp(-4.8*t):s=48000:d=0.68" \
  -f lavfi -i "anoisesrc=color=white:duration=0.16:sample_rate=48000:amplitude=0.20" \
  -filter_complex "[0:a]tremolo=f=21:d=0.8,highpass=f=360[s1];[1:a]aphaser=in_gain=0.45:out_gain=0.72:delay=1.4:decay=0.22:speed=0.6:type=t,bandpass=f=1100:w=1800,volume=0.88[s2];[2:a]bandpass=f=4700:w=5200,volume=0.28,afade=t=out:st=0:d=0.16[sp];[s1][s2][sp]amix=inputs=3:normalize=0,acompressor=threshold=0.2:ratio=2.2:attack=5:release=140,aecho=0.75:0.22:64:0.12,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render pinwheel_kill_03 \
  -f lavfi -i "aevalsrc=0.13*sin(2*PI*(1320-760*t)*t)*exp(-4.4*t):s=48000:d=0.60" \
  -f lavfi -i "aevalsrc=0.08*sin(2*PI*(540+320*sin(2*PI*6.5*t))*t)*exp(-5.0*t):s=48000:d=0.58" \
  -f lavfi -i "anoisesrc=color=white:duration=0.20:sample_rate=48000:amplitude=0.18" \
  -filter_complex "[0:a]tremolo=f=14:d=0.82,highpass=f=260[s1];[1:a]bandpass=f=760:w=1200,volume=0.96[s2];[2:a]highpass=f=2800,lowpass=f=9000,volume=0.32,afade=t=out:st=0:d=0.20[sp];[s1][s2][sp]amix=inputs=3:normalize=0,acompressor=threshold=0.18:ratio=2.3:attack=5:release=140,aecho=0.7:0.2:42:0.15,alimiter=limit=0.92" \
  -ar 48000 -ac 1

# Sierpinski: layered recursive breakup with inner pulse steps and a glowing tail.
render sierpinski_kill_01 \
  -f lavfi -i "aevalsrc=0.10*sin(2*PI*680*t)*exp(-4.0*t)+0.08*sin(2*PI*1020*t)*exp(-38*abs(t-0.10))+0.07*sin(2*PI*1320*t)*exp(-40*abs(t-0.22))+0.05*sin(2*PI*1760*t)*exp(-42*abs(t-0.34)):s=48000:d=0.70" \
  -f lavfi -i "anoisesrc=color=white:duration=0.34:sample_rate=48000:amplitude=0.16" \
  -f lavfi -i "aevalsrc=0.06*sin(2*PI*220*t)*exp(-3.2*t):s=48000:d=0.68" \
  -filter_complex "[0:a]highpass=f=260,volume=1.05[p];[1:a]bandpass=f=2800:w=3000,volume=0.34,afade=t=out:st=0:d=0.34[n];[2:a]lowpass=f=480,volume=0.8[l];[p][n][l]amix=inputs=3:normalize=0,acompressor=threshold=0.17:ratio=2.5:attack=6:release=180,aecho=0.75:0.32:72:0.18,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render sierpinski_kill_02 \
  -f lavfi -i "aevalsrc=0.09*sin(2*PI*760*t)*exp(-3.6*t)+0.08*sin(2*PI*980*t)*exp(-36*abs(t-0.08))+0.07*sin(2*PI*1260*t)*exp(-40*abs(t-0.18))+0.06*sin(2*PI*1640*t)*exp(-44*abs(t-0.29))+0.05*sin(2*PI*2120*t)*exp(-48*abs(t-0.40)):s=48000:d=0.82" \
  -f lavfi -i "anoisesrc=color=pink:duration=0.30:sample_rate=48000:amplitude=0.15" \
  -f lavfi -i "aevalsrc=0.05*sin(2*PI*260*t)*exp(-3.0*t):s=48000:d=0.76" \
  -filter_complex "[0:a]highpass=f=260,aphaser=in_gain=0.4:out_gain=0.72:delay=1.9:decay=0.28:speed=0.45:type=t,volume=1.08[p];[1:a]highpass=f=1000,lowpass=f=4200,volume=0.36,afade=t=out:st=0:d=0.30[n];[2:a]lowpass=f=520,volume=0.72[l];[p][n][l]amix=inputs=3:normalize=0,acompressor=threshold=0.16:ratio=2.6:attack=6:release=190,aecho=0.75:0.34:84:0.20,alimiter=limit=0.92" \
  -ar 48000 -ac 1

render sierpinski_kill_03 \
  -f lavfi -i "aevalsrc=0.09*sin(2*PI*620*t)*exp(-4.1*t)+0.07*sin(2*PI*900*t)*exp(-35*abs(t-0.09))+0.07*sin(2*PI*1180*t)*exp(-39*abs(t-0.20))+0.06*sin(2*PI*1460*t)*exp(-42*abs(t-0.31)):s=48000:d=0.68" \
  -f lavfi -i "anoisesrc=color=white:duration=0.28:sample_rate=48000:amplitude=0.18" \
  -f lavfi -i "aevalsrc=0.05*sin(2*PI*300*t)*exp(-2.8*t):s=48000:d=0.66" \
  -filter_complex "[0:a]highpass=f=240,chorus=0.42:0.58:31:0.22:0.18:0.14,volume=1.0[p];[1:a]bandpass=f=2400:w=2600,volume=0.32,afade=t=out:st=0:d=0.28[n];[2:a]lowpass=f=600,volume=0.66[l];[p][n][l]amix=inputs=3:normalize=0,acompressor=threshold=0.17:ratio=2.4:attack=6:release=170,aecho=0.7:0.28:66:0.16,alimiter=limit=0.92" \
  -ar 48000 -ac 1

LIST_FILE="${TMP_DIR}/preview-reel.txt"
for file in \
  rhombus_kill_01.wav rhombus_kill_02.wav rhombus_kill_03.wav \
  square_kill_01.wav square_kill_02.wav square_kill_03.wav \
  pinwheel_kill_01.wav pinwheel_kill_02.wav pinwheel_kill_03.wav \
  sierpinski_kill_01.wav sierpinski_kill_02.wav sierpinski_kill_03.wav
do
  printf "file '%s/%s'\n" "${OUT_DIR}" "${file}" >> "${LIST_FILE}"
done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "${LIST_FILE}" "${OUT_DIR}/kill_signature_preview_reel.wav"

for rendered in "${OUT_DIR}"/*.wav; do
  ffprobe -v error -show_entries format=filename,duration -of csv=p=0 "${rendered}"
done
