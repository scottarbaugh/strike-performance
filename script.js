// Main JavaScript file for Strike BTC Performance Analyzer

// App version for cache busting
const APP_VERSION = '1.0.7';

// SUPPORTED_CURRENCIES is loaded from currencies.js

// Function to handle cache busting when new versions are deployed
function checkForUpdates() {
    // Check local storage for the last version used
    const lastVersion = localStorage.getItem('app_version');
    
    // If this is a new version, clear any cached data
    if (lastVersion !== APP_VERSION) {
        // We could clear app-specific cache items here if needed
        // but be careful not to remove user preferences like theme
        
        // Update version in localStorage
        localStorage.setItem('app_version', APP_VERSION);
        
        // If it's a refresh (not first load) and the version changed
        if (lastVersion) {
            // Force reload to ensure all assets are fresh
            window.location.reload(true);
        }
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check for updates on page load
    checkForUpdates();
    
    // Display app version in footer
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
        versionElement.textContent = APP_VERSION;
    }
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
    const currencySelector = document.getElementById('currency-selector');
    const excludeOnChainToggle = document.getElementById('exclude-onchain-toggle');
    
    // Donation elements
    const donateButton = document.getElementById('donate-button');
    const donationModal = document.getElementById('donation-modal');
    const closeDonationModal = document.getElementById('close-donation-modal');
    const closeDonationBtn = document.getElementById('close-donation-btn');
    const copyBtcAddressBtn = document.getElementById('copy-btc-address');
    const btcAddress = document.getElementById('btc-address');
    const copySuccess = document.getElementById('copy-success');
    
    // Instructions elements
    const instructionsButton = document.getElementById('instructions-button');
    const instructionsModal = document.getElementById('instructions-modal');
    const closeInstructionsModal = document.getElementById('close-instructions-modal');
    const closeInstructionsBtn = document.getElementById('close-instructions-btn');
    
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
    let includeOnChain = true; // Always include on-chain transactions
    let selectedCurrency = localStorage.getItem('selectedCurrency') || "USD"; // Load saved currency or default to USD
    let currencyRates = {}; // Exchange rates for different currencies
    const MANUAL_REFRESH_COOLDOWN = 120000; // 2 minute cooldown for manual refresh
    const REFRESH_INTERVAL = 120000; // 120 seconds (2 minutes) to match API refresh rate
    
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
    
    // Initialize currency dropdown
    initializeCurrencyDropdown();
    
    // Load auto-refresh toggle value from localStorage if available
    if (autoRefreshToggle) {
        const savedAutoRefresh = localStorage.getItem('autoRefresh') === 'true';
        autoRefreshToggle.checked = savedAutoRefresh;
        
        // Start auto-refresh if enabled
        if (savedAutoRefresh) {
            startAutoRefresh();
        }
    }
    
    // Exclude on-chain toggle functionality
    if (excludeOnChainToggle) {
        excludeOnChainToggle.addEventListener('change', () => {
            includeOnChain = !excludeOnChainToggle.checked;
            
            // Remember preference
            localStorage.setItem('excludeOnChain', excludeOnChainToggle.checked ? 'true' : 'false');
            
            // Re-render transactions table if we have data
            if (cachedTransactions && currentBtcPrice) {
                // Recalculate performance with the updated includeOnChain setting
                if (csvData) {
                    analysisResults = calculatePerformance(csvData, currentBtcPrice.price);
                    renderResults(analysisResults, currentBtcPrice);
                } else {
                    renderTransactionsTable(cachedTransactions, currentBtcPrice.price);
                }
            }
        });
        
        // Load saved preference
        const savedExcludeOnChain = localStorage.getItem('excludeOnChain') === 'true';
        excludeOnChainToggle.checked = savedExcludeOnChain;
        includeOnChain = !savedExcludeOnChain;
    }
    
    // Tooltips are handled via native browser functionality and CSS
    
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
            // Make sure the saved preference is applied before analysis
            if (excludeOnChainToggle) {
                const savedExcludeOnChain = localStorage.getItem('excludeOnChain') === 'true';
                excludeOnChainToggle.checked = savedExcludeOnChain;
                includeOnChain = !savedExcludeOnChain;
            }
            
            // Fetch exchange rates first
            await fetchExchangeRates();
            
            // Fetch current Bitcoin price
            currentBtcPrice = await fetchCurrentBtcPrice();
            
            if (!currentBtcPrice) {
                throw new Error('Failed to fetch current Bitcoin price. Please try again later.');
            }
            
            // Process and analyze data
            analysisResults = calculatePerformance(csvData, currentBtcPrice.price);
            
            // Reset cachedTransactions to null to ensure fresh caching with all transactions
            cachedTransactions = null;
            
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
            // Determine which currency to fetch based on selection
            const vsCurrency = selectedCurrency.toLowerCase();
            
            // Always also request USD price as a fallback
            // Try primary CoinGecko API with selected currency
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vsCurrency},usd&include_24hr_change=true&include_last_updated_at=true`);
            
            if (!response.ok) {
                throw new Error('Primary API request failed');
            }
            
            const data = await response.json();
            
            // First make sure we have the exchange rates for conversion
            if (Object.keys(currencyRates).length === 0) {
                await fetchExchangeRates();
            }
            
            // Check if we got the price in the selected currency directly
            if (data.bitcoin[vsCurrency]) {
                return {
                    price: data.bitcoin[vsCurrency],
                    change24h: data.bitcoin[`${vsCurrency}_24h_change`] || data.bitcoin.usd_24h_change,
                    lastUpdated: new Date(data.bitcoin.last_updated_at * 1000),
                    sourceType: 'direct' // Flag indicating this price came directly from the API
                };
            } else {
                // If not available in the selected currency, use USD price and convert
                const usdPrice = data.bitcoin.usd;
                const convertedPrice = usdPrice * (currencyRates[selectedCurrency] || 1);
                
                return {
                    price: convertedPrice,
                    change24h: data.bitcoin.usd_24h_change,
                    lastUpdated: new Date(data.bitcoin.last_updated_at * 1000),
                    sourceType: 'converted' // Flag indicating this price was converted from USD
                };
            }
        } catch (primaryError) {
            console.error('Error fetching BTC price from primary API:', primaryError);
            
            try {
                // Make sure we have currency rates for conversion
                if (Object.keys(currencyRates).length === 0) {
                    await fetchExchangeRates();
                }
                
                // Fallback to alternative API - try to get the price in the selected currency
                let fallbackUrl = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
                
                // If not USD, try to fetch the price in selected currency directly
                const directCurrencySupported = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(selectedCurrency);
                if (directCurrencySupported) {
                    fallbackUrl = `https://api.coinbase.com/v2/prices/BTC-${selectedCurrency}/spot`;
                }
                
                const fallbackResponse = await fetch(fallbackUrl);
                
                if (!fallbackResponse.ok && directCurrencySupported) {
                    // If the selected currency isn't available directly, fall back to USD and convert
                    const usdFallbackResponse = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
                    if (!usdFallbackResponse.ok) {
                        throw new Error('Fallback API request failed');
                    }
                    
                    const usdFallbackData = await usdFallbackResponse.json();
                    const usdPrice = parseFloat(usdFallbackData.data.amount);
                    
                    // Convert using our exchange rates
                    return {
                        price: usdPrice * (currencyRates[selectedCurrency] || 1),
                        change24h: 0, // Fallback doesn't provide 24h change
                        lastUpdated: new Date(),
                        sourceType: 'converted'
                    };
                } else if (!fallbackResponse.ok) {
                    throw new Error('Fallback API request failed');
                }
                
                const fallbackData = await fallbackResponse.json();
                
                if (!directCurrencySupported) {
                    // We got USD price, need to convert to selected currency
                    const usdPrice = parseFloat(fallbackData.data.amount);
                    return {
                        price: usdPrice * (currencyRates[selectedCurrency] || 1),
                        change24h: 0, // Fallback doesn't provide 24h change
                        lastUpdated: new Date(),
                        sourceType: 'converted'
                    };
                } else {
                    // Direct price in selected currency
                    return {
                        price: parseFloat(fallbackData.data.amount),
                        change24h: 0, // Fallback doesn't provide 24h change
                        lastUpdated: new Date(),
                        sourceType: 'direct'
                    };
                }
            } catch (fallbackError) {
                console.error('Error fetching BTC price from fallback API:', fallbackError);
                
                // Last resort - use a hardcoded recent price with warning
                showError('Warning: Using estimated Bitcoin price. Could not connect to price APIs.');
                
                // Make sure we have exchange rates for conversion
                if (Object.keys(currencyRates).length === 0) {
                    // Fallback rates if we can't fetch exchange rates
                    currencyRates = {
                        USD: 1,
                        EUR: 0.91,
                        GBP: 0.78,
                        AUD: 1.51,
                        CAD: 1.36,
                        JPY: 155.2,
                        INR: 83.52
                    };
                }
                
                // Use hardcoded USD price and convert if needed
                let estimatedPrice = 104000; // Fallback price in USD (update this to a recent value)
                
                // Convert to selected currency if needed
                if (selectedCurrency !== 'USD') {
                    estimatedPrice = estimatedPrice * (currencyRates[selectedCurrency] || 1);
                }
                
                return {
                    price: estimatedPrice,
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
        
        // Store the current BTC price in the selected currency for calculations
        const currentBtcPriceInSelectedCurrency = currentPrice;
        
        // Process each transaction
        transactions.forEach((tx, index) => {
            const btcAmount = parseFloat(tx.Amount);
            const isOnChain = tx['Transaction Type'] === 'On-Chain';
            
            if (isOnChain) {
                // On-chain transactions don't have an exchange rate
                onChainBtc += btcAmount;
                cumulativeBtc += btcAmount;
                
                // Calculate current value for on-chain transactions
                const calculatedOnChainCurrentValue = btcAmount * currentBtcPriceInSelectedCurrency;
                
                // Add to history with special on-chain flag
                purchaseHistory.push({
                    date: new Date(tx['Time (UTC)']),
                    btcAmount,
                    isOnChain: true,
                    exchangeRate: 0, // No exchange rate for on-chain
                    usdInvested: 0, // No USD invested for on-chain
                    cumulativeBtc,
                    currentValue: calculatedOnChainCurrentValue,
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
                
                // Calculate current value based on the BTC amount and current price
                // The btcAmount is the actual amount of BTC, and currentBtcPriceInSelectedCurrency is already in the selected currency
                const calculatedCurrentValue = btcAmount * currentBtcPriceInSelectedCurrency;
                
                // Calculate profit/loss and ROI
                // usdInvested is actually in the selected currency (confusing variable name)
                const calculatedProfitLoss = calculatedCurrentValue - usdInvested;
                const calculatedROI = usdInvested > 0 ? (calculatedProfitLoss / usdInvested) * 100 : 0;
                
                // Build purchase history for charts
                purchaseHistory.push({
                    date: new Date(tx['Time (UTC)']),
                    btcAmount,
                    isOnChain: false,
                    exchangeRate,
                    usdInvested,
                    cumulativeBtc,
                    currentValue: calculatedCurrentValue,
                    profitLoss: calculatedProfitLoss,
                    roi: calculatedROI
                });
            }
        });
        
        // Calculate total BTC with or without on-chain
        const totalBtcWithOnChain = totalBtc + onChainBtc;
        
        // Calculate current portfolio value using the current BTC price in selected currency
        const currentValue = totalBtc * currentBtcPriceInSelectedCurrency;
        const currentValueWithOnChain = totalBtcWithOnChain * currentBtcPriceInSelectedCurrency;
        
        // Always calculate profit/loss based on exchange-only transactions, regardless of toggle state
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
        
        // Update currency display
        updateCurrencyDisplay();
        
        // Format and display the current price banner
        // Format directly without conversion since price is already in selected currency
        document.getElementById('current-btc-price').textContent = formatDirectAmount(btcPriceData.price);
        
        // Make sure currency selector has the right value
        if (currencySelector) {
            currencySelector.value = selectedCurrency;
        }
        
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
        
        // On-chain transactions are now always included
        
        // Summary cards
        const totalBtcElement = document.getElementById('total-btc');
        totalBtcElement.textContent = results.totalBtc.toFixed(8);
        
        // If exclude on-chain is enabled, use larger font size to match total invested
        // Otherwise use default size since it's showing combined value
        if (excludeOnChainToggle && excludeOnChainToggle.checked) {
            totalBtcElement.classList.add('text-4xl');
            totalBtcElement.classList.remove('text-2xl');
        } else {
            totalBtcElement.classList.add('text-2xl');
            totalBtcElement.classList.remove('text-4xl');
        }
        
        // If we have on-chain BTC, show a breakdown
        if (results.onChainBtc > 0 && results.includesOnChain) {
            const exchangeOnly = results.exchangeOnlyBtc.toFixed(8);
            const onChainOnly = results.onChainBtc.toFixed(8);
            
            // Show the breakdown directly instead of using a tooltip
            totalBtcElement.innerHTML = `
                <span class="block ${excludeOnChainToggle && excludeOnChainToggle.checked ? 'text-4xl' : 'text-2xl'} font-bold">${results.totalBtc.toFixed(8)}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div>Exchange: ${exchangeOnly}</div>
                    <div>On-Chain: ${onChainOnly}</div>
                </div>
            `;
        }
        
        // Format the total invested directly without conversion
        const totalInvestedFormatted = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: selectedCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(results.totalInvested);
        document.getElementById('total-invested').textContent = totalInvestedFormatted;
        // Format current value directly - it's already in the selected currency
        // (BTC amount × current BTC price in selected currency)
        const currentValueElement = document.getElementById('current-value');
        currentValueElement.textContent = formatDirectAmount(results.currentValue);
        
        // If exclude on-chain is enabled, use larger font size to match total invested
        // Otherwise use default size since it's showing combined value
        if (excludeOnChainToggle && excludeOnChainToggle.checked) {
            currentValueElement.classList.add('text-4xl');
            currentValueElement.classList.remove('text-2xl');
        } else {
            currentValueElement.classList.add('text-2xl');
            currentValueElement.classList.remove('text-4xl');
        }
        
        // If we have on-chain BTC, show a breakdown for current value
        if (results.onChainBtc > 0 && results.includesOnChain) {
            const exchangeOnlyValue = formatDirectAmount(results.exchangeOnlyValue);
            const onChainValue = formatDirectAmount(results.currentValue - results.exchangeOnlyValue);
            
            // Show the breakdown directly instead of using a tooltip
            currentValueElement.innerHTML = `
                <span class="block ${excludeOnChainToggle && excludeOnChainToggle.checked ? 'text-4xl' : 'text-2xl'} font-bold">${formatDirectAmount(results.currentValue)}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div>Exchange: ${exchangeOnlyValue}</div>
                    <div>On-Chain: ${onChainValue}</div>
                </div>
            `;
        }
        
        const totalProfitElement = document.getElementById('total-profit');
        const profitPercentageElement = document.getElementById('profit-percentage');
        const profitLossCard = document.getElementById('profit-loss-card');
        
        // Always show the exchange-only profit/loss, regardless of on-chain toggle
        // Format directly without conversion
        const totalProfitFormatted = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: selectedCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(results.totalProfit);
        
        totalProfitElement.textContent = totalProfitFormatted;
        profitPercentageElement.textContent = `(${results.totalRoi.toFixed(2)}%)`;
        
        // Apply enhanced styling to make the profit/loss card stand out
        if (results.totalProfit >= 0) {
            // Profit styling
            totalProfitElement.className = 'text-4xl font-bold profit';
            profitPercentageElement.className = 'ml-2 text-lg self-center font-semibold profit';
            profitLossCard.className = 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg shadow-lg p-6 transform transition-all duration-300 hover:scale-105 border-l-4 border-green-500';
        } else {
            // Loss styling
            totalProfitElement.className = 'text-4xl font-bold loss';
            profitPercentageElement.className = 'ml-2 text-lg self-center font-semibold loss';
            profitLossCard.className = 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20 rounded-lg shadow-lg p-6 transform transition-all duration-300 hover:scale-105 border-l-4 border-red-500';
        }
        
        // Additional metrics
        // Format average purchase price and best purchase directly (no conversion)
        const avgPurchasePriceFormatted = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: selectedCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(results.avgPurchasePrice);
        
        const bestPurchaseRateFormatted = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: selectedCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(results.bestPurchaseRate);
        
        document.getElementById('avg-purchase-price').textContent = avgPurchasePriceFormatted;
        
        // Get best purchase date from the transaction at bestPurchaseIndex
        const bestPurchaseDate = results.bestPurchaseIndex >= 0 && results.bestPurchaseIndex < results.transactions.length 
            ? formatDate(results.transactions[results.bestPurchaseIndex].date) 
            : '';
        
        // Set best purchase price with date in parentheses
        document.getElementById('best-purchase').innerHTML = bestPurchaseRateFormatted + 
            (bestPurchaseDate ? ' <span class="text-xs text-gray-500 dark:text-gray-400">on ' + bestPurchaseDate + '</span>' : '');
            
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
        
        // Format average purchase amount directly (no conversion)
        const avgPurchaseAmountFormatted = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: selectedCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(results.avgPurchaseAmount);
        
        document.getElementById('avg-purchase-amount').textContent = avgPurchaseAmountFormatted;
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
        
        // Cache ALL transactions before rendering
        // Important: Make sure we have ALL transactions with ALL properties correctly set
        cachedTransactions = results.transactions;
        
        // Render transactions table
        renderTransactionsTable(results.transactions, btcPriceData.price);
    }
    
    function renderPurchaseHistoryChart(transactions) {
        const ctx = document.getElementById('purchase-history-chart').getContext('2d');
        
        // Separate exchange and on-chain transactions
        const exchangeTxs = transactions.filter(tx => !tx.isOnChain);
        const onChainTxs = transactions.filter(tx => tx.isOnChain);
        
        // Exchange transaction data
        const exchangeLabels = exchangeTxs.map(tx => {
            // Ensure date is properly handled as a Date object
            return tx.date instanceof Date ? tx.date : new Date(tx.date);
        });
        const exchangeRates = exchangeTxs.map(tx => tx.exchangeRate);
        const exchangeBtcAmounts = exchangeTxs.map(tx => tx.btcAmount);
        
        // On-chain transaction data
        const onChainLabels = onChainTxs.map(tx => {
            // Ensure date is properly handled as a Date object
            return tx.date instanceof Date ? tx.date : new Date(tx.date);
        });
        const onChainBtcAmounts = onChainTxs.map(tx => tx.btcAmount);
        
        // Destroy existing chart if it exists
        if (window.purchaseChart instanceof Chart) {
            window.purchaseChart.destroy();
        }
        
        // Find the currency object for proper display
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                          { code: 'USD', symbol: '$' };
                          
        // Create datasets
        const datasets = [
            {
                label: `BTC Price (Exchange) (${currencyObj.code})`,
                data: exchangeTxs.map(tx => ({
                    x: tx.date instanceof Date ? tx.date : new Date(tx.date),
                    y: tx.exchangeRate
                })),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y'
            },
            {
                label: 'BTC Amount (Exchange)',
                data: exchangeTxs.map(tx => ({
                    x: tx.date instanceof Date ? tx.date : new Date(tx.date),
                    y: tx.btcAmount
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
            // Simplify the on-chain data structure to avoid potential issues
            const onChainData = onChainTxs.map(tx => {
                // Ensure we're working with a proper Date object
                const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
                
                return {
                    // Use the date as the x-axis value
                    x: txDate,
                    y: tx.btcAmount,
                    // Store the original date for tooltip access
                    originalDate: txDate,
                    // Pre-format the date for consistent display
                    formattedDate: formatDate(txDate, true)
                };
            });
            
            datasets.push({
                label: 'BTC Amount (On-Chain)', 
                data: onChainData,
                borderColor: 'rgb(16, 185, 129)', // Green color for on-chain
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 0, // No border to prevent connecting lines
                showLine: false, // Don't connect the points with a line
                pointStyle: 'triangle', // Different point style for on-chain
                pointRadius: 8, // Larger point size for visibility
                pointHoverRadius: 10,
                pointBackgroundColor: 'rgb(16, 185, 129)',
                pointBorderColor: 'rgb(16, 185, 129)',
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
                    mode: 'point',
                    intersect: true
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
                            text: `Price (${selectedCurrency})`
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
                        // Basic tooltip behavior - let Chart.js handle defaults
                        mode: 'nearest',
                        intersect: true,
                        // Prioritize on-chain data points when present
                        itemSort: function(a, b) {
                            if (a.dataset.label === 'BTC Amount (On-Chain)') return -1;
                            if (b.dataset.label === 'BTC Amount (On-Chain)') return 1;
                            return 0;
                        },
                        callbacks: {
                            title: function(tooltipItems) {
                                // Customize the title to ensure correct date display
                                const item = tooltipItems[0];
                                
                                // Simple approach: Use the parsed X value which is a timestamp
                                const date = new Date(item.parsed.x);
                                
                                // Add special handling for on-chain points
                                if (item.dataset.label === 'BTC Amount (On-Chain)' && item.raw) {
                                    // Use formattedDate or originalDate if available 
                                    if (item.raw.formattedDate) {
                                        return item.raw.formattedDate;
                                    } else if (item.raw.originalDate) {
                                        return formatDate(item.raw.originalDate, true);
                                    }
                                }
                                
                                // Default fallback
                                return formatDate(date, true);
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                
                                // Find the currency object for proper display
                                const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                                                  { code: 'USD', symbol: '$' };
                                
                                if (context.dataset.label.includes('BTC Price (Exchange)')) {
                                    // Don't convert exchange rate - format directly with the currency symbol
                                    return label + new Intl.NumberFormat('en-US', { 
                                        style: 'currency', 
                                        currency: currencyObj.code,
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }).format(context.parsed.y);
                                } else if (context.dataset.label === 'BTC Amount (On-Chain)') {
                                    // For on-chain transactions, ensure we're using the correct BTC amount
                                    let btcAmount = context.parsed.y;
                                    if (context.raw && typeof context.raw.y === 'number') {
                                        btcAmount = context.raw.y;
                                    }
                                    return `${label}${btcAmount.toFixed(8)} BTC`;
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
        const sortedTransactions = [...transactions].sort((a, b) => {
            // Ensure proper date comparison
            const dateA = a.date instanceof Date ? a.date : new Date(a.date);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date);
            return dateA - dateB;
        });
        
        // Prepare data for chart
        const labels = sortedTransactions.map(tx => {
            // Ensure date is properly handled as a Date object
            return tx.date instanceof Date ? tx.date : new Date(tx.date);
        });
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
        
        // Find the currency object for proper display
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                          { code: 'USD', symbol: '$' };
        
        // Always show investment line
        datasets.push({
            label: `Exchange-Only Investment (${currencyObj.code})`,
            data: labels.map((label, i) => ({
                x: label,
                y: cumulativeInvestment[i],
                // Store extra metadata for tooltip access
                formattedDate: formatDate(label, true)
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
            label: `Exchange-Only Value (${currencyObj.code})`,
            data: labels.map((label, i) => ({
                x: label,
                y: exchangeOnlyValues[i],
                // Store extra metadata for tooltip access
                formattedDate: formatDate(label, true)
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
                label: `Total Value (incl. On-Chain) (${currencyObj.code})`,
                data: labels.map((label, i) => ({
                    x: label,
                    y: portfolioValues[i],
                    // Store extra metadata for tooltip access
                    formattedDate: formatDate(label, true)
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
                    mode: 'point',
                    intersect: true
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
                            text: `Value (${selectedCurrency})`
                        },
                        grid: {
                            borderDash: [2, 2]
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        // Basic tooltip behavior - let Chart.js handle defaults
                        mode: 'nearest',
                        intersect: true,
                        callbacks: {
                            title: function(tooltipItems) {
                                // Customize the title to ensure correct date display
                                const item = tooltipItems[0];
                                
                                // Simple approach: Use the parsed X value which is a timestamp
                                const date = new Date(item.parsed.x);
                                
                                // Default fallback
                                return formatDate(date, true);
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatCurrency(context.parsed.y);
                                
                                // Find the currency object for proper display
                                const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                                                  { code: 'USD', symbol: '$' };
                                
                                // Different tooltip labels based on dataset
                                if (context.dataset.label.includes('Exchange-Only Value')) {
                                    const investment = cumulativeInvestment[context.dataIndex];
                                    const exchangeBtc = exchangeOnlyBtc[context.dataIndex];
                                    const profit = exchangeOnlyValues[context.dataIndex] - investment;
                                    const roi = investment > 0 ? (profit / investment) * 100 : 0;
                                    
                                    // Format the investment and profit directly - both values are already in the selected currency
                                    const formattedInvestment = formatDirectAmount(investment);
                                    const formattedProfit = formatDirectAmount(profit);
                                    
                                    // Calculate ROI directly: (current_value - invested) / invested * 100
                                    // Both current_value and invested are already in the selected currency
                                    const directRoi = (exchangeOnlyValues[context.dataIndex] - investment) / investment * 100;
                                    
                                    return [
                                        label,
                                        `Profit/Loss: ${formattedProfit} (${directRoi.toFixed(2)}%)`
                                    ];
                                }
                                else if (context.dataset.label.includes('Total Value (incl. On-Chain)')) {
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
    
    // Global variables to keep track of current sort state
    let currentSortColumn = 'date';
    let currentSortDirection = 'desc'; // Default sort is descending (newest first)
    let sortListenersInitialized = false; // Flag to track if sort listeners have been initialized
    // Keep track of transactions for re-sorting without full re-renders
    let cachedTransactions = null;
    
    function renderTransactionsTable(transactions, currentPrice) {
        // Always update the cached transactions with the latest transactions
        cachedTransactions = transactions;
        
        // Filter out on-chain transactions if excludeOnChain is enabled
        let displayTransactions = includeOnChain ? 
            cachedTransactions : 
            cachedTransactions.filter(tx => !tx.isOnChain);
        
        // Apply current sort
        const sortedTransactions = sortTransactions([...displayTransactions], currentSortColumn, currentSortDirection);
        
        // Initialize sort listeners only once
        if (!sortListenersInitialized) {
            setupTableSorting();
            sortListenersInitialized = true;
        }
        
        // Update the sort icons to reflect the current sort state
        updateSortIcons(currentSortColumn, currentSortDirection);
        
        // Render the table content
        renderTableRows(sortedTransactions, currentPrice);
    }
    
    function renderTableRows(sortedTransactions, currentPrice) {
        const tableBody = document.getElementById('transactions-table-body');
        tableBody.innerHTML = '';
        
        sortedTransactions.forEach(tx => {
            const row = document.createElement('tr');
            
            // Mark on-chain transactions with a different style
            if (tx.isOnChain) {
                row.classList.add('bg-blue-50', 'dark:bg-blue-900', 'dark:bg-opacity-20');
            }
            
            // Use the pre-calculated values from the transaction data
            const currentValue = tx.currentValue;
            const profitLoss = tx.profitLoss;
            const roi = tx.roi;
            
            // Find the selected currency object for symbol display
            const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                               { code: 'USD', symbol: '$' };
            
            if (tx.isOnChain) {
                // On-chain transactions - use dashes for price at purchase, cost, profit/loss and ROI
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDate(tx.date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${tx.btcAmount.toFixed(8)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 italic">On-Chain Transfer</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDirectAmount(currentValue)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">—</td>
                `;
            } else {
                // Exchange transactions - show all values
                const formattedExchangeRate = new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: currencyObj.code,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(tx.exchangeRate);
                
                const formattedUsdInvested = new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: currencyObj.code,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(tx.usdInvested);
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDate(tx.date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${tx.btcAmount.toFixed(8)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formattedExchangeRate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formattedUsdInvested}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${formatDirectAmount(currentValue)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${profitLoss >= 0 ? 'profit' : 'loss'}">${formatDirectAmount(profitLoss)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${roi >= 0 ? 'profit' : 'loss'}">${roi.toFixed(2)}%</td>
                `;
            }
            
            tableBody.appendChild(row);
        });
    }
    
    function sortTransactions(transactions, column, direction) {
        if (!transactions || transactions.length === 0) return [];
        
        // Create a new array to avoid mutating the original array
        const sortableTransactions = [...transactions];
        
        return sortableTransactions.sort((a, b) => {
            let valueA, valueB;
            
            // Define how to extract values for each column
            switch (column) {
                case 'date':
                    valueA = new Date(a.date).getTime();
                    valueB = new Date(b.date).getTime();
                    break;
                case 'btcAmount':
                    valueA = parseFloat(a.btcAmount) || 0;
                    valueB = parseFloat(b.btcAmount) || 0;
                    break;
                case 'price':
                    // Handle on-chain transactions (which don't have exchange rates)
                    valueA = a.isOnChain ? 0 : (parseFloat(a.exchangeRate) || 0);
                    valueB = b.isOnChain ? 0 : (parseFloat(b.exchangeRate) || 0);
                    break;
                case 'invested':
                    valueA = a.isOnChain ? 0 : (parseFloat(a.usdInvested) || 0);
                    valueB = b.isOnChain ? 0 : (parseFloat(b.usdInvested) || 0);
                    break;
                case 'currentValue':
                    valueA = parseFloat(a.currentValue) || 0;
                    valueB = parseFloat(b.currentValue) || 0;
                    break;
                case 'profitLoss':
                    valueA = a.isOnChain ? 0 : (parseFloat(a.profitLoss) || 0);
                    valueB = b.isOnChain ? 0 : (parseFloat(b.profitLoss) || 0);
                    break;
                case 'roi':
                    valueA = a.isOnChain ? 0 : (parseFloat(a.roi) || 0);
                    valueB = b.isOnChain ? 0 : (parseFloat(b.roi) || 0);
                    break;
                default:
                    // Default to date sort
                    valueA = new Date(a.date).getTime();
                    valueB = new Date(b.date).getTime();
            }
            
            // Apply sort direction
            if (direction === 'asc') {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });
    }
    
    function setupTableSorting() {
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        
        tableHeaders.forEach(header => {
            // Remove any existing event listeners by cloning and replacing the element
            const clone = header.cloneNode(true);
            header.parentNode.replaceChild(clone, header);
            
            clone.addEventListener('click', () => {
                const column = clone.dataset.sort;
                
                // Toggle sort direction if clicking the same column
                if (column === currentSortColumn) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = column;
                    // Default to descending for date, ascending for everything else when first clicked
                    currentSortDirection = column === 'date' ? 'desc' : 'asc';
                }
                
                // Update the icons in the table headers
                updateSortIcons(currentSortColumn, currentSortDirection);
                
                // Only re-sort and re-render rows, not the entire table
                if (cachedTransactions) {
                    // Filter out on-chain transactions if not included
                    const displayTransactions = includeOnChain ? 
                        cachedTransactions : 
                        cachedTransactions.filter(tx => !tx.isOnChain);
                    
                    // Apply the new sort
                    const sortedTransactions = sortTransactions(
                        [...displayTransactions], 
                        currentSortColumn, 
                        currentSortDirection
                    );
                    
                    // Just update the table rows
                    renderTableRows(sortedTransactions);
                }
            });
        });
        
        // Set initial sort icons
        updateSortIcons(currentSortColumn, currentSortDirection);
    }
    
    function updateSortIcons(activeColumn, direction) {
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        
        tableHeaders.forEach(header => {
            const icon = header.querySelector('i');
            if (!icon) return;
            
            const column = header.dataset.sort;
            
            // Reset all icons first
            icon.className = 'fas fa-sort ml-1';
            
            // Update the active column's icon
            if (column === activeColumn) {
                if (direction === 'asc') {
                    icon.className = 'fas fa-sort-up ml-1';
                } else {
                    icon.className = 'fas fa-sort-down ml-1';
                }
            }
        });
    }
    
    // Format a value directly in the selected currency without conversion
    // Used for values that are already in the selected currency
    function formatDirectAmount(value) {
        // Find the selected currency object
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                         { code: 'USD', symbol: '$' };
        
        // Format based on currency code
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: currencyObj.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    function formatDate(date, includeTime = false) {
        // Make sure date is a valid Date object
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            try {
                date = new Date(date);
            } catch (e) {
                return "Invalid Date";
            }
        }
        
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'UTC'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
            options.hour12 = true;
        }
        
        const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);
        
        // For transaction table dates, always include the time (for regular formatDate calls)
        if (!includeTime) {
            const timeOptions = {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
                hour12: true
            };
            const timeString = new Intl.DateTimeFormat('en-US', timeOptions).format(date);
            return `${formattedDate}, ${timeString}`;
        }
        
        return formattedDate;
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
    
    // Currency handling functions
    function initializeCurrencyDropdown() {
        // Clear existing options
        currencySelector.innerHTML = '';
        
        // Add options for each supported currency
        SUPPORTED_CURRENCIES.forEach(currency => {
            const option = document.createElement('option');
            option.value = currency.code;
            option.textContent = `${currency.code} (${currency.symbol})`;
            currencySelector.appendChild(option);
        });
        
        // Set selection based on saved preference or default
        currencySelector.value = selectedCurrency;
        
        // Add event listener for currency change
        currencySelector.addEventListener('change', async () => {
            selectedCurrency = currencySelector.value;
            // Save currency preference to localStorage
            localStorage.setItem('selectedCurrency', selectedCurrency);
            
            // Find the selected currency object
            const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);
            
            // First update the UI currency labels
            updateCurrencyDisplay();
            
            try {
                // Always fetch exchange rates when currency changes
                await fetchExchangeRates();
                
                // Then fetch the bitcoin price in the new currency
                if (csvData && analysisResults) {
                    // Show loading indicator for price update
                    document.getElementById('current-btc-price').innerHTML = '<span class="animate-pulse">Updating...</span>';
                    
                    // Fetch new BTC price and update analysis
                    const updatedPrice = await fetchCurrentBtcPrice();
                    if (updatedPrice) {
                        currentBtcPrice = updatedPrice;
                        
                        // Recalculate analysis with new price
                        // This function handles all the currency conversion internally
                        updateAnalysisWithNewPrice(currentBtcPrice.price);
                        
                        // Re-render results with updated data
                        renderResults(analysisResults, currentBtcPrice);
                    }
                }
            } catch (error) {
                console.error('Error updating currency:', error);
                showError(`Error updating to ${selectedCurrency}: ${error.message}`);
            }
        });
    }
    
    async function fetchExchangeRates() {
        try {
            // Use ExchangeRate-API for currency conversion (free tier)
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rates');
            }
            
            const data = await response.json();
            
            // Store all exchange rates
            currencyRates = data.rates;
            
            return currencyRates;
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            showError('Error fetching exchange rates. Using estimated values.');
            
            // Fallback to some common exchange rates
            currencyRates = {
                USD: 1,
                EUR: 0.9,
                GBP: 0.8,
                AUD: 1.5,
                CAD: 1.35,
                JPY: 110,
                INR: 75
            };
            
            return currencyRates;
        }
    }
    
    function convertCurrency(amountInUSD) {
        // If the selected currency is USD or we don't have rates yet, return as is
        if (selectedCurrency === 'USD' || !currencyRates[selectedCurrency]) {
            return amountInUSD;
        }
        
        // Convert USD amount to selected currency
        return amountInUSD * currencyRates[selectedCurrency];
    }
    
    // This function is intentionally separate from formatDirectAmount
    // Use this when you need to convert from USD to the selected currency
    // Use formatDirectAmount when values are already in the selected currency
    
    function updateCurrencyDisplay() {
        // Find the selected currency object
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                           { code: 'USD', symbol: '$' };
        
        // Update all currency-related elements
        const currencyLabels = document.querySelectorAll('.currency-label');
        currencyLabels.forEach(label => {
            label.textContent = currencyObj.code;
        });
        
        // Update table headers for currency
        const priceHeader = document.querySelector('th:nth-child(3)');
        if (priceHeader) {
            const currencyLabel = priceHeader.querySelector('.currency-label');
            if (currencyLabel) {
                currencyLabel.textContent = `(${currencyObj.code})`;
            }
        }
        
        const investedHeader = document.querySelector('th:nth-child(4)');
        if (investedHeader) {
            const currencyLabel = investedHeader.querySelector('.currency-label');
            if (currencyLabel) {
                currencyLabel.textContent = currencyObj.code;
            }
        }
        
        // Update charts if they exist
        if (window.purchaseChart) {
            window.purchaseChart.options.scales.y.title.text = `Price (${currencyObj.code})`;
            window.purchaseChart.update();
        }
        
        if (window.portfolioChart) {
            window.portfolioChart.options.scales.y.title.text = `Value (${currencyObj.code})`;
            window.portfolioChart.update();
        }
    }
    
    // Override formatCurrency to use the selected currency
    // This is used for values that need to be converted (not for direct CSV values)
    function formatCurrency(value) {
        // Convert the value from USD to selected currency
        // Note: This is only for values derived from the current bitcoin price
        // The exchange rates and invested amounts in the CSV are assumed to be already in the selected currency
        const convertedValue = convertCurrency(value);
        
        // Find the selected currency object
        const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency) || 
                           { code: 'USD', symbol: '$' };
        
        // Format based on currency code
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: currencyObj.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(convertedValue);
    }
    
    // Refresh functionality
    
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
        // If auto-refresh is enabled, always disable the manual refresh button
        if (autoRefreshToggle.checked) {
            manualRefreshBtn.disabled = true;
            
            // Show countdown to next auto-refresh in the button
            if (nextRefreshTime) {
                const now = Date.now();
                const timeToNextRefresh = Math.max(0, nextRefreshTime - now);
                const secondsToNextRefresh = Math.ceil(timeToNextRefresh / 1000);
                
                // Ensure we always show the correct time left (up to full REFRESH_INTERVAL)
                const displaySeconds = Math.min(secondsToNextRefresh, Math.floor(REFRESH_INTERVAL / 1000));
                
                manualRefreshBtn.title = `Auto and manual refreshing is limited to once every two minutes. Auto-refresh in ${displaySeconds}s`;
                manualRefreshBtn.innerHTML = `<i class="fas fa-clock"></i><span>${displaySeconds}s</span>`;
            } else {
                manualRefreshBtn.title = "Auto and manual refreshing is limited to once every two minutes. Auto-refresh is enabled";
                manualRefreshBtn.innerHTML = '<i class="fas fa-clock"></i><span>Auto</span>';
            }
            return;
        }
        
        // For manual refresh mode
        if (!lastRefreshTime) {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Auto and manual refreshing is limited to once every two minutes.";
            manualRefreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh</span>';
            return;
        }
        
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime;
        
        if (timeSinceLastRefresh < MANUAL_REFRESH_COOLDOWN) {
            const secondsRemaining = Math.ceil((MANUAL_REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
            manualRefreshBtn.disabled = true;
            manualRefreshBtn.title = `Please wait ${secondsRemaining} seconds before refreshing again`;
            manualRefreshBtn.innerHTML = `<i class="fas fa-clock"></i><span>${secondsRemaining}s</span>`;
        } else {
            manualRefreshBtn.disabled = false;
            manualRefreshBtn.title = "Auto and manual refreshing is limited to once every two minutes.";
            manualRefreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh</span>';
        }
    }
    
    // Update button state every second
    setInterval(updateManualRefreshButton, 1000);
    
    // Auto-refresh toggle
    autoRefreshToggle.addEventListener('change', function() {
        // Save preference to localStorage
        localStorage.setItem('autoRefresh', this.checked ? 'true' : 'false');
        
        if (this.checked) {
            // Check if manual refresh is available (cooldown period completed)
            const now = Date.now();
            const manualRefreshAvailable = !lastRefreshTime || (now - lastRefreshTime) >= MANUAL_REFRESH_COOLDOWN;
            
            // If manual refresh is available, refresh immediately then start the timer
            if (manualRefreshAvailable && currentBtcPrice && analysisResults) {
                refreshBitcoinPrice();
                // After immediate refresh, start the regular interval
                startAutoRefresh();
            } else {
                // Otherwise just start the timer for the next refresh
                startAutoRefresh();
            }
            
            // Immediately disable manual refresh button when auto-refresh is enabled
            updateManualRefreshButton();
        } else {
            stopAutoRefresh();
            // Update button state immediately
            updateManualRefreshButton();
        }
    });
    
    // On-chain transactions are now always included by default
    
    // Instructions modal functionality
    instructionsButton.addEventListener('click', () => {
        instructionsModal.classList.remove('hidden');
        // Set a small timeout to ensure the modal is rendered before adding the active class
        setTimeout(() => {
            instructionsModal.classList.add('active');
        }, 10);
    });
    
    function closeInstructionsModalFunc() {
        instructionsModal.classList.remove('active');
        // Add a delay before hiding completely to allow for animation
        setTimeout(() => {
            instructionsModal.classList.add('hidden');
        }, 300);
    }
    
    closeInstructionsModal.addEventListener('click', closeInstructionsModalFunc);
    closeInstructionsBtn.addEventListener('click', closeInstructionsModalFunc);
    
    // Close modal when clicking outside the modal content
    instructionsModal.addEventListener('click', (e) => {
        if (e.target === instructionsModal) {
            closeInstructionsModalFunc();
        }
    });
    
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
            // If there's already a manual countdown in progress, use that instead of resetting
            const now = Date.now();
            if (!lastRefreshTime || now - lastRefreshTime >= MANUAL_REFRESH_COOLDOWN) {
                // No manual countdown in progress, set to full interval
                nextRefreshTime = now + REFRESH_INTERVAL;
            } else {
                // There's a manual countdown in progress, calculate remaining time
                const remainingCooldown = MANUAL_REFRESH_COOLDOWN - (now - lastRefreshTime);
                nextRefreshTime = now + remainingCooldown;
            }
            
            // Start the main refresh interval - ensure it's exactly REFRESH_INTERVAL
            autoRefreshInterval = setInterval(refreshBitcoinPrice, REFRESH_INTERVAL);
            
            // Start the countdown display
            updateCountdownDisplay();
            countdownInterval = setInterval(updateCountdownDisplay, 1000);
            
            // Update the button state immediately
            updateManualRefreshButton();
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
            
            // No need to clear text since we're not showing it anymore
        }
    }
    
    function updateCountdownDisplay() {
        if (!nextRefreshTime) return;
        
        const now = Date.now();
        const timeLeft = Math.max(0, nextRefreshTime - now);
        
        if (timeLeft ===  0) {
            // If the timer reached zero, trigger a refresh immediately
            refreshBitcoinPrice();
            // Reset for next interval with exact REFRESH_INTERVAL value to ensure consistency
            nextRefreshTime = Date.now() + REFRESH_INTERVAL;
        }
        
        // No longer displaying countdown text
    }
    
    async function refreshBitcoinPrice() {
        if (refreshing || !csvData) return;
        
        // Indicate refreshing state
        refreshing = true;
        const refreshIcon = manualRefreshBtn.querySelector('i');
        refreshIcon.classList.add('spin-animation');
        
        try {
            // Fetch updated exchange rates
            await fetchExchangeRates();
            
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
            
            // Reset the countdown timer for both manual and auto refresh
            const now = Date.now();
            // Always set to exactly REFRESH_INTERVAL to ensure consistency
            nextRefreshTime = now + REFRESH_INTERVAL;
            
            // Update the last refresh time
            lastRefreshTime = now;
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
        const exchangeOnlyBtc = analysisResults.exchangeOnlyBtc;
        const totalInvested = analysisResults.totalInvested;
        
        // Update the portfolio value - both total and exchange-only
        analysisResults.currentValue = totalBtc * newPrice;
        analysisResults.exchangeOnlyValue = exchangeOnlyBtc * newPrice;
        
        // Update profit/loss - always uses exchange-only transactions
        // These values are already in the selected currency
        // The exchange rates from CSV are in selected currency
        // The current bitcoin price is fetched/converted to selected currency
        analysisResults.totalProfit = analysisResults.exchangeOnlyValue - totalInvested;
        analysisResults.totalRoi = totalInvested > 0 ? (analysisResults.totalProfit / totalInvested) * 100 : 0;
        
        // Update each transaction's current value, profit/loss, and ROI
        analysisResults.transactions.forEach(tx => {
            // Calculate current value for each transaction
            tx.currentValue = tx.btcAmount * newPrice;
            
            // Only calculate profit/loss and ROI for exchange transactions
            if (!tx.isOnChain) {
                tx.profitLoss = tx.currentValue - tx.usdInvested;
                tx.roi = tx.usdInvested > 0 ? (tx.profitLoss / tx.usdInvested) * 100 : 0;
            }
        });
    }
});
