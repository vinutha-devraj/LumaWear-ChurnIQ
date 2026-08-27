"""
utils/config.py

Single source of truth for paths and model store configuration.
No longer hardcodes feature names — those come from schema.json per model.
"""

from pathlib import Path

# ─── Project root ──────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).resolve().parent.parent
ARTIFACTS_BASE = BASE_DIR / "artifacts"
DATA_DIR       = BASE_DIR / "data"

# ─── Default model (existing E-Commerce model) ────────────────────────────────
DEFAULT_MODEL_DIR  = ARTIFACTS_BASE / "b139e4227328"
DEFAULT_MODEL_HASH = "b139e4227328"

# ─── Model store ──────────────────────────────────────────────────────────────
# Each trained model lives in ARTIFACTS_BASE / {dataset_hash}/
# The active model is tracked in ARTIFACTS_BASE / active_model.txt

ACTIVE_MODEL_FILE = ARTIFACTS_BASE / "active_model.txt"


def get_active_model_dir() -> Path:
    """
    Returns the directory of the currently active model.
    Falls back to DEFAULT_MODEL_DIR if no active model is set.
    """
    if ACTIVE_MODEL_FILE.exists():
        model_id = ACTIVE_MODEL_FILE.read_text().strip()
        candidate = ARTIFACTS_BASE / model_id
        if candidate.exists():
            return candidate
    return DEFAULT_MODEL_DIR


def set_active_model(model_id: str):
    """
    Set the active model by writing its ID to active_model.txt.
    model_id is either 'ecommerce_default' or a dataset hash string.
    """
    ARTIFACTS_BASE.mkdir(parents=True, exist_ok=True)
    ACTIVE_MODEL_FILE.write_text(model_id.strip())


def get_model_dir(model_id: str) -> Path:
    """Return the artifact directory for a given model_id."""
    return ARTIFACTS_BASE / model_id


def list_available_models() -> list:
    """
    List all available trained models in the artifacts directory.
    Returns list of dicts with id, name, hash, auc_cv.
    """
    import json
    models = []
    for d in sorted(ARTIFACTS_BASE.iterdir()):
        if not d.is_dir():
            continue
        meta_path = d / "model_metadata.json"
        if not meta_path.exists():
            continue
        try:
            meta = json.loads(meta_path.read_text())
            models.append({
                "id":           d.name,
                "dataset_name": meta.get("dataset_name", d.name),
                "dataset_hash": meta.get("dataset_hash", d.name),
                "auc_cv":       meta.get("auc_cv"),
                "n_rows":       meta.get("n_rows"),
                "churn_rate":   meta.get("churn_rate"),
            })
        except Exception:
            continue
    return models