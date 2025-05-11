# OSRM Obstacle Management System

This project provides a web application for managing geographical obstacles that might affect routing and navigation. Users can visualize, add, and manage obstacles on a map interface.

## Features

- Interactive map visualization using Leaflet
- Add obstacles with various details (type, description, danger level)
- View and manage existing obstacles
- Integration with backend API for data persistence
- Toast notifications for user feedback

## Project Structure

- `/components` - UI components including the obstacle form and map
- `/types` - TypeScript type definitions
- `/utils` - Utility functions including API client
- `/app` - Next.js application routes and layout
- `/lib` - Utility libraries and helper functions
- `/public` - Static assets

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Replace the API URL with your actual backend API endpoint.

### Installation

```bash
# Install dependencies
npm install
# or
yarn install

# Start the development server
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:3000

### Building for Production

```bash
# Build the application
npm run build
# or
yarn build

# Start the production server
npm start
# or
yarn start
```

## API Integration

The application interacts with a backend API for managing obstacles. The API client in `utils/api.ts` provides the following methods:

- `getAll()` - Fetch all obstacles
- `getById(id)` - Fetch a specific obstacle
- `create(obstacle)` - Create a new obstacle
- `update(id, obstacle)` - Update an existing obstacle
- `delete(id)` - Delete an obstacle

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request