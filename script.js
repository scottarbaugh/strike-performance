// Main JavaScript file for Strike BTC Performance Analyzer

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loadingIndicator = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    const errorMessageContainer = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const themeToggle = document.getElementById('theme-toggle');
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const manualRefreshBtn = document.getElementById('manual-refresh');
    const refreshIntervalDisplay = document.getElementById('refresh-interval');
    
    // Global variables
    let csvData = null;
    let currentFile = null;
    let currentBtcPrice = null;
    let analysisResults = null;
    let autoRefreshInterval = null;
    let countdownInterval = null;
    let nextRefreshTime = null;
    let refreshing = false;
    let lastRefreshTime = null;
    const MANUAL_REFRESH_COOLDOWN = 60000; // 1 minute cooldown for manual refresh
    
    // Check for saved theme preference and apply it
    function applyTheme() {
        if (localStorage.getItem('theme') === 'dark' || 
            (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    
    // Apply theme on page load
    applyTheme();
    
    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    });
    
    // File Upload Event Listeners
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('active');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('active');
    });
    
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('active');
        handleFiles(e.dataTransfer.files);
        // Analysis will be triggered after file is parsed
    });
    
    // Only trigger file input when clicking on drop area but not on its child elements
    dropArea.addEventListener('click', (e) => {
        // Only trigger if the click is directly on the drop area itself,
        // not on any of its children
        if (e.target === dropArea) {
            fileInput.click();
        }
    });
    
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
        // Analysis will be triggered after file is parsed
    });
    
    removeFileBtn.addEventListener('click', () => {
        resetFileUpload();
    });
    
    // No sample data button
    
    // File handling functions
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            showError('Please upload a valid CSV file.');
            return;
        }
        
        currentFile = file;
        fileInfo.classList.add('hidden'); // Hide file info instead of showing it
        hideError();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                csvData = parseCSV(e.target.result);
                // Start analysis only after CSV has been successfully parsed
                analyzeData();
            } catch (error) {
                showError('Error parsing CSV file. Please check the file format.');
                console.error(error);
            }
        };
        reader.onerror = () => {
            showError('Error reading file. Please try again.');
        };
        reader.readAsText(file);
    }
    
    function resetFileUpload() {
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        currentFile = null;
        csvData = null;
        
        // Stop auto-refresh if it's running
        if (autoRefreshToggle.checked) {
            autoRefreshToggle.checked = false;
            stopAutoRefresh();
        }
    }
    
    // CSV Parser
    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        
        // Find header row
        let headerRowIndex = 0;
        while (headerRowIndex < lines.length && !lines[headerRowIndex].includes('Transaction ID')) {
            headerRowIndex++;
        }
        
        if (headerRowIndex >= lines.length) {
            throw new Error('Invalid CSV format. Could not find header row.');
        }
        
        const headers = lines[headerRowIndex].split(',');
        const result = [];
        
        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            // Handle quoted values with commas inside
            const values = [];
            let currentValue = '';
            let inQuotes = false;
            
            for (let char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue); // Add the last value
            
            const rowData = {};
            headers.forEach((header, index) => {
                if (index < values.length) {
                    rowData[header.trim()] = values[index].trim();
                }
            });
            
            result.push(rowData);
        }
        
        return result;
    }
    
    // Analysis functions
    async function analyzeData() {
        if (!csvData) return;
        
        showLoading();
        hideError();
        
        try {
            // Fetch current Bitcoin price
            currentBtcPrice = await fetchCurrentBtcPrice();
            
            if (!currentBtcPrice) {
                throw new Error('Failed to fetch current Bitcoin price. Please try again later.');
            }
            
            // Process and analyze data
            analysisResults = calculatePerformance(csvData, currentBtcPrice.price);
            
            // Render results
            renderResults(analysisResults, currentBtcPrice);
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            showError(error.message);
            console.error(error);
        } finally {
            hideLoading();
        }
    }
    
    async function fetchCurrentBtcPrice() {
        try {
            // Try primary CoinGecko API
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true');
            
            if (!response.ok) {
                throw new Error('Primary API request failed');
            }
            
            const data = await response.json();
            
            return {
                price: data.bitcoin.usd,
                change24h: data.bitcoin.usd_24h_change,
                lastUpdated: new Date(data.bitcoin.last_updated_at * 1000)
            };
        } catch (primaryError) {
            console.error('Error fetching BTC price from primary API:', primaryError);
            
            try {
                // Fallback to alternative API
                const fallbackResponse = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
                
                if (!fallbackResponse.ok) {
                    throw new Error('Fallback API request failed');
                }
                
                const fallbackData = await fallbackResponse.json();
                
                return {
                    price: parseFloat(fallbackData.data.amount),
                    change24h: 0, // Fallback doesn't provide 24h change
                    lastUpdated: new Date()
                };
            } catch (fallbackError) {
                console.error('Error fetching BTC price from fallback API:', fallbackError);
                
                // Last resort - use a hardcoded recent price with warning
                showError('Warning: Using estimated Bitcoin price. Could not connect to price APIs.');
                return {
                    price: 104000, // Fallback price (update this to a recent value)
                    change24h: 0,
                    lastUpdated: new Date(),
                    isEstimated: true
                };
            }
        }
    }
    
    function calculatePerformance(data, currentPrice) {
        // Filter for completed exchange transactions
        const transactions = data.filter(row => 
            row.Status === 'Completed' && 
            row.Currency === 'BTC' && 
            row['Transaction Type'] === 'Exchange'
        );
        
        if (transactions.length === 0) {
            throw new Error('No valid Bitcoin exchange transactions found in the provided CSV.');
        }
        
        // Sort transactions by date (oldest first)
        transactions.sort((a, b) => new Date(a['Time (UTC)']) - new Date(b['Time (UTC)']));
        
        let totalBtc = 0;
        let totalInvested = 0;
        let purchaseHistory = [];
        let cumulativeBtc = 0;
        let bestPurchaseRate = 0;
        let bestPurchaseIndex = 0;
        
        // Process each transaction
        transactions.forEach((tx, index) => {
            const btcAmount = parseFloat(tx.Amount);
            const exchangeRate = parseFloat(tx['Exchange Rate']);
            const usdInvested = btcAmount * exchangeRate;
            
            totalBtc += btcAmount;
            totalInvested += usdInvested;
            cumulativeBtc += btcAmount;
            
            // Track best purchase (lowest price)
            if (index === 0 || exchangeRate < bestPurchaseRate) {
                bestPurchaseRate = exchangeRate;
                bestPurchaseIndex = index;
            }
            
            // Build purchase history for charts
            purchaseHistory.push({
                date: new Date(tx['Time (UTC)']),
                btcAmount,
                exchangeRate,
                usdInvested,
                cumulativeBtc,
                currentValue: btcAmount * currentPrice,
                profitLoss: (btcAmount * currentPrice) - usdInvested,
                roi: ((btcAmount * currentPrice) - usdInvested) / usdInvested * 100
            });
        });
        
        // Calculate current portfolio value
        const currentValue = totalBtc * currentPrice;
        const totalProfit = currentValue - totalInvested;
        const totalRoi = (totalProfit / totalInvested) * 100;
        
        // Calculate average purchase price
        const avgPurchasePrice = totalInvested / totalBtc;
        
        // Calculate DCA metrics
        const firstPurchaseDate = transactions[0]['Time (UTC)'];
        const latestPurchaseDate = transactions[transactions.length - 1]['Time (UTC)'];
        const avgPurchaseAmount = totalInvested / transactions.length;
        
        // Calculate consistency score (based on regularity of purchases)
        let consistencyScore = calculateConsistencyScore(transactions);
        
        // Calculate DCA vs Lump Sum comparison
        const lumpSumBtc = totalInvested / parseFloat(transactions[0]['Exchange Rate']);
        const lumpSumValue = lumpSumBtc * currentPrice;
        const dcaVsLumpSumPerformance = ((currentValue - lumpSumValue) / lumpSumValue) * 100;
        
        return {
            totalBtc,
            totalInvested,
            currentValue,
            totalProfit,
            totalRoi,
            avgPurchasePrice,
            firstPurchaseDate,
            latestPurchaseDate,
            transactions: purchaseHistory,
            transactionCount: transactions.length,
            avgPurchaseAmount,
            bestPurchaseRate,
            bestPurchaseIndex,
            consistencyScore,
            dcaVsLumpSumPerformance
        };
    }
    
    function calculateConsistencyScore(transactions) {
        if (transactions.length <= 1) return 100;
        
        // Calculate time between purchases in days
        const intervals = [];
        for (let i = 1; i < transactions.length; i++) {
            const prevDate = new Date(transactions[i-1]['Time (UTC)']);
            const currDate = new Date(transactions[i]['Time (UTC)']);
            const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
            intervals.push(daysDiff);
        }
        
        // Calculate average interval and standard deviation
        const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        
        const squaredDifferences = intervals.map(interval => Math.pow(interval - avgInterval, 2));
        const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Coefficient of variation (lower is more consistent)
        const cv = stdDev / avgInterval;
        
        // Convert to a 0-100 score (100 being perfectly consistent)
        let score = 100 * Math.exp(-cv);
        
        // Ensure the score is between 0 and 100
        return Math.min(100, Math.max(0, Math.round(score)));
    }
    
    // UI rendering functions
    function renderResults(results, btcPriceData) {
        // Ensure loading indicator is hidden
        loadingIndicator.classList.add('hidden');
        
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('fade-in');
        
        // Format and display the current price banner
        document.getElementById('current-btc-price').textContent = formatCurrency(btcPriceData.price);
        
        if (btcPriceData.isEstimated) {
            document.getElementById('price-update-time').textContent = "ESTIMATED PRICE";
            document.getElementById('price-update-time').classList.add('text-yellow-400');
        } else {
            document.getElementById('price-update-time').textContent = formatDate(btcPriceData.lastUpdated, true);
            document.getElementById('price-update-time').classList.remove('text-yellow-400');
        }
        
        const priceChangeElement = document.getElementById('price-change-24h');
        const priceDirectionIcon = document.getElementById('price-direction');
        
        if (btcPriceData.change24h > 0) {
            priceChangeElement.textContent = `+${btcPriceData.change24h.toFixed(2)}%`;
            priceChangeElement.className = 'text-sm profit';
            priceDirectionIcon.className = 'fas fa-arrow-up ml-1 profit';
        } else {
            priceChangeElement.textContent = `${btcPriceData.change24h.toFixed(2)}%`;
            priceChangeElement.className = 'text-sm loss';
            priceDirectionIcon.className = 'fas fa-arrow-down ml-1 loss';
        }
        
        // Summary cards
        document.getElementById('total-btc').textContent = results.totalBtc.toFixed(8);
        document.getElementById('total-invested').textContent = formatCurrency(results.totalInvested);
        document.getElementById('current-value').textContent = formatCurrency(results.currentValue);
        
        const totalProfitElement = document.getElementById('total-profit');
        const profitPercentageElement = document.getElementById('profit-percentage');
        
        totalProfitElement.textContent = formatCurrency(results.totalProfit);
        profitPercentageElement.textContent = `(${results.totalRoi.toFixed(2)}%)`;
        
        if (results.totalProfit >= 0) {
            totalProfitElement.className = 'text-2xl font-bold profit';
            profitPercentageElement.className = 'ml-2 text-sm profit';
        } else {
            totalProfitElement.className = 'text-2xl font-bold loss';
            profitPercentageElement.className = 'ml-2 text-sm loss';
        }
        
        // Additional metrics
        document.getElementById('avg-purchase-price').textContent = formatCurrency(results.avgPurchasePrice);
        document.getElementById('best-purchase').textContent = formatCurrency(results.bestPurchaseRate);
        document.getElementById('first-purchase-date').textContent = formatDate(new Date(results.firstPurchaseDate));
        document.getElementById('latest-purchase-date').textContent = formatDate(new Date(results.latestPurchaseDate));
        
        document.getElementById('total-purchases').textContent = results.transactionCount;
        document.getElementById('avg-purchase-amount').textContent = formatCurrency(results.avgPurchaseAmount);
        document.getElementById('consistency-score').textContent = `${results.consistencyScore}/100`;
        
        const dcaVsLumpElement = document.getElementById('dca-vs-lump');
        dcaVsLumpElement.textContent = `${results.dcaVsLumpSumPerformance.toFixed(2)}%`;
        
        if (results.dcaVsLumpSumPerformance >= 0) {
            dcaVsLumpElement.className = 'text-xl font-bold profit';
        } else {
            dcaVsLumpElement.className = 'text-xl font-bold loss';
        }
        
        // Render charts
        renderPurchaseHistoryChart(results.transactions);
        renderPortfolioValueChart(results.transactions);
        
        // Render transactions table
        renderTransactionsTable(results.transactions, btcPriceData.price);
    }
    
    function renderPurchaseHistoryChart(transactions) {
        const ctx = document.getElementById('purchase-history-chart').getContext('2d');
        
        // Prepare data for chart
        const labels = transactions.map(tx => tx.date);
        const exchangeRates = transactions.map(tx => tx.exchangeRate);
        const btcAmounts = transactions.map(tx => tx.btcAmount);
        
        // Destroy existing chart if it exists
        if (window.purchaseChart instanceof Chart) {
            window.purchaseChart.destroy();
        }
        
        // Create new chart
        window.purchaseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'BTC Price at Purchase (USD)',
                        data: exchangeRates,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'BTC Amount Purchased',
                        data: btcAmounts,
                        borderColor: 'rgb(245, 158, 11)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'MMM dd, yyyy'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Price (USD)'
                        },
                        grid: {
                            borderDash: [2, 2]
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'BTC Amount'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.datasetIndex === 0) {
                                    label += formatCurrency(context.raw);
                                } else {
                                    label += context.raw.toFixed(8) + ' BTC';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function renderPortfolioValueChart(transactions) {
        const ctx = document.getElementById('portfolio-value-chart').getContext('2d');
        
        // Prepare data for chart
        const labels = transactions.map(tx => tx.date);
        const cumulativeBtc = transactions.map(tx => tx.cumulativeBtc);
        const cumulativeInvestment = [];
        let runningInvestment = 0;
        
        transactions.forEach(tx => {
            runningInvestment += tx.usdInvested;
            cumulativeInvestment.push(runningInvestment);
        });
        
        // Calculate portfolio value at each point using the current BTC price
        const portfolioValues = cumulativeBtc.map(btc => btc * currentBtcPrice.price);
        
        // Destroy existing chart if it exists
        if (window.portfolioChart instanceof Chart) {
            window.portfolioChart.destroy();
        }
        
        // Create new chart
        window.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Portfolio Value (USD)',
                        data: portfolioValues,
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        borderWidth: 2,
                        tension: 0.2
                    },
                    {
                        label: 'Total Investment (USD)',
                        data: cumulativeInvestment,
                        borderColor: 'rgb(107, 114, 128)',
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        borderWidth: 2,
                        tension: 0.2,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'MMM dd, yyyy'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Value (USD)'
                        },
                        grid: {
                            borderDash: [2, 2]
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatCurrency(context.raw);
                                if (context.datasetIndex === 0) {
                                    const investment = cumulativeInvestment[context.dataIndex];
                                    const profit = context.raw - investment;
                                    const roi = (profit / investment) * 100;
                                    return [
                                        label,
                                        `BTC: ${cumulativeBtc[context.dataIndex].toFixed(8)}`,
                                        `Profit/Loss: ${formatCurrency(profit)} (${roi.toFixed(2)}%)`
                                    ];
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function renderTransactionsTable(transactions, currentPrice) {
        const tableBody = document.getElementById('transactions-table-body');
        tableBody.innerHTML = '';
        
        // Sort transactions by date, most recent first
        const sortedTransactions = [...transactions].sort((a, b) => b.date - a.date);
        
        sortedTransactions.forEach(tx => {
            const row = document.createElement('tr');
            
            // Calculate profit/loss for this transaction
            const profitLoss = tx.currentValue - tx.usdInvested;
            const roi = (profitLoss / tx.usdInvested) * 100;
            
            // Create table cells
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDate(tx.date)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${tx.btcAmount.toFixed(8)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.exchangeRate)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.usdInvested)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.currentValue)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${profitLoss >= 0 ? 'profit' : 'loss'}">${formatCurrency(profitLoss)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${roi >= 0 ? 'profit' : 'loss'}">${roi.toFixed(2)}%</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Utility functions
    function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    function formatDate(date, includeTime = false) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
            options.hour12 = true;
        }
        
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }
    
    function showLoading() {
        loadingIndicator.classList.remove('hidden');
        resultsSection.classList.add('hidden');
    }
    
    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }
    
    function showError(message) {
        errorText.textContent = message;
        errorMessageContainer.classList.remove('hidden');
    }
    
    function hideError() {
        errorMessageContainer.classList.add('hidden');
    }
    
    // Handle download report button
    document.getElementById('download-report').addEventListener('click', function() {
        alert('Report download feature will be implemented in a future update.');
    });
    
    // Handle share results button
    document.getElementById('share-results').addEventListener('click', function() {
        alert('Share results feature will be implemented in a future update.');
    });
    
    // Refresh functionality
    
    // Set the refresh rate based on API limits (CoinGecko has a rate limit)
    const REFRESH_INTERVAL = 60000; // 60 seconds (conservative to avoid rate limits)
    
    // Manual refresh button
    manualRefreshBtn.addEventListener('click', function() {
        const now = Date.now();
        if (!refreshing && currentBtcPrice && analysisResults && (!lastRefreshTime || now - lastRefreshTime >= MANUAL_REFRESH_COOLDOWN)) {
            refreshBitcoinPrice();
        }
    });
    
    // Function to update the manual refresh button state
    function updateManualRefreshButton() {
        if (!lastRefreshTime) {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Refresh price data";
            return;
        }
        
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime;
        
        if (timeSinceLastRefresh < MANUAL_REFRESH_COOLDOWN) {
            const secondsRemaining = Math.ceil((MANUAL_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
            manualRefreshBtn.disabled = true;
            manualRefreshBtn.title = `Please wait ${secondsRemaining} seconds before refreshing again`;
        } else {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Refresh price data";
        }
    }
    
    // Update button state every second
    setInterval(updateManualRefreshButton, 1000);
    
    // Auto-refresh toggle
    autoRefreshToggle.addEventListener('change', function() {
        if (this.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    
    function startAutoRefresh() {
        if (!autoRefreshInterval) {
            // Set next refresh time
            nextRefreshTime = Date.now() + REFRESH_INTERVAL;
            
            // Start the main refresh interval
            autoRefreshInterval = setInterval(refreshBitcoinPrice, REFRESH_INTERVAL);
            
            // Start the countdown display
            updateCountdownDisplay();
            countdownInterval = setInterval(updateCountdownDisplay, 1000);
            
            // Also refresh immediately when turned on
            if (currentBtcPrice && analysisResults) {
                refreshBitcoinPrice();
            }
        }
    }
    
    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            refreshIntervalDisplay.textContent = '';
        }
    }
    
    function updateCountdownDisplay() {
        if (!nextRefreshTime) return;
        
        const now = Date.now();
        const timeLeft = Math.max(0, nextRefreshTime - now);
        
        if (timeLeft === 0) {
            // Reset for next interval
            nextRefreshTime = Date.now() + REFRESH_INTERVAL;
        }
        
        const seconds = Math.floor(timeLeft / 1000);
        refreshIntervalDisplay.textContent = `Next refresh in ${seconds}s`;
    }
    
    async function refreshBitcoinPrice() {
        if (refreshing || !csvData) return;
        
        // Indicate refreshing state
        refreshing = true;
        const refreshIcon = manualRefreshBtn.querySelector('i');
        refreshIcon.classList.add('spin-animation');
        
        try {
            // Fetch updated Bitcoin price
            const updatedPrice = await fetchCurrentBtcPrice();
            
            if (!updatedPrice) {
                throw new Error('Failed to fetch updated Bitcoin price');
            }
            
            // Update the global price data
            currentBtcPrice = updatedPrice;
            
            // Update analysis with new price
            updateAnalysisWithNewPrice(currentBtcPrice.price);
            
            // Update the UI with the refreshed data
            renderResults(analysisResults, currentBtcPrice);
            
            // Reset the countdown timer if auto-refresh is enabled
            if (autoRefreshInterval) {
                nextRefreshTime = Date.now() + REFRESH_INTERVAL;
            }
            
            // Update the last refresh time
            lastRefreshTime = Date.now();
            updateManualRefreshButton();
            
        } catch (error) {
            console.error('Price refresh error:', error);
            showError('Error refreshing price data: ' + error.message);
        } finally {
            // Reset refreshing state
            refreshing = false;
            refreshIcon.classList.remove('spin-animation');
        }
    }
    
    function updateAnalysisWithNewPrice(newPrice) {
        if (!analysisResults || !csvData) return;
        
        // Update the current value and profit calculations based on the new price
        const totalBtc = analysisResults.totalBtc;
        const totalInvested = analysisResults.totalInvested;
        
        // Update the portfolio value
        analysisResults.currentValue = totalBtc * newPrice;
        
        // Update profit/loss
        analysisResults.totalProfit = analysisResults.currentValue - totalInvested;
        analysisResults.totalRoi = (analysisResults.totalProfit / totalInvested) * 100;
        
        // Update each transaction's current value, profit/loss, and ROI
        analysisResults.transactions.forEach(tx => {
            tx.currentValue = tx.btcAmount * newPrice;
            tx.profitLoss = tx.currentValue - tx.usdInvested;
            tx.roi = (tx.profitLoss / tx.usdInvested) * 100;
        });
    }
});
