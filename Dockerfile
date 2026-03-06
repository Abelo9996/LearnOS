FROM python:3.11-slim AS backend
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["python", "main.py"]

FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM node:18-alpine AS frontend
WORKDIR /app/frontend
COPY --from=frontend-build /app/frontend/.next .next
COPY --from=frontend-build /app/frontend/node_modules node_modules
COPY --from=frontend-build /app/frontend/package.json .
COPY --from=frontend-build /app/frontend/public public
EXPOSE 3000
CMD ["npm", "start"]
