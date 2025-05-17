# Strike BTC Performance Analyzer

A modern web application for analyzing the performance of your Bitcoin investments made through the Strike platform.

## Features

- Upload and parse Strike CSV export files
- Analyze Bitcoin investment performance
- Calculate key metrics (total BTC, current value, profit/loss)
- Visualize purchase history and portfolio value over time
- Show detailed transaction history with current value and ROI
- Dark/Light mode toggle
- Private analysis (all processing happens in your browser)

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (to fetch current Bitcoin price)

### Running the Application

1. Clone this repository:
   ```
   git clone <repository-url>
   cd strike-performance
   ```

2. Start a local server:
   ```
   python3 server.py
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

4. Upload your Strike Bitcoin account statement CSV file and analyze your performance.

## Data Privacy

All analysis is performed client-side in your browser. No data is sent to any external servers except for fetching the current Bitcoin price from the CoinGecko API.

## How to Export Your Strike Data

1. Log in to your Strike account
2. Navigate to the Account section
3. Select "Export Transactions" or similar option
4. Choose the date range and download the CSV file

## License

MIT
