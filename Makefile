# Makefile — UrbanFlow Valencia
# Uso: make <target>

.PHONY: help backend-install backend-run backend-test backend-lint \
        frontend-install frontend-run frontend-build artifacts validate docker-up

help:
	@echo "Targets disponibles:"
	@echo "  backend-install   Instala dependencias del backend"
	@echo "  backend-run       Arranca FastAPI en :8000"
	@echo "  backend-test      Ejecuta pytest"
	@echo "  backend-lint      Ejecuta ruff"
	@echo "  frontend-install  Instala dependencias del frontend"
	@echo "  frontend-run      Arranca Next.js en :3000"
	@echo "  frontend-build    Build de producción del frontend"
	@echo "  artifacts         Genera artefactos (modelos, métricas, candidatos)"
	@echo "  validate          Valida los artefactos generados"
	@echo "  docker-up         Levanta el backend con docker compose"

backend-install:
	cd backend && pip install -r requirements.txt

backend-run:
	cd backend && uvicorn main:app --reload --port 8000

backend-test:
	cd backend && pytest -q

backend-lint:
	cd backend && ruff check .

frontend-install:
	cd frontend && npm install

frontend-run:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

artifacts:
	python scripts/export_models.py
	python scripts/generate_metrics.py
	python scripts/generate_candidates.py

validate:
	python scripts/validate_artifacts.py

docker-up:
	docker compose up --build
