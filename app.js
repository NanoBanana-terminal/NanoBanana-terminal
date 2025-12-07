// Configuration
const CONFIG = {
    maxFileSize: 5 * 1024 * 1024,
    validImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    models: {
        'google/gemini-3-pro-image': {
            name: 'Gemini 3 Pro',
            options: { model: "google/gemini-3-pro-image", provider: "together-ai", disable_safety_checker: true }
        },
        'gemini-2.5-flash-image-preview': {
            name: 'Gemini 2.5 Flash',
            options: { model: "gemini-2.5-flash-image-preview", disable_safety_checker: true }
        }
    }
};

// App State
const STATE = {
    mode: 'command', // command, prompt, confirm, generating
    currentPrompt: '',
    referenceImage: null,
    commandHistory: [],
    historyIndex: -1,
    isPuterInitialized: false
};

// DOM Elements
const elements = {
    commandInput: document.getElementById('commandInput'),
    commandHistory: document.getElementById('commandHistory'),
    uploadArea: document.getElementById('uploadArea'),
    uploadText: document.getElementById('uploadText'),
    uploadPreview: document.getElementById('uploadPreview'),
    fileInput: document.getElementById('fileInput'),
    uploadSection: document.getElementById('uploadSection'),
    generationSection: document.getElementById('generationSection'),
    modelSelect: document.getElementById('modelSelect'),
    resultContainer: document.getElementById('resultContainer'),
    imageContainer: document.getElementById('imageContainer'),
    downloadLink: document.getElementById('downloadLink'),
    connectionStatus: document.getElementById('connectionStatus'),
    currentMode: document.getElementById('currentMode'),
    statusText: document.getElementById('statusText')
};

// Logger System
class Logger {
    static log(type, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logElement = document.createElement('div');
        logElement.className = `log-line ${type}`;
        
        let logText = `[${timestamp}] ${message}`;
        
        if (data && typeof data === 'object') {
            try {
                const dataStr = JSON.stringify(data);
                if (dataStr.length < 100) {
                    logText += ` ${dataStr}`;
                }
            } catch (e) {
                // Ignore serialization errors
            }
        }
        
        logElement.textContent = logText;
        elements.commandHistory.appendChild(logElement);
        elements.commandHistory.scrollTop = elements.commandHistory.scrollHeight;
        
        // Console logging
        const consoleMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[consoleMethod](`[${timestamp}] ${type.toUpperCase()}: ${message}`, data || '');
        
        // Update status
        this.updateStatus(type, message);
    }
    
    static info(message, data = null) { this.log('info', message, data); }
    static success(message, data = null) { this.log('success', message, data); }
    static error(message, data = null) { this.log('error', message, data); }
    static warning(message, data = null) { this.log('warning', message, data); }
    
    static updateStatus(type, message) {
        if (type === 'error') {
            elements.statusText.textContent = `Error: ${message.substring(0, 30)}`;
            elements.statusText.style.color = 'var(--red)';
        } else if (type === 'success') {
            elements.statusText.textContent = message;
            elements.statusText.style.color = 'var(--green)';
        } else if (type === 'warning') {
            elements.statusText.textContent = message;
            elements.statusText.style.color = 'var(--yellow)';
        }
    }
    
    static addOutput(message, isCommand = false) {
        const outputElement = document.createElement('div');
        outputElement.className = isCommand ? 'command-line' : 'command-output';
        outputElement.textContent = message;
        elements.commandHistory.appendChild(outputElement);
        elements.commandHistory.scrollTop = elements.commandHistory.scrollHeight;
    }
}

// Command Processing
function processCommand(command) {
    command = command.trim();
    if (!command) return;
    
    // Add command to history
    Logger.addOutput(`➜ ${command}`, true);
    
    // Process command
    const cmd = command.toLowerCase();
    
    switch (cmd) {
        case 'help':
        case 'h':
            showHelp();
            break;
            
        case 'clear':
        case 'c':
            elements.commandHistory.innerHTML = '';
            Logger.info('Terminal cleared');
            break;
            
        case 'generate':
        case 'g':
            startGeneration();
            break;
            
        case 'upload':
        case 'u':
            elements.fileInput.click();
            break;
            
        case 'exit':
        case 'quit':
        case 'e':
        case 'q':
            Logger.info('Exiting...');
            setTimeout(() => location.reload(), 1000);
            break;
            
        default:
            if (cmd.startsWith('generate ') || cmd.startsWith('g ')) {
                const prompt = command.substring(cmd.indexOf(' ') + 1);
                startGenerationWithPrompt(prompt);
            } else {
                Logger.addOutput(`Unknown command: ${command}. Type 'help' for available commands.`);
            }
    }
}

function showHelp() {
    const helpText = `
Available Commands:
• help, h          - Show this help message
• clear, c         - Clear terminal
• generate, g      - Start image generation
• upload, u        - Upload reference image
• exit, quit, e, q - Exit application

Generation Process:
1. Type 'generate' or 'g'
2. Enter your prompt
3. Confirm with 'y' or 'yes'
4. Wait for generation to complete
    `.trim();
    
    Logger.addOutput(helpText);
}

function startGeneration() {
    STATE.mode = 'prompt';
    elements.currentMode.textContent = 'AWAITING PROMPT';
    elements.currentMode.style.color = 'var(--yellow)';
    
    Logger.addOutput('Enter image description (prompt):');
    elements.commandInput.placeholder = 'Type your prompt here...';
}

function startGenerationWithPrompt(prompt) {
    STATE.currentPrompt = prompt;
    STATE.mode = 'confirm';
    
    Logger.addOutput(`Prompt: "${prompt}"`);
    Logger.addOutput('Start generation? (y/yes or n/no)');
    
    elements.commandInput.placeholder = 'y/n';
    elements.currentMode.textContent = 'CONFIRMATION';
    elements.currentMode.style.color = 'var(--cyan)';
}

function confirmGeneration(answer) {
    const normalized = answer.trim().toLowerCase();
    const positive = ['y', 'yes', 'да', 'д'];
    const negative = ['n', 'no', 'нет', 'н'];
    
    if (positive.includes(normalized)) {
        Logger.addOutput(answer);
        Logger.addOutput('Starting generation...');
        executeGeneration();
    } else if (negative.includes(normalized)) {
        Logger.addOutput(answer);
        Logger.addOutput('Generation cancelled.');
        resetToCommandMode();
    } else {
        Logger.addOutput('Invalid response. Please answer y/yes or n/no');
    }
}

function resetToCommandMode() {
    STATE.mode = 'command';
    STATE.currentPrompt = '';
    elements.commandInput.placeholder = 'Type command...';
    elements.currentMode.textContent = 'READY';
    elements.currentMode.style.color = 'var(--cyan)';
    elements.generationSection.classList.add('hidden');
    elements.resultContainer.classList.add('hidden');
    elements.statusText.textContent = 'System ready';
    elements.statusText.style.color = 'var(--gray)';
}

async function executeGeneration() {
    STATE.mode = 'generating';
    elements.commandInput.disabled = true;
    elements.currentMode.textContent = 'GENERATING';
    elements.currentMode.style.color = 'var(--green)';
    elements.statusText.textContent = 'Generating image...';
    elements.statusText.style.color = 'var(--yellow)';
    
    elements.generationSection.classList.remove('hidden');
    elements.resultContainer.classList.add('hidden');
    
    Logger.info('Starting image generation', {
        promptLength: STATE.currentPrompt.length,
        hasReference: !!STATE.referenceImage
    });
    
    try {
        // Initialize Puter if needed
        if (!STATE.isPuterInitialized && typeof puter === 'object') {
            try {
                puter.init({ name: 'NanoBanana Terminal' });
                STATE.isPuterInitialized = true;
                updateConnectionStatus(true);
                Logger.success('Puter API initialized');
            } catch (err) {
                updateConnectionStatus(false);
                Logger.warning('Puter API initialization failed, continuing without full integration');
            }
        }
        
        // Get model configuration
        const selectedModel = elements.modelSelect.value;
        const modelConfig = CONFIG.models[selectedModel];
        
        if (!modelConfig) {
            throw new Error(`Unknown model: ${selectedModel}`);
        }
        
        Logger.info(`Using model: ${modelConfig.name}`);
        
        // Prepare AI options
        const aiOptions = { ...modelConfig.options };
        
        // Generate image
        const startTime = Date.now();
        let resultImg;
        
        if (STATE.referenceImage) {
            Logger.info('Attempting image-to-image generation');
            try {
                const blob = dataURLtoBlob(STATE.referenceImage);
                const file = new File([blob], 'reference.jpg', { type: 'image/jpeg' });
                resultImg = await puter.ai.img2img(file, STATE.currentPrompt, aiOptions);
            } catch (imgError) {
                Logger.warning('Image editing failed, using text-to-image');
                resultImg = await puter.ai.txt2img(STATE.currentPrompt, aiOptions);
            }
        } else {
            Logger.info('Using text-to-image generation');
            resultImg = await puter.ai.txt2img(STATE.currentPrompt, aiOptions);
        }
        
        const generationTime = Date.now() - startTime;
        
        if (!resultImg || !resultImg.src) {
            throw new Error("No image data received");
        }
        
        Logger.success(`Image generated in ${generationTime}ms`);
        
        // Display result
        elements.imageContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = resultImg.src;
        img.alt = 'Generated image';
        elements.imageContainer.appendChild(img);
        
        // Create download link
        const response = await fetch(resultImg.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        elements.downloadLink.href = url;
        elements.downloadLink.download = `nanobanana-${Date.now()}.png`;
        elements.downloadLink.onclick = () => {
            setTimeout(() => URL.revokeObjectURL(url), 100);
        };
        
        elements.resultContainer.classList.remove('hidden');
        
        elements.statusText.textContent = 'Generation successful';
        elements.statusText.style.color = 'var(--green)';
        
    } catch (error) {
        Logger.error('Generation failed', error.message);
        
        elements.imageContainer.innerHTML = `<div class="error-box">Error: ${error.message}</div>`;
        elements.resultContainer.classList.remove('hidden');
        
        elements.statusText.textContent = 'Generation failed';
        elements.statusText.style.color = 'var(--red)';
    } finally {
        elements.commandInput.disabled = false;
        elements.commandInput.focus();
        setTimeout(resetToCommandMode, 1000);
    }
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
}

// File Upload Handling
function handleFileUpload(file) {
    if (!file) return;
    
    // Check file size
    if (file.size > CONFIG.maxFileSize) {
        Logger.error('File too large', `${(file.size / 1024 / 1024).toFixed(2)}MB > 5MB`);
        return;
    }
    
    // Check file type
    if (!CONFIG.validImageTypes.includes(file.type)) {
        Logger.error('Invalid file type', file.type);
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        STATE.referenceImage = e.target.result;
        
        // Update UI
        elements.uploadText.textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(0)}KB)`;
        elements.uploadArea.classList.add('dragover');
        
        elements.uploadPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = STATE.referenceImage;
        elements.uploadPreview.appendChild(img);
        
        Logger.success('Reference image loaded', {
            name: file.name,
            size: `${(file.size / 1024).toFixed(2)}KB`
        });
    };
    
    reader.onerror = () => {
        Logger.error('Failed to read file');
    };
    
    reader.readAsDataURL(file);
}

function updateConnectionStatus(connected) {
    const statusDot = elements.connectionStatus.querySelector('.status-dot');
    const statusText = elements.connectionStatus.querySelector('span:last-child');
    
    if (connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'CONNECTED';
        elements.connectionStatus.style.background = 'rgba(0, 255, 0, 0.1)';
        elements.connectionStatus.style.borderColor = 'rgba(0, 255, 0, 0.3)';
    } else {
        statusDot.className = 'status-dot connecting';
        statusText.textContent = 'CONNECTING';
        elements.connectionStatus.style.background = 'rgba(255, 255, 0, 0.1)';
        elements.connectionStatus.style.borderColor = 'rgba(255, 255, 0, 0.3)';
    }
}

// Initialize Application
function init() {
    // Setup event listeners
    elements.commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = elements.commandInput.value.trim();
            elements.commandInput.value = '';
            
            if (STATE.mode === 'command') {
                processCommand(command);
            } else if (STATE.mode === 'prompt') {
                if (command) {
                    startGenerationWithPrompt(command);
                }
            } else if (STATE.mode === 'confirm') {
                confirmGeneration(command);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (STATE.commandHistory.length > 0 && STATE.historyIndex < STATE.commandHistory.length - 1) {
                STATE.historyIndex++;
                const historyItem = STATE.commandHistory[STATE.commandHistory.length - 1 - STATE.historyIndex];
                elements.commandInput.value = historyItem;
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (STATE.historyIndex > 0) {
                STATE.historyIndex--;
                const historyItem = STATE.commandHistory[STATE.commandHistory.length - 1 - STATE.historyIndex];
                elements.commandInput.value = historyItem;
            } else {
                STATE.historyIndex = -1;
                elements.commandInput.value = '';
            }
        }
    });
    
    // File upload
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, () => {
            elements.uploadArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, () => {
            elements.uploadArea.classList.remove('dragover');
        }, false);
    });
    
    elements.uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files[0]) {
            handleFileUpload(files[0]);
        }
    }, false);
    
    // Initialize Puter
    if (typeof puter === 'object') {
        updateConnectionStatus(true);
        STATE.isPuterInitialized = true;
    }
    
    // Focus input
    elements.commandInput.focus();
    
    Logger.info('System initialized');
}

// Start app
document.addEventListener('DOMContentLoaded', init);