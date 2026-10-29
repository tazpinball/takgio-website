# The Takgio promo's sound from ElevenLabs: one clip per voice line, the music bed and the snaps.
#   ELEVENLABS_API_KEY=... python3 audio.py <out dir> [voice|music|sfx ...]
# Reads lines.json next to this file. Clips that already exist are kept (delete one to redo it).
import json, os, sys, requests

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'lines.json')))
API = 'https://api.elevenlabs.io/v1'
H = {'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json'}
out = sys.argv[1]; what = sys.argv[2:] or ['voice', 'music', 'sfx']
os.makedirs(out, exist_ok=True)

def save(path, r):
    if r.status_code != 200: sys.exit(f'{path}: {r.status_code} {r.text[:300]}')
    open(path, 'wb').write(r.content); print('->', path)

if 'voice' in what:
    L = CFG['lines']
    for i, (key, _, text) in enumerate(L):
        p = os.path.join(out, key + '.mp3')
        if os.path.exists(p): continue
        body = {'text': text, 'model_id': CFG['model'], 'voice_settings': CFG['settings'],
                'previous_text': ' '.join(l[2] for l in L[:i])[-400:] or None,
                'next_text': L[i + 1][2] if i + 1 < len(L) else None}
        save(p, requests.post(f"{API}/text-to-speech/{CFG['voice']}?output_format=mp3_44100_192", headers=H, json=body, timeout=120))

if 'music' in what:
    p = os.path.join(out, 'music.mp3')
    if not os.path.exists(p):
        save(p, requests.post(f'{API}/music?output_format=mp3_44100_192', headers=H, timeout=600,
                              json={'prompt': CFG['music'], 'music_length_ms': 56000}))

if 'sfx' in what:
    for key, text in CFG['sfx'].items():
        p = os.path.join(out, key + '.mp3')
        if os.path.exists(p): continue
        save(p, requests.post(f'{API}/sound-generation', headers=H, timeout=120,
                              json={'text': text, 'duration_seconds': 1.2 if key != 'chime' else 2.5, 'prompt_influence': 0.5}))
