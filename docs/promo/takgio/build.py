# Mix the Takgio promo's sound and put it under the rendered picture.
#   python3 build.py <audio dir> <picture.mp4> <out.mp4>
# Voice lines and snaps land at the times in timeline.json; the music runs under everything, ducked
# while the voice speaks, and fades out at the end (music_tempo < 1 slows it, same pitch, to cover a longer cut). Loudness -14 LUFS (web and social).
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
aud, pic, out = sys.argv[1:4]
D = TL['duration']
SFX_VOL = {'whoosh': 0.35, 'tick': 0.3, 'pop': 0.45, 'chime': 0.6}

ins, voice, fx, vl, fl = [], [], [], '', ''
def add(path):
    ins.extend(['-i', path]); return len(ins) // 2   # input 0 is the picture
for k, at in TL['voice'].items():
    i = add(os.path.join(aud, k + '.mp3')); ms = round(at * 1000)
    voice.append(f'[{i}:a]aresample=48000,adelay={ms}|{ms}[v{i}]'); vl += f'[v{i}]'
for k, times in TL['sfx'].items():
    for at in times:
        i = add(os.path.join(aud, k + '.mp3')); ms = round(at * 1000)
        fx.append(f'[{i}:a]aresample=48000,volume={SFX_VOL[k]},adelay={ms}|{ms}[f{i}]'); fl += f'[f{i}]'
m = add(os.path.join(aud, 'music.mp3'))
g = ';'.join(voice + fx + [
    f'{vl}amix=inputs={len(voice)}:normalize=0,pan=stereo|c0=c0|c1=c0,asplit[vo][key]',
    f'{fl}amix=inputs={len(fx)}:normalize=0,pan=stereo|c0=c0|c1=c0[fx]',
    f'[{m}:a]aresample=48000,atempo={TL.get("music_tempo", 1)},atrim=0:{D},volume=0.32,afade=t=in:d=0.6,afade=t=out:st={D - 3}:d=3[mu]',
    '[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450[duck]',
    f'[vo][duck][fx]amix=inputs=3:normalize=0,atrim=0:{D},loudnorm=I=-14:TP=-2:LRA=9,aresample=48000[a]'])
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pic, *ins, '-filter_complex', g,
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                '-t', str(D), '-movflags', '+faststart', out], check=True)
print('->', out)
