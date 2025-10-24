// Dashboard-specific JavaScript
let riskChart = null;
const API_BASE = 'http://localhost:3000';
let dashboardInitialized = false;
let analysisHistory = [];

// Quick check functionality
function setupQuickCheck() {
    const quickCheckBtn = document.getElementById('quickCheckBtn');
    const quickEmailUrl = document.getElementById('quickEmailUrl');
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    
    // Quick check button
    if (quickCheckBtn) {
        quickCheckBtn.addEventListener('click', function() {
            const emailContent = quickEmailUrl.value.trim();
            if (emailContent) {
                // Copy content to main textarea and trigger analysis
                const mainTextarea = document.getElementById('rawEmail');
                if (mainTextarea) {
                    mainTextarea.value = emailContent;
                    updateCharCount();
                    // Trigger analysis
                    document.getElementById('runAnalyze').click();
                }
            } else {
                showError('Please enter email content to analyze');
            }
        });
    }
    
    // Quick action buttons
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            let placeholder = '';
            
            switch(action) {
                case 'gmail':
                    placeholder = 'Paste Gmail URL or email content here...';
                    break;
                case 'outlook':
                    placeholder = 'Paste Outlook URL or email content here...';
                    break;
                case 'yahoo':
                    placeholder = 'Paste Yahoo Mail URL or email content here...';
                    break;
            }
            
            quickEmailUrl.placeholder = placeholder;
            quickEmailUrl.focus();
        });
    });
}

// Character count functionality
function updateCharCount() {
    const textarea = document.getElementById('rawEmail');
    const charCount = document.querySelector('.char-count');
    
    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count} characters`;
        
        // Change color based on length
        if (count > 1000) {
            charCount.style.color = '#48bb78';
        } else if (count > 500) {
            charCount.style.color = '#ed8936';
        } else {
            charCount.style.color = '#718096';
        }
    }
}

// Clear functionality
function setupClearButton() {
    const clearBtn = document.getElementById('clearBtn');
    const textarea = document.getElementById('rawEmail');
    
    if (clearBtn && textarea) {
        clearBtn.addEventListener('click', function() {
            textarea.value = '';
            updateCharCount();
            clearResult();
        });
    }
}

// Error and success message functions
function showError(message) {
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.className = 'result-section error';
        resultDiv.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <div class="error-content">
                    <h3>Analysis failed: ${message}</h3>
                    <div class="troubleshooting">
                        <h4>Troubleshooting:</h4>
                        <ul>
                            <li>Make sure the backend server is running on port 3000</li>
                            <li>Check your internet connection</li>
                            <li>Try again in a few moments</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
}

function showSuccess(message) {
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.className = 'result-section success';
        resultDiv.innerHTML = `
            <div class="success-message">
                <div class="success-icon">✅</div>
                <div class="success-content">
                    <h3>${message}</h3>
                </div>
            </div>
        `;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');
    
    // Check if user is authenticated
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && !dashboardInitialized) {
                console.log('User authenticated:', user.email);
                dashboardInitialized = true; // Prevent multiple initializations
                updateUserInfo(user);
                initializeDashboard();
            } else if (!user) {
                console.log('No user authenticated, redirecting to landing page');
                window.location.href = 'index.html';
            }
        });
        
        // Fallback timeout in case auth state doesn't change
        setTimeout(() => {
            if (!dashboardInitialized && firebase.auth().currentUser) {
                console.log('Fallback initialization for authenticated user');
                dashboardInitialized = true;
                updateUserInfo(firebase.auth().currentUser);
                initializeDashboard();
            }
        }, 3000);
    } else {
        console.error('Firebase not loaded');
        // Redirect to landing page if Firebase fails
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

function updateUserInfo(user) {
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
        userEmailEl.style.color = '#ffffff';
        userEmailEl.style.display = 'inline';
    }
}

function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // Hide loading state immediately
    hideDashboardLoading();
    
    // Initialize charts
    initializeCharts();
    
    // Load stats
    loadStats();
    
    // Load history
    loadHistory();
    
    // Set up event listeners
    setupEventListeners();
}

function showDashboardLoading() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.opacity = '0.7';
        dashboard.style.transition = 'opacity 0.3s ease';
    }
}

function hideDashboardLoading() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.opacity = '1';
    }
    
    // Hide loading text in header
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        loadingText.style.display = 'none';
    }
    
    // Show user email instead
    const userEmail = document.getElementById('userEmail');
    if (userEmail && userEmail.textContent) {
        userEmail.style.display = 'inline';
    }
}

function setupEventListeners() {
    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Sign out error:', error);
            }
        });
    }

    // Analyze button
    const runAnalyzeBtn = document.getElementById('runAnalyze');
    if (runAnalyzeBtn) {
        runAnalyzeBtn.addEventListener('click', analyzeEmail);
    }

    // Demo button
    const demoBtn = document.getElementById('demoBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', loadDemoEmail);
    }
    
    // Setup new functionality
    setupQuickCheck();
    setupClearButton();
    setupHistoryControls();
    
    // Character count for textarea
    const textarea = document.getElementById('rawEmail');
    if (textarea) {
        textarea.addEventListener('input', updateCharCount);
    }
}

function loadDemoEmail() {
    const demoEmail = `Subject: Urgent: Verify Your Account Immediately

Dear Customer,

We have detected suspicious activity on your account. To prevent unauthorized access, please verify your account immediately by clicking the link below:

VERIFY NOW: http://fake-bank-security.com/verify?account=12345

This is urgent! Your account will be suspended if you don't verify within 24 hours.

Best regards,
Security Team
Bank of Trust`;

    const textarea = document.getElementById('rawEmail');
    if (textarea) {
        textarea.value = demoEmail;
    }
}

async function analyzeEmail() {
    const rawEmail = document.getElementById('rawEmail').value.trim();
    const resultDiv = document.getElementById('result');
    
    if (!rawEmail) {
        alert('Please enter email content to analyze');
        return;
    }

    // Show loading state
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-section loading';
    resultDiv.textContent = '🔄 Analyzing email... Please wait...';

    try {
        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email_text: rawEmail })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Update user's emails analyzed count
        if (firebase.auth().currentUser) {
            try {
                await fetch(`http://localhost:3000/api/users/${firebase.auth().currentUser.uid}/emails-analyzed`, {
                    method: 'PUT'
                });
            } catch (error) {
                console.error('Error updating emails analyzed count:', error);
            }
        }
        
        // Display results
        displayResults(data);
        addHistoryItem(data);
        
        // Reload stats and history
        loadStats();
        loadHistory();
        
    } catch (error) {
        console.error('Analysis error:', error);
        resultDiv.className = 'result-section error';
        resultDiv.innerHTML = `
            <div class="error-message">
                ⚠️ Analysis failed: ${error.message}
                <br><br>
                <strong>Troubleshooting:</strong>
                <ul>
                    <li>Make sure the backend server is running on port 3000</li>
                    <li>Check your internet connection</li>
                    <li>Try again in a few moments</li>
                </ul>
            </div>
        `;
    }
}

function displayResults(data) {
    const resultDiv = document.getElementById('result');
    const riskScore = Math.round((data.score || 0) * 100);
    const riskLevel = data.level || 'unknown';
    const reason = data.reason || 'No analysis available';
    const alertSummary = data.alert_summary || 'No alert generated';
    
    // Determine risk class and color
    let riskClass = 'risk-low';
    let riskColor = '#10b981'; // green
    let riskIcon = '✅';
    let riskMessage = 'This email appears safe';
    
    if (riskScore >= 70) {
        riskClass = 'risk-high';
        riskColor = '#ef4444'; // red
        riskIcon = '🚨';
        riskMessage = 'High risk detected - proceed with caution';
    } else if (riskScore >= 40) {
        riskClass = 'risk-medium';
        riskColor = '#f59e0b'; // orange
        riskIcon = '⚠️';
        riskMessage = 'Medium risk - review carefully';
    }
    
    resultDiv.className = `result-section ${riskClass}`;
    resultDiv.innerHTML = `
        <div class="analysis-header">
            <div class="risk-score-circle ${riskClass}">
                <div class="score-number">${riskScore}%</div>
                <div class="score-label">Risk Score</div>
            </div>
            <div class="risk-summary">
                <div class="risk-icon">${riskIcon}</div>
                <div class="risk-level ${riskClass}">${riskLevel.toUpperCase()} RISK</div>
                <div class="risk-message">${riskMessage}</div>
            </div>
        </div>
        
        <div class="analysis-content">
            <div class="alert-section">
                <h4>🛡️ Security Alert</h4>
                <div class="alert-text">${alertSummary}</div>
            </div>
            
            <div class="reason-section">
                <h4>🔍 Analysis Reason</h4>
                <div class="reason-text">${reason}</div>
            </div>
            
            <div class="quick-actions">
                <button class="action-btn primary" onclick="showDetailedAnalysis()">
                    <span class="btn-icon">📊</span>
                    View Detailed Analysis
                </button>
                <button class="action-btn secondary" onclick="copyAnalysisResults()">
                    <span class="btn-icon">📋</span>
                    Copy Results
                </button>
            </div>
        </div>
        
        <div id="detailedAnalysis" class="detailed-analysis" style="display: none;">
            <h4>📋 Detailed Analysis</h4>
            <div class="analysis-breakdown">
                ${formatAnalysisDetails(data)}
            </div>
        </div>
    `;
}

function formatAnalysisDetails(data) {
    let details = '';
    
    if (data.features) {
        details += '<div class="feature-group"><strong>🔍 Detected Features:</strong><br>';
        Object.entries(data.features).forEach(([key, value]) => {
            if (value) {
                details += `<span class="feature-tag">${key.replace(/_/g, ' ').toUpperCase()}</span>`;
            }
        });
        details += '</div>';
    }
    
    if (data.urls && data.urls.length > 0) {
        details += '<div class="url-group"><strong>🔗 URLs Found:</strong><br>';
        data.urls.forEach(url => {
            details += `<div class="url-item">• ${url}</div>`;
        });
        details += '</div>';
    }
    
    if (data.entities && data.entities.length > 0) {
        details += '<div class="entity-group"><strong>👤 Entities Detected:</strong><br>';
        data.entities.forEach(entity => {
            details += `<div class="entity-item">• ${entity}</div>`;
        });
        details += '</div>';
    }
    
    return details || '<div class="no-details">No additional details available</div>';
}

// Helper functions for the new UI
function showDetailedAnalysis() {
    const detailedDiv = document.getElementById('detailedAnalysis');
    const btn = document.querySelector('.action-btn.primary');
    
    if (detailedDiv.style.display === 'none') {
        detailedDiv.style.display = 'block';
        btn.innerHTML = '<span class="btn-icon">📊</span>Hide Detailed Analysis';
    } else {
        detailedDiv.style.display = 'none';
        btn.innerHTML = '<span class="btn-icon">📊</span>View Detailed Analysis';
    }
}

function copyAnalysisResults() {
    const resultDiv = document.getElementById('result');
    const riskScore = resultDiv.querySelector('.score-number').textContent;
    const riskLevel = resultDiv.querySelector('.risk-level').textContent;
    const alertText = resultDiv.querySelector('.alert-text').textContent;
    const reasonText = resultDiv.querySelector('.reason-text').textContent;
    
    const copyText = `Phishing Detection Analysis Results:
Risk Score: ${riskScore}
Risk Level: ${riskLevel}
Alert: ${alertText}
Reason: ${reasonText}`;
    
    navigator.clipboard.writeText(copyText).then(() => {
        // Show success message
        const btn = document.querySelector('.action-btn.secondary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="btn-icon">✅</span>Copied!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(() => {
        alert('Failed to copy results');
    });
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        
        console.log('Stats loaded:', stats);
        
        if (riskChart) {
            // Update chart with the correct data structure
            riskChart.data.datasets[0].data = [
                stats.risk_levels?.low || 0,
                stats.risk_levels?.medium || 0,
                stats.risk_levels?.high || 0
            ];
            riskChart.update();
            
            // Update stats cards
            updateStatsCards(stats);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Set default values if API fails
        if (riskChart) {
            riskChart.data.datasets[0].data = [0, 0, 0];
            riskChart.update();
        }
    }
}

function updateStatsCards(stats) {
    // Update the stats cards with real data
    const emailsAnalyzedEl = document.getElementById('emailsAnalyzed');
    const threatsBlockedEl = document.getElementById('threatsBlocked');
    
    if (emailsAnalyzedEl) {
        emailsAnalyzedEl.textContent = stats.total_emails || 0;
    }
    
    if (threatsBlockedEl) {
        threatsBlockedEl.textContent = (stats.risk_levels?.high || 0) + (stats.risk_levels?.medium || 0);
    }
}

function initializeCharts() {
    // Main dashboard chart
    const ctx = document.getElementById('riskChart');
    if (ctx) {
        riskChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [{
                    data: [2, 4, 0], // Sample data based on current API response
                    backgroundColor: ['#059669', '#d97706', '#dc2626'],
                    borderWidth: 0,
                    hoverOffset: 10,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#374151',
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            usePointStyle: true,
                            padding: 20,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        return {
                                            text: `${label}: ${value} emails`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].backgroundColor[i],
                                            lineWidth: 0,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} emails (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%',
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000
                }
            }
        });
        
        // Load real data after chart is initialized
        setTimeout(() => {
            loadStats();
        }, 500);
    }
}

// Enhanced History Management Functions
function setupHistoryControls() {
    const riskFilter = document.getElementById('riskFilter');
    const dateFilter = document.getElementById('dateFilter');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    
    if (riskFilter) {
        riskFilter.addEventListener('change', filterHistory);
    }
    
    if (dateFilter) {
        dateFilter.addEventListener('change', filterHistory);
    }
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllHistory);
    }
    
    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', exportHistory);
    }
}

function addHistoryItem(data) {
    const historyItem = {
        id: Date.now(),
        subject: data.subject || 'No Subject',
        riskScore: Math.round((data.score || 0) * 100),
        riskLevel: data.level || 'unknown',
        reason: data.reason || 'No analysis available',
        alertSummary: data.alert_summary || 'No alert generated',
        timestamp: new Date(),
        fullData: data
    };
    
    analysisHistory.unshift(historyItem); // Add to beginning
    updateHistoryDisplay();
    updateHistoryStats();
    saveHistory();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    
    if (!historyList) return;
    
    const filteredHistory = getFilteredHistory();
    
    if (filteredHistory.length === 0) {
        historyList.style.display = 'none';
        if (noHistoryMessage) {
            noHistoryMessage.style.display = 'block';
        }
        return;
    }
    
    historyList.style.display = 'block';
    if (noHistoryMessage) {
        noHistoryMessage.style.display = 'none';
    }
    
    historyList.innerHTML = filteredHistory.map(item => `
        <div class="history-item ${item.riskLevel}-risk" data-id="${item.id}">
            <div class="history-item-content">
                <div class="history-item-header">
                    <span class="history-subject" title="${item.subject}">${item.subject}</span>
                    <span class="history-risk-badge ${item.riskLevel}">${item.riskLevel}</span>
                </div>
                <div class="history-item-details">
                    <span class="history-date">${formatDate(item.timestamp)}</span>
                    <span class="history-score">${item.riskScore}%</span>
                </div>
            </div>
            <div class="history-actions-item">
                <button class="history-action-btn view" onclick="viewHistoryItem(${item.id})" title="View Details">
                    👁️
                </button>
                <button class="history-action-btn remove" onclick="removeHistoryItem(${item.id})" title="Remove">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function getFilteredHistory() {
    const riskFilter = document.getElementById('riskFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';
    
    let filtered = [...analysisHistory];
    
    // Filter by risk level
    if (riskFilter !== 'all') {
        filtered = filtered.filter(item => item.riskLevel === riskFilter);
    }
    
    // Filter by date
    if (dateFilter !== 'all') {
        const now = new Date();
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.timestamp);
            switch (dateFilter) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                default:
                    return true;
            }
        });
    }
    
    return filtered;
}

function filterHistory() {
    updateHistoryDisplay();
}

function updateHistoryStats() {
    const totalAnalyses = analysisHistory.length;
    const highRiskCount = analysisHistory.filter(item => item.riskLevel === 'high').length;
    const mediumRiskCount = analysisHistory.filter(item => item.riskLevel === 'medium').length;
    const lowRiskCount = analysisHistory.filter(item => item.riskLevel === 'low').length;
    
    const totalEl = document.getElementById('totalAnalyses');
    const highEl = document.getElementById('highRiskCount');
    const mediumEl = document.getElementById('mediumRiskCount');
    const lowEl = document.getElementById('lowRiskCount');
    
    if (totalEl) totalEl.textContent = totalAnalyses;
    if (highEl) highEl.textContent = highRiskCount;
    if (mediumEl) mediumEl.textContent = mediumRiskCount;
    if (lowEl) lowEl.textContent = lowRiskCount;
}

function viewHistoryItem(id) {
    const item = analysisHistory.find(h => h.id === id);
    if (item) {
        // Display the analysis result
        displayResults(item.fullData);
        
        // Scroll to results
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function removeHistoryItem(id) {
    if (confirm('Are you sure you want to remove this analysis from history?')) {
        analysisHistory = analysisHistory.filter(item => item.id !== id);
        updateHistoryDisplay();
        updateHistoryStats();
        saveHistory();
    }
}

function clearAllHistory() {
    if (confirm('Are you sure you want to clear all analysis history? This action cannot be undone.')) {
        analysisHistory = [];
        updateHistoryDisplay();
        updateHistoryStats();
        saveHistory();
    }
}

function exportHistory() {
    if (analysisHistory.length === 0) {
        alert('No history to export');
        return;
    }
    
    const csvContent = [
        ['Subject', 'Risk Level', 'Risk Score', 'Date', 'Reason'],
        ...analysisHistory.map(item => [
            `"${item.subject}"`,
            item.riskLevel,
            item.riskScore,
            formatDate(item.timestamp),
            `"${item.reason}"`
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phishing-analysis-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(date);
}

function loadHistory() {
    // Load from localStorage if available
    const savedHistory = localStorage.getItem('analysisHistory');
    if (savedHistory) {
        try {
            analysisHistory = JSON.parse(savedHistory).map(item => ({
                ...item,
                timestamp: new Date(item.timestamp)
            }));
        } catch (e) {
            console.error('Error loading history:', e);
            analysisHistory = [];
        }
    }
    
    updateHistoryDisplay();
    updateHistoryStats();
}

function saveHistory() {
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
}
