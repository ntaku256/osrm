# OSRM Obstacle Management System

This project provides a web application for managing geographical obstacles that might affect routing and navigation. Users can visualize, add, and manage obstacles on a map interface.

## Project Structure

This project consists of two main components:

1. **Backend API** - An AWS Lambda-based serverless API for managing obstacle data
2. **Frontend Application** - A Next.js web application for visualizing and managing obstacles on a map

## Backend Setup

The backend is built using AWS SAM (Serverless Application Model) with Go.

### Prerequisites

- Go 1.18+
- AWS SAM CLI
- AWS credentials configured

### Building and Deploying

```bash
cd backend

# Build the project
make build

# Deploy to development environment
make deploy-dev

# Or deploy to production
make deploy-prd
```

### Running Locally

```bash
cd backend
make start
```

This will start the API locally at http://localhost:3000

## Frontend Setup

The frontend is built with Next.js, TypeScript, and Tailwind CSS.

### Prerequisites

- Node.js 18+
- npm or yarn

### Environment Configuration

Create a `.env.local` file in the frontend directory:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

For production, update the URL to your deployed API endpoint.

### Installing Dependencies and Running

```bash
cd frontend
npm install
npm run dev
```

The application will be available at http://localhost:3000

## Using the Application

1. Navigate to the application in your browser
2. Click on the map to add a new obstacle
3. Fill in the obstacle details (type, description, danger level)
4. Submit the form to save the obstacle

## Notes on Route-related Functionality

The application no longer attempts to fetch route information when registering obstacles. The focus is purely on obstacle management.

## API Documentation

The API endpoints are documented in the OpenAPI specification available at `backend/openapi.yaml`. The main endpoints are:

- `GET /obstacles` - Get all obstacles
- `POST /obstacles` - Create a new obstacle
- `GET /obstacles/{id}` - Get an obstacle by ID
- `PUT /obstacles/{id}` - Update an obstacle
- `DELETE /obstacles/{id}` - Delete an obstacle 