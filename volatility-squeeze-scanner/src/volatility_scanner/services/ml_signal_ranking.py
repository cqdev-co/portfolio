from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib
import pandas as pd
import numpy as np

class MLSignalRanker:
    def __init__(self, model_path: str = 'ml_model.pkl', local_only: bool = False):
        self.model_path = model_path
        self.local_only = local_only
        self.model = None
        if not self.local_only:
            raise ValueError("ML ranking is local-only")

    def train(self, data: pd.DataFrame, target: str):
        if not self.local_only:
            return
        X = data.drop(target, axis=1)
        y = data[target]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
        self.model = RandomForestClassifier()
        self.model.fit(X_train, y_train)
        joblib.dump(self.model, self.model_path)

    def predict(self, features: pd.DataFrame) -> np.array:
        if not self.model:
            self.model = joblib.load(self.model_path)
        return self.model.predict_proba(features)[:, 1]
