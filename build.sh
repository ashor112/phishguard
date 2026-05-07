#!/usr/bin/env bash
set -e

echo "=== Installing backend dependencies ==="
cd backend
npm install
cd ..

echo "=== Installing frontend dependencies ==="
cd frontend
npm install --include=dev

echo "=== Building frontend ==="
npm run build
cd ..

echo "=== Build complete ==="
