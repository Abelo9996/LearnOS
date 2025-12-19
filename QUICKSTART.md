# Quick Start Guide - Manual Setup

This guide walks you through starting LearnOS manually with full visibility.

## Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- npm or yarn

## Step 1: Setup Backend

Open a terminal and run:

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate     # On Windows

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

The backend should now be running on **http://localhost:8000**

You can verify by visiting **http://localhost:8000/docs** (API documentation)

---

## Step 2: Setup Frontend

Open a **new terminal** and run:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend should now be running on **http://localhost:3000**

---

## Step 3: Test the Application

1. Open your browser to **http://localhost:3000**
2. You should see the "What do you want to learn?" page
3. Enter a learning goal, for example:
   - "Learn reinforcement learning well enough to build agents"
   - "Master neural networks from fundamentals to advanced architectures"
4. Click **"Start Learning"**
5. The system will generate a concept graph
6. Click **"Begin Learning"** to start the learning session

---

## Troubleshooting

### Backend Issues

**Problem: `ModuleNotFoundError: No module named 'fastapi'`**

Solution:
```bash
cd backend
source venv/bin/activate  # Make sure venv is activated
pip install --upgrade pip
pip install -r requirements.txt
```

**Problem: Port 8000 already in use**

Solution:
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process (replace PID with actual number)
kill -9 PID
```

---

### Frontend Issues

**Problem: `Cannot find module 'react'`**

Solution:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Problem: Port 3000 already in use**

Solution:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID with actual number)
kill -9 PID
```

---

## Alternative: Using the start script

If you prefer automation:

```bash
./start.sh
```

This will start both backend and frontend automatically.

---

## Stopping the Application

### If running manually:
Press `Ctrl+C` in each terminal where backend/frontend is running

### If using start.sh:
Press `Ctrl+C` once to stop both services

---

## Next Steps

Once running:
1. Try entering different learning goals
2. Complete a full learning loop
3. Check the progress dashboard
4. Explore the concept graph visualization

---

## Development Tips

### Backend Development
- API docs: http://localhost:8000/docs
- Each agent is in `backend/agents/`
- Add new endpoints in `backend/routers/`
- Models are in `backend/models.py`

### Frontend Development
- Hot reload is enabled (changes reflect immediately)
- Add new pages in `frontend/app/`
- Styles are in `frontend/app/globals.css`
- API calls use axios with base URL from env

### Testing Changes
1. Modify backend code → Server auto-reloads (with uvicorn --reload)
2. Modify frontend code → Browser auto-updates
3. Test API directly at http://localhost:8000/docs

---

## Common First-Time Setup Issues

### Issue: Python version too old
```bash
# Check Python version
python3 --version

# Should be 3.10+
# If not, install latest Python from python.org
```

### Issue: Node version too old
```bash
# Check Node version
node --version

# Should be 18+
# If not, install from nodejs.org or use nvm
```

### Issue: Permission denied on start.sh
```bash
chmod +x start.sh
./start.sh
```

---

## Success Indicators

✅ Backend ready when you see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

✅ Frontend ready when you see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

---

Enjoy using LearnOS! 🚀
