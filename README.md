# Hotel Rooms Backend API

A Node.js Express API server for the Hotel Rooms Management System.

## Features

- ✅ Handle room requests
- ✅ Handle financial reports  
- ✅ Handle general reports
- ✅ SQLite database
- ✅ CORS enabled
- ✅ Error handling
- ✅ Input validation

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /` - API information

### Submissions
- `GET /api/submissions` - Get all submissions
- `POST /api/submissions` - Create new submission

## Supported Work Types

- `room_request` - Room addition/modification requests
- `report` - General reports
- `financial_report` - Financial reports with PDF support

## Deployment

This backend is designed to work with:
- Render.com
- Heroku  
- Railway
- Any Node.js hosting platform

## Environment Variables

- `PORT` - Server port (default: 3001)

## Local Development

```bash
npm install
npm run dev
```

## Production

```bash
npm start
```
