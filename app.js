
class GoldDashboard {
    constructor() {
        // Configuration for decimal precision
        this.config = {
            goldDecimalPlaces: 7,    // Up to 0.0000001 grams
            currencyDecimalPlaces: 2, // 2 decimal places for money
            rateDecimalPlaces: 2,     // 2 decimal places for gold rate
            maxDecimalDigits: 15      // Maximum safe decimal digits
        };
        
        // Initialize data structure
        this.data = {
            config: {
                passwordHash: null,
                currency: '₹',
                defaultProvider: 'SafeGold',
                decimalSettings: this.config
            },
            user: {
                currentGoldRate: 6500.00,
                lastUpdated: new Date().toISOString()
            },
            transactions: []
        };
        
        this.charts = {};
        this.isAuthenticated = false;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.checkAuth();
        
        if (this.isAuthenticated) {
            this.loadData();
            this.showDashboard();
            this.initializeChart();
            this.updateDashboard();
        }
    }
    
    // ===== DECIMAL PRECISION HANDLING =====
    
    // Parse any number format (including scientific notation)
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        
        // Convert to string and clean
        let str = value.toString().trim().replace(/,/g, '');
        
        // Handle scientific notation
        if (str.includes('e') || str.includes('E')) {
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        }
        
        // Handle fractions
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 2) {
                const numerator = parseFloat(parts[0]);
                const denominator = parseFloat(parts[1]);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    return numerator / denominator;
                }
            }
        }
        
        // Regular decimal parsing
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }
    
    // Format number with specified decimal places
    formatNumber(value, decimalPlaces, options = {}) {
        const num = this.parseNumber(value);
        
        if (isNaN(num)) {
            return options.zeroValue || '0'.padEnd(decimalPlaces + 2, '0');
        }
        
        // Handle very small numbers
        if (Math.abs(num) < Math.pow(10, -decimalPlaces)) {
            // Use scientific notation for extremely small values
            if (Math.abs(num) < 1e-10) {
                return num.toExponential(6);
            }
            
            // Show full precision for micro-values
            const fixed = num.toFixed(decimalPlaces);
            // Remove unnecessary trailing zeros
            return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        }
        
        // Regular formatting
        let formatted;
        if (decimalPlaces === 0) {
            formatted = Math.round(num).toString();
        } else {
            formatted = num.toFixed(decimalPlaces);
            // Remove trailing zeros for decimal places > 2
            if (decimalPlaces > 2) {
                formatted = formatted.replace(/(\.\d*?)0+$/, '$1');
                if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
            }
        }
        
        return formatted;
    }
    
    // Format gold weight (7 decimal places)
    formatGold(grams) {
        const num = this.parseNumber(grams);
        
        if (num === 0) return '0.0000000';
        
        // For values less than 0.0000001, use scientific notation
        if (Math.abs(num) < 0.0000001) {
            return num.toExponential(7);
        }
        
        // Format with 7 decimal places
        let formatted = num.toFixed(7);
        
        // Remove trailing zeros but keep at least 7 decimal places for very small values
        if (num < 0.001) {
            // Keep all decimal places for micro-values
            return formatted;
        }
        
        // For larger values, remove unnecessary zeros
        formatted = formatted.replace(/(\.\d*?)0+$/, '$1');
        if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
        
        // Ensure we have at least 3 decimal places
        const decimalPart = formatted.includes('.') ? formatted.split('.')[1] : '';
        if (decimalPart.length < 3 && num > 0) {
            formatted = num.toFixed(3);
        }
        
        return formatted;
    }
    
    // Format currency (2 decimal places)
    formatCurrency(amount) {
        const num = this.parseNumber(amount);
        
        if (num === 0) return '₹0.00';
        
        // Handle very small currency values
        if (Math.abs(num) < 0.01) {
            if (Math.abs(num) < 0.0001) {
                return `₹${num.toExponential(4)}`;
            }
            return `₹${num.toFixed(4)}`;
        }
        
        // Regular formatting with Indian number system
        return `₹${num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
    
    // Format rate (2 decimal places)
    formatRate(rate) {
        return this.formatNumber(rate, 2);
    }
    
    // Safe arithmetic operations to avoid floating point errors
    safeAdd(a, b) {
        const precision = Math.pow(10, 10);
        return (Math.round(a * precision) + Math.round(b * precision)) / precision;
    }
    
    safeMultiply(a, b) {
        const precision = Math.pow(10, 10);
        return (Math.round(a * precision) * Math.round(b * precision)) / (precision * precision);
    }
    
    safeDivide(a, b) {
        if (b === 0) return 0;
        const precision = Math.pow(10, 10);
        return (Math.round(a * precision) / Math.round(b * precision));
    }
    
    // ===== AUTHENTICATION =====
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    checkAuth() {
        const savedHash = localStorage.getItem('goldfolio_password_hash');
        const session = sessionStorage.getItem('goldfolio_session');
        
        if (session === 'active') {
            this.isAuthenticated = true;
        }
    }
    
    async handleLogin(password) {
        try {
            const hash = await this.hashPassword(password);
            const savedHash = localStorage.getItem('goldfolio_password_hash');
            
            if (!savedHash) {
                // First time - set password
                localStorage.setItem('goldfolio_password_hash', hash);
                this.saveData();
                sessionStorage.setItem('goldfolio_session', 'active');
                this.isAuthenticated = true;
                this.showDashboard();
            } else if (hash === savedHash) {
                // Correct password
                sessionStorage.setItem('goldfolio_session', 'active');
                this.isAuthenticated = true;
                this.loadData();
                this.showDashboard();
                this.initializeChart();
                this.updateDashboard();
            } else {
                alert('Incorrect password!');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Error during login');
        }
    }
    
    logout() {
        sessionStorage.removeItem('goldfolio_session');
        this.isAuthenticated = false;
        this.showLogin();
    }
    
    // ===== DATA MANAGEMENT =====
    loadData() {
        try {
            const savedData = localStorage.getItem('goldfolio_data');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                
                // Parse all transaction values with proper decimal handling
                parsed.transactions = parsed.transactions.map(txn => ({
                    ...txn,
                    ratePerGram: this.parseNumber(txn.ratePerGram),
                    goldWeightGram: this.parseNumber(txn.goldWeightGram),
                    goldValue: this.parseNumber(txn.goldValue),
                    gst: this.parseNumber(txn.gst),
                    totalAmountPaid: this.parseNumber(txn.totalAmountPaid)
                }));
                
                this.data = { ...this.data, ...parsed };
                document.getElementById('gold-rate-input').value = this.formatRate(this.data.user.currentGoldRate);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    
    saveData() {
        localStorage.setItem('goldfolio_data', JSON.stringify(this.data));
    }
    
    // ===== CALCULATIONS =====
    calculateMetrics() {
        const transactions = this.data.transactions;
        const currentRate = this.parseNumber(this.data.user.currentGoldRate);
        
        let totalGold = 0;
        let totalInvested = 0;
        let totalGST = 0;
        
        // Use safe arithmetic for accumulation
        transactions.forEach(txn => {
            totalGold = this.safeAdd(totalGold, txn.goldWeightGram);
            totalInvested = this.safeAdd(totalInvested, txn.totalAmountPaid);
            totalGST = this.safeAdd(totalGST, txn.gst);
        });
        
        const currentValue = this.safeMultiply(totalGold, currentRate);
        const profitLoss = currentValue - totalInvested;
        const profitLossPercent = totalInvested > 0 ? 
            (profitLoss / totalInvested) * 100 : 0;
        
        const averageBuyPrice = totalGold > 0 ? 
            this.safeDivide(totalInvested, totalGold) : 0;
        
        return {
            totalGold,
            totalInvested,
            currentValue,
            profitLoss,
            profitLossPercent,
            totalGST,
            averageBuyPrice,
            transactionCount: transactions.length
        };
    }
    
    // ===== UI MANAGEMENT =====
    showDashboard() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('dashboard').classList.add('active');
    }
    
    showLogin() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('dashboard').classList.remove('active');
    }
    
    showTransactionModal(transaction = null) {
        const modal = document.getElementById('transaction-modal');
        modal.classList.add('active');
        
        const form = document.getElementById('transaction-form');
        const modalTitle = document.getElementById('modal-title');
        const deleteBtn = document.getElementById('delete-transaction');
        
        // Set current rate hint
        document.getElementById('current-rate-hint').textContent = 
            this.formatRate(this.data.user.currentGoldRate);
        
        if (transaction) {
            // Edit mode
            modalTitle.textContent = 'Edit Transaction';
            deleteBtn.style.display = 'block';
            form.dataset.editingId = transaction.id;
            
            document.getElementById('transaction-id').value = transaction.id;
            document.getElementById('txn-date').value = transaction.date;
            document.getElementById('txn-time').value = transaction.time || '12:00';
            document.getElementById('txn-provider').value = transaction.provider;
            document.getElementById('txn-payment').value = transaction.paymentMode || 'UPI';
            document.getElementById('txn-rate').value = this.formatRate(transaction.ratePerGram);
            document.getElementById('txn-weight').value = this.formatGold(transaction.goldWeightGram);
            document.getElementById('txn-gst').value = this.formatRate(transaction.gst);
            document.getElementById('txn-total').value = this.formatRate(transaction.totalAmountPaid);
        } else {
            // Add mode
            modalTitle.textContent = 'Add Gold Purchase';
            deleteBtn.style.display = 'none';
            delete form.dataset.editingId;
            
            form.reset();
            
            // Set default values
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const time = now.toTimeString().slice(0, 5);
            
            document.getElementById('txn-date').value = today;
            document.getElementById('txn-time').value = time;
            document.getElementById('txn-provider').value = this.data.config.defaultProvider;
            document.getElementById('txn-payment').value = 'UPI';
            document.getElementById('txn-rate').value = this.formatRate(this.data.user.currentGoldRate);
            
            // Clear calculation fields
            document.getElementById('txn-weight').value = '';
            document.getElementById('txn-gst').value = '';
            document.getElementById('txn-total').value = '';
        }
        
        // Update calculation preview
        this.updateCalculationPreview();
    }
    
    closeModal() {
        document.getElementById('transaction-modal').classList.remove('active');
    }
    
    updateDashboard() {
        const metrics = this.calculateMetrics();
        
        // Update cards with proper formatting
        document.getElementById('total-gold').textContent = this.formatGold(metrics.totalGold);
        document.getElementById('total-invested').textContent = this.formatCurrency(metrics.totalInvested);
        document.getElementById('current-value').textContent = this.formatCurrency(metrics.currentValue);
        document.getElementById('current-rate').textContent = this.formatRate(this.data.user.currentGoldRate);
        
        // Update transaction count
        document.getElementById('transaction-count').textContent = 
            `${metrics.transactionCount} transaction${metrics.transactionCount !== 1 ? 's' : ''}`;
        
        // Update profit/loss with color coding
        const profitLossElem = document.getElementById('profit-loss');
        const profitPercentElem = document.getElementById('profit-percent');
        const profitHint = document.getElementById('profit-hint');
        
        if (metrics.profitLoss >= 0) {
            profitLossElem.textContent = this.formatCurrency(metrics.profitLoss);
            profitLossElem.className = 'card-value positive';
            profitPercentElem.textContent = `+${metrics.profitLossPercent.toFixed(2)}%`;
            profitPercentElem.className = 'card-subtext positive';
            profitHint.textContent = '';
        } else {
            profitLossElem.textContent = `-${this.formatCurrency(Math.abs(metrics.profitLoss))}`;
            profitLossElem.className = 'card-value negative';
            profitPercentElem.textContent = `${metrics.profitLossPercent.toFixed(2)}%`;
            profitPercentElem.className = 'card-subtext negative';
            profitHint.textContent = '';
        }
        
        // Update gold hint for very small amounts
        const goldHint = document.getElementById('gold-hint');
        if (metrics.totalGold > 0 && metrics.totalGold < 0.001) {
            goldHint.textContent = `≈ ${this.formatGold(metrics.totalGold * 1000)} milligrams`;
            goldHint.className = 'card-hint warning-text';
        } else {
            goldHint.textContent = '';
        }
        
        // Show/hide empty state
        const emptyState = document.getElementById('empty-state');
        const transactionsList = document.getElementById('transactions-list');
        
        if (metrics.transactionCount === 0) {
            emptyState.style.display = 'flex';
            transactionsList.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            transactionsList.style.display = 'block';
            this.updateTransactionsList();
        }
        
        // Update stats summary
        document.getElementById('total-weight').textContent = `${this.formatGold(metrics.totalGold)}g`;
        document.getElementById('avg-rate').textContent = `₹${this.formatRate(metrics.averageBuyPrice)}/g`;
        
        // Update chart
        this.updateChart();
    }
    
    updateCalculationPreview() {
        const rate = this.parseNumber(document.getElementById('txn-rate').value);
        const weight = this.parseNumber(document.getElementById('txn-weight').value);
        
        if (rate <= 0 || weight <= 0) {
            document.getElementById('calc-gold-value').textContent = '₹0.00';
            document.getElementById('calc-gst').textContent = '₹0.00';
            document.getElementById('calc-total').textContent = '₹0.00';
            return;
        }
        
        const goldValue = this.safeMultiply(rate, weight);
        const gst = this.safeMultiply(goldValue, 0.03); // 3% GST
        const total = this.safeAdd(goldValue, gst);
        
        document.getElementById('calc-gold-value').textContent = this.formatCurrency(goldValue);
        document.getElementById('calc-gst').textContent = this.formatCurrency(gst);
        document.getElementById('calc-total').textContent = this.formatCurrency(total);
        
        // Auto-fill GST and total if empty or zero
        const gstInput = document.getElementById('txn-gst');
        const totalInput = document.getElementById('txn-total');
        
        const currentGst = this.parseNumber(gstInput.value);
        const currentTotal = this.parseNumber(totalInput.value);
        
        if (!currentGst || currentGst === 0) {
            gstInput.value = this.formatRate(gst);
        }
        if (!currentTotal || currentTotal === 0) {
            totalInput.value = this.formatRate(total);
        }
    }
    
    updateTransactionsList() {
        const container = document.getElementById('transactions-list');
        const providerFilter = document.getElementById('filter-provider').value;
        const sortBy = document.getElementById('sort-transactions').value;
        
        let transactions = [...this.data.transactions];
        
        // Apply provider filter
        if (providerFilter !== 'all') {
            transactions = transactions.filter(t => t.provider === providerFilter);
        }
        
        // Apply sorting
        switch (sortBy) {
            case 'date-asc':
                transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'weight-desc':
                transactions.sort((a, b) => b.goldWeightGram - a.goldWeightGram);
                break;
            case 'weight-asc':
                transactions.sort((a, b) => a.goldWeightGram - b.goldWeightGram);
                break;
            case 'rate-desc':
                transactions.sort((a, b) => b.ratePerGram - a.ratePerGram);
                break;
            case 'rate-asc':
                transactions.sort((a, b) => a.ratePerGram - b.ratePerGram);
                break;
            case 'date-desc':
            default:
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Add transactions
        transactions.forEach(txn => {
            const date = new Date(txn.date);
            const day = date.getDate();
            const month = date.toLocaleString('default', { month: 'short' });
            
            // Determine if this is a micro-transaction
            const isMicro = txn.goldWeightGram < 0.001;
            const weightClass = isMicro ? 'very-small' : '';
            
            const transactionHTML = `
                <div class="transaction-item" data-id="${txn.id}">
                    <div class="transaction-date">
                        <div class="date-day">${day}</div>
                        <div class="date-month">${month}</div>
                        ${txn.time ? `<div class="date-time">${txn.time}</div>` : ''}
                    </div>
                    
                    <div class="transaction-details">
                        <div class="transaction-header">
                            <div class="transaction-title">Gold Purchase</div>
                            <span class="transaction-provider">${txn.provider}</span>
                        </div>
                        
                        <div class="transaction-metrics">
                            <div class="metric-item">
                                <div class="metric-label">Rate</div>
                                <div class="metric-value">₹${this.formatRate(txn.ratePerGram)}/g</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Weight</div>
                                <div class="metric-value ${weightClass}">${this.formatGold(txn.goldWeightGram)}g</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">GST</div>
                                <div class="metric-value">${this.formatCurrency(txn.gst)}</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Total</div>
                                <div class="metric-value">${this.formatCurrency(txn.totalAmountPaid)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="transaction-actions">
                        <button class="action-btn edit" onclick="dashboard.editTransaction('${txn.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="dashboard.deleteTransaction('${txn.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', transactionHTML);
        });
    }
    
    // ===== TRANSACTION MANAGEMENT =====
    addTransaction(transactionData) {
        // Parse all values
        const weight = this.parseNumber(transactionData.weight);
        const rate = this.parseNumber(transactionData.rate);
        const gst = this.parseNumber(transactionData.gst);
        const total = this.parseNumber(transactionData.total);
        
        // Validate
        if (weight <= 0 || rate <= 0 || total <= 0) {
            alert('All values must be greater than 0');
            return;
        }
        
        // Warn for extremely small amounts
        if (weight < 0.0000001) {
            if (!confirm(`You're adding an extremely small amount: ${this.formatGold(weight)}g.\nThis is near the precision limit.\nContinue?`)) {
                return;
            }
        }
        
        const txn = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            date: transactionData.date,
            time: transactionData.time,
            provider: transactionData.provider,
            paymentMode: transactionData.paymentMode,
            ratePerGram: rate,
            goldWeightGram: weight,
            goldValue: this.safeMultiply(rate, weight),
            gst: gst,
            totalAmountPaid: total,
            createdAt: new Date().toISOString()
        };
        
        this.data.transactions.push(txn);
        this.saveData();
        this.updateDashboard();
        this.closeModal();
        
        // Show success message with details
        alert(`Transaction added successfully!\n\n` +
              `Weight: ${this.formatGold(weight)}g\n` +
              `Rate: ₹${this.formatRate(rate)}/g\n` +
              `Amount: ${this.formatCurrency(total)}`);
    }
    
    editTransaction(id) {
        const transaction = this.data.transactions.find(t => t.id === id);
        if (transaction) {
            this.showTransactionModal(transaction);
        }
    }
    
    updateTransaction(id, transactionData) {
        const index = this.data.transactions.findIndex(t => t.id === id);
        if (index === -1) return;
        
        const weight = this.parseNumber(transactionData.weight);
        const rate = this.parseNumber(transactionData.rate);
        const gst = this.parseNumber(transactionData.gst);
        const total = this.parseNumber(transactionData.total);
        
        this.data.transactions[index] = {
            ...this.data.transactions[index],
            ...transactionData,
            ratePerGram: rate,
            goldWeightGram: weight,
            goldValue: this.safeMultiply(rate, weight),
            gst: gst,
            totalAmountPaid: total,
            updatedAt: new Date().toISOString()
        };
        
        this.saveData();
        this.updateDashboard();
        alert('Transaction updated successfully!');
    }
    
    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.data.transactions = this.data.transactions.filter(t => t.id !== id);
            this.saveData();
            this.updateDashboard();
            alert('Transaction deleted!');
        }
    }
    
    // ===== CHART MANAGEMENT =====
    initializeChart() {
        const ctx = document.getElementById('valueChart').getContext('2d');
        
        if (this.charts.valueChart) {
            this.charts.valueChart.destroy();
        }
        
        this.charts.valueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Investment Value',
                    data: [],
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return this.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                return this.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateChart() {
        if (!this.charts.valueChart || this.data.transactions.length === 0) return;
        
        const transactions = [...this.data.transactions]
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let cumulativeValue = 0;
        const dates = [];
        const values = [];
        
        transactions.forEach(txn => {
            cumulativeValue = this.safeAdd(cumulativeValue, txn.totalAmountPaid);
            dates.push(new Date(txn.date).toLocaleDateString('en-IN', { 
                month: 'short', 
                day: 'numeric' 
            }));
            values.push(cumulativeValue);
        });
        
        this.charts.valueChart.data.labels = dates;
        this.charts.valueChart.data.datasets[0].data = values;
        this.charts.valueChart.update();
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            await this.handleLogin(password);
        });
        
        // Logout button
        document.getElementById('logout').addEventListener('click', () => this.logout());
        
        // Export data button
        document.getElementById('export-data').addEventListener('click', () => {
            const exportData = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    version: '2.0',
                    precision: '0.0000001g'
                },
                ...this.data
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = `goldfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        });
        
        // Add transaction buttons
        document.getElementById('add-transaction').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-first-btn').addEventListener('click', () => this.showTransactionModal());
        
        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        
        // Delete transaction button in modal
        document.getElementById('delete-transaction').addEventListener('click', () => {
            const form = document.getElementById('transaction-form');
            const id = form.dataset.editingId;
            if (id) {
                this.deleteTransaction(id);
                this.closeModal();
            }
        });
        
        // Update gold rate
        document.getElementById('update-rate').addEventListener('click', () => {
            const newRate = this.parseNumber(document.getElementById('gold-rate-input').value);
            if (newRate && newRate > 0) {
                this.data.user.currentGoldRate = newRate;
                this.data.user.lastUpdated = new Date().toISOString();
                this.saveData();
                this.updateDashboard();
            }
        });
        
        // Transaction form submission
        document.getElementById('transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const form = e.target;
            const isEditing = form.dataset.editingId;
            
            // Collect form data
            const transactionData = {
                date: document.getElementById('txn-date').value,
                time: document.getElementById('txn-time').value,
                provider: document.getElementById('txn-provider').value,
                paymentMode: document.getElementById('txn-payment').value,
                rate: document.getElementById('txn-rate').value,
                weight: document.getElementById('txn-weight').value,
                gst: document.getElementById('txn-gst').value,
                total: document.getElementById('txn-total').value
            };
            
            // Validate required fields
            if (!transactionData.date || !transactionData.rate || 
                !transactionData.weight || !transactionData.total) {
                alert('Please fill in all required fields (Date, Rate, Weight, Total)');
                return;
            }
            
            if (isEditing) {
                this.updateTransaction(isEditing, transactionData);
            } else {
                this.addTransaction(transactionData);
            }
            
            this.closeModal();
        });
        
        // Auto-calculate when rate or weight changes
        document.getElementById('txn-rate').addEventListener('input', () => this.updateCalculationPreview());
        document.getElementById('txn-weight').addEventListener('input', () => this.updateCalculationPreview());
        
        // Helper buttons for weight input
        document.querySelectorAll('.helper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                document.getElementById('txn-weight').value = value;
                this.updateCalculationPreview();
            });
        });
        
        // Sort and filter changes
        document.getElementById('sort-transactions').addEventListener('change', () => {
            this.updateTransactionsList();
        });
        
        document.getElementById('filter-provider').addEventListener('change', () => {
            this.updateTransactionsList();
        });
        
        // Allow scientific notation input
        document.getElementById('txn-weight').addEventListener('blur', (e) => {
            const value = this.parseNumber(e.target.value);
            if (!isNaN(value)) {
                e.target.value = this.formatGold(value);
                this.updateCalculationPreview();
            }
        });
        
        document.getElementById('txn-rate').addEventListener('blur', (e) => {
            const value = this.parseNumber(e.target.value);
            if (!isNaN(value)) {
                e.target.value = this.formatRate(value);
                this.updateCalculationPreview();
            }
        });
        
        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new GoldDashboard();
});
