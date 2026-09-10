/**
 * MedAssist AI — Main Application JavaScript
 * Core utilities, theme management, chat, and API interactions
 */

// ═══════════════════════════════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

const Theme = {
  current: localStorage.getItem('medassist-theme') || 'light',

  init() {
    document.documentElement.setAttribute('data-theme', this.current);
    this.updateIcon();
  },

  toggle() {
    document.body.classList.add('theme-transitioning');
    this.current = this.current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.current);
    localStorage.setItem('medassist-theme', this.current);
    this.updateIcon();
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 350);
  },

  updateIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = this.current === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
};

// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(title, message = '', type = 'info', duration = 4000) {
    if (!this.container) this.init();
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
    `;
    this.container.appendChild(toast);
    if (duration > 0) setTimeout(() => toast.remove(), duration);
    return toast;
  },

  success: (t, m) => Toast.show(t, m, 'success'),
  error: (t, m) => Toast.show(t, m, 'error'),
  warning: (t, m) => Toast.show(t, m, 'warning'),
  info: (t, m) => Toast.show(t, m, 'info'),
};

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

const Sidebar = {
  collapsed: localStorage.getItem('sidebar-collapsed') === 'true',

  init() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('main-content');
    const topbar = document.getElementById('topbar');
    if (!sidebar) return;

    if (this.collapsed) this.applyCollapsed();
    this.setActiveLink();
  },

  toggle() {
    this.collapsed = !this.collapsed;
    localStorage.setItem('sidebar-collapsed', this.collapsed);
    if (this.collapsed) this.applyCollapsed();
    else this.applyExpanded();
  },

  applyCollapsed() {
    document.getElementById('sidebar')?.classList.add('collapsed');
    document.getElementById('main-content')?.classList.add('sidebar-collapsed');
    document.getElementById('topbar')?.classList.add('sidebar-collapsed');
  },

  applyExpanded() {
    document.getElementById('sidebar')?.classList.remove('collapsed');
    document.getElementById('main-content')?.classList.remove('sidebar-collapsed');
    document.getElementById('topbar')?.classList.remove('sidebar-collapsed');
  },

  toggleMobile() {
    document.getElementById('sidebar')?.classList.toggle('mobile-open');
  },

  setActiveLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.remove('active');
      const href = el.getAttribute('href');
      if (href && (path === href || (href !== '/' && path.startsWith(href)))) {
        el.classList.add('active');
      }
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API ${endpoint}:`, err);
      throw err;
    }
  },

  post: (endpoint, body) => API.request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  get: (endpoint) => API.request(endpoint, { method: 'GET' }),

  // ── Specific endpoints ─────────────────────────────────────────────
  chat: (message, history, language) => API.post('/chat', { message, history, language }),
  symptoms: (symptoms) => API.post('/symptoms', { symptoms }),
  disease: (disease) => API.post('/disease', { disease }),
  medication: (medication) => API.post('/medication', { medication }),
  healthTip: () => API.get('/health-tip'),
  wellnessPlan: (profile) => API.post('/wellness-plan', profile),

  async uploadReport(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${this.baseUrl}/report/upload`, {
      method: 'POST', body: formData,
    });
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message);
    return data;
  },
};

// ═══════════════════════════════════════════════════════════════════
// CHAT ENGINE
// ═══════════════════════════════════════════════════════════════════

const Chat = {
  messages: [],
  isLoading: false,

  init(options = {}) {
    this.messagesContainer = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send');
    this.typingEl = document.getElementById('typing-indicator');
    if (!this.messagesContainer || !this.inputEl) return;

    this.loadHistory();
    this.loadServerHistory();
    this.bindEvents();
    if (options.welcomeMessage) this.addAIMessage(options.welcomeMessage);
  },

  bindEvents() {
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    this.inputEl.addEventListener('input', () => this.autoResize());
    this.sendBtn?.addEventListener('click', () => this.send());
  },

  autoResize() {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 160) + 'px';
  },

  async send() {
    const message = this.inputEl.value.trim();
    if (!message || this.isLoading) return;

    this.isLoading = true;
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    if (this.sendBtn) this.sendBtn.disabled = true;

    this.addUserMessage(message);
    this.showTyping();

    try {
      const language = localStorage.getItem('doctortalk-language') || 'en-IN';
      const data = await API.chat(message, this.messages.slice(-10), language);
      this.hideTyping();
      this.addAIMessage(data.message);

      if (data.demo) {
        Toast.info('Demo Mode', 'Configure your IBM watsonx API key for full AI responses.');
      }
    } catch (err) {
      this.hideTyping();
      this.addAIMessage('⚠️ I encountered an error. Please try again.');
      Toast.error('Error', err.message);
    } finally {
      this.isLoading = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      this.inputEl.focus();
    }
  },

  addUserMessage(text) {
    const msg = { role: 'user', content: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    this.messages.push(msg);
    this.renderMessage(msg);
    this.scrollToBottom();
    this.saveHistory();
  },

  addAIMessage(text) {
    const msg = { role: 'assistant', content: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    this.messages.push(msg);
    this.renderMessage(msg);
    this.scrollToBottom();
    this.saveHistory();
  },

  renderMessage(msg) {
    if (!this.messagesContainer) return;
    const isUser = msg.role === 'user';
    const avatarClass = isUser ? 'user' : 'ai';
    const avatarContent = isUser ? 'U' : '<i class="fas fa-robot"></i>';
    const html = this.parseMarkdown(msg.content);

    const el = document.createElement('div');
    el.className = `message-wrap ${isUser ? 'user' : 'ai'} fade-in`;
    el.innerHTML = `
      <div class="message-avatar ${avatarClass}">${avatarContent}</div>
      <div>
        <div class="message-bubble ${avatarClass} ai-response">${html}</div>
        <div class="message-meta">
          <span class="message-time">${msg.time}</span>
          ${!isUser ? `
            <div class="message-actions">
              <button class="msg-action-btn" title="Copy" onclick="Chat.copyMessage(this)"><i class="far fa-copy"></i></button>
              <button class="msg-action-btn" title="Like" onclick="Chat.likeMessage(this, 'like')"><i class="far fa-thumbs-up"></i></button>
              <button class="msg-action-btn" title="Dislike" onclick="Chat.likeMessage(this, 'dislike')"><i class="far fa-thumbs-down"></i></button>
              <button class="msg-action-btn" title="Read aloud" onclick="Chat.speakMessage(this)"><i class="fas fa-volume-up"></i></button>
            </div>` : ''}
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(el);
  },

  parseMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/, '<p>$1</p>')
      .replace(/---/g, '<hr>');
  },

  showTyping() {
    if (this.typingEl) this.typingEl.style.display = 'flex';
    this.scrollToBottom();
  },

  hideTyping() {
    if (this.typingEl) this.typingEl.style.display = 'none';
  },

  scrollToBottom() {
    if (this.messagesContainer) {
      requestAnimationFrame(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      });
    }
  },

  copyMessage(btn) {
    const bubble = btn.closest('.message-wrap').querySelector('.message-bubble');
    navigator.clipboard.writeText(bubble.innerText).then(() => {
      Toast.success('Copied!', 'Message copied to clipboard.');
    });
  },

  likeMessage(btn, type) {
    btn.style.color = type === 'like' ? 'var(--success)' : 'var(--danger)';
    Toast.success('Feedback', `Thank you for your ${type}!`);
  },

  speakMessage(btn) {
    const bubble = btn.closest('.message-wrap').querySelector('.message-bubble');
    if (!('speechSynthesis' in window)) { Toast.warning('Not Supported','Speech output is not available in this browser.'); return; }
    const utterance = new SpeechSynthesisUtterance(bubble.innerText);
    utterance.lang = localStorage.getItem('doctortalk-language') || 'en-IN';
    utterance.rate = parseFloat(localStorage.getItem('doctortalk-voice-speed') || '0.9');
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    Toast.info('Reading aloud', 'Playing response...');
  },

  recognition: null,
  startVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { Toast.warning('Not Supported','Voice input is not supported in this browser. Try Chrome or Edge.'); return; }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    this.stopVoiceInput(); this.recognition=new SR();
    this.recognition.lang=localStorage.getItem('doctortalk-language')||'en-IN';
    this.recognition.interimResults=false; this.recognition.continuous=false;
    this.recognition.onstart=()=>{const s=document.getElementById('voice-status');if(s)s.textContent='Listening…';Toast.info('Voice message','Speak now.');};
    this.recognition.onresult=e=>{const t=e.results[0][0].transcript;if(this.inputEl){this.inputEl.value=t;this.autoResize();}const s=document.getElementById('voice-status');if(s)s.textContent='Ready';this.send();};
    this.recognition.onerror=e=>{const s=document.getElementById('voice-status');if(s)s.textContent='';Toast.error('Voice Error',e.error==='not-allowed'?'Microphone permission was denied.':'Could not capture voice.');};
    this.recognition.onend=()=>{const s=document.getElementById('voice-status');if(s)s.textContent='';};
    this.recognition.start();
  },
  stopVoiceInput(){try{this.recognition?.stop()}catch(e){}this.recognition=null;const s=document.getElementById('voice-status');if(s)s.textContent='';},

  clearChat() {
    this.messages = [];
    if (this.messagesContainer) this.messagesContainer.innerHTML = '';
    localStorage.removeItem('medassist-chat');
    Toast.success('Cleared', 'Chat history has been cleared.');
  },

  exportPDF() { window.location.href='/api/chat/export-pdf'; },

  exportChat() {
    const text = this.messages.map(m =>
      `[${m.time}] ${m.role === 'user' ? 'You' : 'MedAssist AI'}: ${m.content}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `medassist-chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    Toast.success('Exported', 'Chat exported successfully.');
  },

  saveHistory() {
    localStorage.setItem('medassist-chat', JSON.stringify(this.messages.slice(-50)));
  },


  async loadServerHistory() {
    try { const r=await fetch('/api/chat/history'); const d=await r.json(); if(r.ok && d.messages?.length){ this.messages=d.messages.map(x=>({role:x.role,content:x.content,time:new Date(x.created_at.replace(' ','T')+'Z').toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})})); this.messagesContainer.innerHTML=''; this.messages.forEach(m=>this.renderMessage(m)); this.scrollToBottom(); } } catch(e){}
  },

  loadHistory() {
    try {
      const saved = localStorage.getItem('medassist-chat');
      if (saved) {
        this.messages = JSON.parse(saved);
        this.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
      }
    } catch (e) {}
  },
};

// ═══════════════════════════════════════════════════════════════════
// LOADING HELPERS
// ═══════════════════════════════════════════════════════════════════

const Loader = {
  show(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `
      <div class="d-flex justify-content-center align-items-center py-5">
        <div style="text-align:center;">
          <div class="loading-spinner" style="margin:0 auto 1rem; border-color: var(--border-color); border-top-color: var(--primary);"></div>
          <p style="color:var(--text-muted); font-size:0.875rem;">Analyzing with IBM watsonx...</p>
        </div>
      </div>`;
  },

  skeleton(containerId, count = 3) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array.from({ length: count }, () => `
      <div class="card mb-3">
        <div class="card-body">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width:80%"></div>
          <div class="skeleton skeleton-text" style="width:60%"></div>
        </div>
      </div>`).join('');
  },

  renderResult(containerId, html) {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = html;
      el.classList.add('fade-in');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER (for results pages)
// ═══════════════════════════════════════════════════════════════════

function renderMarkdown(text) {
  return Chat.parseMarkdown(text);
}

function renderAIResult(containerId, text, title = '') {
  const titleHtml = title ? `<h5 class="fw-bold mb-3"><i class="fas fa-robot text-primary me-2"></i>${title}</h5>` : '';
  Loader.renderResult(containerId, `
    <div class="card">
      <div class="card-body ai-response">
        ${titleHtml}
        ${renderMarkdown(text)}
        <div class="disclaimer-box mt-4">
          <i class="fas fa-shield-alt"></i>
          <span>This information is for educational purposes only and does not constitute medical advice, diagnosis, or treatment.
          Always consult a qualified healthcare professional for personal medical guidance.</span>
        </div>
      </div>
    </div>`);
}

// ═══════════════════════════════════════════════════════════════════
// HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════════

const Dashboard = {
  init() {
    this.loadHealthTip();
    this.initProgressBars();
    this.initBMI();
  },

  async loadHealthTip() {
    const el = document.getElementById('health-tip');
    if (!el) return;
    try {
      const data = await API.healthTip();
      el.innerHTML = `<p class="ai-response">${renderMarkdown(data.tip)}</p>`;
    } catch {
      el.innerHTML = '<p class="text-muted">Could not load health tip.</p>';
    }
  },

  initProgressBars() {
    document.querySelectorAll('[data-progress]').forEach(bar => {
      setTimeout(() => {
        bar.style.width = bar.dataset.progress + '%';
      }, 200);
    });
  },

  initBMI() {
    const form = document.getElementById('bmi-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const w = parseFloat(document.getElementById('bmi-weight').value);
      const h = parseFloat(document.getElementById('bmi-height').value) / 100;
      if (!w || !h) return;
      const bmi = (w / (h * h)).toFixed(1);
      let cat = bmi < 18.5 ? ['Underweight', 'warning'] :
                bmi < 25 ? ['Normal weight', 'success'] :
                bmi < 30 ? ['Overweight', 'warning'] : ['Obese', 'danger'];
      document.getElementById('bmi-result').innerHTML = `
        <div class="text-center mt-3">
          <div style="font-size:2.5rem;font-weight:800;color:var(--${cat[1]})">${bmi}</div>
          <span class="badge-pill badge-${cat[1]}">${cat[0]}</span>
        </div>`;
    });
  },
};

// ═══════════════════════════════════════════════════════════════════
// SYMPTOM CHECKER
// ═══════════════════════════════════════════════════════════════════

const SymptomChecker = {
  symptoms: [],

  init() {
    const input = document.getElementById('symptom-input');
    const addBtn = document.getElementById('add-symptom');
    if (!input || !addBtn) return;

    addBtn.addEventListener('click', () => this.addSymptom(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.addSymptom(input.value.trim()); }
    });

    document.getElementById('check-symptoms-btn')?.addEventListener('click', () => this.analyze());
  },

  addSymptom(text) {
    if (!text || this.symptoms.includes(text)) return;
    this.symptoms.push(text);
    this.renderTags();
    document.getElementById('symptom-input').value = '';
  },

  removeSymptom(idx) {
    this.symptoms.splice(idx, 1);
    this.renderTags();
  },

  renderTags() {
    const container = document.getElementById('symptom-tags');
    if (!container) return;
    container.innerHTML = this.symptoms.map((s, i) => `
      <span class="symptom-tag">
        ${s}
        <span class="remove" onclick="SymptomChecker.removeSymptom(${i})">✕</span>
      </span>`).join('');
  },

  async analyze() {
    if (!this.symptoms.length) {
      Toast.warning('No Symptoms', 'Please add at least one symptom.');
      return;
    }
    const resultEl = document.getElementById('symptom-result');
    if (!resultEl) return;

    Loader.show('symptom-result');
    try {
      const data = await API.symptoms(this.symptoms.join(', '));
      renderAIResult('symptom-result', data.analysis, 'Symptom Analysis');
    } catch (err) {
      Loader.renderResult('symptom-result', `<div class="alert alert-danger">Error: ${err.message}</div>`);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// DISEASE INFORMATION
// ═══════════════════════════════════════════════════════════════════

const DiseaseInfo = {
  async search(disease) {
    if (!disease) return;
    Loader.skeleton('disease-result', 4);
    try {
      const data = await API.disease(disease);
      renderAIResult('disease-result', data.info, `${data.disease} — Educational Overview`);
    } catch (err) {
      Loader.renderResult('disease-result', `<div class="alert alert-danger">Error: ${err.message}</div>`);
    }
  },

  init() {
    const btn = document.getElementById('search-disease-btn');
    const input = document.getElementById('disease-input');
    if (!btn || !input) return;

    btn.addEventListener('click', () => this.search(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.search(input.value.trim());
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// MEDICATION INFORMATION
// ═══════════════════════════════════════════════════════════════════

const MedicationInfo = {
  async search(medication) {
    if (!medication) return;
    Loader.skeleton('medication-result', 4);
    try {
      const data = await API.medication(medication);
      renderAIResult('medication-result', data.info, `${data.medication} — Medication Information`);
    } catch (err) {
      Loader.renderResult('medication-result', `<div class="alert alert-danger">Error: ${err.message}</div>`);
    }
  },

  init() {
    const btn = document.getElementById('search-medication-btn');
    const input = document.getElementById('medication-input');
    if (!btn || !input) return;

    btn.addEventListener('click', () => this.search(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.search(input.value.trim());
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// REPORT UPLOAD
// ═══════════════════════════════════════════════════════════════════

const ReportUpload = {
  init() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    if (!zone) return;

    zone.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
      this.handleFile(e.dataTransfer.files[0]);
    });
  },

  async handleFile(file) {
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.some(t => file.type === t || file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
      Toast.error('Invalid File', 'Only PDF, DOCX, and TXT files are supported.');
      return;
    }

    document.getElementById('upload-zone').innerHTML = `
      <div class="upload-icon"><i class="fas fa-file-medical animate-pulse"></i></div>
      <div class="upload-title">${file.name}</div>
      <div class="upload-subtitle">Uploading and analyzing...</div>`;

    Loader.show('report-result');
    try {
      const data = await API.uploadReport(file);
      renderAIResult('report-result', data.analysis, 'Medical Report Analysis');
      Toast.success('Analysis Complete', 'Your report has been analyzed successfully.');
    } catch (err) {
      Toast.error('Upload Failed', err.message);
      this.resetZone();
    }
  },

  resetZone() {
    const zone = document.getElementById('upload-zone');
    if (zone) zone.innerHTML = `
      <div class="upload-icon"><i class="fas fa-file-medical"></i></div>
      <div class="upload-title">Drop your medical report here</div>
      <div class="upload-subtitle">Supports PDF, DOCX, and TXT files up to 16MB</div>`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════

const Appointments = {
  list: JSON.parse(localStorage.getItem('appointments') || '[]'),

  init() {
    this.render();
    document.getElementById('add-appointment-btn')?.addEventListener('click', () => this.add());
  },

  add() {
    const title = document.getElementById('appt-title')?.value.trim();
    const date = document.getElementById('appt-date')?.value;
    const doctor = document.getElementById('appt-doctor')?.value.trim();
    if (!title || !date) { Toast.warning('Required Fields', 'Please fill in title and date.'); return; }

    this.list.push({ id: Date.now(), title, date, doctor, status: 'upcoming' });
    this.save();
    this.render();
    Toast.success('Appointment Added', `${title} scheduled.`);
    document.getElementById('appointment-form')?.reset();
  },

  remove(id) {
    this.list = this.list.filter(a => a.id !== id);
    this.save();
    this.render();
    Toast.info('Removed', 'Appointment removed.');
  },

  render() {
    const el = document.getElementById('appointments-list');
    if (!el) return;
    if (!this.list.length) {
      el.innerHTML = '<p class="text-muted text-center py-4">No appointments scheduled.</p>';
      return;
    }
    const sorted = [...this.list].sort((a, b) => new Date(a.date) - new Date(b.date));
    el.innerHTML = sorted.map(a => {
      const d = new Date(a.date);
      return `
        <div class="appointment-card mb-3 fade-in">
          <div class="appt-date-block">
            <div class="appt-day">${d.getDate()}</div>
            <div class="appt-month">${d.toLocaleString('default',{month:'short'})}</div>
          </div>
          <div class="flex-grow-1">
            <div class="fw-bold">${a.title}</div>
            ${a.doctor ? `<div class="text-muted small"><i class="fas fa-user-md me-1"></i>${a.doctor}</div>` : ''}
            <div class="text-muted small"><i class="far fa-clock me-1"></i>${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="Appointments.remove(${a.id})">
            <i class="far fa-trash-alt"></i>
          </button>
        </div>`;
    }).join('');
  },

  save() {
    localStorage.setItem('appointments', JSON.stringify(this.list));
  }
};

// ═══════════════════════════════════════════════════════════════════
// HEALTH HISTORY TIMELINE
// ═══════════════════════════════════════════════════════════════════

const HealthTimeline = {
  events: JSON.parse(localStorage.getItem('health-timeline') || '[]'),

  init() {
    this.render();
    document.getElementById('add-event-btn')?.addEventListener('click', () => this.add());
  },

  add() {
    const title = document.getElementById('event-title')?.value.trim();
    const date = document.getElementById('event-date')?.value;
    const notes = document.getElementById('event-notes')?.value.trim();
    const type = document.getElementById('event-type')?.value || 'primary';
    if (!title || !date) { Toast.warning('Required Fields', 'Title and date are required.'); return; }

    this.events.unshift({ id: Date.now(), title, date, notes, type });
    this.save();
    this.render();
    Toast.success('Event Added', title);
    document.getElementById('timeline-form')?.reset();
  },

  render() {
    const el = document.getElementById('timeline-list');
    if (!el) return;
    if (!this.events.length) {
      el.innerHTML = '<p class="text-muted text-center py-4">No health events recorded yet.</p>';
      return;
    }
    el.innerHTML = `<div class="timeline">` + this.events.map(ev => `
      <div class="timeline-item fade-in">
        <div class="timeline-dot ${ev.type}"></div>
        <div class="timeline-date">${new Date(ev.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
        <div class="timeline-card">
          <div class="timeline-title">${ev.title}</div>
          ${ev.notes ? `<div class="timeline-body">${ev.notes}</div>` : ''}
        </div>
      </div>`).join('') + `</div>`;
  },

  save() {
    localStorage.setItem('health-timeline', JSON.stringify(this.events));
  }
};

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

const Settings = {
  init() {
    // Load saved settings
    const saved = JSON.parse(localStorage.getItem('user-settings') || '{}');
    Object.entries(saved).forEach(([key, val]) => {
      const el = document.querySelector(`[name="${key}"]`);
      if (el) el.type === 'checkbox' ? (el.checked = val) : (el.value = val);
    });

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {};
      new FormData(e.target).forEach((v, k) => { data[k] = v; });
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        data[cb.name] = cb.checked;
      });
      localStorage.setItem('user-settings', JSON.stringify(data));
      Toast.success('Settings Saved', 'Your preferences have been updated.');
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K — focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.querySelector('.topbar-search input')?.focus();
  }
  // Ctrl/Cmd + D — toggle dark mode
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    Theme.toggle();
  }
  // Escape — close mobile sidebar
  if (e.key === 'Escape') {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
  }
});

// ═══════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════

const GlobalSearch = {
  pages: [
    { name: 'Home', url: '/', icon: 'fa-home' },
    { name: 'AI Chat', url: '/chat', icon: 'fa-robot' },
    { name: 'Dashboard', url: '/dashboard', icon: 'fa-chart-line' },
    { name: 'Symptom Checker', url: '/symptoms', icon: 'fa-stethoscope' },
    { name: 'Disease Information', url: '/diseases', icon: 'fa-book-medical' },
    { name: 'Medications', url: '/medications', icon: 'fa-pills' },
    { name: 'Medical Reports', url: '/reports', icon: 'fa-file-medical' },
    { name: 'Timeline', url: '/timeline', icon: 'fa-history' },
    { name: 'Appointments', url: '/appointments', icon: 'fa-calendar' },
    { name: 'Settings', url: '/settings', icon: 'fa-cog' },
    { name: 'About', url: '/about', icon: 'fa-info-circle' },
  ],

  init() {
    const input = document.querySelector('.topbar-search input');
    if (!input) return;
    const dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown';
    dropdown.style.cssText = `position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:1000;display:none;overflow:hidden;`;
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) { dropdown.style.display = 'none'; return; }
      const results = this.pages.filter(p => p.name.toLowerCase().includes(q));
      if (!results.length) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = results.map(p =>
        `<a href="${p.url}" style="display:flex;align-items:center;gap:.75rem;padding:.625rem 1rem;color:var(--text-primary);text-decoration:none;transition:.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''">${'<i class="fas ' + p.icon + '" style="width:16px;color:var(--primary)"></i>'}<span style="font-size:.875rem">${p.name}</span></a>`
      ).join('');
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target)) dropdown.style.display = 'none';
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// EMERGENCY CONTACTS
// ═══════════════════════════════════════════════════════════════════

const Emergency = {
  STORAGE_KEY: 'medassist-emergency-contacts',
  DEFAULT: { name: 'Ambulance (National)', number: '108' },

  _contacts: [],
  _open: false,

  init() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    this._contacts = stored ? JSON.parse(stored) : [];
    this._render();

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('sos-panel');
      const fab   = document.getElementById('sos-fab');
      if (this._open && panel && !panel.contains(e.target) && !fab.contains(e.target)) {
        this._closePanel();
      }
    });

    // Enter key in number field triggers add
    const numInput = document.getElementById('sos-num-input');
    if (numInput) numInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addContact(); });
  },

  toggle() {
    this._open ? this._closePanel() : this._openPanel();
  },

  _openPanel() {
    const panel = document.getElementById('sos-panel');
    const fab   = document.getElementById('sos-fab');
    if (!panel) return;
    panel.style.display = 'block';
    fab && fab.classList.add('active');
    this._open = true;
  },

  _closePanel() {
    const panel = document.getElementById('sos-panel');
    const fab   = document.getElementById('sos-fab');
    if (!panel) return;
    panel.style.display = 'none';
    fab && fab.classList.remove('active');
    this._open = false;
  },

  _render() {
    const list = document.getElementById('sos-list');
    if (!list) return;

    // Build items: default 108 (non-deletable) + user contacts
    const allItems = [
      { name: this.DEFAULT.name, number: this.DEFAULT.number, deletable: false },
      ...this._contacts.map((c, i) => ({ ...c, deletable: true, idx: i }))
    ];

    list.innerHTML = allItems.map(item => `
      <li>
        <div class="sos-contact-info">
          <div class="sos-contact-name">${this._escape(item.name)}</div>
          <div class="sos-contact-num">${this._escape(item.number)}</div>
        </div>
        <a href="tel:${this._escape(item.number)}" class="sos-call-btn" title="Call">
          <i class="fas fa-phone"></i>
        </a>
        ${item.deletable
          ? `<button class="sos-delete-btn" onclick="Emergency.removeContact(${item.idx})" title="Remove"><i class="fas fa-times"></i></button>`
          : ''}
      </li>`).join('');
  },

  addContact() {
    const nameEl = document.getElementById('sos-name-input');
    const numEl  = document.getElementById('sos-num-input');
    const name   = nameEl ? nameEl.value.trim() : '';
    const number = numEl  ? numEl.value.trim()  : '';

    if (!number) { Toast.show('Missing number', 'Please enter a phone number.', 'warning'); return; }

    this._contacts.push({ name: name || 'Hospital', number });
    this._save();
    this._render();
    if (nameEl) nameEl.value = '';
    if (numEl)  numEl.value  = '';
    Toast.show('Contact added', `${name || 'Hospital'} (${number}) saved.`, 'success', 3000);
  },

  removeContact(idx) {
    this._contacts.splice(idx, 1);
    this._save();
    this._render();
  },

  _save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._contacts));
  },

  _escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Toast.init();
  Sidebar.init();
  GlobalSearch.init();
  Emergency.init();

  // Page-specific initializations
  const page = document.body.dataset.page;
  if (page === 'chat') Chat.init({ welcomeMessage: '👋 Hello! I\'m **MedAssist AI**, your personal health education assistant powered by IBM watsonx.\n\nI can help you with health questions, explain medical terms, provide information about diseases and medications, and much more.\n\n*How can I help you today?*' });
  if (page === 'dashboard') Dashboard.init();
  if (page === 'symptoms') SymptomChecker.init();
  if (page === 'diseases') DiseaseInfo.init();
  if (page === 'medications') MedicationInfo.init();
  if (page === 'reports') ReportUpload.init();
  if (page === 'appointments') Appointments.init();
  if (page === 'timeline') HealthTimeline.init();
  if (page === 'settings') Settings.init();
});
