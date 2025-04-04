const socket = io();

// Elementos del DOM
const preInvitationModal = document.getElementById('preInvitationModal');
const preInvitationText = document.getElementById('preInvitationText');
const cancelPreInviteBtn = document.getElementById('cancelPreInviteBtn');
const beingInvitedModal = document.getElementById('beingInvitedModal');
const beingInvitedText = document.getElementById('beingInvitedText');
const cancelBeingInvitedBtn = document.getElementById('cancelBeingInvitedBtn');
const registerScreen = document.getElementById('registerScreen');
const mainContainer = document.getElementById('mainContainer');
const nameError = document.getElementById('nameError');
const sidebar = document.getElementById('sidebar');
const playerList = document.getElementById('playerList');
const gameChat = document.getElementById('gameChat');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatOpponentName = document.getElementById('chatOpponentName');
const emojiPickerBtn = document.getElementById('emojiPickerBtn');
const emojiPicker = document.getElementById('emojiPicker');
const gameBoard = document.getElementById('gameBoard');
const welcomeCard = document.getElementById('welcomeCard');
const opponentName = document.getElementById('opponentName');
const turnIndicator = document.getElementById('turnIndicator');
const gameModeIndicator = document.getElementById('gameModeIndicator');
const guessInput = document.getElementById('guessInput');
const submitGuessBtn = document.getElementById('submitGuessBtn');
const yourGuesses = document.getElementById('yourGuesses');
const opponentGuesses = document.getElementById('opponentGuesses');
const invitationModal = document.getElementById('invitationModal');
const invitationText = document.getElementById('invitationText');
const invitationGameMode = document.getElementById('invitationGameMode');
const acceptInviteBtn = document.getElementById('acceptInviteBtn');
const declineInviteBtn = document.getElementById('declineInviteBtn');
const gameModeScreen = document.getElementById('gameModeScreen');
const gameModeOpponentName = document.getElementById('gameModeOpponentName');
const gameModeBtns = document.querySelectorAll('.game-mode-btn');
const confirmGameModeBtn = document.getElementById('confirmGameModeBtn');
const cancelGameModeBtn = document.getElementById('cancelGameModeBtn');
const secretNumberScreen = document.getElementById('secretNumberScreen');
const secretNumberInput = document.getElementById('secretNumberInput');
const secretNumberInstruction = document.getElementById('secretNumberInstruction');
const secretNumberLength = document.getElementById('secretNumberLength');
const secretNumberError = document.getElementById('secretNumberError');
const submitSecretNumberBtn = document.getElementById('submitSecretNumberBtn');
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const closeResultBtn = document.getElementById('closeResultBtn');
const gameStatus = document.getElementById('gameStatus');
const secretNumberContainer = document.getElementById('secretNumberContainer');
const yourSecretNumber = document.getElementById('yourSecretNumber');
const toggleSecretNumberBtn = document.getElementById('toggleSecretNumberBtn');
const toggleSecretNumberIcon = document.getElementById('toggleSecretNumberIcon');
const quitGameBtn = document.getElementById('quitGameBtn');
const cancelSecretNumberBtn = document.getElementById('cancelSecretNumberBtn');

// Elementos de autenticación
const authTabs = document.getElementById('authTabs');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const regUsernameInput = document.getElementById('regUsernameInput');
const regPasswordInput = document.getElementById('regPasswordInput');
const regConfirmPasswordInput = document.getElementById('regConfirmPasswordInput');
const regError = document.getElementById('regError');
const registerBtn = document.getElementById('registerBtn');
const loginUsernameInput = document.getElementById('loginUsernameInput');
const loginPasswordInput = document.getElementById('loginPasswordInput');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');

// Elementos del chat global
const globalChatContainer = document.getElementById('globalChatContainer');
const globalChatToggle = document.getElementById('globalChatToggle');
const globalChatToggleBtn = document.getElementById('globalChatToggleBtn');
const globalChatMessages = document.getElementById('globalChatMessages');
const globalChatInput = document.getElementById('globalChatInput');
const globalChatSendBtn = document.getElementById('globalChatSendBtn');
const globalChatNotification = document.getElementById('globalChatNotification');
const userMentionList = document.getElementById('userMentionList');

// Variables de estado
let currentGameId = null;
let myTurn = false;
let currentInviterId = null;
let currentInviteeId = null;
let opponentPlayerName = '';
let playerName = '';
let selectedGameMode = 'classic';
let secretNumberVisible = false;
let mySecretNumber = '';
let turnTimer;
let remainingTime = 0;
let globalChatOpen = false;
let mentionStartPos = -1;
let mentionedUsers = [];
let notificationCount = 0;
let players = {};

// Límites de tiempo por modo de juego
const gameTimeLimits = {
    'classic': 45000,  // 45 segundos
    '5digits': 60000,  // 1 minuto
    '6digits': 60000,  // 1 minuto
    'race': 45000      // 45 segundos
};

// Lista de emojis
const emojis = [
    '&#128512;', '&#128515;', '&#128516;', '&#128513;', '&#128518;', '&#128517;', '&#128514;', '&#129315;', '&#128522;', '&#128519;',
    '&#128578;', '&#128579;', '&#128521;', '&#128524;', '&#128525;', '&#129392;', '&#128536;', '&#128537;', '&#128539;', '&#128540;',
    '&#128523;', '&#128541;', '&#128541;', '&#128540;', '&#129322;', '&#129320;', '&#129488;', '&#129299;', '&#128526;', '&#129300;',
    '&#129321;', '&#129327;', '&#128527;', '&#128528;', '&#128530;', '&#128532;', '&#128543;', '&#128533;', '&#128577;', '&#9785;',
    '&#128531;', '&#128534;', '&#128555;', '&#128551;', '&#129402;', '&#128546;', '&#128557;', '&#128548;', '&#128544;', '&#128545;',
    '&#129324;', '&#129327;', '&#128563;', '&#129398;', '&#129399;', '&#128561;', '&#128552;', '&#128560;', '&#128549;', '&#128531;',
    '&#129303;', '&#129300;', '&#129317;', '&#129323;', '&#129325;', '&#128566;', '&#128527;', '&#128528;', '&#128530;', '&#128580;',
    '&#128580;', '&#129317;', '&#128565;', '&#129326;', '&#128567;', '&#128567;', '&#128568;', '&#128570;', '&#129296;', '&#129312;',
    '&#128520;', '&#128127;', '&#128125;', '&#128123;', '&#128122;', '&#129313;', '&#128128;', '&#128121;', '&#9760;', '&#128126;',
    '&#128126;', '&#129302;', '&#127875;', '&#128570;', '&#128568;', '&#128569;', '&#128572;', '&#128573;', '&#128576;', '&#128575;',
    '&#128575;', '&#128574;', '&#128584;', '&#128585;', '&#128586;', '&#128139;', '&#128140;', '&#128152;', '&#128157;', '&#129505;',
    '&#128151;', '&#128147;', '&#128150;', '&#128149;', '&#128153;', '&#10083;', '&#128148;', '&#10084;', '&#129505;', '&#128153;',
    '&#128154;', '&#128155;', '&#128156;', '&#129293;', '&#128420;', '&#128165;', '&#128293;', '&#128168;', '&#128169;', '&#128171;',
    '&#128172;', '&#128064;', '&#128488;', '&#128483;', '&#128173;', '&#128164;'
];

// Funciones auxiliares
function loadEmojis() {
    if (!emojiPicker) return;
    
    emojiPicker.innerHTML = '';
    emojis.forEach(emojiCode => {
        const emojiOption = document.createElement('span');
        emojiOption.className = 'emoji-option';
        emojiOption.innerHTML = emojiCode;
        emojiOption.addEventListener('click', () => {
            if (chatInput) {
                chatInput.value += emojiCode;
                chatInput.focus();
            }
        });
        emojiPicker.appendChild(emojiOption);
    });
}

function showUserMentionList() {
    if (!userMentionList) return;
    
    userMentionList.innerHTML = '';
    const players = Array.from(document.querySelectorAll('.player-item'));
    
    players.forEach(player => {
        const username = player.textContent.trim();
        if (username && username !== playerName) {
            const item = document.createElement('div');
            item.className = 'user-mention-item';
            item.textContent = username;
            item.dataset.username = username;
            item.addEventListener('click', () => {
                insertMention(username);
            });
            userMentionList.appendChild(item);
        }
    });
    
    if (userMentionList.children.length > 0) {
        userMentionList.classList.add('show');
        userMentionList.children[0].classList.add('highlighted');
    }
}

function filterUserMentionList(filterText) {
    if (!userMentionList) return;
    
    const items = userMentionList.children;
    let hasMatches = false;
    
    for (let i = 0; i < items.length; i++) {
        const username = items[i].dataset.username.toLowerCase();
        if (username.includes(filterText.toLowerCase())) {
            items[i].style.display = 'block';
            hasMatches = true;
        } else {
            items[i].style.display = 'none';
        }
    }
    
    if (hasMatches) {
        userMentionList.classList.add('show');
        for (let i = 0; i < items.length; i++) {
            if (items[i].style.display !== 'none') {
                items[i].classList.add('highlighted');
                break;
            }
        }
    } else {
        userMentionList.classList.remove('show');
    }
}

function navigateUserMentionList(direction) {
    if (!userMentionList) return;
    
    const items = Array.from(userMentionList.children).filter(item => item.style.display !== 'none');
    if (items.length === 0) return;
    
    const currentIndex = items.findIndex(item => item.classList.contains('highlighted'));
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;
    
    items.forEach(item => item.classList.remove('highlighted'));
    items[newIndex].classList.add('highlighted');
    items[newIndex].scrollIntoView({ block: 'nearest' });
}

function selectMentionedUser() {
    const highlightedItem = document.querySelector('.user-mention-item.highlighted');
    if (highlightedItem) {
        insertMention(highlightedItem.dataset.username);
    }
}

function insertMention(username) {
    if (!globalChatInput) return;
    
    const currentValue = globalChatInput.value;
    const beforeMention = currentValue.substring(0, mentionStartPos);
    const afterMention = currentValue.substring(globalChatInput.selectionStart);
    
    globalChatInput.value = `${beforeMention}@${username}${afterMention}`;
    globalChatInput.focus();
    
    const newCursorPos = mentionStartPos + username.length + 1;
    globalChatInput.selectionStart = newCursorPos;
    globalChatInput.selectionEnd = newCursorPos;
    
    if (!mentionedUsers.includes(username)) {
        mentionedUsers.push(username);
    }
    
    hideUserMentionList();
}

function hideUserMentionList() {
    if (userMentionList) {
        userMentionList.classList.remove('show');
    }
    mentionStartPos = -1;
}

function showWelcomeMessage(username, isReturning = false) {
    if (!welcomeCard) return;
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 15px;">
            ${isReturning ? '&#128075;' : '&#127881;'} ${isReturning ? '¡Bienvenido/a de vuelta' : '¡Hola'} <span style="font-size: 1.8rem;">${username}</span>!
        </h3>
        <p style="font-size: 1.1rem;">
            Estás listo/a para jugar Vacas y Toros Online.
        </p>
        <p style="margin-top: 15px; font-size: 0.95rem; color: #666;">
            Elige un oponente de la lista para comenzar.
        </p>
    `;
    
    welcomeCard.insertBefore(welcomeDiv, welcomeCard.firstChild);
}

function requestNotificationPermission() {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }
}

function sendGlobalMessage() {
    if (!globalChatInput) return;
    
    const message = globalChatInput.value.trim();
    if (message === '') return;
    
    const mentions = [];
    const mentionMatches = message.match(/@(\w+)/g);
    
    if (mentionMatches) {
        mentionMatches.forEach(match => {
            const username = match.substring(1);
            if (Object.values(players).some(p => p.name === username)) {
                mentions.push(username);
            }
        });
    }
    
    socket.emit('sendGlobalChatMessage', {
        message: message,
        mentionedUsers: mentions
    });
    
    globalChatInput.value = '';
    mentionedUsers = [];
    hideUserMentionList();
    
    setTimeout(() => {
        if (globalChatMessages) {
            globalChatMessages.scrollTop = globalChatMessages.scrollHeight;
        }
    }, 100);
}

function addGlobalChatMessage(message) {
    if (!globalChatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender === playerName ? 'message-sent' : 'message-received'}`;
    
    let messageContent = message.message;
    if (message.mentionedUsers) {
        message.mentionedUsers.forEach(user => {
            const regex = new RegExp(`@${user}`, 'gi');
            messageContent = messageContent.replace(regex, 
                `<span class="mention">@${user}</span>`);
        });
    }
    
    messageElement.innerHTML = `
        <div class="message-sender">${message.sender}</div>
        <div class="message-text">${messageContent}</div>
        <div class="message-time">${message.timestamp}</div>
    `;
    
    globalChatMessages.appendChild(messageElement);
    globalChatMessages.scrollTop = globalChatMessages.scrollHeight;
}

function setupGlobalChat() {
    if (!globalChatToggle || !globalChatContainer) return;
    
    globalChatToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        globalChatOpen = !globalChatOpen;
        globalChatContainer.classList.toggle('open');
        if (globalChatToggleBtn) {
            globalChatToggleBtn.textContent = globalChatOpen ? '▼' : '▲';
        }
        
        if (globalChatOpen) {
            notificationCount = 0;
            if (globalChatNotification) {
                globalChatNotification.style.display = 'none';
            }
            setTimeout(() => {
                if (globalChatInput) globalChatInput.focus();
            }, 100);
        }
    });
}

function setupGlobalChatSend() {
    if (!globalChatSendBtn || !globalChatInput) return;
    
    globalChatSendBtn.addEventListener('click', sendGlobalMessage);
    
    globalChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendGlobalMessage();
        }
    });

    globalChatInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        if (value[cursorPos - 1] === '@') {
            mentionStartPos = cursorPos;
            showUserMentionList();
        } else if (mentionStartPos !== -1) {
            const mentionText = value.substring(mentionStartPos, cursorPos).toLowerCase();
            filterUserMentionList(mentionText);
        }
    });

    globalChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            navigateUserMentionList(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter' && document.querySelector('.user-mention-item.highlighted')) {
            e.preventDefault();
            selectMentionedUser();
        } else if (e.key === 'Escape') {
            hideUserMentionList();
        }
    });

    document.addEventListener('click', (e) => {
        if (globalChatOpen && !globalChatContainer.contains(e.target)) {
            globalChatOpen = false;
            if (globalChatContainer) globalChatContainer.classList.remove('open');
            if (globalChatToggleBtn) globalChatToggleBtn.textContent = '▲';
        }
    });
}

function updateTurnIndicator(timeLeft) {
    if (!turnIndicator || !submitGuessBtn || !guessInput) return;
    
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }
    
    if (myTurn) {
        remainingTime = timeLeft;
        const seconds = Math.floor(remainingTime / 1000);
        
        turnIndicator.classList.remove('timer-warning', 'timer-critical');
        
        if (seconds <= 10) {
            turnIndicator.classList.add('timer-critical');
        } else if (seconds <= 20) {
            turnIndicator.classList.add('timer-warning');
        }
        
        turnIndicator.innerHTML = `ES TU TURNO &#x1f3af; (${seconds}s)`;
        turnIndicator.className = 'your-turn';
        guessInput.disabled = false;
        submitGuessBtn.disabled = false;
        submitGuessBtn.classList.add('btn-primary');
        submitGuessBtn.classList.remove('btn-disabled');
        
        turnTimer = setInterval(() => {
            remainingTime -= 1000;
            const seconds = Math.floor(remainingTime / 1000);
            
            if (remainingTime <= 0) {
                clearInterval(turnTimer);
            } else {
                turnIndicator.classList.remove('timer-warning', 'timer-critical');
                if (seconds <= 10) {
                    turnIndicator.classList.add('timer-critical');
                } else if (seconds <= 20) {
                    turnIndicator.classList.add('timer-warning');
                }
                
                turnIndicator.innerHTML = `ES TU TURNO &#x1f3af; (${seconds}s)`;
            }
        }, 1000);
    } else {
        clearInterval(turnTimer);
        turnTimer = null;
        turnIndicator.innerHTML = 'TURNO DEL OPONENTE &#x23f3;';
        turnIndicator.className = 'opponent-turn';
        guessInput.disabled = false;
        submitGuessBtn.disabled = true;
        submitGuessBtn.classList.remove('btn-primary');
        submitGuessBtn.classList.add('btn-disabled');
    }
}

function sendChatMessage() {
    if (!chatInput || !currentGameId) return;
    
    const message = chatInput.value.trim();
    if (message === '') return;
    
    socket.emit('sendChatMessage', {
        gameId: currentGameId,
        message: message
    });
    
    chatInput.value = '';
}

function addChatMessage(msg) {
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    
    if (msg.isSystem) {
        messageElement.className = 'message message-system';
        messageElement.innerHTML = `
            <div class="message-text" style="color: var(--warning-color); font-style: italic;">${msg.message}</div>
            <div class="message-time">${msg.timestamp}</div>
        `;
    } else {
        messageElement.className = `message ${msg.sender === playerName ? 'message-sent' : 'message-received'}`;
        messageElement.innerHTML = `
            <div class="message-sender">${msg.sender}</div>
            <div class="message-text">${msg.message}</div>
            <div class="message-time">${msg.timestamp}</div>
        `;
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resetGame() {
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }
    
    currentGameId = null;
    mySecretNumber = '';
    if (gameBoard) gameBoard.style.display = 'none';
    if (gameChat) gameChat.style.display = 'none';
    if (secretNumberScreen) secretNumberScreen.style.display = 'none';
    if (welcomeCard) welcomeCard.style.display = 'block';
    if (yourGuesses) yourGuesses.innerHTML = '';
    if (opponentGuesses) opponentGuesses.innerHTML = '';
    if (chatMessages) chatMessages.innerHTML = '';
    if (secretNumberContainer) secretNumberContainer.style.display = 'none';
    if (quitGameBtn) quitGameBtn.style.display = 'none';
    if (sidebar) sidebar.style.display = 'block';
}

// Funciones de autenticación
function setupAuthForms() {
    // Limpiar errores al empezar a escribir
    if (loginUsernameInput && loginPasswordInput) {
        [loginUsernameInput, loginPasswordInput].forEach(input => {
            input.addEventListener('input', () => {
                if (loginError && loginError.style.display !== 'none') {
                    loginError.style.display = 'none';
                }
            });
        });
    }

    if (regUsernameInput && regPasswordInput && regConfirmPasswordInput) {
        [regUsernameInput, regPasswordInput, regConfirmPasswordInput].forEach(input => {
            input.addEventListener('input', () => {
                if (regError && regError.style.display !== 'none') {
                    regError.style.display = 'none';
                }
            });
        });
    }

    // Manejar login
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
        
        // También manejar Enter en los campos de login
        [loginUsernameInput, loginPasswordInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        handleLogin();
                    }
                });
            }
        });
    }

    // Manejar registro
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
        
        // También manejar Enter en los campos de registro
        [regUsernameInput, regPasswordInput, regConfirmPasswordInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        handleRegister();
                    }
                });
            }
        });
    }
}

function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    
    if (!username || !password) {
        showLoginError('Usuario y contraseña son requeridos');
        return;
    }
    
    // Deshabilitar botón mientras se procesa
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="emoji">⏳</span> Cargando...';
    
    socket.emit('loginPlayer', { username, password });
}

function handleRegister() {
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();
    const confirmPassword = regConfirmPasswordInput.value.trim();
    
    // Validaciones básicas
    if (!username || !password || !confirmPassword) {
        showRegisterError('Todos los campos son requeridos');
        return;
    }
    
    if (password !== confirmPassword) {
        showRegisterError('Las contraseñas no coinciden');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showRegisterError('El usuario debe tener entre 3 y 20 caracteres');
        return;
    }
    
    if (password.length < 6) {
        showRegisterError('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    // Deshabilitar botón mientras se procesa
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="emoji">⏳</span> Registrando...';
    
    socket.emit('registerPlayer', { username, password });
}

function showLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
    [loginUsernameInput, loginPasswordInput].forEach(input => {
        if (input) {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    });
}

function showRegisterError(message) {
    if (regError) {
        regError.textContent = message;
        regError.style.display = 'block';
    }
    [regUsernameInput, regPasswordInput, regConfirmPasswordInput].forEach(input => {
        if (input) {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    });
}

// Eventos de Socket.io
socket.on('connect', () => {
    console.log('Conectado al servidor');
});

socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error);
    alert('No se pudo conectar al servidor. Por favor recarga la página.');
});

socket.on('registrationError', ({ message }) => {
    if (regError) {
        regError.textContent = message;
        regError.style.display = 'block';
    }
    if (registerBtn) {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<span class="emoji">&#x1f3ae;</span> Registrarse';
    }
});

socket.on('loginError', ({ message }) => {
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
        if (loginUsernameInput) loginUsernameInput.classList.add('shake');
        if (loginPasswordInput) loginPasswordInput.classList.add('shake');
        setTimeout(() => {
            if (loginUsernameInput) loginUsernameInput.classList.remove('shake');
            if (loginPasswordInput) loginPasswordInput.classList.remove('shake');
        }, 500);
    }
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<span class="emoji">&#x1f511;</span> Iniciar Sesión';
    }
});

socket.on('registrationSuccess', ({ username }) => {
    playerName = username;
    if (registerScreen) registerScreen.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'flex';
    showWelcomeMessage(username, false);
    requestNotificationPermission();
    loadEmojis();
    setupGlobalChat();
    setupGlobalChatSend();
});

socket.on('loginSuccess', ({ username }) => {
    playerName = username;
    if (registerScreen) registerScreen.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'flex';
    showWelcomeMessage(username, true);
    requestNotificationPermission();
    loadEmojis();
    setupGlobalChat();
    setupGlobalChatSend();
});

socket.on('playerUpdate', (updatedPlayers) => {
    players = updatedPlayers;
    if (!playerList) return;
    
    playerList.innerHTML = '';
    
    Object.values(players).forEach(player => {
        if (player.socketId !== socket.id) {
            const playerItem = document.createElement('li');
            playerItem.className = 'player-item';
            
            const playerInfo = document.createElement('div');
            playerInfo.innerHTML = `
                <span>
                    <span class="player-status ${player.status}"></span>
                    ${player.name}
                </span>
            `;
            
            if (player.currentGame) {
                const gameStatus = document.createElement('span');
                gameStatus.className = 'player-game-status';
                gameStatus.textContent = '(en partida)';
                playerInfo.appendChild(gameStatus);
                
                playerItem.style.opacity = '0.7';
                playerItem.style.cursor = 'not-allowed';
            } else {
                playerItem.addEventListener('click', () => {
                    currentInviteeId = player.socketId;
                    
                    if (gameModeOpponentName) {
                        gameModeOpponentName.textContent = `Selecciona modo de juego para ${player.name}`;
                    }
                    if (gameModeScreen) gameModeScreen.style.display = 'flex';
                    
                    selectedGameMode = 'classic';
                    if (gameModeBtns.length > 0) {
                        gameModeBtns[0].classList.add('active');
                        for (let i = 1; i < gameModeBtns.length; i++) {
                            gameModeBtns[i].classList.remove('active');
                        }
                    }
                    
                    socket.emit('selectingGameMode', {
                        inviteeId: currentInviteeId
                    });
                });
            }
            
            playerItem.appendChild(playerInfo);
            playerList.appendChild(playerItem);
        }
    });
});

socket.on('receiveGlobalChatMessage', (message) => {
    addGlobalChatMessage(message);
    
    if (!globalChatOpen && message.mentionedUsers && message.mentionedUsers.includes(playerName)) {
        notificationCount++;
        if (globalChatNotification) {
            globalChatNotification.textContent = notificationCount;
            globalChatNotification.style.display = 'flex';
        }
        
        if (Notification.permission === 'granted') {
            new Notification(`Te mencionaron en el chat global`, {
                body: `${message.sender}: ${message.message}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/2936/2936886.png'
            });
        }
    }
});

socket.on('beingInvited', ({ inviterName }) => {
    if (beingInvitedText) beingInvitedText.textContent = `${inviterName} te está invitando a jugar, está seleccionando el modo de juego.`;
    if (beingInvitedModal) beingInvitedModal.style.display = 'flex';
});

socket.on('receiveInvitation', ({ inviterName, inviterId, gameMode }) => {
    currentInviterId = inviterId;
    selectedGameMode = gameMode;
    if (invitationText) invitationText.textContent = `${inviterName} te ha invitado a una partida de Vacas y Toros.`;
    
    let modeText = '';
    switch(gameMode) {
        case '5digits': modeText = 'Modo Avanzado (5 digitos)'; break;
        case '6digits': modeText = 'Modo Experto (6 digitos)'; break;
        case 'race': modeText = 'Modo Carrera'; break;
        default: modeText = 'Modo Clasico (4 digitos)';
    }
    
    if (invitationGameMode) invitationGameMode.textContent = `Modo de juego: ${modeText}`;
    if (invitationModal) invitationModal.style.display = 'flex';
    if (beingInvitedModal) beingInvitedModal.style.display = 'none';
});

socket.on('invitationDeclined', ({ inviteeName }) => {
    alert(`${inviteeName} ha rechazado tu invitacion a jugar.`);
});

socket.on('invitationCancelled', () => {
    if (beingInvitedModal) beingInvitedModal.style.display = 'none';
    if (preInvitationModal) preInvitationModal.style.display = 'none';
    if (gameModeScreen) gameModeScreen.style.display = 'none';
    currentInviterId = null;
    currentInviteeId = null;
});

socket.on('enterSecretNumber', ({ gameId, opponent, gameMode, secretLength }) => {
    currentGameId = gameId;
    opponentPlayerName = opponent;
    
    let modeText = '';
    switch(gameMode) {
        case '5digits': modeText = '5 dígitos (Modo Avanzado)'; break;
        case '6digits': modeText = '6 dígitos (Modo Experto)'; break;
        case 'race': modeText = '4 dígitos (Modo Carrera)'; break;
        default: modeText = '4 dígitos (Modo Clásico)';
    }
    
    if (secretNumberInstruction) {
        secretNumberInstruction.innerHTML = `Elige un número de <strong>${secretLength} digitos unicos</strong> (${modeText}) que ${opponent} deberá adivinar.`;
    }
    if (secretNumberLength) secretNumberLength.textContent = secretLength;
    if (secretNumberInput) {
        secretNumberInput.maxLength = secretLength;
        secretNumberInput.value = '';
    }
    if (secretNumberScreen) secretNumberScreen.style.display = 'flex';
});

socket.on('secretNumberAccepted', () => {
    if (secretNumberScreen) secretNumberScreen.style.display = 'none';
    if (secretNumberInput) secretNumberInput.value = '';
    
    if (welcomeCard) welcomeCard.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'flex';
    if (gameBoard) gameBoard.style.display = 'block';
    if (opponentName) opponentName.textContent = opponentPlayerName;
    if (turnIndicator) {
        turnIndicator.textContent = 'Esperando que el oponente ingrese su numero...';
        turnIndicator.style.color = 'var(--info-color)';
    }
    
    if (selectedGameMode !== 'race') {
        if (secretNumberContainer) secretNumberContainer.style.display = 'block';
        if (yourSecretNumber) yourSecretNumber.textContent = '••••';
        secretNumberVisible = false;
        if (toggleSecretNumberIcon) toggleSecretNumberIcon.textContent = '👁️‍🗨️';
    }
    if (quitGameBtn) quitGameBtn.style.display = 'block';
});

socket.on('gameStarted', ({ gameId, opponent, yourTurn, chatMessages, gameMode }) => {
    currentGameId = gameId;
    myTurn = yourTurn;
    if (opponentName) opponentName.textContent = opponent;
    if (chatOpponentName) chatOpponentName.textContent = opponent;
    
    if (guessInput) guessInput.value = '';
    if (chatInput) chatInput.value = '';
    
    let modeText = '';
    switch(gameMode) {
        case '5digits':
            modeText = 'Modo Avanzado (5 digitos)';
            if (guessInput) guessInput.maxLength = 5;
            break;
        case '6digits':
            modeText = 'Modo Experto (6 digitos)';
            if (guessInput) guessInput.maxLength = 6;
            break;
        case 'race':
            modeText = 'Modo Carrera (4 digitos)';
            if (guessInput) guessInput.maxLength = 4;
            break;
        default:
            modeText = 'Modo Clasico (4 digitos)';
            if (guessInput) guessInput.maxLength = 4;
    }
    
    if (gameModeIndicator) gameModeIndicator.textContent = modeText;
    
    if (welcomeCard) welcomeCard.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'flex';
    if (gameBoard) gameBoard.style.display = 'block';
    if (gameChat) gameChat.style.display = 'block';
    
    if (sidebar) sidebar.style.display = 'none';
    
    if (gameMode === 'race') {
        if (secretNumberContainer) secretNumberContainer.style.display = 'none';
    } else {
        if (secretNumberContainer) secretNumberContainer.style.display = 'block';
        if (yourSecretNumber) yourSecretNumber.textContent = '••••';
        secretNumberVisible = false;
        if (toggleSecretNumberIcon) toggleSecretNumberIcon.textContent = '👁️‍🗨️';
    }
    
    if (quitGameBtn) quitGameBtn.style.display = 'block';
    
    if (chatMessages && chatMessages.length > 0) {
        chatMessages.forEach(msg => {
            addChatMessage(msg);
        });
    }
    
    updateTurnIndicator(myTurn ? gameTimeLimits[gameMode] : 0);
    
    if (yourGuesses) yourGuesses.innerHTML = '';
    if (opponentGuesses) opponentGuesses.innerHTML = '';
    if (gameStatus) gameStatus.innerHTML = '';
});

socket.on('turnChanged', ({ currentTurn, timeLeft }) => {
    myTurn = currentTurn === socket.id;
    updateTurnIndicator(timeLeft);
    
    if (myTurn && guessInput) {
        guessInput.focus();
    }
});

socket.on('timeOut', ({ playerTimedOut, nextTurn }) => {
    if (playerTimedOut === socket.id) {
        const timeoutMessage = {
            sender: "[Sistema]",
            message: "¡Se te acabó el tiempo!",
            timestamp: new Date().toLocaleTimeString(),
            isSystem: true
        };
        addChatMessage(timeoutMessage);
    }
    
    myTurn = nextTurn === socket.id;
    updateTurnIndicator(myTurn ? gameTimeLimits[selectedGameMode] : 0);
    
    if (myTurn && guessInput) {
        guessInput.focus();
    }
});

socket.on('receiveChatMessage', (message) => {
    addChatMessage(message);
});

socket.on('guessResult', ({ guess, bulls, cows, yourTurn, gameMode }) => {
    myTurn = yourTurn;
    
    if (yourGuesses) {
        const guessItem = document.createElement('li');
        guessItem.className = 'guess-item';
        guessItem.innerHTML = `
            <span>${guess}</span>
            <div class="guess-result">
                <span class="bull">&#x1f402; ${bulls}</span>
                <span class="cow">&#x1f404; ${cows}</span>
            </div>
        `;
        yourGuesses.appendChild(guessItem);
    }
});

socket.on('opponentGuess', ({ guess, bulls, cows, yourTurn, gameMode }) => {
    myTurn = yourTurn;
    
    if (opponentGuesses) {
        const guessItem = document.createElement('li');
        guessItem.className = 'guess-item';
        guessItem.innerHTML = `
            <span>${guess}</span>
            <div class="guess-result">
                <span class="bull">&#x1f402; ${bulls}</span>
                <span class="cow">&#x1f404; ${cows}</span>
            </div>
        `;
        opponentGuesses.appendChild(guessItem);
    }
});

socket.on('gameWon', ({ secretNumber, opponentSecret, gameMode }) => {
    let title, message;
    
    if (gameMode === 'race') {
        title = '&#x1f3c6; ¡GANASTE LA CARRERA!';
        message = 'Adivinaste el número antes que tu oponente';
    } else {
        title = '&#x1f389; ¡GANASTE!';
        message = 'Adivinaste el número secreto de tu oponente';
    }
    
    if (resultTitle) resultTitle.innerHTML = title;
    if (resultMessage) {
        resultMessage.innerHTML = `
            <p>${message}</p>
            ${gameMode !== 'race' ? 
                `<p>Tu número secreto: <strong>${secretNumber}</strong></p>
                 <p>Número del oponente: <strong>${opponentSecret}</strong></p>` :
                `<p>Número a adivinar: <strong>${secretNumber}</strong></p>`}
        `;
    }
    if (resultModal) resultModal.style.display = 'flex';
    
    if (gameStatus) {
        gameStatus.innerHTML = '<span style="color: var(--success-color); font-weight: bold;">&#x1f3c6; ¡Ganaste!</span>';
    }
});

socket.on('gameLost', ({ secretNumber, opponentSecret, gameMode }) => {
    let title, message;
    
    if (gameMode === 'race') {
        title = '&#x1f62d; ¡PERDISTE LA CARRERA!';
        message = 'Tu oponente adivinó el número primero';
    } else {
        title = '&#x1f622; ¡PERDISTE!';
        message = 'Tu oponente adivinó tu número secreto';
    }
    
    if (resultTitle) resultTitle.innerHTML = title;
    if (resultMessage) {
        resultMessage.innerHTML = `
            <p>${message}</p>
            ${gameMode !== 'race' ? 
                `<p>Tu número secreto: <strong>${secretNumber}</strong></p>
                 <p>Número del oponente: <strong>${opponentSecret}</strong></p>` :
                `<p>Número a adivinar: <strong>${secretNumber}</strong></p>`}
        `;
    }
    if (resultModal) resultModal.style.display = 'flex';
    
    if (gameStatus) {
        gameStatus.innerHTML = '<span style="color: var(--danger-color); font-weight: bold;">&#x1f494; ¡Perdiste!</span>';
    }
});

socket.on('opponentDisconnected', ({ opponentName }) => {
    alert(`${opponentName} se ha desconectado. La partida ha terminado.`);
    resetGame();
});

socket.on('opponentQuit', ({ opponentName }) => {
    alert(`${opponentName} ha abandonado la partida.`);
    resetGame();
});

socket.on('gameCancelled', () => {
    alert('El otro jugador ha cancelado la partida antes de que comenzara.');
    resetGame();
});

socket.on('gameError', ({ message }) => {
    alert(`Error: ${message}`);
    resetGame();
});

socket.on('invalidGuess', ({ message }) => {
    alert(message);
});

socket.on('invalidSecretNumber', ({ message }) => {
    if (secretNumberError) {
        secretNumberError.textContent = message;
        secretNumberError.style.display = 'block';
    }
    if (secretNumberInput) {
        secretNumberInput.classList.add('shake');
        setTimeout(() => {
            secretNumberInput.classList.remove('shake');
        }, 500);
    }
});

socket.on('notYourTurn', ({ message }) => {
    alert(message);
});

// Eventos del DOM
if (cancelPreInviteBtn) {
    cancelPreInviteBtn.addEventListener('click', () => {
        if (preInvitationModal) preInvitationModal.style.display = 'none';
        currentInviteeId = null;
        socket.emit('cancelPendingInvitation');
    });
}

if (gameModeBtns) {
    gameModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gameModeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGameMode = btn.dataset.mode;
        });
    });
}

if (confirmGameModeBtn) {
    confirmGameModeBtn.addEventListener('click', () => {
        if (!currentInviteeId) return;
        
        if (gameModeScreen) gameModeScreen.style.display = 'none';
        if (preInvitationModal) preInvitationModal.style.display = 'none';
        
        socket.emit('sendInvitationWithMode', {
            inviterId: socket.id,
            inviteeId: currentInviteeId,
            gameMode: selectedGameMode
        });
    });
}

if (cancelGameModeBtn) {
    cancelGameModeBtn.addEventListener('click', () => {
        if (gameModeScreen) gameModeScreen.style.display = 'none';
        if (currentInviteeId) {
            socket.emit('cancelPendingInvitation', {
                inviteeId: currentInviteeId
            });
            currentInviteeId = null;
        }
    });
}

if (cancelBeingInvitedBtn) {
    cancelBeingInvitedBtn.addEventListener('click', () => {
        if (currentInviterId) {
            socket.emit('rejectInvitation', { 
                inviterId: currentInviterId,
                inviteeId: socket.id
            });
            if (beingInvitedModal) beingInvitedModal.style.display = 'none';
            currentInviterId = null;
        }
    });
}

if (acceptInviteBtn) {
    acceptInviteBtn.addEventListener('click', () => {
        if (invitationModal) invitationModal.style.display = 'none';
        socket.emit('respondInvitation', {
            inviterId: currentInviterId,
            accepted: true,
            gameMode: selectedGameMode
        });
    });
}

if (declineInviteBtn) {
    declineInviteBtn.addEventListener('click', () => {
        if (invitationModal) invitationModal.style.display = 'none';
        socket.emit('respondInvitation', {
            inviterId: currentInviterId,
            accepted: false,
            gameMode: selectedGameMode
        });
        currentInviterId = null;
    });
}

if (secretNumberInput) {
    secretNumberInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const secretLength = parseInt(secretNumberLength.textContent);
        
        if (new Set(value.split('')).size !== value.length && value.length > 0) {
            if (secretNumberError) {
                secretNumberError.textContent = 'Los digitos deben ser unicos';
                secretNumberError.style.display = 'block';
            }
        } else {
            if (secretNumberError) secretNumberError.style.display = 'none';
        }
    });
}

if (submitSecretNumberBtn) {
    submitSecretNumberBtn.addEventListener('click', () => {
        const secret = secretNumberInput.value.trim();
        const secretLength = parseInt(secretNumberLength.textContent);
        
        if (secret.length !== secretLength || !/^\d+$/.test(secret) || new Set(secret.split('')).size !== secretLength) {
            if (secretNumberError) {
                secretNumberError.textContent = `El numero debe tener ${secretLength} digitos unicos`;
                secretNumberError.style.display = 'block';
            }
            if (secretNumberInput) {
                secretNumberInput.classList.add('shake');
                setTimeout(() => {
                    secretNumberInput.classList.remove('shake');
                }, 500);
            }
            return;
        }
        
        mySecretNumber = secret;
        socket.emit('submitSecretNumber', {
            gameId: currentGameId,
            secretNumber: secret
        });
    });
}

if (cancelSecretNumberBtn) {
    cancelSecretNumberBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres cancelar la partida?')) {
            socket.emit('cancelGame', { gameId: currentGameId });
            resetGame();
        }
    });
}

if (secretNumberScreen) {
    secretNumberScreen.addEventListener('click', (e) => {
        if (e.target.id === 'secretNumberScreen' && currentGameId) {
            if (confirm('¿Estás seguro de que quieres cancelar la partida?')) {
                socket.emit('cancelGame', { gameId: currentGameId });
                resetGame();
            }
        }
    });
}

if (toggleSecretNumberBtn) {
    toggleSecretNumberBtn.addEventListener('click', () => {
        secretNumberVisible = !secretNumberVisible;
        if (yourSecretNumber) {
            yourSecretNumber.textContent = secretNumberVisible ? mySecretNumber : '••••';
        }
        if (toggleSecretNumberIcon) {
            toggleSecretNumberIcon.textContent = secretNumberVisible ? '👁️' : '👁️‍🗨️';
        }
    });
}

if (quitGameBtn) {
    quitGameBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres abandonar la partida?')) {
            socket.emit('quitGame', { gameId: currentGameId });
            resetGame();
        }
    });
}

if (sendChatBtn) {
    sendChatBtn.addEventListener('click', sendChatMessage);
}

if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

if (submitGuessBtn) {
    submitGuessBtn.addEventListener('click', () => {
        if (!myTurn) {
            alert('¡No es tu turno! Espera a que el oponente juegue.');
            return;
        }
        
        const guess = guessInput.value.trim();
        const requiredLength = parseInt(guessInput.maxLength);
        
        if (guess.length !== requiredLength || !/^\d+$/.test(guess) || new Set(guess.split('')).size !== requiredLength) {
            if (guessInput) {
                guessInput.classList.add('shake');
                setTimeout(() => {
                    guessInput.classList.remove('shake');
                }, 500);
            }
            return;
        }
        
        socket.emit('submitGuess', {
            gameId: currentGameId,
            guess: guess
        });
        
        if (guessInput) guessInput.value = '';
    });
}

if (guessInput) {
    guessInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const requiredLength = parseInt(guessInput.maxLength);
        
        if (value.length > requiredLength) {
            e.target.value = value.slice(0, requiredLength);
        }
        
        if (new Set(value.split('')).size !== value.length && value.length > 0) {
            guessInput.style.borderColor = 'var(--danger-color)';
        } else {
            guessInput.style.borderColor = '#ddd';
        }
    });

    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!myTurn) {
                alert('¡No es tu turno! Espera a que el oponente juegue.');
                return;
            }
            if (submitGuessBtn) submitGuessBtn.click();
        }
    });
}

if (closeResultBtn) {
    closeResultBtn.addEventListener('click', () => {
        if (resultModal) resultModal.style.display = 'none';
        resetGame();
    });
}

if (emojiPickerBtn && emojiPicker) {
    emojiPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
        emojiPicker.classList.remove('show');
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM completamente cargado');
    loadEmojis();
    setupAuthForms();
    
    if (authTabs) {
        const tabs = authTabs.querySelectorAll('.auth-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                if (e.target.dataset.tab === 'register') {
                    if (registerForm) registerForm.style.display = 'block';
                    if (loginForm) loginForm.style.display = 'none';
                } else {
                    if (registerForm) registerForm.style.display = 'none';
                    if (loginForm) loginForm.style.display = 'block';
                }
            });
        });
    }
    
    // Verificación inicial de elementos
    console.log('Verificación de elementos:', {
        registerScreen: !!registerScreen,
        mainContainer: !!mainContainer,
        loginBtn: !!loginBtn,
        registerBtn: !!registerBtn,
        globalChatContainer: !!globalChatContainer,
        socket: !!socket
    });
});