# ThyroLens — Thyroid Disease Detection

**Your thyroid blood test, explained.** A patient-facing screening product that
turns a lab report into an explained result, keeps a history per account, charts
how each test is moving and produces a PDF report to take to a doctor.

[![CI](https://github.com/iamarslankhalid/Thyroid-Disease-Detection/actions/workflows/ci.yml/badge.svg)](https://github.com/iamarslankhalid/Thyroid-Disease-Detection/actions/workflows/ci.yml)

> **A screening aid, not a diagnosis.** Results come from a statistical model and
> can be wrong; every result and report says so and points the user to a doctor.

---

## What it does

A patient enters whatever their lab report shows — even a single TSH value, in whatever
unit their laboratory printed — and gets back:

- **A screening result** (Negative / Hypothyroid / Hyperthyroid) with the model's confidence
- **Why it said that**: the specific values that drove the result, measured per patient rather than pulled from a global feature-importance chart
- **What would change it**: *"if your TSH were below 4.46 mU/L, this would read Negative"* — a real boundary found by re-running the model across the whole plausible range, not an estimate
- **Their numbers against reference ranges**, in their own units, so nothing rests on the model's word alone
- **What to do next**, and a comparison against their previous check
- **An account** that saves every check, with notes for the doctor on each one
- **An analytics dashboard**: latest status, each test against its reference range, trends, result mix and monthly activity
- **PDF reports** of the full history (or a period) or a single check, with reference ranges, high/low flags, trend charts and notes
- **A transparency page** showing the confusion matrix, per-class recall and known limits

Guests can still run a check without an account; their checks stay in the
browser and can be imported into an account later.

---

## Results

Random forest, selected on cross-validated macro F1, measured on 1,536 held-out patients:

| model | macro F1 | balanced acc. | accuracy | missed disease |
|---|---|---|---|---|
| **random forest** *(selected)* | **0.939** | 0.952 | 0.984 | 3.8% |
| hist gradient boosting | 0.924 | 0.954 | 0.980 | 3.8% |
| SVM (RBF) | 0.866 | 0.961 | 0.956 | 2.7% |
| logistic regression | 0.829 | 0.950 | 0.945 | 2.2% |
| KNN | 0.755 | 0.685 | 0.930 | 54.4% |
| *baseline: always "Negative"* | *0.312* | *0.333* | *0.882* | *100%* |

**Read the baseline row first.** A model that calls every patient healthy scores
88.2% accuracy on this dataset while missing every sick person. That is why
accuracy is the last column here and macro F1 is the first.

Per class, for the selected model:

| class | precision | recall | F1 | test cases |
|---|---|---|---|---|
| Negative | 0.995 | 0.987 | 0.991 | 1,354 |
| Hypothyroid | 0.930 | 0.993 | 0.960 | 134 |
| Hyperthyroid | 0.857 | 0.875 | 0.866 | 48 |

Full details, including the confusion matrix and the reasons specific columns
were excluded, are generated into [`models/MODEL_CARD.md`](models/MODEL_CARD.md)
by the training run itself.

---

## Quick start

```bash
git clone https://github.com/iamarslankhalid/Thyroid-Disease-Detection.git
cd Thyroid-Disease-Detection

python -m venv .venv && .venv/Scripts/activate   # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt

python -m ml.train                # ~30s, writes models/thyroid_model.joblib
cd frontend && npm ci && npm run build && cd ..
uvicorn backend.app.main:app --reload
```

Open <http://127.0.0.1:8000>. The API documentation is at `/docs`.

---

## Live demo

The public demo is a free [Render](https://render.com) Web Service built from
the [Dockerfile](Dockerfile) and [render.yaml](render.yaml) in this repo. After
you connect the GitHub repository in the Render dashboard, the URL looks like
`https://thyrolens.onrender.com`. Add that address here once the first deploy
succeeds.

On the free plan:

- The instance **sleeps after about 15 minutes** with no visitors. The next
  request takes around a minute to wake it.
- There is **no persistent disk**, so accounts and saved checks are wiped when
  the instance sleeps or redeploys. That is acceptable for a portfolio demo,
  not for real patient records.
- The instance has **512 MB of RAM**. If it dies while loading the model, the
  next step is Render's cheapest paid instance, not a static host.

To deploy it yourself: **New → Web Service → this repo**. Accept the blueprint,
or set Runtime to Docker, the plan to Free, the port to 8000, and the health
check to `/api/health`. Confirm `/api/health` returns
`{"status":"ok","model_loaded":true}` before sharing the link.

Accounts and saved checks live in a SQLite database at `var/thyrolens.db`
(override with `THYROLENS_DB_PATH`); it is created on first start.

With Docker, the whole thing is one image. Mount a volume at `/app/var` so
accounts survive container restarts:

```bash
docker build -t thyroid-screening .
docker run -p 8000:8000 -v thyrolens-data:/app/var thyroid-screening
```

### Working on the frontend

Run the API and Vite side by side — Vite proxies `/api` to uvicorn and hot-reloads:

```bash
uvicorn backend.app.main:app --reload      # terminal 1
cd frontend && npm run dev                 # terminal 2, http://localhost:5173
```

---

## Architecture

```text
             ┌───────────────────────────┐
Lab report → │  React + TypeScript UI    │  form → result → explanation,
             │  (Vite, Tailwind)         │  dashboard, history, account
             └─────────────┬─────────────┘
                           │  /api/*  (Bearer session token)
             ┌─────────────▼─────────────┐
             │  FastAPI                  │  Pydantic validates clinical ranges;
             │  backend/app              │  accounts, history, analytics, PDFs
             └──────┬──────────────┬─────┘
                    │              └──────────▶ SQLite (raw SQL): users,
                    │                           sessions, checks, lab values
             ┌──────▼────────────────────┐
             │  scikit-learn Pipeline    │  impute → scale → random forest
             │  models/*.joblib          │  + per-patient explanation
             └───────────────────────────┘
```

The preprocessing lives *inside* the pickled pipeline, so serving cannot apply a
different transformation than training did. The artifact also carries its own
feature order, class names, metrics and scikit-learn version, and the API reads
units and reference ranges from the same `ml/config.py` the model was trained
from — the UI never hard-codes a clinical value.

### The site

| Route | What it is |
|---|---|
| `/` | Landing page — what the product does, how it works, its limits |
| `/screening` | The tool: the form, the result, the reasoning |
| `/dashboard` | Analytics for the signed-in user |
| `/history` | Saved checks with notes, filters and PDF downloads |
| `/account` | Profile, password, data export, report download, account deletion |
| `/login`, `/register` | Sign in and create an account |
| `/model` | Performance, confusion matrix, excluded columns |
| `/about` | The dataset, the full FAQ, limitations, how it is built |
| `/docs` | Interactive API documentation (FastAPI) |

### Units are a correctness problem, not a convenience

The training data records thyroid hormones in **nmol/L**. Most laboratories in
Pakistan, the United States and much of Asia print total T4 in **µg/dL** and
total T3 in **ng/dL**. A perfectly normal 8.1 µg/dL typed into a field measured
in nmol/L would be scored against a 60–140 range and read as severe
hypothyroidism — a confidently wrong answer given to a healthy person.

So every value carries a unit. `ml/units.py` converts to the training unit
before the model sees anything, bounds are validated *after* conversion (and
reported back in the unit you typed), and reference ranges are converted for
display. Only exact conversions are offered: thyroid uptake is sometimes
reported as a percentage, but turning that into this dataset's ratio needs the
reporting lab's own normal mean, so the app says so instead of guessing.

```text
ml/            data cleaning, pipeline, training, evaluation, explanation
backend/app/   FastAPI: schemas, model service, accounts, history, analytics,
               PDF reports, SQLite access; serves the built UI
frontend/src/  React app: pages, components, typed API client
tests/         tests over cleaning, imputation, unit conversion, the API and accounts
models/        trained artifact + generated model card
reports/       metrics.json and the dataset report from the last run
```

---

## What changed, and why

This started as a university notebook that reported 97.6% accuracy. The
rebuild reports 98.4% — and the interesting part is that the first number was
meaningless while the second one is defensible. The problems that were fixed:

**Missing lab values were filled with random numbers.** The notebook replaced
missing TSH, T3 and T4U with uniform random draws between mean ± standard
deviation. For TSH that range is roughly −19 to +29, so the training data ended
up containing *negative* TSH readings, which cannot exist. No seed was set, so
every run trained on different data — which is why the notebook's numbers never
matched its own README. Missing values now stay missing and are imputed inside
the pipeline, fitted on the training fold only.

**The outlier filter deleted the patients it most needed.** Rows more than three
standard deviations above the mean were dropped — that is, the highest TSH
readings, which are the clearest hypothyroid cases in the dataset. Extreme lab
values are now kept; only physically impossible ones (an age of 65,526) are
treated as missing.

**Accuracy was the only metric.** With 88% healthy patients, "always Negative"
already scores 0.88. Model selection now runs on cross-validated macro F1, and
every report shows per-class recall and the share of ill patients missed.

**Preprocessing leaked across the train/test split.** Imputation happened before
splitting, so test-set statistics reached the training data. Everything now
happens inside a `Pipeline` under a `StratifiedKFold`.

**Clinically important inputs were thrown away.** The notebook kept 8 of 30
columns, dropping whether the patient takes thyroxine or antithyroid
medication, has had thyroid surgery, or has a goitre. All 20 usable features are
back. `referral_source` stays out on purpose: it encodes which clinic sent the
sample, which correlates with the diagnosis in this dataset but is unknown for a
new patient — using it would inflate the scores and fail in the real world.

**The prediction helper was broken.** It passed 7 features in a different order
to a model expecting 8, and its own test case described a pregnant male patient.
The feature order now lives in the artifact, and tests cover the contract.

**KNN and SVM were trained on unscaled features**, so distance was dominated by
whichever measurement happened to have the largest units. Both are still
compared, now on scaled inputs — KNN's honest macro F1 is 0.755.

---

## Responsible use

- **Not a diagnosis.** The output says a set of numbers *resembles* a group in a historical dataset. Only a doctor can diagnose a thyroid disorder.
- **The data is from the 1980s**, collected at one Australian clinic. Assay methods and reference ranges have changed; real-world accuracy today would be lower.
- **Hyperthyroidism is rare here** — 241 cases in the whole dataset — so that class is the least reliable.
- **Never externally validated** on patients from another hospital, country or era.
- **Health data is stored per account.** Passwords are hashed with scrypt, session tokens are stored only as SHA-256 digests, every history query is scoped to the signed-in user, and users can export or permanently delete everything. Guests' checks never leave their browser.
- Modern lab reports usually give free T4 and free T3, while this dataset uses the older T4-uptake and free-T4-index measures. Missing inputs are imputed, and a result from fewer values deserves less weight.

---

## Dataset

Garvan Institute thyroid disease data, via the
[UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/102/thyroid+disease)
and [Kaggle](https://www.kaggle.com/datasets/emmanuelfwerr/thyroid-disease-data).
9,172 records, of which 7,679 carry one of the three diagnoses this project
classifies; the rest (binding-protein anomalies, replacement therapy, discordant
assays) are dropped rather than relabelled.

## Contributors

- [Muhammad Arslan Khalid](https://github.com/iamarslankhalid)
- [Zainab Nadeem](https://github.com/imzainabnadeem)
