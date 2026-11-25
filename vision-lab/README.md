# RYBEX Vision Lab: build a visual quality-control system

RYBEX Vision Lab is an interactive laboratory about computer vision in manufacturing. The student is the AI engineer of RYBEX, a fictional canned fish manufacturer, and builds a camera system that removes defective tins from the production line: collect images, label them, train a model, test it, deploy it on a 3D line and estimate what it is worth.

Nothing is simulated in the machine-learning part. The model is trained in the browser with TensorFlow.js, and every accuracy, loss, confusion matrix and inference time on screen comes from that model. There is no server, no API key and no cost: the whole lab is a static site.

The app opens in **Polish**; the PL/EN switch in the header changes the interface (`?lang=en` opens it in English).

## The seven stages

| # | Stage | What the student does |
|---|-------|-----------------------|
| 1 | Understand the problem | Watches the line, learns what a camera hands to a computer, inspects 12 tins by hand. Accuracy and time are recorded and used again in stage 7. |
| 2 | Collect training data | Browses the photo pool, removes the 8 unusable pictures hidden in it, uploads own photos, generates synthetic tins with chosen defects, lighting, background, camera angle, product design and reflections. |
| 3 | Label the data | Labels images (number keys), in basic mode (good / defective) or advanced mode (7 classes). Can copy the quality team's reference labels for the rest, audit disagreements, and flip a share of labels on purpose. |
| 4 | Train the AI model | Trains a classifier on frozen MobileNet features (transfer learning). Epochs, learning rate, batch size, validation split, augmentation, number of images and class balancing are adjustable. Live accuracy and loss charts. Models can be saved, loaded, exported and imported. |
| 5 | Test and evaluate | Sees accuracy, precision, recall, F1, false acceptance and false rejection rates, confusion matrices, score distributions and individual predictions on a held-out test set and six stress sets. Moves the decision threshold. |
| 6 | Deploy on the line | Runs a 3D conveyor (Three.js). The model receives the rendered camera frame of every tin and decides. Speed, defect frequency, lighting, camera position, products, threshold and an optional manual-inspection station are adjustable. Wrong decisions can be sent back into the training data. |
| 7 | Business impact | Combines measured results with cost assumptions and compares no inspection, manual inspection, AI, and AI with a person. |

An eighth page holds nine guided experiments (few images, imbalance, wrong labels, one lighting condition, new packaging, too many epochs, threshold, line speed, human verification) and a table that compares all training runs, exportable as JSON or CSV.

The loop that matters most: a tin is misjudged on the line (stage 6) → its camera frame is added to the training pool → the student labels it (stage 3) → retrains (stage 4) → the new model takes over the line.

## Data

- **Photos**: 210 photo-style images of RYBEX tins (320×400 WebP) copied from the `rybex` repository (`assets/vision-generated/web/`). Classes there: good, dent, shifted label, smudged date code. Their `train` and `val` parts (150) form the training pool, the `test` part (60) is held out. The class of each image comes from the prompt it was generated with and was not verified image by image, so a few reference labels may be wrong.
- **Synthetic images**: rendered in the browser on first start (about 390 images, a few seconds on a laptop GPU) by the same 3D tin builder that the production line uses. They cover all seven classes and come in three groups: training pool, test set, and six stress sets (poor lighting, unseen packaging, unusual angles, partly covered, subtle defects, strong reflections). Fixed seeds: every student starts with the same images.
- **Leakage**: every image belongs to a *group* (one physical tin or one synthetic scene, which may have several views). Groups never cross between the training pool, the test set and the stress sets, and the training / validation split is also made by group.
- Line 2 runs two products (Szprot, Makrela). Two more (Śledź, Tuńczyk) exist only in the "unseen packaging" stress set and as an option on the line, to show distribution shift.

## How the model works

```
image 224×224 ──► MobileNet v1 0.50 (pretrained, frozen) ──► 1024 features ──► dense 64 + dropout ──► softmax ──► defect score = 1 − P(good)
                  last conv map, average + max pooled        cached per image   trained in the browser      reject if score ≥ threshold
```

- MobileNet weights (5 MB) are served from `web/public/models/`, so the lab needs no other host at run time (fonts excepted).
- Each image passes through MobileNet once; the features are cached in memory and IndexedDB. Training the small classifier then takes seconds. With augmentation on, two altered copies of every training image are pushed through MobileNet for that run.
- WebGL is used when available, otherwise the TensorFlow.js CPU backend (slower, same results).
- On the line, the model gets only the frame rendered by the inspection camera. The defect each tin was built with is reported by the scene later, after the tin has left the station, and is used only for scoring (`src/render/line.ts`, `src/stages/Stage6.tsx`).
- Not modelled: defects on the back of the tin (one camera cannot see them, so generated defects face the camera), and motion blur.

## Code layout (`web/`)

| Path | What |
|------|------|
| `src/render/tin.ts` | Procedural tin: metal body, lid, label artwork, date code and the six defect types |
| `src/render/rig.ts`, `studio.ts`, `line.ts` | Lighting and camera shared by the synthetic image generator (`studio`) and the 3D production line (`line`) |
| `src/data/` | Starting dataset (`seed.ts`), dataset logic: group split, label noise, class counts (`dataset.ts`) |
| `src/ml/` | Feature extraction and cache (`features.ts`), training (`train.ts`), metrics (`metrics.ts`), model save / load / export (`session.ts`) |
| `src/business.ts` | Cost model of stage 7 |
| `src/store.ts`, `src/db.ts` | State, actions and persistence in IndexedDB |
| `src/stages/` | One file per stage, plus the experiments page |
| `src/i18n.ts` | All interface text, English and Polish |
| `public/data/red/`, `public/models/` | Photos and MobileNet weights |
| `scripts/e2e.mjs` | End-to-end check of the whole journey in headless Chromium |

Everything the student does is stored in the browser (IndexedDB): images, labels, settings, results and models. "Reset the lab" deletes it. Datasets, models and experiment results can be exported as files.

## Local development

```bash
cd vision-lab/web
npm install
npm run dev          # http://localhost:5175/
npm run typecheck
npm test             # unit tests: metrics, dataset logic, cost model
npm run build && npm run preview   # production build on http://localhost:4175/
node scripts/e2e.mjs               # needs Playwright with Chromium and the preview server running
```

The end-to-end check trains a real model, so it takes a few minutes in a browser without a GPU.

## Deployment (GitHub Pages)

The lab is published by the repository's single Pages workflow, [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): the job `vision-lab-web` runs the type check, the unit tests and the build, and the `site` job copies `web/dist` to `/vision-lab/`. No repository variable or secret is needed. The build uses a relative base (`./`), so it works under any path; set `VITE_BASE` to override.

## Limits

- This is a teaching lab. Synthetic renders and generated photos are suitable for learning the process. A real deployment needs representative photographs from the actual line and independent validation.
- Visual inspection sees only the outside of a tin. It cannot guarantee microbiological safety, a hermetic seal or the absence of contamination inside.
- The cost figures of stage 7 are estimates scaled from a small number of images and from assumptions typed in by the student.
