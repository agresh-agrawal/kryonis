/**
 * Prepares the intro videos for playback in a browser.
 *
 * The source trailer is a 3840x2160 master at 23.5 Mbps - a delivery file for a
 * cinema, being streamed into a window that is at most 1920x1080. That is why
 * it hangs: the browser is decoding four times the pixels it can display, at a
 * bitrate no consumer connection or disk read is going to keep ahead of, and
 * every dropped frame stalls the whole page.
 *
 * "Highest possible quality" for this job does **not** mean the biggest file.
 * It means the best picture the screen can actually show, delivered fast enough
 * to play without stuttering. At 1080p - the native resolution of the display
 * this game is tuned for - CRF 19 is visually indistinguishable from the master
 * and lands roughly one twentieth of the size.
 *
 * Two flags matter as much as the bitrate:
 *
 *   -movflags +faststart   puts the index at the front of the file so playback
 *                          can begin on the first chunk instead of the last.
 *   -pix_fmt yuv420p       the only chroma format every browser decodes in
 *                          hardware. 10-bit or 4:2:2 silently falls back to a
 *                          software decoder and stutters on modest machines.
 *
 * Usage: node tools/build-video.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import ffmpegPath from 'ffmpeg-static';

const SOURCE_DIR = '_archive/media';
const OUT_DIR = 'public/media';

const TARGETS = [
  {
    source: 'Trailer video.mp4',
    out: 'trailer.mp4',
    height: 1080,
    // Visually lossless at this resolution. 18 is the usual "can't tell"
    // threshold; 19 keeps a little headroom on file size for no visible cost.
    crf: 19,
    audioKbps: 160,
  },
];

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

function mb(file) {
  return fs.statSync(file).size / 1048576;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const input = path.join(SOURCE_DIR, target.source);
  const output = path.join(OUT_DIR, target.out);

  if (!fs.existsSync(input)) {
    console.log(`SKIP ${target.source} - not found in ${SOURCE_DIR}`);
    continue;
  }

  const before = mb(input);
  process.stdout.write(`${target.source}  ${before.toFixed(1)} MB -> `);

  run([
    '-y',
    '-i',
    input,
    // Scale to target height, keep aspect, force even width (H.264 requires it).
    '-vf',
    `scale=-2:${target.height}:flags=lanczos`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(target.crf),
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p',
    // Two seconds between keyframes: seeking and looping stay responsive
    // without costing much size.
    '-g',
    '60',
    '-c:a',
    'aac',
    '-b:a',
    `${target.audioKbps}k`,
    '-movflags',
    '+faststart',
    output,
  ]);

  const after = mb(output);
  console.log(`${after.toFixed(1)} MB  (${((after / before) * 100).toFixed(1)}%)`);
}

console.log('\nDone.');
