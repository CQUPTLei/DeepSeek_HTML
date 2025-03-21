
// 预处理数学公式，避免 marked 转义问题
function extractMath(text) {
  let mathBlocks = [];
  text = text.replace(/(\\\[[\s\S]+?\\\])/g, function (match) {
    mathBlocks.push(match);
    return 'MATHPLACEHOLDER' + (mathBlocks.length - 1) + 'END';
  });
  text = text.replace(/(\\\([\s\S]+?\\\))/g, function (match) {
    mathBlocks.push(match);
    return 'MATHPLACEHOLDER' + (mathBlocks.length - 1) + 'END';
  });
  return { text, mathBlocks };
}
function restoreMath(text, mathBlocks) {
  return text.replace(/MATHPLACEHOLDER(\d+)END/g, function (match, index) {
    return mathBlocks[index];
  });
}
function renderContent(content) {
  let { text, mathBlocks } = extractMath(content);
  let html = marked.parse(text);
  return restoreMath(html, mathBlocks);
}

// 复制消息内容函数（优先复制数据属性中的原始 markdown）
function copyMessageContent(btn) {
  const messageContent = btn.parentElement.querySelector('.message-content');
  if (messageContent) {
    const text = messageContent.dataset.original || messageContent.innerText;
    const convertedText = text
      .replace(/\\\(/g, '$').replace(/\\\)/g, '$')
      .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
    navigator.clipboard.writeText(convertedText).then(() => {
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 2000);
    }).catch(err => {
      console.error('复制失败', err);
    });
  }
}
// 复制代码块函数，只复制代码部分（避免复制按钮文字）
function copyCodeBlock(preElement) {
  const codeElement = preElement.querySelector('code');
  const codeText = codeElement ? codeElement.innerText : preElement.innerText;
  navigator.clipboard.writeText(codeText).then(() => {
    const btn = preElement.querySelector('.copy-code-btn');
    if (btn) {
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 2000);
    }
  }).catch(err => {
    console.error('复制代码失败', err);
  });
}
// 为代码块添加复制按钮
function addCodeCopyButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (!pre.querySelector('.copy-code-btn')) {
      pre.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.textContent = '复制';
      btn.onclick = function () { copyCodeBlock(pre); };
      pre.appendChild(btn);
    }
  });
}

// 初始化配置
const API_URL = 'https://api.deepseek.com/chat/completions';
let API_KEY = '';
let fileHandle = null;
let sessions = [];
let currentSessionId = null;
let isGenerating = false;

class ChatSession {
  constructor() {
    this.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    this.title = '新对话';
    this.createTime = new Date().toISOString();
    this.messages = [];
    this.model = 'deepseek-chat';
  }
}

async function loadConfig() {
  return new Promise((resolve) => {
    const checkConfig = () => {
      if (window.CONFIG?.API_KEY) {
        API_KEY = window.CONFIG.API_KEY;
        resolve(true);
      } else {
        setTimeout(checkConfig, 100);
      }
    };
    checkConfig();
    setTimeout(() => {
      if (!API_KEY) {
        showError('未检测到有效配置文件');
        resolve(false);
      }
    }, 3000);
  });
}

// 新增错误提示函数
function showError(message) {
  const container = document.getElementById('chatContainer');
  container.innerHTML = `
        <div class="p-4 bg-red-100 text-red-700 rounded-lg">
          <strong>错误:</strong> ${message}
          <div class="mt-2 text-sm">
            请创建配置文件 <code>config.json</code>，格式示例：
            <pre class="bg-gray-100 p-2 rounded mt-1">
{
  "API_KEY": "your-api-key-here"
}</pre>
          </div>
        </div>
      `;
}

// 配置 marked 和 highlight.js
marked.setOptions({
  breaks: true,
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
});

// IndexedDB 操作
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatDB', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      db.createObjectStore('fileHandleStore');
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}
async function saveFileHandleToDB(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileHandleStore', 'readwrite');
    const store = tx.objectStore('fileHandleStore');
    const request = store.put(handle, 'chatFile');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
async function getFileHandleFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileHandleStore', 'readonly');
    const store = tx.objectStore('fileHandleStore');
    const request = store.get('chatFile');
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });
}
// 新增：删除已存储的文件句柄
async function removeStoredFileHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileHandleStore', 'readwrite');
    const store = tx.objectStore('fileHandleStore');
    const request = store.delete('chatFile');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
// 优化后的文件句柄获取函数：先尝试使用 open 文件选择器，若用户取消则用 save 文件选择器
async function getFileHandleFunc() {
  try {
    const [existingHandle] = await window.showOpenFilePicker({
      suggestedName: 'deepseek_log.json',
      types: [{
        description: 'JSON 文件',
        accept: { 'application/json': ['.json'] }
      }]
    });
    await saveFileHandleToDB(existingHandle);
    return existingHandle;
  } catch (openError) {
    try {
      const newHandle = await window.showSaveFilePicker({
        suggestedName: 'deepseek_log.json',
        types: [{
          description: 'JSON 文件',
          accept: { 'application/json': ['.json'] }
        }]
      });
      await saveFileHandleToDB(newHandle);
      return newHandle;
    } catch (saveError) {
      console.error(saveError);
      throw saveError;
    }
  }
}
// 调整 loadSessionsFromFile，若文件不存在或调用 getFile() 被拒绝则提示用户重新选择
async function loadSessionsFromFile() {
  if (!fileHandle) return [];
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    let loadedSessions = [];
    try {
      loadedSessions = JSON.parse(content);
    } catch (e) {
      loadedSessions = [];
    }
    loadedSessions.forEach(s => { if (!s.id) s.id = Date.now(); });
    renderSessionList(loadedSessions);
    return loadedSessions;
  } catch (e) {
    console.error('读取文件失败:', e);
    if (e.name === "NotAllowedError") {
      // 权限问题：显示恢复按钮，让用户点击恢复
      showRestoreSessionPrompt("无法自动访问保存的文件，需要用户操作恢复会话。");
    } else if (e.name === "NotFoundError") {
      showFilePickerPrompt("无法找到保存的文件，请选择新的保存位置。");
    }
    return [];
  }
}
async function saveSessionsToFile() {
  if (!fileHandle) return;
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(sessions, null, 2));
  await writable.close();
}
function showFilePickerPrompt(message) {
  if (document.getElementById('filePickerPrompt')) return;
  const container = document.getElementById('chatContainer');
  const promptDiv = document.createElement('div');
  promptDiv.id = 'filePickerPrompt';
  promptDiv.className = 'p-4 bg-yellow-100 text-yellow-800 text-center';
  promptDiv.innerHTML = message + ' 请点击 <button id="chooseFileButton" class="underline text-blue-500">这里</button>。';
  container.prepend(promptDiv);
  document.getElementById('chooseFileButton').addEventListener('click', async function (e) {
    try {
      fileHandle = await getFileHandleFunc();
      promptDiv.remove();
      sessions = await loadSessionsFromFile();
      if (sessions.length === 0) {
        await createNewSession();
      } else {
        switchSession(sessions[sessions.length - 1].id);
      }
    } catch (err) {
      console.error("选择保存位置失败", err);
    }
  });
}
// 新增：显示恢复会话按钮（利用用户手势请求权限）
function showRestoreSessionPrompt(message) {
  if (document.getElementById('restorePrompt')) return;
  const container = document.getElementById('chatContainer');
  const promptDiv = document.createElement('div');
  promptDiv.id = 'restorePrompt';
  promptDiv.className = 'p-4 bg-yellow-100 text-yellow-800 text-center';
  promptDiv.innerHTML = message + ' 请点击 <button id="restoreButton" class="underline text-blue-500">恢复会话</button>。';
  container.prepend(promptDiv);
  document.getElementById('restoreButton').addEventListener('click', async function (e) {
    try {
      let permission = await fileHandle.requestPermission({ mode: 'read' });
      if (permission === 'granted') {
        promptDiv.remove();
        sessions = await loadSessionsFromFile();
        await checkExistingSessions();
      } else {
        promptDiv.innerHTML = "未获得权限，请刷新页面后再次点击恢复会话。";
      }
    } catch (err) {
      console.error("恢复会话失败", err);
    }
  });
}
// 修改：在初始化时检测存储句柄是否有效，并在必要时显示恢复会话按钮
async function initializeApp() {
  const configLoaded = await loadConfig();
  if (!configLoaded) return;
  try {
    const storedHandle = await getFileHandleFromDB();
    if (storedHandle) {
      fileHandle = storedHandle;
      let permission = await fileHandle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') {
        // 无法自动恢复权限，显示恢复提示
        showRestoreSessionPrompt("当前无权限自动访问上次保存的文件，需要您点击恢复会话。");
        sessions = [];
        // 不调用 loadSessionsFromFile()，等待用户点击恢复按钮
        return;
      } else {
        sessions = await loadSessionsFromFile();
      }
    } else {
      showFilePickerPrompt("未找到保存的文件，请选择保存位置。");
      sessions = [];
    }
  } catch (e) {
    console.error("存储的文件句柄无效：", e);
    await removeStoredFileHandle();
    showFilePickerPrompt("无法访问保存的文件，请选择新的保存位置。");
    sessions = [];
  }
  setupEventListeners();
  await checkExistingSessions();
}
function setupEventListeners() {
  document.getElementById('sendButton').addEventListener('click', sendMessage);
  document.getElementById('inputBox').addEventListener('keydown', handleInputKey);
  document.getElementById('newChatButton').addEventListener('click', createNewSession);
  document.getElementById('modelSelect').addEventListener('change', handleModelChange);
}
async function checkExistingSessions() {
  if (sessions.length === 0) {
    await createNewSession();
  } else {
    switchSession(sessions[sessions.length - 1].id);
  }
}
function handleModelChange() {
  const currentSession = sessions.find(s => s.id === currentSessionId);
  if (currentSession) {
    currentSession.model = document.getElementById('modelSelect').value;
  }
}
function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
function renderSessionList(sessionsArray) {
  const container = document.getElementById('sessionList');
  container.innerHTML = sessionsArray.map(session => `
        <div class="p-2 border-b hover:bg-gray-50 cursor-pointer flex items-center justify-between group ${session.id === currentSessionId ? 'bg-indigo-50' : ''}" data-id="${session.id}">
          <div class="truncate flex-1" onclick="switchSession('${session.id}')">
            ${session.title}
          </div>
          <button class="invisible group-hover:visible text-red-400 hover:text-red-600 p-1" onclick="deleteSession('${session.id}', event)">×</button>
        </div>
      `).join('');
}
async function deleteSession(sessionId, event) {
  event.stopPropagation();
  sessions = sessions.filter(s => s.id !== sessionId);
  await saveSessionsToFile();
  if (sessionId === currentSessionId) {
    sessions.length > 0 ? switchSession(sessions[0].id) : await createNewSession();
  }
  renderSessionList(sessions);
}
async function createNewSession() {
  const newSession = new ChatSession();
  sessions.push(newSession);
  await saveSessionsToFile();
  switchSession(newSession.id);
}
function switchSession(sessionId) {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;
  currentSessionId = sessionId;
  document.getElementById('modelSelect').value = session.model;
  renderChatHistory(session.messages);
  renderSessionList(sessions);
}
function renderChatHistory(messages) {
  const container = document.getElementById('chatContainer');
  container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.role}-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="message-container relative max-w-[85%] p-4 rounded-lg shadow ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-white'}">
            <div class="message-content markdown-body" data-original="${msg.content}">
              ${renderContent(msg.content)}
            </div>
            ${msg.role === 'assistant' ?
      '<button class="copy-btn message-copy-btn block mt-2 bg-gray-200 text-xs px-2 py-1 rounded" onclick="copyMessageContent(this)">复制</button>' :
      '<button class="copy-btn message-copy-btn absolute top-1 right-1 bg-transparent text-white text-xs px-2 py-1" onclick="copyMessageContent(this)">复制</button>'}
          </div>
        </div>
      `).join('');
  container.scrollTop = container.scrollHeight;
  document.querySelectorAll('.message-content').forEach(div => {
    addCodeCopyButtons(div);
  });
  if (window.MathJax) {
    MathJax.typesetPromise([container]);
  }
}
async function sendMessage() {
  if (isGenerating) return;
  const inputBox = document.getElementById('inputBox');
  const sendButton = document.getElementById('sendButton');
  const message = inputBox.value.trim();
  if (!message) return;
  if (!fileHandle) {
    showFilePickerPrompt("请先选择保存位置以加载和保存对话历史。");
    alert("请先选择保存位置以加载和保存对话历史。");
    return;
  }
  let permission = await fileHandle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    permission = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      showFilePickerPrompt("请先选择保存位置以加载和保存对话历史。");
      alert("请先选择保存位置以加载和保存对话历史。");
      return;
    }
  }
  isGenerating = true;
  inputBox.disabled = true;
  sendButton.disabled = true;
  addMessage(message, 'user');
  const currentSession = sessions.find(s => s.id === currentSessionId);
  if (!currentSession) {
    isGenerating = false;
    inputBox.disabled = false;
    sendButton.disabled = false;
    return;
  }
  currentSession.messages.push({ role: 'user', content: message });
  currentSession.messages.push({ role: 'assistant', content: '' });
  inputBox.value = '';
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  if (!createMessageContainer(messageId)) {
    handleSendError(messageId, '消息容器创建失败');
    return;
  }
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: currentSession.model,
        messages: currentSession.messages.slice(0, -1),
        temperature: 0.7,
        stream: true
      })
    });
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aiMessage = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n');
      buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        const trimmedChunk = chunk.trim();
        if (!trimmedChunk || trimmedChunk === 'data: [DONE]') continue;
        try {
          const jsonStr = trimmedChunk.replace('data: ', '');
          const data = JSON.parse(jsonStr);
          const content = data.choices[0]?.delta?.content || '';
          if (content) {
            aiMessage += content;
            updateMessageContent(messageId, aiMessage);
            currentSession.messages[currentSession.messages.length - 1].content = aiMessage;
          }
        } catch (e) {
          console.warn('解析JSON时出错:', e);
        }
      }
    }
    currentSession.title = generateSessionTitle(currentSession.messages);
    await saveSessionsToFile();
    renderSessionList(sessions);
  } catch (error) {
    handleSendError(messageId, error.message);
  } finally {
    isGenerating = false;
    inputBox.disabled = false;
    sendButton.disabled = false;
    inputBox.focus();
  }
}
function generateSessionTitle(messages) {
  const firstUserMessage = messages.find(m => m.role === 'user')?.content || '新对话';
  return firstUserMessage.substring(0, 30) + (firstUserMessage.length > 30 ? '...' : '');
}
// 助手消息容器，添加复制按钮并保存原始 markdown 到 data-original
function createMessageContainer(id) {
  const container = document.getElementById('chatContainer');
  if (!container) return false;
  const existing = document.getElementById(`msg-${id}`);
  if (existing) existing.remove();
  const template = `
        <div id="msg-${id}" class="chat-message ai-message flex justify-start">
          <div class="message-container relative max-w-[85%] bg-white p-4 rounded-lg shadow">
            <div id="loading-${id}" class="flex items-center">
              <div class="animate-spin mr-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <span class="text-gray-500">正在生成...</span>
            </div>
            <div id="content-${id}" class="message-content markdown-body" data-original="" style="display: none;"></div>
            <button class="copy-btn message-copy-btn block mt-2 bg-gray-200 text-xs px-2 py-1 rounded" onclick="copyMessageContent(this)" style="display: none;">复制</button>
          </div>
        </div>
      `;
  container.insertAdjacentHTML('beforeend', template);
  return true;
}
function updateMessageContent(id, content) {
  let retryCount = 0;
  const maxRetries = 5;
  const tryUpdate = () => {
    const loadingEl = document.getElementById(`loading-${id}`);
    const contentEl = document.getElementById(`content-${id}`);
    if (loadingEl && contentEl) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      try {
        contentEl.innerHTML = renderContent(content);
        contentEl.setAttribute('data-original', content);
        contentEl.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
        addCodeCopyButtons(contentEl);
        const copyBtn = document.querySelector(`#msg-${id} .message-copy-btn`);
        if (copyBtn) copyBtn.style.display = 'block';
        if (window.MathJax) {
          MathJax.typesetPromise([contentEl]);
        }
      } catch (e) {
        contentEl.textContent = content;
      }
      contentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(tryUpdate, 100 * retryCount);
    } else {
      console.warn(`无法定位消息元素: ${id}`);
    }
  };
  tryUpdate();
}
// 添加用户提问消息及复制按钮，并保存原始 markdown 到 data-original
function addMessage(content, role) {
  const container = document.getElementById('chatContainer');
  if (!container) return;
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  const messageContainer = document.createElement('div');
  messageContainer.className = `message-container relative max-w-[85%] p-4 rounded-lg shadow ${role === 'user' ? 'bg-indigo-500 text-white' : 'bg-white'}`;
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content markdown-body';
  try {
    messageContent.innerHTML = renderContent(content);
    messageContent.setAttribute('data-original', content);
    messageContent.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    if (window.MathJax) {
      MathJax.typesetPromise([messageContent]);
    }
  } catch (e) {
    messageContent.textContent = content;
  }
  messageContainer.appendChild(messageContent);
  const copyBtn = document.createElement('button');
  if (role === 'assistant') {
    copyBtn.className = "copy-btn message-copy-btn block mt-2 bg-gray-200 text-xs px-2 py-1 rounded";
  } else {
    copyBtn.className = "copy-btn message-copy-btn absolute top-1 right-1 bg-transparent text-white text-xs px-2 py-1";
  }
  copyBtn.textContent = "复制";
  copyBtn.onclick = function () { copyMessageContent(copyBtn); };
  messageContainer.appendChild(copyBtn);
  messageDiv.appendChild(messageContainer);
  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
  addCodeCopyButtons(messageContent);
}
window.addEventListener('load', async () => {
  await initializeApp();
});
