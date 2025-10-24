// Dashboard-specific JavaScript
let riskChart = null;
const API_BASE = 'http://localhost:3000';
let dashboardInitialized = false;
let authStateChecked = false;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');
    
    // Check if user is authenticated
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (authStateChecked) return; // Prevent multiple checks
            authStateChecked = true;
            
            if (user && !dashboardInitialized) {
                console.log('User authenticated:', user.email);
                dashboardInitialized = true; // Prevent multiple initializations
                updateUserInfo(user);
                initializeDashboard();
            } else if (!user) {
                console.log('No user authenticated, redirecting to landing page');
                window.location.href = '../index.html';
            }
        });
    } else {
        console.error('Firebase not loaded');
        // Redirect to landing page if Firebase fails
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
    }
});

function updateUserInfo(user) {
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }
}

function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // Show loading state initially
    showDashboardLoading();
    
    // Initialize charts
    initializeCharts();
    
    // Load stats
    loadStats();
    
    // Load history
    loadHistory();
    
    // Set up event listeners
    setupEventListeners();
    
    // Hide loading state after a short delay
    setTimeout(() => {
        hideDashboardLoading();
    }, 1000);
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
}

function setupEventListeners() {
    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                // Prevent multiple clicks
                signOutBtn.disabled = true;
                signOutBtn.textContent = 'Signing out...';
                
                await firebase.auth().signOut();
                
                // Clear dashboard state
                dashboardInitialized = false;
                authStateChecked = false;
                
                // Redirect to landing page
                window.location.href = '../index.html';
            } catch (error) {
                console.error('Sign out error:', error);
                signOutBtn.disabled = false;
                signOutBtn.textContent = 'Sign Out';
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
            body: JSON.stringify({ email_content: rawEmail })
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
    const riskScore = data.risk_score || 0;
    const riskLevel = data.risk_level || 'unknown';
    
    // Determine risk class
    let riskClass = 'risk-low';
    if (riskScore >= 70) riskClass = 'risk-high';
    else if (riskScore >= 40) riskClass = 'risk-medium';
    
    resultDiv.className = `result-section success ${riskClass}`;
    resultDiv.innerHTML = `
        <div class="score-display ${riskClass.replace('risk-', 'score-')}">
            Risk Score: ${riskScore}%
        </div>
        
        <div class="risk-indicator ${riskClass}">
            ${riskLevel.toUpperCase()} RISK
        </div>
        
        <h3>Analysis Results:</h3>
        <div class="analysis-details">
            <strong>Subject:</strong> ${data.subject || 'No Subject'}<br>
            <strong>From:</strong> ${data.from || 'Unknown'}<br>
            <strong>Risk Level:</strong> ${riskLevel}<br>
            <strong>Confidence:</strong> ${data.confidence || 'N/A'}%<br>
        </div>
        
        <h3>Alert:</h3>
        <div class="alert-content">
            ${data.alert || 'No specific alert generated'}
        </div>
        
        <h3>Analysis Details:</h3>
        <div class="analysis-breakdown">
            ${formatAnalysisDetails(data)}
        </div>
    `;
}

function formatAnalysisDetails(data) {
    let details = '';
    
    if (data.features) {
        details += '<strong>Detected Features:</strong><br>';
        Object.entries(data.features).forEach(([key, value]) => {
            if (value) {
                details += `• ${key.replace(/_/g, ' ').toUpperCase()}<br>`;
            }
        });
    }
    
    if (data.urls && data.urls.length > 0) {
        details += '<br><strong>URLs Found:</strong><br>';
        data.urls.forEach(url => {
            details += `• ${url}<br>`;
        });
    }
    
    if (data.entities && data.entities.length > 0) {
        details += '<br><strong>Entities Detected:</strong><br>';
        data.entities.forEach(entity => {
            details += `• ${entity}<br>`;
        });
    }
    
    return details || 'No additional details available';
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

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/emails`);
        const emails = await response.json();
        
        console.log('History loaded:', emails);
        
        const historyList = document.getElementById('history');
        if (historyList && emails.length > 0) {
            historyList.innerHTML = emails.slice(0, 10).map(email => {
                const riskScore = email.risk_score || 0;
                let riskClass = 'risk-low';
                if (riskScore >= 70) riskClass = 'risk-high';
                else if (riskScore >= 40) riskClass = 'risk-medium';
                
                const timestamp = new Date(email.timestamp || Date.now()).toLocaleString();
                
                return `
                    <li class="${riskClass}">
                        <div class="history-item-header">
                            <strong>${email.subject || 'No Subject'}</strong>
                            <span class="risk-score">${riskScore}%</span>
                        </div>
                        <div class="history-item-details">
                            <div class="history-result">${email.alert || 'Analysis completed'}</div>
                            <div class="history-timestamp">${timestamp}</div>
                        </div>
                    </li>
                `;
            }).join('');
        } else if (historyList) {
            historyList.innerHTML = '<li class="no-history">No analysis history yet. Try analyzing an email!</li>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        const historyList = document.getElementById('history');
        if (historyList) {
            historyList.innerHTML = '<li class="error-history">Error loading history. Please try again.</li>';
        }
    }
}
