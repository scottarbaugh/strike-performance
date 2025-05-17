# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strike BTC Performance Analyzer is a web application for analyzing Bitcoin investments made through the Strike platform. It allows users to upload their Strike CSV export files to visualize and analyze their Bitcoin investment performance.

Key features:
- Upload and parse Strike CSV export files
- Calculate investment metrics (total BTC, current value, profit/loss)
- Visualize purchase history and portfolio value
- Show detailed transaction history with current value and ROI
- Dark/Light mode toggle
- Private analysis (processing happens in the browser)

## Development Commands

### Start the Development Server

To start the local development server:

```bash
python3 server.py
```

This will start a server on one of the following ports (trying in sequence): 3000, 3001, 3002, 3003, 5000, 5001. The server will automatically open in a browser if running on macOS.

## Architecture Overview

### Frontend Structure

The application is a single-page web app with no build process:

- `index.html` - Main HTML structure, uses Tailwind CSS for styling
- `script.js` - JavaScript that handles all functionality:
  - File upload and CSV parsing
  - Data analysis and calculations
  - Chart rendering with Chart.js
  - UI updates and interactions
- `styles.css` - Custom CSS styles beyond Tailwind

### Backend

- `server.py` - Simple Python HTTP server for local development
  - Serves static files
  - Adds CORS headers for API calls
  - No server-side processing (all data analysis happens client-side)

### Data Flow

1. User uploads CSV file
2. Application parses the CSV to extract Bitcoin transactions
3. App fetches current Bitcoin price from CoinGecko API (with Coinbase fallback)
4. Calculations are performed on the transaction data
5. Results are displayed via summary cards, charts, and a detailed transaction table

### Key Components

- **CSV Parser**: Handles Strike's export format, extracts transaction data
- **Analysis Engine**: Calculates performance metrics (ROI, profit/loss, etc.)
- **Data Visualization**: Uses Chart.js to render purchase history and portfolio value charts
- **Theme System**: Supports light/dark mode with Tailwind's dark mode

## Privacy Note

All data processing happens client-side; no user data is sent to external servers except for fetching the current Bitcoin price from public APIs (CoinGecko/Coinbase).