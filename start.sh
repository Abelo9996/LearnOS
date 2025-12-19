#!/bin/bash

echo "🚀 Starting LearnOS..."
echo ""

# Check if backend is running
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "📦 Starting backend server..."
    cd backend
    
    # Create venv if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv
    source venv/bin/activate
    
    # Upgrade pip first
    echo "Upgrading pip..."
    pip install --upgrade pip > /dev/null 2>&1
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies. Please check the error above."
        exit 1
    fi
    
    # Start backend in background
    python main.py &
    BACKEND_PID=$!
    echo "✅ Backend started (PID: $BACKEND_PID)"
    cd ..
else
    echo "✅ Backend already running on port 8000"
fi

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Check if frontend is running
if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "📦 Starting frontend server..."
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing Node dependencies..."
        npm install
    fi
    
    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!
    echo "✅ Frontend started (PID: $FRONTEND_PID)"
    cd ..
else
    echo "✅ Frontend already running on port 3000"
fi

echo ""
echo "🎉 LearnOS is ready!"
echo ""
echo "📍 Backend API: http://localhost:8000"
echo "📍 API Docs: http://localhost:8000/docs"
echo "📍 Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait
