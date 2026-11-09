# Notice

This repository holds two kinds of things: the code of the site, which you may reuse, and Mohammad AlOulabi's
personal content, which you may not.

## Covered by the MIT license

The [MIT license](LICENSE) covers the source code and the configuration: everything under `src/` except
`src/content/` and the files listed below, everything under `scripts/`, and the project's config files.

## Not covered: all rights reserved

Copyright (c) 2026 Mohammad AlOulabi. All rights reserved. None of the following is licensed under MIT or any other
license:

- `src/content/**`: the site's copy in English and Arabic, the CV text, the ink journal, the text of `/llms.txt` and
  `/llms-full.txt`, and the facts in the structured data.
- `docs/STORY.md`: the creative spec of the show and its lines.
- `public/cv/*`: the CV.
- `public/og.jpg`: the social card.
- `public/me.webp`: his portrait.
- The icons: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `src/app/icon.svg`,
  `src/app/favicon.ico` and `src/app/apple-icon.png`.
- `public/stills/*`: frames of the show used by the printed layout.
- `docs/images/*`: screenshots of the show used in the README. The star card in `docs/images/11-again.jpg` also
  shows a small screenshot of a third-party site from `public/work/`, which belongs to its owner (see below).
- His name and likeness.

## Third-party work shown as portfolio

`public/work/*` are screenshots of third-party websites he worked on, shown as examples of his work. The names, marks
and designs in them belong to their owners.

## Third-party data under their own licenses

- `data-src/bsc5.dat`, `data-src/bsc5.readme`, `public/data/bsc5.json` and `public/data/stars.json`: the Yale Bright
  Star Catalogue, 5th Revised Edition (Hoffleit and Warren, 1991), NASA ADC / CDS catalogue V/50. Public domain.
- `public/data/earth.png` and `src/gl/world/inland.ts`: baked by `scripts/bake-earth.mjs` from
  [Natural Earth](https://www.naturalearthdata.com/) 1:50m land (public domain), read from the TopoJSON of
  [world-atlas](https://github.com/topojson/world-atlas) (ISC, Copyright 2013-2019 Michael Bostock) with
  [topojson-client](https://github.com/topojson/topojson-client) (ISC).
- `public/benchmarks/*.json`: the GPU benchmark data of [@pmndrs/detect-gpu](https://github.com/pmndrs/detect-gpu)
  6.0.29 (which takes it from GFXBench), copied unchanged so the site can serve it. Its license:

  ```text
  MIT License

  Copyright (c) 2020 Tim van Scherpenzeel

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  ```

- The 3D simplex noise in `src/gl/show/glsl/common.ts` and `src/gl/world/shaders.ts` is adapted from
  [webgl-noise](https://github.com/stegu/webgl-noise) by Ashima Arts and Stefan Gustavson. Its license:

  ```text
  Copyright (C) 2011 by Ashima Arts (Simplex noise)
  Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
  ```

- Small published algorithms, credited for completeness:
  - the mulberry32 generator, in `src/bridges/ink-geom.ts`, `src/gl/show/sky.ts`, `src/gl/show/figures/galaxy.ts`
    and `src/gl/world/layout.ts`;
  - the PCG hash from Jarzynski and Olano, "Hash Functions for GPU Rendering" (JCGT, 2020), in
    `src/gl/show/glsl/common.ts` and `src/gl/world/shaders.ts`;
  - Ballesteros' color temperature with Tanner Helland's blackbody fit, in `src/gl/show/sky.ts`;
  - the spatial-hash primes of Teschner et al. (2003), in `src/gl/show/nebula.ts`.
- Fonts: Archivo, Newsreader, IBM Plex Mono and Alexandria are downloaded from Google Fonts by `next/font` at build
  time and served with the site. They are not stored in this repository. SIL Open Font License 1.1.
- npm dependencies are installed, not copied into this repository, and each keeps its own license. GSAP is under
  GreenSock's [standard "no charge" license](https://gsap.com/standard-license), not MIT.

## If you fork it

Replace the content with your own before you publish anything: `src/content/`, `docs/STORY.md`, `docs/images/`,
`public/cv/`, `public/work/`, `public/og.jpg`, `public/me.webp`, `public/stills/` (bake your own with
`bun run bake:stills`) and the icons. Remove the redirects in `vercel.json`, which send www.oulabi.dev and his other
addresses to oulabi.dev.
