"""Point the app at a throwaway database before any test imports it."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TEST_DB_DIR = tempfile.mkdtemp(prefix="thyrolens-tests-")
os.environ["THYROLENS_DB_PATH"] = str(Path(_TEST_DB_DIR) / "test.db")
