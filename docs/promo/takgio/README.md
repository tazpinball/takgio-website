# The Takgio client promo video (started 29 Oct 2026)

Ted, 29 Oct: a promo video for Takgio, like Brickture's, **mainly for clients** (a separate investor video comes
later). Script approved by Ted as written (29 Oct). Made the way the Brickture promo was (Brickture repo, branch
`claude/intelligent-gauss-727mv1`, `docs/PROMO-VIDEO.md` and `spike/tools/experiments/promo/`): an HTML page of
scenes, `window.render(t)` per frame, screenshotted by Playwright and piped to ffmpeg; voice, music and snaps from
ElevenLabs; mixed with ffmpeg.

## State

- **Done:** the scene page (`video.html`, 1920x1080), its timing (`timeline.json`), the frame renderer
  (`render.js`) and the capture of the live home-page graphic (`hxcap.js`). The nine scenes were shown to Ted as
  stills (29 Oct). Ann Elise is shown by the AnnElise portrait (`images/reel/ann-elise-app-icon.webp`), Ted's pick.
- **Approved by Ted (29 Oct):** the nine scenes ("The nine scenes are good."). The site now uses the AnnElise portrait
  everywhere too (v2.61.0).
- **Done:** the 9:16 layout (`?tall`, `PROMO_TALL=1 node render.js ...`), 1080x1920, same scenes and timing.
- **Done (29 Oct, v2.62.0):** the sound and the finished cuts. `audio.py` makes the voice lines (Jessica, voice id
  `cgSgspJ2msm6clMCkdW9`, eleven_multilingual_v2; the text is in `lines.json`), the music bed and four snaps
  (whoosh, pop, tick, chime) from ElevenLabs; the clips are kept in `audio/` so a re-render keeps the same voice.
  The scenes were re-timed to the measured voice lines (`timeline.json`: scene times, where each voice line and snap
  lands); the video is 58 s (v2.62.4; the music is slowed to 0.955, same pitch, to cover it). `build.py` mixes it (music ducked under the voice, -14 LUFS) and puts it under the
  picture. Both cuts went to Ted as files: `takgio-promo-16x9.mp4` (1920x1080) and `takgio-promo-9x16.mp4`
  (1080x1920).
- **Not checked by machine:** how the voice says the names. The API key has no speech-to-text permission, so listen
  for Takgio ("tack-jee-oh"), Brickture (written "Brick-chure"), Ann Elise (written "Ann Eleese") and ConcreteIQ
  (written "Concrete I.Q."). Ted, 29 Oct: Hoof Harted is said "Hoof-Hearted" (written "Hoof Hearted") and
  Pinball-QR "Pinball-QR" (written "Pinball Q.R."); the Hoof Harted and Pinball-QR beat is voiced since v2.62.3. Ted, 29 Oct: Hoof Harted is on the App
  Store and Google Play, True Record on the App Store, Pinball-QR is web only (no app). To redo a line: change its text in `lines.json`, delete its clip in `audio/`, run
  `audio.py` again, re-check its length (the scene times assume the lengths below) and rebuild.
- 🔴 TAKGIO is said "tak-geo": write it "tack-jee-oh" in the voice text.
- **Next (Ted's call):** where the video goes on the site, if anywhere. It is not on the site yet.

## The script (approved)

| time | voice | on screen |
|---|---|---|
| 0:00 | Every industry has experts who know things no software does. | expert head, five industry chips |
| 0:04.8 | At Takgio, we start with them. | logo + step 01 of the home graphic |
| 0:08 | We capture what they know, in their own words. More than 1,400 statements for ConcreteIQ alone. | step 01 + 1,400+ |
| 0:15.4 | Then we pair our own expert model with a general-purpose AI. | step 02 |
| 0:19.8 | The result: AI products that work like a seasoned pro. | the whole graphic |
| 0:24.1 | On one live school bid, ConcreteIQ caught $144,219 of missing steel. | ConcreteIQ screen + $144,219 |
| 0:31.6 | Brickture turns a photo into a brick model you can build. True Record reads government documents aloud, and it is on the App Store. Ann Elise teaches organic chemistry. Hoof Harted is on the App Store and Google Play. Pinball-QR runs right in the browser. | Brickture, True Record ("On the App Store"), Ann Elise, Hoof Harted + Pinball-QR ("Hoof Harted · App Store & Google Play", "Pinball-QR · Web, no app") |
| 0:47.5 | Six products. Four industries. And more on the way. | six icons; Meta Ray-Ban Display and myBuyersCoach "Upcoming" |
| 0:52 | Takgio. We turn human expertise into AI products. | lockup, takgio.com (to 0:58) |

Voice clip lengths (speech only, s): v1 3.1, v2 2.3, v3 6.6, v4 3.7, v5 3.5, v6 6.4, v7a 3.0, v7b 3.5, v7c 2.1,
v7d 5.4, v8 3.7, v9 4.3.

## How to make it (S = a scratch folder outside the repo)

```
npx http-server . -p 8091 -s -c-1 &                                   # from the repo root
node docs/promo/takgio/hxcap.js http://127.0.0.1:8091 $S/hx 20 3       # the home graphic, 600 frames, ~30 min
mkdir -p $S/stage/img; cp docs/promo/takgio/video.html $S/stage/index.html; cp docs/promo/takgio/timeline.json $S/stage/
ln -s $S/hx $S/stage/hx; cp <the images video.html names under img/> $S/stage/img/
node docs/promo/takgio/render.js $S/stage --stills $S/stills 4.8 8.6 15.5   # stills to look at
node docs/promo/takgio/render.js $S/stage $S/picture.mp4                    # the whole picture, silent
PROMO_TALL=1 node docs/promo/takgio/render.js $S/stage $S/picture-9x16.mp4  # the 9:16 cut
ELEVENLABS_API_KEY=... python3 docs/promo/takgio/audio.py docs/promo/takgio/audio   # only clips that are missing
python3 docs/promo/takgio/build.py docs/promo/takgio/audio $S/picture.mp4 $S/takgio-promo-16x9.mp4
python3 docs/promo/takgio/build.py docs/promo/takgio/audio $S/picture-9x16.mp4 $S/takgio-promo-9x16.mp4
```
`render.js` also takes a time range (`render.js <stage> <out.mp4> 25 54`); parts join with ffmpeg's concat demuxer
(`-c copy`).
`hxcap.js` takes over the page's clock (document.timeline, performance.now, every CSS animation) so each frame is
the graphic at an exact time.
