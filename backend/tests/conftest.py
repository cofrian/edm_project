import os
import sys

import pytest
from fastapi.testclient import TestClient

# Permite importar `main` y `src` al ejecutar pytest desde backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)
