.PHONY: setup install dev-install run ui test fmt lint clean docker-build docker-run

# Setup and Installation
setup: install
	@echo "Setting up Reddit Source project..."
	poetry run python -c "import nltk; nltk.download('punkt')"
	poetry run python -c "import spacy; spacy.cli.download('en_core_web_sm')"
	mkdir -p data/{images,parquet,cache} logs
	cp .env.example .env
	@echo "Setup complete! Please configure your .env file."

install:
	poetry install

dev-install:
	poetry install --with dev

# Running the application
run:
	poetry run python -m src.app.run

ingest-once:
	poetry run reddit-source ingest --once

ingest-watch:
	poetry run reddit-source ingest --watch

export:
	poetry run reddit-source export --date $(shell date +%Y-%m-%d)

# UI and Monitoring
ui:
	poetry run streamlit run src/ui/audit_app.py --server.port 8501

# Testing and Quality
test:
	poetry run pytest -v

test-unit:
	poetry run pytest tests/unit/ -v

test-integration:
	poetry run pytest tests/integration/ -v -m integration

test-coverage:
	poetry run pytest --cov=src --cov-report=html --cov-report=term

# Code Quality
fmt:
	poetry run ruff check --fix .
	poetry run black .

lint:
	poetry run ruff check .
	poetry run mypy src/

# Maintenance
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage

# Docker (optional)
docker-build:
	docker build -t reddit-source .

docker-run:
	docker run -it --env-file .env -v $(PWD)/data:/app/data reddit-source

# Database operations
db-migrate:
	poetry run python -m src.storage.migrate

db-reset:
	poetry run python -m src.storage.reset

# Development helpers
dev-server:
	poetry run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

jupyter:
	poetry run jupyter lab --ip=0.0.0.0 --port=8888 --no-browser

# Performance profiling
profile:
	poetry run python -m cProfile -o profile.stats -m src.app.run ingest --once
	poetry run python -c "import pstats; p = pstats.Stats('profile.stats'); p.sort_stats('cumulative').print_stats(20)"
