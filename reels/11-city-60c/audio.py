# #11 sound: procedural, on the same timeline as the picture. Writes audio.wav (48 kHz stereo).
#   TRIM=-1.0 python audio.py      (land at -13 to -15 LUFS; check with ffmpeg ebur128)
import json, os, wave
import numpy as np
np.seterr(over="ignore", under="ignore")
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(f'{ROOT}/timeline.json'))
SR = 48000
DUR = TL['duration']
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(1101)
B = TL['beats']
TRIM = float(os.environ.get('TRIM', '0'))

def kf(arr, x, ease=True):
    xs = np.array([a for a, _ in arr], float); ys = np.array([b for _, b in arr], float)
    if not ease: return np.interp(x, xs, ys)
    i = np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2)
    k = np.clip((x - xs[i]) / np.maximum(xs[i + 1] - xs[i], 1e-9), 0, 1)
    k = np.where(k < .5, 4 * k ** 3, 1 - (-2 * k + 2) ** 3 / 2)
    return ys[i] + (ys[i + 1] - ys[i]) * k
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n=N): return rng.standard_normal(n)
def smooth(k): k = np.clip(k, 0, 1); return k * k * (3 - 2 * k)
def env(t0, a, d, n=None):
    """attack a seconds, exponential decay d seconds, starting at t0"""
    x = t - t0; e = np.where(x < 0, 0, np.where(x < a, x / max(a, 1e-4), np.exp(-(x - a) / d)))
    return e
def slow_noise(rate, n=N):  # smooth random 0..1 modulation
    pts = rng.random(int(DUR * rate) + 3); xs = np.arange(len(pts)) / rate
    return np.interp(t, xs, pts)

L = np.zeros(N); R = np.zeros(N)
def add(sig, gain=1.0, pan=0.0):
    global L, R
    L += sig * gain * np.sqrt((1 - pan) / 2) * 1.414; R += sig * gain * np.sqrt((1 + pan) / 2) * 1.414

temp = kf(TL['temp'], t, False)
heat = np.clip((temp - 24) / 36, 0, 1)
crowd = kf(TL['crowd'], t, False)
traffic = kf(TL['traffic'], t, False)
storm = kf(TL['storm'], t)
steam = kf(TL['steam'], t)
screens = kf(TL['screens'], t, False)
endcard = smooth((t - TL['endAt']) / 1.0)
# everything that is "the city" ducks under the end card but keeps a soft bed so the loop joins
city_end = 1 - .75 * endcard

# ---- city bed: crowd murmur (babble-ish), traffic rumble, a hum of screens and AC ----
babble = np.zeros(N)
for k in range(6):
    v = bp(noise(), 250 + k * 120, 900 + k * 260)
    am = .45 + .55 * slow_noise(3 + k * .7)
    babble += v * am
babble = babble / np.max(np.abs(babble))
add(babble * crowd * city_end, .16, -.2)
add(bp(noise(), 300, 2500) * crowd * city_end * slow_noise(1.3), .05, .3)
rumble = lp(noise(), 160, 3); rumble /= np.max(np.abs(rumble))
add(rumble * (.35 + .65 * traffic) * city_end * (1 - .5 * storm), .22)
# passing cars (swooshes) while traffic runs
for i in range(70):
    t0 = rng.random() * (DUR - 2)
    if kf(TL['traffic'], np.array([t0]), False)[0] < rng.random(): continue
    dur = 1.6 + rng.random() * 1.4; x = (t - t0) / dur
    e = np.where((x > 0) & (x < 1), np.sin(np.pi * np.clip(x, 0, 1)) ** 2, 0)
    add(bp(noise(), 120, 1400) * e, .07 + rng.random() * .05, (rng.random() - .5) * 1.4)
# horns
def horn(t0, f=420, d=.35, g=.06, pan=-.3):
    x = t - t0; e = np.where((x > 0) & (x < d), 1, 0) * np.exp(-np.clip(x - d, 0, None) * 30)
    e = np.where(x > 0, np.minimum(1, x / .01), 0) * np.where(x < d + .1, 1, 0) * np.where(x < d, 1, np.exp(-(x - d) * 40))
    s = (np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 1.26 * t)) * e
    add(lp(s, 2500), g, pan)
for h in [2.2, 5.8, 9.1, 12.7, 17.3, 21.9, B['return'] + 2.2, B['return'] + 4.4]:
    horn(h, 380 + rng.random() * 120, .2 + rng.random() * .4, .035 + rng.random() * .02, (rng.random() - .5) * 1.2)
# screens/AC hum: 60 Hz + harmonics, swelling with the heat, dying with the screens
hum = sum(np.sin(2 * np.pi * 60 * k * t) / k for k in (1, 2, 3, 5))
add(hum * (.25 + .75 * heat) * screens * city_end, .02)

# ---- heat: a high, thin whine (heat-haze tinnitus) and a low pressure drone ----
whine = np.sin(2 * np.pi * (5200 + 30 * np.sin(2 * np.pi * .21 * t)) * t) * smooth((temp - 38) / 18)
add(whine * (1 - storm) * (1 - endcard), .006)
drone = (np.sin(2 * np.pi * 55 * t) + .5 * np.sin(2 * np.pi * 82.5 * t + 1) + .3 * np.sin(2 * np.pi * 110.3 * t)) * smooth((temp - 30) / 25)
add(lp(drone, 300) * (1 - storm) * (1 - endcard), .05)
wind = bp(noise(), 200, 1200) * slow_noise(.4)
add(wind * smooth((temp - 45) / 12) * (1 - storm) * (1 - endcard), .05)

# ---- events ----
def thud(t0, g=.35, f=70):
    e = env(t0, .004, .12); s = np.sin(2 * np.pi * f * (t - t0) * (1 + .5 * np.exp(-np.clip(t - t0, 0, None) * 20))) * e
    add(lp(s + .3 * bp(noise(), 80, 600) * e, 900), g)
def murmur_swell(t0, d=3.0, g=.12):
    x = (t - t0) / d; e = np.where((x > 0) & (x < 1), np.sin(np.pi * np.clip(x, 0, 1)), 0)
    add(bp(noise(), 300, 1500) * slow_noise(6) * e, g, .1)
thud(B['faint1'] + .55, .3); murmur_swell(B['faint1'] + .3, 3.5, .1)
thud(B['faint2'] + .45, .22); thud(B['faint3'] + .5, .2); murmur_swell(B['faint2'], 3, .07)
thud(B['elmoSlump'] + .8, .16)
# manhole: a pop and a hiss
add(lp(noise() * env(B['manhole'], .002, .08), 1200), .5, -.5)
add(bp(noise(), 1500, 7000) * env(B['manhole'] + .05, .1, 2.5) * (1 - smooth((t - B['manhole'] - 8) / 3)), .08, -.5)
# ambulance siren: wail, getting louder as it arrives; again when it leaves
def siren(t0, t1, gain_k, pan):
    ph = 2 * np.pi * np.cumsum(950 + 450 * np.sin(2 * np.pi * t / 3.6)) / SR
    s = np.sin(ph) + .3 * np.sin(2 * ph)
    return lp(s, 3000) * gain_k
inK = smooth((t - B['ambIn']) / (B['ambStop'] - B['ambIn'] + .5))
win = np.where((t > B['ambIn']) & (t < B['ambStop'] + 1.2), 1, 0) * (1 - smooth((t - B['ambStop'] - .3) / .9))
add(siren(0, 0, 1, 0) * win * (.15 + .85 * inK), .05, -.4)
outK = np.where(t > B['ambOut'], 1 - smooth((t - B['ambOut']) / 5.5), 0) * np.where(t > B['ambOut'], 1, 0)
add(siren(0, 0, 1, 0) * outK, .04, -.6)
# plane: a far jet roar sweeping across
x = (t - B['plane']) / 6
add(lp(noise(), 500) * np.where((x > 0) & (x < 1), np.sin(np.pi * np.clip(x, 0, 1)), 0), .08, .3)
# vendor: thud and a metal clank off the cart
thud(B['vendor'] + .5, .3)
cl = sum(np.sin(2 * np.pi * f * t) for f in (812, 1307, 2130)) * env(B['vendor'] + .55, .001, .25)
add(cl, .05, .4)
# screens power down: a falling electrical whine with clicks
x = np.clip((t - B['screensOff']) / 4.6, 0, 1)
pd = np.sin(2 * np.pi * np.cumsum(220 * (1 - .8 * x)) / SR) * np.where((t > B['screensOff']) & (t < B['screensOff'] + 4.8), 1 - x, 0)
add(pd, .05)
for i in range(14):
    add(bp(noise() * env(B['screensOff'] + i * .33 + rng.random() * .1, .001, .02), 1000, 6000), .15, (rng.random() - .5) * 1.6)
# pigeons: wing flutters, then soft drops
for i in range(5):
    t0 = B['pigeons'] + i * .5
    fl = bp(noise(), 400, 3000) * (.5 + .5 * np.sign(np.sin(2 * np.pi * 14 * t))) * np.where((t > t0) & (t < t0 + .45), 1, 0)
    add(fl, .05, -.3); thud(t0 + .65, .05, 140)
# the last quiet stretch: a slow heartbeat under the heat
hb = np.zeros(N)
for b in np.arange(B['subwayWalk'], B['rain'] - .8, 1.05):
    for off, g in ((0, 1), (.28, .6)):
        e = env(b + off, .005, .09); hb += np.sin(2 * np.pi * 48 * (t - b)) * e * g
add(lp(hb, 200) * smooth((t - B['subwayWalk']) / 4), .32)

# ---- 60 → 100 °C ----
# sprinklers: rushing water from the doorways and gutters, getting quieter as it dries
wk = smooth((t - B['sprinklers']) / 1.5) * (1 - .6 * smooth((t - B['tar']) / 15)) * (1 - smooth((t - B['return'] - .3) / 1))
add(bp(noise(), 400, 6000) * (.7 + .3 * slow_noise(5)) * wk, .05, -.3)
add(lp(noise(), 600) * wk, .05, .3)
# dying trees: a dry rustle as the leaves let go
lv = np.where((t > B['leaves']) & (t < B['leaves'] + 7), 1, 0) * smooth((t - B['leaves']) / .8)
add(bp(noise(), 2500, 9000) * (np.abs(np.sin(2 * np.pi * 3.1 * t)) ** 6) * lv, .05, .2)
# propane relief valve: a steady hiss until the fire reaches it
pv = smooth((t - B['propane']) / .3) * np.where(t < B['fireball'], 1, 0)
add(bp(noise(), 2500, 12000) * pv * (.85 + .15 * slow_noise(8)), .07, .35)
# traffic lights: relay clicks and a fading buzz
for i in range(6):
    add(bp(noise() * env(B['signals'] + i * .22 + rng.random() * .05, .001, .015), 1500, 7000), .25, -.4)
add(np.sin(2 * np.pi * 120 * t) * np.where((t > B['signals']) & (t < B['signals'] + 1.5), 1 - (t - B['signals']) / 1.5, 0), .02, -.4)
# plastic: soft creaks as bottles and cones sag
for i in range(10):
    t0 = B['bottles'] + i * .45 + rng.random() * .2
    add(bp(noise(), 1200, 5000) * env(t0, .02, .12), .05, (rng.random() - .5))
# batteries: crackle, pops, then a roaring fire that spreads
fire_k = np.clip(kf([[0, 0], [B['batteries'] + .4, 0], [B['batteries'] + 1.6, .5], [B['spread'], .6], [B['spread'] + 6, 1], [B['rain'], 1], [B['rain'] + 2.5, 0], [DUR, 0]], t), 0, 1)
crack = (rng.random(N) < .004) * rng.standard_normal(N) * 3
add(hp(crack, 1500) * fire_k, .12, .1)
add(lp(noise(), 400) * fire_k * (.7 + .3 * slow_noise(4)), .12, .1)
for i in range(7):
    t0 = (B['batteries'] + .6) if i == 0 else B['spread'] + (i - 1) * 1.1
    add(bp(noise(), 300, 4000) * env(t0, .002, .2), .3, .1)
# fireball: a deep whoomp and a long roll
fbk = lp(noise(), 120, 3) * env(B['fireball'], .03, 1.6) + lp(noise(), 1500) * env(B['fireball'], .005, .35) * .8
add(fbk / np.max(np.abs(fbk)), .7, .2)
# tar: slow bubbling
for i in range(40):
    t0 = B['tar'] + rng.random() * 17
    add(np.sin(2 * np.pi * (180 + rng.random() * 120) * (t - t0)) * env(t0, .004, .05), .04, -.5 + rng.random() * .3)

# ---- storm: thunder, rain, then the hiss of rain boiling off the road ----
thunder = lp(noise(), 220, 3) * env(B['rain'] - .2, .05, 2.8) + lp(noise(), 900) * env(B['rain'] - .2, .002, .25) * .6
add(thunder / np.max(np.abs(thunder)), .55)
add(lp(noise(), 150, 3) * env(B['rain'] + 2.8, .4, 2.2), .25)
rain = hp(noise(), 1800) * (.6 + .4 * slow_noise(9))
rain_k = np.clip(kf([[0, 0], [B['rain'] - .1, 0], [B['rain'] + .8, 1], [B['return'] + .5, .8], [B['return'] + 4, .15], [DUR, 0]], t), 0, 1)
add(rain * rain_k, .1, -.15); add(hp(noise(), 2500) * rain_k, .06, .4)
sizzle = bp(noise(), 3000, 11000) * (.7 + .3 * (rng.random(N) < .002) * 6)
add(sizzle * steam, .07)
# the city comes back: murmur swell, a horn, a whoop
murmur_swell(B['return'] + .5, 4, .08)

mix = np.stack([L, R], 1)
# fade in with the picture (the opening must start quiet so the loop's crossfade is soft)
fin = smooth(t / .35)
fout = 1 - smooth((t - (DUR - .7)) / .7) * .5
mix *= (fin * fout)[:, None]
# soft limiter
g = 10 ** (TRIM / 20)
mix = np.tanh(mix * 1.6 * g) / 1.2
pk = np.max(np.abs(mix)); mix = mix / max(pk, 1e-6) * min(pk, .98)
pcm = (mix * 32767).astype('<i2')
with wave.open(f'{ROOT}/audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio.wav', DUR, 's')
