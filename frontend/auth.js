// Landing page authentication - simplified for navigation only
document.addEventListener('DOMContentLoaded', function() {
  console.log('Landing page loaded - authentication handled by separate pages');
  
  // Check if user is already authenticated and redirect to dashboard
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log('User already authenticated:', user.email);
        // Check if we're on the root landing page or frontend landing page
        if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
          window.location.href = 'frontend/dashboard.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }
    });
  }
});