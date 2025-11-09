"""Model versioning and management."""

from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import joblib
from loguru import logger


class ModelVersionManager:
    """Manage model versions."""

    def __init__(self, models_dir: Path):
        """
        Initialize version manager.

        Args:
            models_dir: Directory containing model files
        """
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def list_versions(self) -> List[Dict]:
        """
        List all model versions.

        Returns:
            List of version info dictionaries
        """
        model_files = sorted(self.models_dir.glob("model_*.pkl"))

        versions = []
        for model_file in model_files:
            try:
                model_data = joblib.load(model_file)
                version_info = {
                    "version": model_data.get("version", "unknown"),
                    "file": model_file.name,
                    "path": str(model_file),
                    "size_mb": model_file.stat().st_size / (1024 * 1024),
                    "created": datetime.fromtimestamp(
                        model_file.stat().st_ctime
                    ).isoformat(),
                    "metrics": model_data.get("metrics", {}),
                }
                versions.append(version_info)
            except Exception as e:
                logger.error(f"Error reading model {model_file}: {e}")

        return versions

    def get_latest_version(self) -> Optional[str]:
        """
        Get latest model version.

        Returns:
            Version string or None
        """
        model_files = sorted(self.models_dir.glob("model_*.pkl"))
        if not model_files:
            return None

        latest_file = model_files[-1]
        try:
            model_data = joblib.load(latest_file)
            return model_data.get("version", "unknown")
        except Exception as e:
            logger.error(f"Error reading latest model: {e}")
            return None

    def delete_old_versions(self, keep_last_n: int = 5) -> int:
        """
        Delete old model versions, keeping only the last N.

        Args:
            keep_last_n: Number of versions to keep

        Returns:
            Number of versions deleted
        """
        model_files = sorted(self.models_dir.glob("model_*.pkl"))

        if len(model_files) <= keep_last_n:
            logger.info(
                f"No versions to delete ({len(model_files)} <= {keep_last_n})"
            )
            return 0

        files_to_delete = model_files[:-keep_last_n]
        deleted_count = 0

        for model_file in files_to_delete:
            try:
                model_file.unlink()
                logger.info(f"Deleted old model version: {model_file.name}")
                deleted_count += 1
            except Exception as e:
                logger.error(f"Error deleting {model_file}: {e}")

        logger.info(f"Deleted {deleted_count} old model versions")
        return deleted_count

    def compare_versions(
        self,
        version1: str,
        version2: str,
    ) -> Dict:
        """
        Compare two model versions.

        Args:
            version1: First version
            version2: Second version

        Returns:
            Comparison dictionary
        """
        model_path1 = self.models_dir / f"model_{version1}.pkl"
        model_path2 = self.models_dir / f"model_{version2}.pkl"

        if not model_path1.exists():
            raise FileNotFoundError(f"Model {version1} not found")
        if not model_path2.exists():
            raise FileNotFoundError(f"Model {version2} not found")

        model1 = joblib.load(model_path1)
        model2 = joblib.load(model_path2)

        metrics1 = model1.get("metrics", {})
        metrics2 = model2.get("metrics", {})

        comparison = {
            "version1": version1,
            "version2": version2,
            "metrics1": metrics1,
            "metrics2": metrics2,
        }

        # Compare classification metrics
        if "classification" in metrics1 and "classification" in metrics2:
            auc1 = metrics1["classification"].get("val_auc", 0)
            auc2 = metrics2["classification"].get("val_auc", 0)
            comparison["auc_improvement"] = auc2 - auc1
            comparison["better_version"] = version2 if auc2 > auc1 else version1

        return comparison

    def create_version_name(self, prefix: str = "v") -> str:
        """
        Create a new version name with timestamp.

        Args:
            prefix: Version prefix

        Returns:
            Version string
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}{timestamp}"

