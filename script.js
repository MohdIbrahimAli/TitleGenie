const generateBtn = document.getElementById("generateBtn");
const topicInput = document.getElementById("topicInput");
const resultsSection = document.getElementById("resultsSection");
const generatedTitle = document.getElementById("generatedTitle");
const generatedTags = document.getElementById("generatedTags");
const copyBtn = document.getElementById("copyBtn");
const loginLink = document.getElementById("loginLink");

// API Configuration for AI Model
const API_CONFIG = {
  // Replace these URLs with your actual ngrok endpoints
  BASE_URL: 'https://your-ngrok-url.ngrok.io', // Replace with your ngrok URL
  ENDPOINTS: {
    GENERATE_TITLE: '/api/generate-title',
    GENERATE_TAGS: '/api/generate-tags',
    GENERATE_BOTH: '/api/generate-both', // If you have a combined endpoint
    HEALTH_CHECK: '/api/health'
  },
  TIMEOUT: 30000, // 30 seconds timeout
  MAX_RETRIES: 3
};

// API Helper Functions
class AIModelAPI {
  constructor(config) {
    this.config = config;
  }

  async makeRequest(endpoint, data, retries = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT);

      const response = await fetch(`${this.config.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Add any auth headers if needed
          // 'Authorization': 'Bearer YOUR_TOKEN',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      if (retries < this.config.MAX_RETRIES && !error.name === 'AbortError') {
        console.warn(`Request failed, retrying... (${retries + 1}/${this.config.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
        return this.makeRequest(endpoint, data, retries + 1);
      }
      throw error;
    }
  }

  async generateTitle(topic, additionalParams = {}) {
    const requestData = {
      topic: topic.trim(),
      ...additionalParams
    };
    
    return await this.makeRequest(this.config.ENDPOINTS.GENERATE_TITLE, requestData);
  }

  async generateTags(topic, additionalParams = {}) {
    const requestData = {
      topic: topic.trim(),
      ...additionalParams
    };
    
    return await this.makeRequest(this.config.ENDPOINTS.GENERATE_TAGS, requestData);
  }

  async generateBoth(topic, additionalParams = {}) {
    const requestData = {
      topic: topic.trim(),
      ...additionalParams
    };
    
    return await this.makeRequest(this.config.ENDPOINTS.GENERATE_BOTH, requestData);
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.config.BASE_URL}${this.config.ENDPOINTS.HEALTH_CHECK}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Initialize API client
const aiAPI = new AIModelAPI(API_CONFIG);

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  checkFirstVisit();
  setupEventListeners();
  setupAnimations();
  checkLoginState();
});

// Check if first visit to show terms notification
function checkFirstVisit() {
  if (typeof(Storage) !== "undefined") {
    const hasVisited = sessionStorage.getItem('hasVisited');
    const termsAccepted = sessionStorage.getItem('termsAccepted');
    
    if (!hasVisited && !termsAccepted) {
      setTimeout(() => {
        showNotification('📋 Please review our Terms & Conditions before using TitleGenie', 'info', 6000);
      }, 2000);
    }
  }
}

// Check login state and update UI
function checkLoginState() {
  if (typeof(Storage) !== "undefined") {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const userEmail = sessionStorage.getItem('userEmail');
    
    if (isLoggedIn && userEmail) {
      updateLoginState(true, userEmail);
    }
  }
}

// Update login state in navbar
function updateLoginState(isLoggedIn, email = '') {
  if (isLoggedIn && loginLink) {
    loginLink.innerHTML = `<span class="login-icon">👋</span> Hi, ${email.split('@')[0]}!`;
    loginLink.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
    loginLink.href = '#';
    loginLink.onclick = handleLogout;
  } else if (loginLink) {
    loginLink.innerHTML = `<span class="login-icon">👤</span> Login`;
    loginLink.style.background = 'linear-gradient(45deg, #ff6f61, #ff8a65)';
    loginLink.href = 'login.html';
    loginLink.onclick = null;
  }
}

// Handle logout
function handleLogout(e) {
  e.preventDefault();
  if (typeof(Storage) !== "undefined") {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userEmail');
  }
  updateLoginState(false);
  showNotification('👋 Logged out successfully!', 'success');
}

// Setup all event listeners
function setupEventListeners() {
  // Generation functionality
  if (generateBtn) {
    generateBtn.onclick = generateTitleAndTags;
  }
  
  if (topicInput) {
    topicInput.onkeypress = function(e) {
      if (e.key === 'Enter') {
        generateTitleAndTags();
      }
    };
  }
  
  // Copy functionality
  if (copyBtn) {
    copyBtn.onclick = copyResults;
  }
}

// Setup animations and effects
function setupAnimations() {
  // Intersection Observer for scroll animations
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
        }
      });
    },
    { threshold: 0.1 }
  );
  
  // Observe elements for animation
  document.querySelectorAll('.step, .feature-card').forEach(el => {
    observer.observe(el);
  });
}

// Title and tag generation using AI Model
async function generateTitleAndTags() {
  const topic = topicInput.value.trim();
  
  if (!topic) {
    showNotification('⚠️ Please enter a video topic', 'error');
    topicInput.focus();
    return;
  }

  // Check if topic is too short or too long
  if (topic.length < 3) {
    showNotification('⚠️ Topic must be at least 3 characters long', 'error');
    return;
  }

  if (topic.length > 200) {
    showNotification('⚠️ Topic must be less than 200 characters', 'error');
    return;
  }
  
  // Add loading state
  const originalText = generateBtn.innerHTML;
  generateBtn.classList.add('loading');
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="btn-icon">⏳</span> Generating with AI...';
  
  try {
    // First check if the API is available
    const isHealthy = await aiAPI.healthCheck();
    if (!isHealthy) {
      throw new Error('AI model service is currently unavailable');
    }

    // Call your AI model API
    let result;
    try {
      result = await aiAPI.generateBoth(topic, {
        max_title_length: 100,
        max_tags: 15,
        include_hashtags: true,
        language: 'en',
        platform: 'youtube'
      });
    } catch (combinedError) {
      // If combined endpoint fails, try separate endpoints
      console.warn('Combined endpoint failed, trying separate endpoints:', combinedError.message);
      
      const [titleResult, tagsResult] = await Promise.all([
        aiAPI.generateTitle(topic, {
          max_length: 100,
          platform: 'youtube'
        }),
        aiAPI.generateTags(topic, {
          max_tags: 15,
          include_hashtags: true
        })
      ]);

      result = {
        title: titleResult.title || titleResult.generated_title,
        tags: tagsResult.tags || tagsResult.generated_tags,
        success: true
      };
    }

    // Handle the API response
    if (result && result.success !== false) {
      const generatedTitleText = result.title || result.generated_title || result.data?.title;
      const generatedTagsArray = result.tags || result.generated_tags || result.data?.tags || [];
      
      if (!generatedTitleText) {
        throw new Error('No title received from AI model');
      }

      // Ensure tags is an array
      const tagsArray = Array.isArray(generatedTagsArray) ? generatedTagsArray : 
                      typeof generatedTagsArray === 'string' ? generatedTagsArray.split(',').map(t => t.trim()) :
                      [];

      // Display results
      displayResults(generatedTitleText, tagsArray);
      showNotification('✨ AI-generated title and tags ready!', 'success');
      
    } else {
      throw new Error(result.error || result.message || 'Failed to generate content');
    }
    
  } catch (error) {
    console.error('AI Generation Error:', error);
    
    let errorMessage = 'Failed to generate content. ';
    
    if (error.name === 'AbortError') {
      errorMessage += 'Request timed out. Please try again.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage += 'Network error. Please check your connection and ngrok URL.';
    } else if (error.message.includes('404')) {
      errorMessage += 'API endpoint not found. Please check your endpoint configuration.';
    } else if (error.message.includes('500')) {
      errorMessage += 'AI model server error. Please try again later.';
    } else {
      errorMessage += error.message || 'Unknown error occurred.';
    }
    
    showNotification(`❌ ${errorMessage}`, 'error');
    
    // Optional: Fall back to demo content for testing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      showNotification('💡 Using demo content for localhost testing', 'info');
      setTimeout(() => {
        displayResults(
          `Amazing ${capitalizeFirstLetter(topic)} Tutorial You Must Watch!`,
          ['tutorial', topic.toLowerCase(), 'howto', 'guide', 'tips', 'youtube', 'viral']
        );
      }, 1000);
    }
    
  } finally {
    // Reset button state
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
    generateBtn.innerHTML = originalText;
  }
}

// Display results
function displayResults(title, tags) {
  if (generatedTitle) {
    generatedTitle.textContent = title;
  }
  
  if (generatedTags) {
    generatedTags.innerHTML = '';
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = `#${tag}`;
      generatedTags.appendChild(tagElement);
    });
  }
  
  if (resultsSection) {
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Copy results to clipboard
function copyResults() {
  const title = generatedTitle ? generatedTitle.textContent : '';
  const tags = generatedTags ? Array.from(generatedTags.children).map(tag => tag.textContent).join(' ') : '';
  
  const copyText = `Title: ${title}\n\nTags: ${tags}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(copyText).then(() => {
      showNotification('📋 Results copied to clipboard!', 'success');
      copyBtn.classList.add('success');
      copyBtn.innerHTML = '✅ Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('success');
        copyBtn.innerHTML = '📋 Copy All';
      }, 2000);
    }).catch(() => {
      fallbackCopy(copyText);
    });
  } else {
    fallbackCopy(copyText);
  }
}

// Fallback copy method
function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    showNotification('📋 Results copied to clipboard!', 'success');
  } catch (err) {
    showNotification('❌ Copy failed. Please copy manually.', 'error');
  } finally {
    document.body.removeChild(textArea);
  }
}

// Notification system
function showNotification(message, type = 'info', duration = 4000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">×</button>
    </div>
  `;
  
  // Notification styles
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    }
    
    .notification-success {
      border-left: 4px solid #28a745;
    }
    
    .notification-error {
      border-left: 4px solid #dc3545;
    }
    
    .notification-info {
      border-left: 4px solid #17a2b8;
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 20px;
    }
    
    .notification-message {
      color: #333;
      font-size: 14px;
      font-weight: 500;
    }
    
    .notification-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 0;
      margin-left: 15px;
    }
    
    .notification-close:hover {
      color: #333;
    }
    
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  
  if (!document.querySelector('#notification-styles')) {
    style.id = 'notification-styles';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto remove after specified duration
  const autoRemoveTimeout = setTimeout(() => {
    removeNotification(notification);
  }, duration);
  
  // Manual close
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.onclick = () => {
    clearTimeout(autoRemoveTimeout);
    removeNotification(notification);
  };
}

// Remove notification with animation
function removeNotification(notification) {
  notification.style.animation = 'slideOutRight 0.3s ease-out';
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

// Utility functions
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

//  Easter eggs
let clickCount = 0;
const logo = document.querySelector('.logo');
if (logo) {
  logo.addEventListener('click', () => {
    clickCount++;
    if (clickCount === 5) {
      showNotification('🧞‍♂️ You found the Easter egg! TitleGenie loves you!', 'success');
      clickCount = 0;
      
      // sparkle effects
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const sparkle = document.createElement('div');
          sparkle.textContent = '✨';
          sparkle.style.position = 'fixed';
          sparkle.style.left = Math.random() * window.innerWidth + 'px';
          sparkle.style.top = Math.random() * window.innerHeight + 'px';
          sparkle.style.fontSize = '50px';
          sparkle.style.pointerEvents = 'none';
          sparkle.style.animation = 'sparkle 2s ease-out forwards';
          sparkle.style.zIndex = '9999';
          
          const sparkleStyle = document.createElement('style');
          sparkleStyle.textContent = `
            @keyframes sparkle {
              0% { opacity: 1; transform: scale(0) rotate(0deg); }
              50% { opacity: 1; transform: scale(1) rotate(180deg); }
              100% { opacity: 0; transform: scale(0) rotate(360deg); }
            }
          `;
          document.head.appendChild(sparkleStyle);
          document.body.appendChild(sparkle);
          
          setTimeout(() => {
            if (sparkle.parentNode) {
              sparkle.parentNode.removeChild(sparkle);
            }
          }, 2000);
        }, i * 200);
      }
    }
  });
}