class GoldDashboard {
    constructor() {
        this.data = {
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
                source: 'new'
            },
            settings: {
                currentGoldRate: 6500.00,
                currency: '₹'
            },
            transactions: []
        };

        this.charts = {};
        this.isDemoMode = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showWelcomeScreen();
    }

    // ===== SCREEN MANAGEMENT =====
    showWelcomeScreen() {
        document.getElementById('welcome-screen').classList.add('active');
        document.getElementById('dashboard').classList.remove('active');
    }

    showDashboard() {
        document.getElementById('welcome-screen').classList.remove('active');
        document.getElementById('dashboard').classList.add('active');
        this.updateDashboard();
    }

    // ===== DATA MANAGEMENT =====
    startNewDashboard() {
        this.data = {
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
                source: 'new'
            },
            settings: {
                currentGoldRate: 6500.00,
                currency: '₹'
            },
            transactions: []
        };
        this.isDemoMode = false;
        this.showDashboard();
        alert('New dashboard created!');
    }

    startDemoMode() {
        this.data = {
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
                source: 'demo'
            },
            settings: {
                currentGoldRate: 6500.00,
                currency: '₹'
            },
            transactions: [
                {
                    id: 'demo1',
                    date: '2024-01-15',
                    time: '14:30',
                    provider: 'SafeGold',
                    ratePerGram: 6250.50,
                    goldWeightGram: 2.5000000,
                    goldValue: 15626.25,
                    gst: 468.79,
                    totalAmountPaid: 16095.04,
                    paymentMode: 'UPI'
                },
                {
                    id: 'demo2',
                    date: '2024-01-10',
                    time: '11:15',
                    provider: 'Paytm Gold',
                    ratePerGram: 6220.00,
                    goldWeightGram: 1.2500000,
                    goldValue: 7775.00,
                    gst: 233.25,
                    totalAmountPaid: 8008.25,
                    paymentMode: 'Card'
                }
            ]
        };
        this.isDemoMode = true;
        this.showDashboard();
        alert('Demo mode activated!');
    }

    async importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.data = importedData;
                this.isDemoMode = false;
                this.showDashboard();
                alert('Data imported successfully!');
            } catch (error) {
                alert('Error importing data: Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }

    saveData() {
        const jsonString = JSON.stringify(this.data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `goldfolio_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        alert('Data saved to file!');
    }

    exportData() {
        const jsonString = JSON.stringify(this.data, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            alert('Data copied to clipboard! You can save it as a .json file.');
        });
    }

    // ===== CALCULATIONS =====
    parseNumber(value) {
        if (!value && value !== 0) return 0;
        const str = value.toString().replace(/,/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    formatGold(grams) {
        const num = this.parseNumber(grams);
        if (num === 0) return '0.0000000';

        // For very small values
        if (num < 0.0000001) {
            return num.toExponential(7);
        }

        // Format with up to 7 decimal places
        let formatted = num.toFixed(7);
        // Remove unnecessary trailing zeros
        formatted = formatted.replace(/(\.\d*?)0+$/, '$1');
        if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);

        return formatted;
    }

    formatCurrency(amount) {
        const num = this.parseNumber(amount);
        if (num === 0) return '₹0.00';

        // Format with Indian number system
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    calculateMetrics() {
        const transactions = this.data.transactions;
        const currentRate = this.parseNumber(this.data.settings.currentGoldRate);

        let totalGold = 0;
        let totalInvested = 0;

        transactions.forEach(txn => {
            totalGold += this.parseNumber(txn.goldWeightGram);
            totalInvested += this.parseNumber(txn.totalAmountPaid);
        });

        const currentValue = totalGold * currentRate;
        const profitLoss = currentValue - totalInvested;
        const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

        return {
            totalGold,
            totalInvested,
            currentValue,
            profitLoss,
            profitLossPercent,
            transactionCount: transactions.length
        };
    }

    // ===== UI UPDATES =====
    updateDashboard() {
        const metrics = this.calculateMetrics();

        // Update cards
        document.getElementById('total-gold').textContent = this.formatGold(metrics.totalGold);
        document.getElementById('total-invested').textContent = `₹${this.formatCurrency(metrics.totalInvested)}`;
        document.getElementById('current-value').textContent = `₹${this.formatCurrency(metrics.currentValue)}`;
        document.getElementById('current-rate').textContent = this.formatCurrency(this.data.settings.currentGoldRate);

        // Update transaction count
        document.getElementById('transaction-count').textContent =
            `${metrics.transactionCount} transaction${metrics.transactionCount !== 1 ? 's' : ''}`;

        // Update profit/loss
        const profitLossElem = document.getElementById('profit-loss');
        const profitPercentElem = document.getElementById('profit-percent');

        if (metrics.profitLoss >= 0) {
            profitLossElem.textContent = `₹${this.formatCurrency(metrics.profitLoss)}`;
            profitLossElem.className = 'value positive';
            profitPercentElem.textContent = `+${metrics.profitLossPercent.toFixed(2)}%`;
        } else {
            profitLossElem.textContent = `-₹${this.formatCurrency(Math.abs(metrics.profitLoss))}`;
            profitLossElem.className = 'value negative';
            profitPercentElem.textContent = `${metrics.profitLossPercent.toFixed(2)}%`;
        }

        // Show/hide empty state
        const emptyState = document.getElementById('empty-state');
        const transactionsList = document.getElementById('transactions-list');

        if (metrics.transactionCount === 0) {
            emptyState.classList.remove('hidden');
            transactionsList.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            transactionsList.classList.remove('hidden');
            this.updateTransactionsList();
        }

        // Update chart
        this.updateChart();
    }

    updateTransactionsList() {
        const container = document.getElementById('transactions-list');
        container.innerHTML = '';

        this.data.transactions.forEach(txn => {
            const date = new Date(txn.date);
            const day = date.getDate();
            const month = date.toLocaleString('default', { month: 'short' });

            const transactionHTML = `
                <div class="transaction-item">
                    <div class="transaction-date">
                        <div class="date-day">${day}</div>
                        <div class="date-month">${month}</div>
                    </div>
                    <div class="transaction-details">
                        <h4>${txn.provider}</h4>
                        <div class="transaction-metrics">
                            <div class="metric-item">
                                <div class="metric-label">Rate</div>
                                <div class="metric-value">₹${this.formatCurrency(txn.ratePerGram)}/g</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Weight</div>
                                <div class="metric-value">${this.formatGold(txn.goldWeightGram)}g</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">GST</div>
                                <div class="metric-value">₹${this.formatCurrency(txn.gst)}</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-label">Total</div>
                                <div class="metric-value">₹${this.formatCurrency(txn.totalAmountPaid)}</div>
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

    updateChart() {
        const ctx = document.getElementById('valueChart').getContext('2d');

        // Destroy existing chart
        if (this.charts.valueChart) {
            this.charts.valueChart.destroy();
        }

        const transactions = [...this.data.transactions]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let cumulativeValue = 0;
        const dates = [];
        const values = [];

        transactions.forEach(txn => {
            cumulativeValue += this.parseNumber(txn.totalAmountPaid);
            dates.push(new Date(txn.date).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric'
            }));
            values.push(cumulativeValue);
        });

        this.charts.valueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Investment Value',
                    data: values,
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
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => '₹' + value.toLocaleString('en-IN')
                        }
                    }
                }
            }
        });
    }

    // ===== TRANSACTION MODAL =====
    showTransactionModal() {
        const modal = document.getElementById('transaction-modal');
        modal.classList.add('active');

        // Set default values
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('txn-date').value = today;
        document.getElementById('current-rate-hint').textContent =
            this.formatCurrency(this.data.settings.currentGoldRate);

        // Clear form
        document.getElementById('txn-rate').value = '';
        document.getElementById('txn-weight').value = '';
        document.getElementById('txn-gst').value = '';
        document.getElementById('txn-total').value = '';

        this.updateCalculationPreview();
    }

    closeModal() {
        document.getElementById('transaction-modal').classList.remove('active');
    }

    updateCalculationPreview() {
        const rate = this.parseNumber(document.getElementById('txn-rate').value);
        const weight = this.parseNumber(document.getElementById('txn-weight').value);

        const goldValue = rate * weight;
        const gst = goldValue * 0.03;
        const total = goldValue + gst;

        document.getElementById('calc-gold-value').textContent = `₹${this.formatCurrency(goldValue)}`;
        document.getElementById('calc-gst').textContent = `₹${this.formatCurrency(gst)}`;
        document.getElementById('calc-total').textContent = `₹${this.formatCurrency(total)}`;

        // Auto-fill if empty
        if (goldValue > 0) {
            if (!document.getElementById('txn-gst').value) {
                document.getElementById('txn-gst').value = this.formatCurrency(gst);
            }
            if (!document.getElementById('txn-total').value) {
                document.getElementById('txn-total').value = this.formatCurrency(total);
            }
        }
    }

    addTransaction(transactionData) {
        const txn = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            date: transactionData.date,
            time: new Date().toTimeString().slice(0, 5),
            provider: transactionData.provider,
            paymentMode: transactionData.paymentMode,
            ratePerGram: this.parseNumber(transactionData.rate),
            goldWeightGram: this.parseNumber(transactionData.weight),
            goldValue: this.parseNumber(transactionData.rate) * this.parseNumber(transactionData.weight),
            gst: this.parseNumber(transactionData.gst),
            totalAmountPaid: this.parseNumber(transactionData.total)
        };

        this.data.transactions.push(txn);
        this.updateDashboard();
        this.closeModal();
        alert('Transaction added!');
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Welcome screen buttons
        document.getElementById('start-new').addEventListener('click', () => this.startNewDashboard());
        document.getElementById('demo-mode').addEventListener('click', () => this.startDemoMode());
        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        // File import
        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.importData(file);
        });

        // Dashboard buttons
        document.getElementById('add-transaction').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('add-first-btn').addEventListener('click', () => this.showTransactionModal());
        document.getElementById('save-data').addEventListener('click', () => this.saveData());
        document.getElementById('export-data').addEventListener('click', () => this.exportData());

        // Update gold rate
        document.getElementById('update-rate').addEventListener('click', () => {
            const newRate = this.parseNumber(document.getElementById('gold-rate-input').value);
            if (newRate > 0) {
                this.data.settings.currentGoldRate = newRate;
                this.updateDashboard();
                alert('Gold rate updated!');
            }
        });

        // Transaction form
        document.getElementById('transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const transactionData = {
                date: document.getElementById('txn-date').value,
                provider: document.getElementById('txn-provider').value,
                paymentMode: document.getElementById('txn-payment').value,
                rate: document.getElementById('txn-rate').value,
                weight: document.getElementById('txn-weight').value,
                gst: document.getElementById('txn-gst').value,
                total: document.getElementById('txn-total').value
            };

            this.addTransaction(transactionData);
        });

        // Auto-calculate
        document.getElementById('txn-rate').addEventListener('input', () => this.updateCalculationPreview());
        document.getElementById('txn-weight').addEventListener('input', () => this.updateCalculationPreview());

        // Close modal
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new GoldDashboard();
});