# Original exploratory notebook

`thyroid_disease_detection.ipynb` is the university notebook this project grew
out of, kept unchanged as a record of the exploratory work: the dataset survey,
the distribution and correlation plots, and the first pass at modelling.

**Its results are superseded and should not be quoted.** The numbers it reports
were produced by a training run with several defects - missing lab values filled
with unseeded random draws (which put impossible negative TSH readings into the
training data), an outlier filter that deleted the most clearly hypothyroid
patients, imputation applied before the train/test split, and accuracy used as
the only metric on a dataset that is 88% healthy patients.

The current numbers come from `python -m ml.train` and are written to
[`../models/MODEL_CARD.md`](../models/MODEL_CARD.md) and
[`../reports/metrics.json`](../reports/metrics.json) by the run itself. The
README's "What changed, and why" section explains each fix.
