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
- **Next:** in a session that has `ELEVENLABS_API_KEY` (Ted adds it to the environment; a new
  session picks it up), the voice (Jessica, voice id `cgSgspJ2msm6clMCkdW9`, eleven_multilingual_v2), music and snaps
  (copy the Brickture `audio.py` / `build.py` pattern), re-time the scenes to the measured voice lines, render, mix.
- 🔴 TAKGIO is said "tak-geo": write it "tack-jee-oh" in the voice text.
- The finished video goes to Ted as a file first; where it goes on the site is his call.

## The script (approved)

| time | voice | on screen |
|---|---|---|
| 0:00 | Every industry has experts who know things no software does. | expert head, five industry chips |
| 0:06 | At Takgio, we start with them. | logo + step 01 of the home graphic |
| 0:10 | We capture what they know, in their own words. More than 1,400 statements for ConcreteIQ alone. | step 01 + 1,400+ |
| 0:18 | Then we pair our own expert model with a general-purpose AI. | step 02 |
| 0:23 | The result: AI products that work like a seasoned pro. | the whole graphic |
| 0:27 | On one live school bid, ConcreteIQ caught $144,219 of missing steel. | ConcreteIQ screen + $144,219 |
| 0:33 | Brickture turns a photo into a brick model you can build. True Record reads government documents aloud. Ann Elise teaches organic chemistry. | Brickture, True Record, Ann Elise, Hoof Harted + Pinball-QR |
| 0:43 | Six products. Four industries. And more on the way. | six icons; Meta Ray-Ban Display and myBuyersCoach "Upcoming" |
| 0:47 | Takgio. We turn human expertise into AI products. | lockup, takgio.com |

## How to make it (S = a scratch folder outside the repo)

```
npx http-server . -p 8091 -s -c-1 &                                   # from the repo root
node docs/promo/takgio/hxcap.js http://127.0.0.1:8091 $S/hx 22 3       # the home graphic, 660 frames, ~30 min
mkdir -p $S/stage/img; cp docs/promo/takgio/video.html $S/stage/index.html; cp docs/promo/takgio/timeline.json $S/stage/
ln -s $S/hx $S/stage/hx; cp <the images video.html names under img/> $S/stage/img/
node docs/promo/takgio/render.js $S/stage --stills $S/stills 4.8 8.6 15.5   # stills to look at
node docs/promo/takgio/render.js $S/stage $S/picture.mp4                    # the whole picture, silent
PROMO_TALL=1 node docs/promo/takgio/render.js $S/stage $S/picture-9x16.mp4  # the 9:16 cut
```
`hxcap.js` takes over the page's clock (document.timeline, performance.now, every CSS animation) so each frame is
the graphic at an exact time.
