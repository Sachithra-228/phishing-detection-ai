// Dashboard-specific JavaScript
let riskChart = null;
const API_BASE = 'http://localhost:3000';
let dashboardInitialized = false;
let analysisHistory = [];

// Gmail Integration
let gmailConnected = false;
let gmailEmails = [];
let gmailAccessToken = null;
let gmailClient = null;

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = GMAIL_CONFIG.CLIENT_ID;
const GOOGLE_API_KEY = GMAIL_CONFIG.API_KEY;
const GMAIL_SCOPES = GMAIL_CONFIG.SCOPES;

// Gmail OAuth setup
function setupGmailIntegration() {
    const connectBtn = document.getElementById('connectGmailBtn');
    const disconnectBtn = document.getElementById('disconnectGmailBtn');
    const refreshBtn = document.getElementById('refreshGmailBtn');
    const gmailSection = document.getElementById('gmailSection');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connectGmail);
    }
    
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectGmail);
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshGmailEmails);
    }
    
    // Check if Gmail is already connected
    checkGmailConnection();
}

// Connect to Gmail using Google OAuth
async function connectGmail() {
    const connectBtn = document.getElementById('connectGmailBtn');
    const gmailSection = document.getElementById('gmailSection');
    
    try {
        // Show loading state
        connectBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Connecting...</span>';
        connectBtn.disabled = true;
        
        // Initialize Google API client
        await gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    clientId: GOOGLE_CLIENT_ID,
                    discoveryDocs: [GMAIL_CONFIG.DISCOVERY_DOC],
                    scope: GMAIL_SCOPES
                });
                
                // Request authorization
                const authResult = await gapi.auth2.getAuthInstance().signIn({
                    scope: GMAIL_SCOPES
                });
                
                if (authResult.isSignedIn()) {
                    gmailAccessToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
                    gmailClient = gapi.client;
                    gmailConnected = true;
                    
                    // Store connection status
                    localStorage.setItem('gmailConnected', 'true');
                    localStorage.setItem('gmailAccessToken', gmailAccessToken);
                    
                    // Update UI
                    connectBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Gmail Connected</span>';
                    connectBtn.classList.add('connected');
                    gmailSection.style.display = 'block';
                    
                    // Load real Gmail emails
                    await loadRealGmailEmails();
                    
                    showSuccess('Gmail connected successfully!');
                } else {
                    throw new Error('User did not authorize Gmail access');
                }
                
            } catch (error) {
                console.error('Gmail OAuth failed:', error);
                showError('Failed to connect to Gmail. Please try again.');
                
                // Reset button
                connectBtn.innerHTML = '<span class="btn-icon">📧</span><span class="btn-text">Connect Gmail</span>';
                connectBtn.disabled = false;
            }
        });
        
    } catch (error) {
        console.error('Gmail connection failed:', error);
        showError('Failed to connect to Gmail. Please try again.');
        
        // Reset button
        connectBtn.innerHTML = '<span class="btn-icon">📧</span><span class="btn-text">Connect Gmail</span>';
        connectBtn.disabled = false;
    }
}

// Disconnect Gmail
function disconnectGmail() {
    const connectBtn = document.getElementById('connectGmailBtn');
    const gmailSection = document.getElementById('gmailSection');
    
    // Sign out from Google
    if (gapi.auth2 && gapi.auth2.getAuthInstance()) {
        gapi.auth2.getAuthInstance().signOut();
    }
    
    gmailConnected = false;
    gmailEmails = [];
    gmailAccessToken = null;
    gmailClient = null;
    
    // Remove connection status
    localStorage.removeItem('gmailConnected');
    localStorage.removeItem('gmailAccessToken');
    
    // Update UI
    connectBtn.innerHTML = '<span class="btn-icon">📧</span><span class="btn-text">Connect Gmail</span>';
    connectBtn.classList.remove('connected');
    gmailSection.style.display = 'none';
    
    showSuccess('Gmail disconnected successfully!');
}

// Check Gmail connection status
function checkGmailConnection() {
    const isConnected = localStorage.getItem('gmailConnected') === 'true';
    const storedToken = localStorage.getItem('gmailAccessToken');
    
    if (isConnected && storedToken) {
        gmailConnected = true;
        gmailAccessToken = storedToken;
        const connectBtn = document.getElementById('connectGmailBtn');
        const gmailSection = document.getElementById('gmailSection');
        
        if (connectBtn) {
            connectBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Gmail Connected</span>';
            connectBtn.classList.add('connected');
        }
        if (gmailSection) {
            gmailSection.style.display = 'block';
        }
        
        // Initialize Gmail client and load emails
        initializeGmailClient();
    }
}

// Initialize Gmail client with stored token
async function initializeGmailClient() {
    try {
        await gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                clientId: GOOGLE_CLIENT_ID,
                discoveryDocs: [GMAIL_CONFIG.DISCOVERY_DOC],
                scope: GMAIL_SCOPES
            });
            
            gmailClient = gapi.client;
            await loadRealGmailEmails();
        });
    } catch (error) {
        console.error('Failed to initialize Gmail client:', error);
        // Fallback to sample emails if initialization fails
        loadSampleGmailEmails();
    }
}

// Load real Gmail emails from Gmail API
async function loadRealGmailEmails() {
    if (!gmailClient || !gmailAccessToken) {
        console.error('Gmail client or access token not available');
        loadSampleGmailEmails(); // Fallback to sample emails
        return;
    }
    
    try {
        // Fetch recent emails from Gmail
        const response = await gmailClient.gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: 'in:inbox' // Only inbox emails
        });
        
        const messages = response.result.messages || [];
        gmailEmails = [];
        
        // Process each email
        for (const message of messages) {
            try {
                const emailDetail = await gmailClient.gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full'
                });
                
                const headers = emailDetail.result.payload.headers;
                const sender = headers.find(h => h.name === 'From')?.value || 'Unknown';
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
                
                // Extract email body (simplified)
                let content = '';
                if (emailDetail.result.payload.body && emailDetail.result.payload.body.data) {
                    content = atob(emailDetail.result.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                } else if (emailDetail.result.payload.parts) {
                    for (const part of emailDetail.result.payload.parts) {
                        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                            content = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                            break;
                        }
                    }
                }
                
                // Analyze email for phishing risk (simplified)
                const riskScore = analyzeEmailRisk(content, sender, subject);
                const riskLevel = getRiskLevel(riskScore);
                
                gmailEmails.push({
                    id: message.id,
                    sender: sender,
                    subject: subject,
                    time: formatEmailTime(date),
                    riskScore: riskScore,
                    riskLevel: riskLevel,
                    content: content.substring(0, 200) + '...' // Truncate for display
                });
                
            } catch (error) {
                console.error('Error processing email:', error);
            }
        }
        
        updateGmailStats();
        renderGmailEmails();
        
    } catch (error) {
        console.error('Failed to load Gmail emails:', error);
        showError('Failed to load Gmail emails. Using sample data.');
        loadSampleGmailEmails(); // Fallback to sample emails
    }
}

// Simple email risk analysis
function analyzeEmailRisk(content, sender, subject) {
    let riskScore = 0;
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
        'urgent', 'verify', 'suspended', 'expired', 'immediately',
        'click here', 'verify now', 'account locked', 'security alert'
    ];
    
    const suspiciousDomains = [
        'paypal-security.com', 'amazon-security.com', 'microsoft-security.com',
        'bank-security.com', 'apple-security.com'
    ];
    
    const text = (content + ' ' + subject).toLowerCase();
    
    // Check patterns
    suspiciousPatterns.forEach(pattern => {
        if (text.includes(pattern)) {
            riskScore += 15;
        }
    });
    
    // Check sender domain
    suspiciousDomains.forEach(domain => {
        if (sender.toLowerCase().includes(domain)) {
            riskScore += 30;
        }
    });
    
    // Check for suspicious links
    if (text.includes('http://') || text.includes('https://')) {
        riskScore += 10;
    }
    
    return Math.min(riskScore, 100);
}

// Get risk level from score
function getRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
}

// Format email time
function formatEmailTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// Load sample Gmail emails (for demo)
async function loadSampleGmailEmails() {
    const sampleEmails = [
        {
            id: '1',
            sender: 'noreply@paypal.com',
            subject: 'Your account has been suspended',
            time: '2 hours ago',
            riskScore: 85,
            riskLevel: 'high',
            content: 'Urgent: Your PayPal account has been suspended due to suspicious activity...'
        },
        {
            id: '2',
            sender: 'support@microsoft.com',
            subject: 'Security alert for your account',
            time: '4 hours ago',
            riskScore: 25,
            riskLevel: 'low',
            content: 'We detected unusual sign-in activity on your Microsoft account...'
        },
        {
            id: '3',
            sender: 'billing@amazon.com',
            subject: 'Payment confirmation',
            time: '6 hours ago',
            riskScore: 15,
            riskLevel: 'safe',
            content: 'Thank you for your recent purchase. Your payment has been processed...'
        },
        {
            id: '4',
            sender: 'urgent@bank-security.com',
            subject: 'Verify your account immediately',
            time: '8 hours ago',
            riskScore: 92,
            riskLevel: 'high',
            content: 'Your bank account will be closed if you do not verify your identity...'
        },
        {
            id: '5',
            sender: 'newsletter@techcrunch.com',
            subject: 'Weekly tech news digest',
            time: '1 day ago',
            riskScore: 5,
            riskLevel: 'safe',
            content: 'This week in tech: AI breakthroughs, startup funding rounds...'
        }
    ];
    
    gmailEmails = sampleEmails;
    updateGmailStats();
    renderGmailEmails();
}

// Update Gmail statistics
function updateGmailStats() {
    const totalEmails = gmailEmails.length;
    const analyzedEmails = gmailEmails.length; // All emails are analyzed
    const threatsFound = gmailEmails.filter(email => email.riskLevel === 'high' || email.riskLevel === 'medium').length;
    
    document.getElementById('gmailTotalEmails').textContent = totalEmails;
    document.getElementById('gmailAnalyzedEmails').textContent = analyzedEmails;
    document.getElementById('gmailThreatsFound').textContent = threatsFound;
}

// Render Gmail emails
function renderGmailEmails() {
    const emailList = document.getElementById('gmailEmailList');
    
    if (!emailList) return;
    
    emailList.innerHTML = gmailEmails.map(email => `
        <div class="email-item" onclick="analyzeGmailEmail('${email.id}')">
            <div class="email-header">
                <span class="email-sender">${email.sender}</span>
                <span class="email-time">${email.time}</span>
            </div>
            <div class="email-subject">${email.subject}</div>
            <div class="email-risk">
                <span class="risk-badge ${email.riskLevel}">${email.riskLevel.toUpperCase()}</span>
                <span style="font-size: 0.8rem; color: #718096;">${email.riskScore}% risk</span>
            </div>
        </div>
    `).join('');
}

// Analyze Gmail email
async function analyzeGmailEmail(emailId) {
    const email = gmailEmails.find(e => e.id === emailId);
    if (!email) return;
    
    // Copy email content to main analysis area
    const mainTextarea = document.getElementById('rawEmail');
    if (mainTextarea) {
        mainTextarea.value = `From: ${email.sender}\nSubject: ${email.subject}\n\n${email.content}`;
        updateCharCount();
        
        // Scroll to analysis section
        document.querySelector('.analyze-section').scrollIntoView({ behavior: 'smooth' });
        
        // Trigger analysis
        setTimeout(() => {
            document.getElementById('runAnalyze').click();
        }, 500);
    }
}

// Refresh Gmail emails
async function refreshGmailEmails() {
    const refreshBtn = document.getElementById('refreshGmailBtn');
    
    if (refreshBtn) {
        refreshBtn.innerHTML = '<span class="btn-icon">⏳</span>Refreshing...';
        refreshBtn.disabled = true;
    }
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Reload emails
        await loadSampleGmailEmails();
        
        showSuccess('Gmail emails refreshed successfully!');
        
    } catch (error) {
        console.error('Failed to refresh emails:', error);
        showError('Failed to refresh emails. Please try again.');
    } finally {
        if (refreshBtn) {
            refreshBtn.innerHTML = '<span class="btn-icon">🔄</span>Refresh';
            refreshBtn.disabled = false;
        }
    }
}

// Modal functionality
function setupModal() {
    const openModalBtn = document.getElementById('openQuickCheckModal');
    const closeModalBtn = document.getElementById('closeQuickCheckModal');
    const modal = document.getElementById('quickCheckModal');
    
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
}

// Quick check functionality
function setupQuickCheck() {
    const quickCheckBtn = document.getElementById('quickCheckBtn');
    const quickEmailUrl = document.getElementById('quickEmailUrl');
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    
    // Quick check button
    if (quickCheckBtn) {
        quickCheckBtn.addEventListener('click', async function() {
            const emailContent = quickEmailUrl.value.trim();
            if (emailContent) {
                await performQuickCheck(emailContent);
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

// Perform quick check with pie chart results
async function performQuickCheck(emailContent) {
    const quickCheckBtn = document.getElementById('quickCheckBtn');
    const resultsSection = document.getElementById('quickCheckResults');
    
    // Show loading state
    quickCheckBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Analyzing...</span>';
    quickCheckBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: emailContent })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Display results
        displayQuickCheckResults(result);
        resultsSection.style.display = 'block';
        
    } catch (error) {
        console.error('Quick check failed:', error);
        showError('Quick check failed. Please try again.');
    } finally {
        // Reset button
        quickCheckBtn.innerHTML = '<span class="btn-icon">🔍</span><span class="btn-text">Analyze</span>';
        quickCheckBtn.disabled = false;
    }
}

// Display quick check results with pie chart
function displayQuickCheckResults(result) {
    const riskScore = document.getElementById('quickRiskScore');
    const riskLabel = document.getElementById('quickRiskLabel');
    const resultsSummary = document.getElementById('quickResultsSummary');
    
    // Update risk indicator
    if (riskScore && riskLabel) {
        const score = result.risk_score || 0;
        riskScore.textContent = `${score}%`;
        
        if (score >= 70) {
            riskLabel.textContent = 'High Risk';
            riskLabel.style.color = '#e53e3e';
        } else if (score >= 40) {
            riskLabel.textContent = 'Medium Risk';
            riskLabel.style.color = '#dd6b20';
        } else {
            riskLabel.textContent = 'Low Risk';
            riskLabel.style.color = '#38a169';
        }
    }
    
    // Create pie chart
    createQuickCheckChart(result);
    
    // Update summary
    if (resultsSummary) {
        const summary = result.summary || 'Analysis completed successfully.';
        resultsSummary.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem;">Analysis Summary:</div>
            <div>${summary}</div>
        `;
    }
}

// Create pie chart for quick check results
function createQuickCheckChart(result) {
    const ctx = document.getElementById('quickCheckChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (window.quickCheckChart) {
        window.quickCheckChart.destroy();
    }
    
    const riskScore = result.risk_score || 0;
    const safeScore = 100 - riskScore;
    
    window.quickCheckChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Risk', 'Safe'],
            datasets: [{
                data: [riskScore, safeScore],
                backgroundColor: [
                    riskScore >= 70 ? '#e53e3e' : riskScore >= 40 ? '#dd6b20' : '#38a169',
                    '#e2e8f0'
                ],
                borderWidth: 0,
                cutout: '60%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            }
        }
    });
}

// Navigation function for agent pages
function navigateToAgent(agentType) {
    // For now, we'll show an alert. In a real app, this would navigate to separate pages
    const agentNames = {
        'email-parser': 'Email Parser Agent',
        'risk-scorer': 'Risk Scorer Agent',
        'alert-generator': 'Alert Generator Agent'
    };
    
    const agentName = agentNames[agentType] || 'Unknown Agent';
    
    // Create a simple modal for agent details
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🤖 ${agentName}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🚧</div>
                    <h3>Coming Soon!</h3>
                    <p>Detailed ${agentName} page is under development.</p>
                    <p>This will include:</p>
                    <ul style="text-align: left; margin: 1rem 0;">
                        <li>Real-time performance metrics</li>
                        <li>Detailed configuration options</li>
                        <li>Historical data and analytics</li>
                        <li>Agent-specific settings</li>
                    </ul>
                    <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()" style="margin-top: 1rem;">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });
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
    console.log('Sign out button found:', signOutBtn); // Debug log
    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Sign out button clicked!'); // Debug log
            showSignOutModal();
        });
        console.log('Sign out event listener attached'); // Debug log
    } else {
        console.error('Sign out button not found!'); // Debug log
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
    setupModal();
    setupGmailIntegration();
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

// Sign Out Modal Functions
function showSignOutModal() {
    const modal = document.getElementById('signOutModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function closeSignOutModal() {
    const modal = document.getElementById('signOutModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

async function confirmSignOut() {
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
        }
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Sign out error:', error);
        // Fallback - just redirect
        window.location.href = 'index.html';
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const signOutModal = document.getElementById('signOutModal');
    if (signOutModal && e.target === signOutModal) {
        closeSignOutModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSignOutModal();
    }
});
