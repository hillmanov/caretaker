#!/bin/bash

# Function to stop all processes
cleanup() {
    echo "Stopping all services..."
     docker-compose -p local-caretaker -f docker-compose.local.yml --compatibility down
    exit 0
}

# Trap Ctrl-C (SIGINT) and call cleanup function
trap cleanup SIGINT

# Start the Go server and display its output
echo "Starting Go server..."
cd server && go run ./main.go serve --http='0.0.0.0:3028' &

# Start Docker Compose and display its output
echo "Starting Docker Compose..."
docker-compose -p local-caretaker -f docker-compose.local.yml --compatibility up --remove-orphans &

# Start Vite dev server and display its output
echo "Starting Vite dev server..."
npm --prefix ./client run dev

# Wait for all background processes to finish
wait
