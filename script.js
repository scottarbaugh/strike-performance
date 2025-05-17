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
    const includeOnchainToggle = document.getElementById('include-onchain-toggle');
    
    // Donation elements
    const donateButton = document.getElementById('donate-button');
    const donationModal = document.getElementById('donation-modal');
    const closeDonationModal = document.getElementById('close-donation-modal');
    const closeDonationBtn = document.getElementById('close-donation-btn');
    const copyBtcAddressBtn = document.getElementById('copy-btc-address');
    const btcAddress = document.getElementById('btc-address');
    const copySuccess = document.getElementById('copy-success');
    
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
    let includeOnChain = localStorage.getItem('includeOnChain') === 'true'; // Load from localStorage or default to false
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
            
            // Update the last refresh time and disable refresh button
            lastRefreshTime = Date.now();
            updateManualRefreshButton();
            
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
        const exchangeTransactions = data.filter(row => 
            row.Status === 'Completed' && 
            row.Currency === 'BTC' && 
            row['Transaction Type'] === 'Exchange'
        );
        
        // Filter for completed on-chain transactions
        const onChainTransactions = data.filter(row => 
            row.Status === 'Completed' && 
            row.Currency === 'BTC' && 
            row['Transaction Type'] === 'On-Chain'
        );
        
        // Combine transactions based on the toggle setting
        let transactions = exchangeTransactions;
        if (includeOnChain && onChainTransactions.length > 0) {
            transactions = [...exchangeTransactions, ...onChainTransactions];
        }
        
        if (transactions.length === 0) {
            throw new Error('No valid Bitcoin transactions found in the provided CSV.');
        }
        
        // Sort transactions by date (oldest first)
        transactions.sort((a, b) => new Date(a['Time (UTC)']) - new Date(b['Time (UTC)']));
        
        let totalBtc = 0;
        let totalInvested = 0;
        let purchaseHistory = [];
        let cumulativeBtc = 0;
        let bestPurchaseRate = 0;
        let bestPurchaseIndex = -1;
        let onChainBtc = 0; // Track on-chain BTC separately
        
        // Process each transaction
        transactions.forEach((tx, index) => {
            const btcAmount = parseFloat(tx.Amount);
            const isOnChain = tx['Transaction Type'] === 'On-Chain';
            
            if (isOnChain) {
                // On-chain transactions don't have an exchange rate
                onChainBtc += btcAmount;
                cumulativeBtc += btcAmount;
                
                // Add to history with special on-chain flag
                purchaseHistory.push({
                    date: new Date(tx['Time (UTC)']),
                    btcAmount,
                    isOnChain: true,
                    exchangeRate: 0, // No exchange rate for on-chain
                    usdInvested: 0, // No USD invested for on-chain
                    cumulativeBtc,
                    currentValue: btcAmount * currentPrice,
                    profitLoss: 0, // Can't calculate profit/loss for on-chain
                    roi: 0 // Can't calculate ROI for on-chain
                });
            } else {
                // Regular exchange transaction
                const exchangeRate = parseFloat(tx['Exchange Rate']);
                const usdInvested = btcAmount * exchangeRate;
                
                totalBtc += btcAmount;
                totalInvested += usdInvested;
                cumulativeBtc += btcAmount;
                
                // Track best purchase (lowest price) - only for exchange transactions
                if (bestPurchaseIndex === -1 || exchangeRate < bestPurchaseRate) {
                    bestPurchaseRate = exchangeRate;
                    bestPurchaseIndex = index;
                }
                
                // Build purchase history for charts
                purchaseHistory.push({
                    date: new Date(tx['Time (UTC)']),
                    btcAmount,
                    isOnChain: false,
                    exchangeRate,
                    usdInvested,
                    cumulativeBtc,
                    currentValue: btcAmount * currentPrice,
                    profitLoss: (btcAmount * currentPrice) - usdInvested,
                    roi: ((btcAmount * currentPrice) - usdInvested) / usdInvested * 100
                });
            }
        });
        
        // Calculate total BTC with or without on-chain
        const totalBtcWithOnChain = totalBtc + onChainBtc;
        
        // Calculate current portfolio value
        const currentValue = totalBtc * currentPrice;
        const currentValueWithOnChain = totalBtcWithOnChain * currentPrice;
        
        const totalProfit = currentValue - totalInvested;
        const totalRoi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
        
        // Calculate average purchase price (only for exchange transactions)
        const avgPurchasePrice = totalBtc > 0 ? totalInvested / totalBtc : 0;
        
        // Calculate DCA metrics
        const firstDate = transactions.length > 0 ? transactions[0]['Time (UTC)'] : '';
        const latestDate = transactions.length > 0 ? transactions[transactions.length - 1]['Time (UTC)'] : '';
        const exchangeCount = exchangeTransactions.length;
        const avgPurchaseAmount = exchangeCount > 0 ? totalInvested / exchangeCount : 0;
        
        // Calculate consistency score (based on regularity of purchases)
        // Only use exchange transactions for consistency score
        let consistencyScore = calculateConsistencyScore(exchangeTransactions);
        
        // Calculate DCA vs Lump Sum comparison (only if there are exchange transactions)
        let dcaVsLumpSumPerformance = 0;
        if (exchangeTransactions.length > 0) {
            const lumpSumBtc = totalInvested / parseFloat(exchangeTransactions[0]['Exchange Rate']);
            const lumpSumValue = lumpSumBtc * currentPrice;
            dcaVsLumpSumPerformance = lumpSumValue > 0 ? ((currentValue - lumpSumValue) / lumpSumValue) * 100 : 0;
        }
        
        return {
            totalBtc: totalBtcWithOnChain, // Total including on-chain if enabled
            exchangeOnlyBtc: totalBtc, // BTC from exchange transactions only
            onChainBtc, // BTC from on-chain transactions
            includesOnChain: includeOnChain && onChainTransactions.length > 0,
            totalInvested,
            currentValue: currentValueWithOnChain, // Current value including on-chain if enabled
            exchangeOnlyValue: currentValue, // Value from exchange transactions only
            totalProfit,
            totalRoi,
            avgPurchasePrice,
            firstPurchaseDate: firstDate,
            latestPurchaseDate: latestDate,
            transactions: purchaseHistory,
            transactionCount: transactions.length,
            exchangeTransactionCount: exchangeCount,
            onChainTransactionCount: onChainTransactions.length,
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
        
        // Update the on-chain toggle state
        includeOnchainToggle.checked = results.includesOnChain;
        
        // Summary cards
        document.getElementById('total-btc').textContent = results.totalBtc.toFixed(8);
        
        // If we have on-chain BTC, show a breakdown
        if (results.onChainBtc > 0 && results.includesOnChain) {
            const totalBtcElement = document.getElementById('total-btc');
            const exchangeOnly = results.exchangeOnlyBtc.toFixed(8);
            const onChainOnly = results.onChainBtc.toFixed(8);
            
            // Show the breakdown directly instead of using a tooltip
            totalBtcElement.innerHTML = `
                <span class="block">${results.totalBtc.toFixed(8)}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div>Exchange: ${exchangeOnly}</div>
                    <div>On-Chain: ${onChainOnly}</div>
                </div>
            `;
        }
        
        document.getElementById('total-invested').textContent = formatCurrency(results.totalInvested);
        document.getElementById('current-value').textContent = formatCurrency(results.currentValue);
        
        // If we have on-chain BTC, show a breakdown for current value
        if (results.onChainBtc > 0 && results.includesOnChain) {
            const currentValueElement = document.getElementById('current-value');
            const exchangeOnlyValue = formatCurrency(results.exchangeOnlyValue);
            const onChainValue = formatCurrency(results.currentValue - results.exchangeOnlyValue);
            
            // Show the breakdown directly instead of using a tooltip
            currentValueElement.innerHTML = `
                <span class="block">${formatCurrency(results.currentValue)}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div>Exchange: ${exchangeOnlyValue}</div>
                    <div>On-Chain: ${onChainValue}</div>
                </div>
            `;
        }
        
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
        
        // Show transaction breakdown if we have on-chain transactions
        if (results.onChainTransactionCount > 0) {
            const totalLabel = results.includesOnChain ? 
                `${results.transactionCount} (${results.exchangeTransactionCount} Exchange, ${results.onChainTransactionCount} On-Chain)` :
                `${results.exchangeTransactionCount} (${results.onChainTransactionCount} On-Chain excluded)`;
            
            document.getElementById('total-purchases').textContent = totalLabel;
        } else {
            document.getElementById('total-purchases').textContent = results.transactionCount;
        }
        
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
        
        // Separate exchange and on-chain transactions
        const exchangeTxs = transactions.filter(tx => !tx.isOnChain);
        const onChainTxs = transactions.filter(tx => tx.isOnChain);
        
        // Exchange transaction data
        const exchangeLabels = exchangeTxs.map(tx => tx.date);
        const exchangeRates = exchangeTxs.map(tx => tx.exchangeRate);
        const exchangeBtcAmounts = exchangeTxs.map(tx => tx.btcAmount);
        
        // On-chain transaction data
        const onChainLabels = onChainTxs.map(tx => tx.date);
        const onChainBtcAmounts = onChainTxs.map(tx => tx.btcAmount);
        
        // Destroy existing chart if it exists
        if (window.purchaseChart instanceof Chart) {
            window.purchaseChart.destroy();
        }
        
        // Create datasets
        const datasets = [
            {
                label: 'BTC Price at Purchase (USD)',
                data: exchangeLabels.map((label, i) => ({
                    x: label,
                    y: exchangeRates[i]
                })),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y'
            },
            {
                label: 'BTC Amount (Exchange)',
                data: exchangeLabels.map((label, i) => ({
                    x: label,
                    y: exchangeBtcAmounts[i]
                })),
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.2,
                yAxisID: 'y1'
            }
        ];
        
        // Add on-chain transactions dataset if we have any
        if (onChainTxs.length > 0 && includeOnChain) {
            datasets.push({
                label: 'BTC Amount (On-Chain)',
                data: onChainLabels.map((label, i) => ({
                    x: label,
                    y: onChainBtcAmounts[i]
                })),
                borderColor: 'rgb(16, 185, 129)', // Green color for on-chain
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointStyle: 'triangle', // Different point style for on-chain
                pointRadius: 6,
                tension: 0.2,
                yAxisID: 'y1'
            });
        }
        
        // Create new chart
        window.purchaseChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
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
                                
                                if (context.dataset.label === 'BTC Price at Purchase (USD)') {
                                    return label + formatCurrency(context.parsed.y);
                                } else if (context.dataset.label === 'BTC Amount (On-Chain)') {
                                    return label + context.parsed.y.toFixed(8) + ' BTC (On-Chain)';
                                } else {
                                    return label + context.parsed.y.toFixed(8) + ' BTC';
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    
    function renderPortfolioValueChart(transactions) {
        const ctx = document.getElementById('portfolio-value-chart').getContext('2d');
        
        // Separate exchange and on-chain transactions for visualization
        const exchangeTxs = transactions.filter(tx => !tx.isOnChain);
        const onChainTxs = transactions.filter(tx => tx.isOnChain);
        
        // Combined transactions (sorted by date)
        const sortedTransactions = [...transactions].sort((a, b) => a.date - b.date);
        
        // Prepare data for chart
        const labels = sortedTransactions.map(tx => tx.date);
        const cumulativeBtc = sortedTransactions.map(tx => tx.cumulativeBtc);
        
        // Calculate cumulative exchange-only BTC and investment
        let exchangeOnlyBtc = [];
        let cumulativeInvestment = [];
        let runningExchangeBtc = 0;
        let runningInvestment = 0;
        
        // We need to rebuild these values to ensure proper chronological order
        sortedTransactions.forEach(tx => {
            if (!tx.isOnChain) {
                runningExchangeBtc += tx.btcAmount;
                runningInvestment += tx.usdInvested;
            }
            exchangeOnlyBtc.push(runningExchangeBtc);
            cumulativeInvestment.push(runningInvestment);
        });
        
        // Calculate portfolio values at each point using the current BTC price
        const portfolioValues = cumulativeBtc.map(btc => btc * currentBtcPrice.price);
        const exchangeOnlyValues = exchangeOnlyBtc.map(btc => btc * currentBtcPrice.price);
        
        // Calculate on-chain-only values
        const onChainValues = portfolioValues.map((total, i) => includeOnChain ? total - exchangeOnlyValues[i] : 0);
        
        // Destroy existing chart if it exists
        if (window.portfolioChart instanceof Chart) {
            window.portfolioChart.destroy();
        }
        
        // Determine what datasets to show based on whether we include on-chain
        const datasets = [];
        
        // Always show investment line
        datasets.push({
            label: 'Total Investment (USD)',
            data: labels.map((label, i) => ({
                x: label,
                y: cumulativeInvestment[i]
            })),
            borderColor: 'rgb(107, 114, 128)',
            backgroundColor: 'rgba(107, 114, 128, 0.1)',
            borderWidth: 2,
            tension: 0.2,
            borderDash: [5, 5],
            order: 3 // Draw behind other lines
        });
        
        // Always show exchange-only value line
        datasets.push({
            label: 'Exchange-Only Value (USD)',
            data: labels.map((label, i) => ({
                x: label,
                y: exchangeOnlyValues[i]
            })),
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            borderWidth: 2,
            tension: 0.2,
            order: 2
        });
        
        // Show on-chain value if we have any and it's enabled
        if (onChainTxs.length > 0 && includeOnChain) {
            datasets.push({
                label: 'On-Chain Value (USD)',
                data: labels.map((label, i) => ({
                    x: label,
                    y: portfolioValues[i]
                })),
                borderColor: 'rgb(79, 70, 229)', // Indigo for on-chain total
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                tension: 0.2,
                fill: false,
                order: 1
            });
        }
        
        // Create new chart
        window.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
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
                                label += formatCurrency(context.parsed.y);
                                
                                // Different tooltip labels based on dataset
                                if (context.dataset.label === 'Exchange-Only Value (USD)') {
                                    const investment = cumulativeInvestment[context.dataIndex];
                                    const exchangeBtc = exchangeOnlyBtc[context.dataIndex];
                                    const profit = exchangeOnlyValues[context.dataIndex] - investment;
                                    const roi = investment > 0 ? (profit / investment) * 100 : 0;
                                    
                                    return [
                                        label,
                                        `Exchange BTC: ${exchangeBtc.toFixed(8)}`,
                                        `Profit/Loss: ${formatCurrency(profit)} (${roi.toFixed(2)}%)`
                                    ];
                                }
                                else if (context.dataset.label === 'On-Chain Value (USD)') {
                                    const totalBtc = cumulativeBtc[context.dataIndex];
                                    const exchangeBtc = exchangeOnlyBtc[context.dataIndex];
                                    const onChainBtc = totalBtc - exchangeBtc;
                                    
                                    return [
                                        label,
                                        `Total BTC: ${totalBtc.toFixed(8)}`,
                                        `Exchange: ${exchangeBtc.toFixed(8)} BTC | On-Chain: ${onChainBtc.toFixed(8)} BTC`
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
        
        // Filter out on-chain transactions if not included
        let displayTransactions = includeOnChain ? transactions : transactions.filter(tx => !tx.isOnChain);
        
        // Sort transactions by date, most recent first
        const sortedTransactions = [...displayTransactions].sort((a, b) => b.date - a.date);
        
        sortedTransactions.forEach(tx => {
            const row = document.createElement('tr');
            
            // Mark on-chain transactions with a different style
            if (tx.isOnChain) {
                row.classList.add('bg-blue-50', 'dark:bg-blue-900', 'dark:bg-opacity-20');
            }
            
            // Calculate profit/loss for this transaction (not applicable for on-chain)
            const profitLoss = tx.isOnChain ? 0 : tx.currentValue - tx.usdInvested;
            const roi = tx.isOnChain ? 0 : (profitLoss / tx.usdInvested) * 100;
            
            // Create table cells with special handling for on-chain transactions
            if (tx.isOnChain) {
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDate(tx.date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${tx.btcAmount.toFixed(8)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 italic">On-Chain Transfer</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.currentValue)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                `;
            } else {
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDate(tx.date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${tx.btcAmount.toFixed(8)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.exchangeRate)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.usdInvested)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatCurrency(tx.currentValue)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${profitLoss >= 0 ? 'profit' : 'loss'}">${formatCurrency(profitLoss)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${roi >= 0 ? 'profit' : 'loss'}">${roi.toFixed(2)}%</td>
                `;
            }
            
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
    
    // Refresh functionality
    
    // Set the refresh rate based on API limits (CoinGecko has a rate limit)
    const REFRESH_INTERVAL = 60000; // 60 seconds (conservative to avoid rate limits)
    
    // Manual refresh button
    manualRefreshBtn.addEventListener('click', function() {
        const now = Date.now();
        if (!refreshing && currentBtcPrice && analysisResults && (!lastRefreshTime || now - lastRefreshTime >= MANUAL_REFRESH_COOLDOWN)) {
            refreshBitcoinPrice();
        } else if (lastRefreshTime && now - lastRefreshTime < MANUAL_REFRESH_COOLDOWN) {
            const secondsRemaining = Math.ceil((MANUAL_REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
            manualRefreshBtn.title = `Please wait ${secondsRemaining} seconds before refreshing again`;
        }
    });
    
    // Function to update the manual refresh button state
    function updateManualRefreshButton() {
        if (!lastRefreshTime) {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Refresh price data";
            manualRefreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
            return;
        }
        
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime;
        
        if (timeSinceLastRefresh < MANUAL_REFRESH_COOLDOWN) {
            const secondsRemaining = Math.ceil((MANUAL_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
            manualRefreshBtn.disabled = true;
            manualRefreshBtn.title = `Please wait ${secondsRemaining} seconds before refreshing again`;
            manualRefreshBtn.innerHTML = `<i class="fas fa-clock mr-1"></i> Wait ${secondsRemaining}s`;
        } else {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Refresh price data";
            manualRefreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
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
    
    // On-chain toggle
    includeOnchainToggle.addEventListener('change', function() {
        includeOnChain = this.checked;
        // Save preference to localStorage
        localStorage.setItem('includeOnChain', includeOnChain);
        // If we have CSV data, re-analyze with the new setting
        if (csvData && currentBtcPrice) {
            // Need to modify analysis flow to avoid auto-scrolling
            showLoading();
            hideError();
            
            try {
                // Process and analyze data with current price
                analysisResults = calculatePerformance(csvData, currentBtcPrice.price);
                
                // Render results without scrolling
                renderResults(analysisResults, currentBtcPrice);
                
                // Update the last refresh time and disable refresh button
                lastRefreshTime = Date.now();
                updateManualRefreshButton();
                
            } catch (error) {
                showError(error.message);
                console.error(error);
            } finally {
                hideLoading();
            }
        }
    });
    
    // Initialize toggle state from localStorage
    includeOnchainToggle.checked = includeOnChain;
    
    // Donation functionality
    donateButton.addEventListener('click', () => {
        donationModal.classList.remove('hidden');
        // Set a small timeout to ensure the modal is rendered before adding the active class
        setTimeout(() => {
            donationModal.classList.add('active');
        }, 10);
    });
    
    function closeDonationModalFunc() {
        donationModal.classList.remove('active');
        // Add a delay before hiding completely to allow for animation
        setTimeout(() => {
            donationModal.classList.add('hidden');
        }, 300);
        
        // Hide copy success message if visible
        copySuccess.classList.add('hidden');
    }
    
    closeDonationModal.addEventListener('click', closeDonationModalFunc);
    closeDonationBtn.addEventListener('click', closeDonationModalFunc);
    
    // Close modal when clicking outside the modal content
    donationModal.addEventListener('click', (e) => {
        if (e.target === donationModal) {
            closeDonationModalFunc();
        }
    });
    
    // Copy Bitcoin address to clipboard
    copyBtcAddressBtn.addEventListener('click', async () => {
        const address = btcAddress.textContent.trim();
        
        try {
            await navigator.clipboard.writeText(address);
            copySuccess.classList.remove('hidden');
            
            // Hide the success message after 3 seconds
            setTimeout(() => {
                copySuccess.classList.add('hidden');
            }, 3000);
        } catch (err) {
            console.error('Failed to copy address: ', err);
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
