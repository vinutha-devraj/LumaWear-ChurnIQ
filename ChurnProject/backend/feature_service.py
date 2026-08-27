"""
backend/feature_service.py

Feature extraction service layer for LumaWear live customer predictions.
Reuses existing LumaWear Mongoose connection and feature extraction logic
strictly from live MongoDB without using synthetic CSV data.
"""

import os
import json
import subprocess
import urllib.request
import urllib.error
from typing import Dict, Any

from utils.config import BASE_DIR

LUMAWEAR_BACKEND_URL = os.environ.get("LUMAWEAR_BACKEND_URL", "http://localhost:4000")
LUMAWEAR_DIR = BASE_DIR.parent / "LumaWear-Ecommerce" / "backend"


def extract_live_customer_features(user_id: str) -> Dict[str, Any]:
    """
    Extract 21 LumaWear-native features for a given user_id from live MongoDB data.

    Tries in sequence:
    1. LumaWear REST API (if Express server is running)
    2. Node.js direct extractor script using existing LumaWear Mongoose models

    Strictly avoids synthetic CSV datasets for live customer predictions.
    """
    user_id_str = str(user_id).strip()
    if not user_id_str:
        raise ValueError("A valid user_id is required.")

    # ── Strategy 1: LumaWear REST API ─────────────────────────────────────────
    api_url = f"{LUMAWEAR_BACKEND_URL}/api/churn/customer-features/{user_id_str}"
    try:
        req = urllib.request.Request(
            api_url,
            headers={"User-Agent": "ChurnIQ-Inference/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                if data.get("success") and "features" in data:
                    return data["features"]
    except urllib.error.HTTPError as http_err:
        if http_err.code == 404:
            raise ValueError(f"Customer '{user_id_str}' was not found in LumaWear database.")
    except Exception:
        # Server not reachable -> fallback to Strategy 2 (direct DB extractor script)
        pass

    # ── Strategy 2: Node.js extractor script (Direct DB extraction) ───────────
    script_path = LUMAWEAR_DIR / "src" / "churn" / "extractSingleCustomer.js"
    if script_path.exists():
        try:
            result = subprocess.run(
                ["node", str(script_path), user_id_str],
                cwd=str(LUMAWEAR_DIR),
                capture_output=True,
                text=True,
                timeout=5.0,
            )
            if result.returncode == 0 and result.stdout.strip():
                for line in reversed(result.stdout.strip().splitlines()):
                    if line.startswith("{") and line.endswith("}"):
                        parsed = json.loads(line)
                        if parsed.get("success") and "features" in parsed:
                            return parsed["features"]
                        if parsed.get("error") and "not found" in parsed.get("error", "").lower():
                            raise ValueError(f"Customer '{user_id_str}' was not found in LumaWear database.")
        except ValueError:
            raise
        except Exception:
            pass

    raise ValueError(f"Live customer '{user_id_str}' was not found in LumaWear database.")
