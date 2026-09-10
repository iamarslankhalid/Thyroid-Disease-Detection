"""Preprocessing and model definitions.

Everything a model needs - imputation, scaling, the estimator - lives inside a
single scikit-learn ``Pipeline``. That is what makes the training honest (each
step is fitted on the training fold only) and serving safe (the API cannot
forget to apply a transform the model was trained with).
"""

from __future__ import annotations

from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from ml.config import BINARY_FEATURES, NUMERIC_FEATURES, RANDOM_STATE


def build_preprocessor() -> ColumnTransformer:
    """Impute and scale, adding explicit "this value was missing" columns.

    ``add_indicator=True`` matters clinically as well as statistically: a test
    that was never ordered is itself information, and it lets the API accept a
    lab report that only carries TSH.
    """
    numeric = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median", add_indicator=True)),
            ("scale", StandardScaler()),
        ]
    )
    binary = Pipeline(steps=[("impute", SimpleImputer(strategy="most_frequent"))])

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric, NUMERIC_FEATURES),
            ("binary", binary, BINARY_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def build_candidates() -> dict[str, Pipeline]:
    """The models compared during training.

    ``class_weight="balanced"`` is applied wherever it is supported. Without it,
    a model can score 90% accuracy on this dataset by calling every patient
    healthy, which is the worst possible failure mode for a screening tool.
    """
    estimators = {
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=400,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),
        "hist_gradient_boosting": HistGradientBoostingClassifier(
            max_iter=300,
            learning_rate=0.08,
            early_stopping=True,
            validation_fraction=0.15,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        # Kept so the rebuilt system can be compared like-for-like with the
        # original notebook - but now on properly scaled, leak-free features.
        "knn": KNeighborsClassifier(n_neighbors=15, weights="distance"),
        "svm": SVC(
            kernel="rbf",
            class_weight="balanced",
            probability=True,
            random_state=RANDOM_STATE,
        ),
    }

    return {
        name: Pipeline(steps=[("preprocess", build_preprocessor()), ("model", estimator)])
        for name, estimator in estimators.items()
    }


def build_baseline() -> Pipeline:
    """Always predicts the majority class - the score any real model must beat."""
    return Pipeline(
        steps=[
            ("preprocess", build_preprocessor()),
            ("model", DummyClassifier(strategy="most_frequent")),
        ]
    )


__all__ = ["build_preprocessor", "build_candidates", "build_baseline"]
