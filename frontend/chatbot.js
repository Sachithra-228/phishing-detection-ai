// Chat Bot JavaScript
let chatBotOpen = false;
let chatHistory = [];

// Knowledge base for site-related questions
const knowledgeBase = {
    'what is phishing': {
        answer: 'Phishing is a cyber attack where criminals impersonate legitimate organizations to steal sensitive information like passwords, credit card numbers, or personal data. They often use fake emails, websites, or messages that look real.',
        related: ['How does phishing work?', 'What are common phishing signs?']
    },
    'how does the ai work': {
        answer: 'Our AI uses advanced machine learning algorithms to analyze emails in real-time. It examines patterns, sender reputation, content analysis, and behavioral indicators to detect phishing attempts with high accuracy.',
        related: ['What makes our AI different?', 'How accurate is the detection?']
    },
    'is it free to use': {
        answer: 'Yes! Our basic phishing detection service is completely free. You can analyze unlimited emails and get real-time protection. We also offer premium features for advanced users.',
        related: ['What are the premium features?', 'How do I get started?']
    },
    'how accurate is the detection': {
        answer: 'Our AI achieves over 95% accuracy in detecting phishing emails. It continuously learns from new threats and updates its detection patterns to stay ahead of evolving attack methods.',
        related: ['How does it learn?', 'What if it makes a mistake?']
    },
    'what are common phishing signs': {
        answer: 'Common signs include: urgent language ("act now"), suspicious sender addresses, requests for personal information, poor grammar/spelling, unexpected attachments, and links to unfamiliar websites.',
        related: ['How can I protect myself?', 'What should I do if I receive a phishing email?']
    },
    'how can i protect myself': {
        answer: 'Always verify sender identities, never click suspicious links, use strong passwords, enable two-factor authentication, keep software updated, and use our AI-powered detection tool for email analysis.',
        related: ['What is two-factor authentication?', 'How do I report phishing?']
    },
    'how do i get started': {
        answer: 'Getting started is easy! Click "Get Started" to create your free account, then you can immediately start analyzing emails for phishing threats. No credit card required.',
        related: ['Do I need to download anything?', 'Can I use it on mobile?']
    },
    'what makes our ai different': {
        answer: 'Our AI combines multiple detection methods: content analysis, sender reputation checking, behavioral pattern recognition, and real-time threat intelligence. It\'s specifically trained on phishing patterns.',
        related: ['How does it compare to other tools?', 'Can it detect new threats?']
    },
    'can it detect new threats': {
        answer: 'Yes! Our AI continuously learns from new phishing patterns and updates its detection algorithms. It can identify previously unknown threats based on behavioral patterns and content analysis.',
        related: ['How often does it update?', 'What about zero-day attacks?']
    },
    'how do i report phishing': {
        answer: 'You can report phishing emails directly through our platform. Just paste the suspicious email content and our system will analyze it. You can also forward phishing emails to report@phishing-detection-ai.com',
        related: ['Will you notify others?', 'How long does analysis take?']
    },
    'do i need to download anything': {
        answer: 'No downloads required! Our service works entirely in your web browser. You can also use our Chrome extension for seamless Gmail integration and automatic email analysis.',
        related: ['How does the Chrome extension work?', 'Is it safe?']
    },
    'can i use it on mobile': {
        answer: 'Absolutely! Our web interface is fully responsive and works great on mobile devices. You can analyze emails and access all features from your smartphone or tablet.',
        related: ['Is there a mobile app?', 'How do I use it on mobile?']
    },
    'is it safe': {
        answer: 'Yes, completely safe! We use enterprise-grade security, encrypt all data, and never store your personal information. Our Chrome extension only reads emails you specifically choose to analyze.',
        related: ['What data do you collect?', 'How do you protect privacy?']
    },
    'what data do you collect': {
        answer: 'We only collect email content you choose to analyze. We don\'t store personal information, passwords, or sensitive data. All analysis is done securely and anonymously.',
        related: ['How do you protect privacy?', 'Can I delete my data?']
    },
    'how do you protect privacy': {
        answer: 'We use end-to-end encryption, secure data centers, and strict privacy policies. Your email content is only used for analysis and is never shared with third parties.',
        related: ['What is your privacy policy?', 'Can I opt out?']
    }
};

// Initialize chat bot
document.addEventListener('DOMContentLoaded', function() {
    initializeChatBot();
});

function initializeChatBot() {
    const toggle = document.getElementById('chatBotToggle');
    const windowEl = document.getElementById('chatBotWindow');
    const close = document.querySelector('.chatbot-close');
    const sendBtn = document.getElementById('chatBotSend');
    const input = document.getElementById('chatBotInput');

    if (!toggle || !windowEl || !sendBtn || !input) {
        return; // chatbot UI not present on this page
    }

    // Toggle chat bot
    toggle.addEventListener('click', function() {
        chatBotOpen = !chatBotOpen;
        windowEl.style.display = chatBotOpen ? 'flex' : 'none';
        
        if (chatBotOpen) {
            input.focus();
        }
    });

    // Close chat bot
    if (close) close.addEventListener('click', function() {
        chatBotOpen = false;
        windowEl.style.display = 'none';
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
        if (chatBotOpen && !windowEl.contains(e.target) && !toggle.contains(e.target)) {
            chatBotOpen = false;
            windowEl.style.display = 'none';
        }
    });
}

function sendMessage() {
    const input = document.getElementById('chatBotInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Process message after delay
    setTimeout(() => {
        hideTypingIndicator();
        const response = getBotResponse(message);
        addMessage(response, 'bot');
    }, 1000 + Math.random() * 1000); // Random delay for realism
}

function addMessage(content, sender) {
    const messagesContainer = document.getElementById('chatBotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (typeof content === 'string') {
        contentDiv.innerHTML = `<p>${content}</p>`;
    } else {
        contentDiv.innerHTML = content;
    }
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store in history
    chatHistory.push({ content, sender, timestamp: new Date() });
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatBotMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message bot-message typing-indicator';
    typingDiv.id = 'typingIndicator';
    
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function getBotResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check for exact matches first
    for (const [key, data] of Object.entries(knowledgeBase)) {
        if (lowerMessage.includes(key)) {
            let response = data.answer;
            
            // Add related questions if available
            if (data.related && data.related.length > 0) {
                response += '<div class="quick-questions">';
                data.related.forEach(question => {
                    response += `<button class="quick-btn" onclick="askQuickQuestion('${question}')">${question}</button>`;
                });
                response += '</div>';
            }
            
            return response;
        }
    }
    
    // Check for keywords
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('money')) {
        return 'Our basic service is completely free! You can analyze unlimited emails at no cost. Premium features are available for advanced users.';
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
        return 'I\'m here to help! You can ask me about phishing detection, how our AI works, pricing, security features, or anything else about our service. What would you like to know?';
    }
    
    if (lowerMessage.includes('contact') || lowerMessage.includes('email')) {
        return 'You can reach our support team at support@phishing-detection-ai.com or use our contact form. We typically respond within 24 hours.';
    }
    
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
        return 'You\'re welcome! I\'m happy to help. Is there anything else you\'d like to know about phishing detection or our service?';
    }
    
    // Default response
    return 'I understand you\'re asking about "' + message + '". While I have extensive knowledge about phishing detection and our service, I might not have specific information about that topic. Could you try rephrasing your question or ask about our core features like AI detection, security, or how to get started?';
}

function askQuickQuestion(question) {
    const input = document.getElementById('chatBotInput');
    input.value = question;
    sendMessage();
}

// Auto-open chat bot after 10 seconds on landing page
setTimeout(() => {
    if (!chatBotOpen && window.location.pathname.includes('index.html')) {
        // Show a subtle notification
        const toggle = document.getElementById('chatBotToggle');
        toggle.style.animation = 'chatbotPulse 1s ease-in-out 3';
    }
}, 10000);

// Export functions for global access
window.askQuickQuestion = askQuickQuestion;
