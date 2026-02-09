# portfolio-core

Shared Python library for portfolio trading services.

## Installation

From any service directory:

```bash
poetry add portfolio-core --path ../lib/py-core
```

Or in `pyproject.toml`:

```toml
[tool.poetry.dependencies]
portfolio-core = { path = "../lib/py-core", develop = true }
```

## Usage

### Supabase Client

```python
from portfolio_core import get_supabase_client, get_service_client

# Anonymous client (respects RLS)
client = get_supabase_client()

# Service role client (bypasses RLS)
client = get_service_client()
```

### Configuration

```python
from portfolio_core import BaseServiceSettings, find_env_file

class MySettings(BaseServiceSettings):
    my_api_key: str = ""
    batch_size: int = 100

settings = MySettings(_env_file=find_env_file())
```

### Utilities

```python
from portfolio_core import safe_divide, clamp, normalize_score, pct_change

safe_divide(10, 0)  # 0.0
clamp(150, 0, 100)  # 100
normalize_score(75, 0, 100)  # 0.75
pct_change(110, 100)  # 10.0
```

### Logging

```python
from portfolio_core import setup_logging

setup_logging(level="DEBUG", service_name="my-scanner")
```
