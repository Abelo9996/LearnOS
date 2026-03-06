.PHONY: dev dev-backend dev-frontend install docker docker-down clean

# Development
dev: dev-backend dev-frontend

dev-backend:
	cd backend && python main.py

dev-frontend:
	cd frontend && npm run dev

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Docker
docker:
	docker-compose up --build

docker-down:
	docker-compose down

# Utilities
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
