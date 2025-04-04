const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración del servidor
const PORT = process.env.PORT || 3001;
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    next();
});

// Archivo para almacenar usuarios
const USERS_FILE = path.join(__dirname, 'users.json');

// Cargar usuarios existentes o crear archivo si no existe
let users = {};
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Función para guardar usuarios
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Límites de tiempo por modo de juego
const gameTimeLimits = {
    'classic': 45000, // 45 segundos para 4 dígitos
    '5digits': 60000, // 1 minuto para 5 dígitos
    '6digits': 60000, // 1 minuto para 6 dígitos
    'race': 45000     // 45 segundos para modo carrera
};

// Estado del juego
const players = {};
const games = {};
const pendingInvitations = {};

// Eliminar acentos y caracteres especiales
function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Generar número aleatorio único
function generateRandomNumber(length) {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let result = '';
    
    // Primer dígito no puede ser 0
    const firstDigit = digits.slice(1)[Math.floor(Math.random() * 9)];
    result += firstDigit;
    
    // Resto de dígitos
    const remainingDigits = digits.filter(d => d !== parseInt(firstDigit));
    for (let i = 1; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * remainingDigits.length);
        result += remainingDigits[randomIndex];
        remainingDigits.splice(randomIndex, 1);
    }
    
    return result;
}

// Lógica del juego
function calculateBullsAndCows(secret, guess) {
    let bulls = 0;
    let cows = 0;
    
    for (let i = 0; i < secret.length; i++) {
        if (secret[i] === guess[i]) {
            bulls++;
        } else if (secret.includes(guess[i])) {
            cows++;
        }
    }
    
    return { bulls, cows };
}

// Validación de número según modo de juego
function isValidNumber(number, length) {
    return number.length === length && 
           /^\d+$/.test(number) && 
           new Set(number.split('')).size === length;
}

// Cambiar turno y manejar temporizador
function changeTurn(game) {
    // Limpiar temporizador existente
    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }
    
    // Solo cambiar turno si el juego no ha terminado
    if (!game.winner) {
        // Cambiar al siguiente jugador
        game.currentTurn = game.players.find(id => id !== game.currentTurn);
        game.timeLeft = game.timeLimit;
        
        // Configurar nuevo temporizador
        game.timer = setTimeout(() => {
            const playerTimedOut = game.currentTurn;
            const nextPlayer = game.players.find(id => id !== playerTimedOut);
            const playerName = players[playerTimedOut]?.name || "Un jugador";
            
            // Solo procesar si el juego no ha terminado
            if (!game.winner) {
                const timeoutMessage = {
                    sender: "[Sistema]",
                    message: `¡A ${playerName} se le acabó el tiempo!`,
                    timestamp: new Date().toLocaleTimeString(),
                    isSystem: true
                };
                
                game.chatMessages.push(timeoutMessage);
                
                // Cambiar al siguiente jugador
                game.currentTurn = nextPlayer;
                
                // Notificar a ambos jugadores
                game.players.forEach(playerId => {
                    if (players[playerId]) {
                        io.to(playerId).emit('receiveChatMessage', timeoutMessage);
                        io.to(playerId).emit('timeOut', {
                            playerTimedOut: playerTimedOut,
                            nextTurn: nextPlayer
                        });
                    }
                });
                
                // Iniciar nuevo turno sin recursión
                if (game.timer) {
                    clearTimeout(game.timer);
                }
                game.timeLeft = game.timeLimit;
                game.timer = setTimeout(() => {
                    changeTurn(game);
                }, game.timeLimit);
                
                // Notificar cambio de turno
                game.players.forEach(playerId => {
                    if (players[playerId]) {
                        io.to(playerId).emit('turnChanged', {
                            currentTurn: game.currentTurn,
                            timeLeft: game.timeLimit
                        });
                    }
                });
            }
        }, game.timeLimit);
        
        // Notificar cambio de turno inicial
        game.players.forEach(playerId => {
            if (players[playerId]) {
                io.to(playerId).emit('turnChanged', {
                    currentTurn: game.currentTurn,
                    timeLeft: game.timeLeft
                });
            }
        });
    }
}

// Conexiones Socket.io
io.on('connection', (socket) => {
    console.log(`Nuevo usuario conectado: ${socket.id}`);
    
    // Registro de nuevo jugador
    socket.on('registerPlayer', ({ username, password }) => {
        // Validaciones básicas
        if (!username || !password) {
            socket.emit('registrationError', {
                message: 'Usuario y contraseña son requeridos'
            });
            return;
        }

        if (username.length < 3 || username.length > 20) {
            socket.emit('registrationError', {
                message: 'El usuario debe tener entre 3 y 20 caracteres'
            });
            return;
        }

        if (password.length < 6) {
            socket.emit('registrationError', {
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
            return;
        }

        // Verificar si el usuario ya existe
        if (users[username]) {
            socket.emit('registrationError', {
                message: 'Este nombre de usuario ya está en uso'
            });
            return;
        }

        // Crear nuevo usuario (en un caso real, deberías hashear la contraseña)
        users[username] = {
            password: password, // En producción, usa bcrypt para hashear
            socketId: socket.id,
            status: 'online',
            currentGame: null
        };

        saveUsers();

        // Actualizar lista de jugadores
        players[socket.id] = {
            name: username,
            socketId: socket.id,
            status: 'online',
            currentGame: null
        };

        socket.broadcast.emit('playerUpdate', players);
        socket.emit('playerUpdate', players);
        socket.emit('registrationSuccess', { username });
    });

    // Inicio de sesión de jugador
    socket.on('loginPlayer', ({ username, password }) => {
        // Verificar credenciales
        if (!users[username] || users[username].password !== password) {
            socket.emit('loginError', {
                message: 'Usuario o contraseña incorrectos'
            });
            return;
        }

        // Actualizar conexión
        users[username].socketId = socket.id;
        users[username].status = 'online';
        saveUsers();

        // Actualizar lista de jugadores
        players[socket.id] = {
            name: username,
            socketId: socket.id,
            status: 'online',
            currentGame: null
        };

        socket.broadcast.emit('playerUpdate', players);
        socket.emit('playerUpdate', players);
        socket.emit('loginSuccess', { username });
    });
    
	socket.on('sendGlobalChatMessage', ({ message, mentionedUsers }) => {
    const player = players[socket.id];
    if (!player) return;
    
    const processedMessage = message.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 
        match => `&#x${match.codePointAt(0).toString(16)};`);
    
    const chatMessage = {
        sender: player.name,
        message: processedMessage,
        timestamp: new Date().toLocaleTimeString(),
        mentionedUsers: mentionedUsers || []
    };
    
    // Enviar a todos los jugadores
    io.emit('receiveGlobalChatMessage', chatMessage);
});
	
    // Invitación a jugar
    socket.on('sendInvitationWithMode', ({ inviterId, inviteeId, gameMode }) => {
        const inviter = players[inviterId];
        const invitee = players[inviteeId];
        
        if (inviter && invitee && !invitee.currentGame) {
            // Solo notificar al invitado que están seleccionando modo para él
            io.to(inviteeId).emit('beingInvited', {
                inviterName: inviter.name
            });
            
            // Guardar temporalmente la invitación pendiente
            pendingInvitations[inviteeId] = {
                inviterId,
                gameMode
            };
            
            // Enviar la invitación formal después de un breve retraso
            setTimeout(() => {
                if (pendingInvitations[inviteeId]) {
                    io.to(inviteeId).emit('receiveInvitation', {
                        inviterName: inviter.name,
                        inviterId: inviterId,
                        gameMode: gameMode
                    });
                }
            }, 500);
        }
    });
    
    socket.on('selectingGameMode', ({ inviteeId }) => {
        const invitee = players[inviteeId];
        if (invitee) {
            io.to(inviteeId).emit('beingInvited', {
                inviterName: players[socket.id].name
            });
        }
    });
    
    socket.on('rejectInvitation', ({ inviterId, inviteeId }) => {
        // Limpiar la invitación pendiente
        delete pendingInvitations[inviteeId || socket.id];
        
        if (players[inviterId]) {
            // Notificar al invitador que fue rechazado
            io.to(inviterId).emit('invitationDeclined', {
                inviteeName: players[inviteeId || socket.id]?.name || 'El jugador'
            });
            
            // Notificar al invitador que cancele la selección de modo
            io.to(inviterId).emit('invitationCancelled');
        }
        
        // Notificar al invitado que se canceló
        if (inviteeId && players[inviteeId]) {
            io.to(inviteeId).emit('invitationCancelled');
        }
    });
    
    // Cancelar invitación pendiente
    socket.on('cancelPendingInvitation', ({ inviteeId }) => {
        if (players[inviteeId]) {
            io.to(inviteeId).emit('invitationCancelled');
        }
        delete pendingInvitations[inviteeId];
    });
    
    // Respuesta a invitación
    socket.on('respondInvitation', ({ inviterId, accepted, gameMode }) => {
        if (accepted) {
            if (!players[inviterId] || !players[socket.id]) {
                socket.emit('gameError', { message: 'Uno de los jugadores no está disponible.' });
                return;
            }

            const gameId = `${inviterId}-${socket.id}`;
            let secretLength;
            
            switch(gameMode) {
                case '5digits':
                    secretLength = 5;
                    break;
                case '6digits':
                    secretLength = 6;
                    break;
                case 'race':
                    secretLength = 4;
                    break;
                default:
                    secretLength = 4;
            }
            
            games[gameId] = {
                players: [inviterId, socket.id],
                secrets: {},
                guesses: {
                    [inviterId]: [],
                    [socket.id]: []
                },
                chatMessages: [],
                currentTurn: null,
                winner: null,
                readyPlayers: 0,
                gameMode: gameMode,
                secretLength: secretLength,
                raceNumber: gameMode === 'race' ? generateRandomNumber(secretLength) : null,
                timer: null,
                timeLimit: gameTimeLimits[gameMode] || 45000,
                timeLeft: 0
            };
            
            if (players[inviterId]) players[inviterId].currentGame = gameId;
            if (players[socket.id]) players[socket.id].currentGame = gameId;
            
            if (gameMode !== 'race') {
                io.to(inviterId).emit('enterSecretNumber', { 
                    gameId, 
                    opponent: players[socket.id].name,
                    gameMode: gameMode,
                    secretLength: secretLength
                });
                
                io.to(socket.id).emit('enterSecretNumber', { 
                    gameId, 
                    opponent: players[inviterId].name,
                    gameMode: gameMode,
                    secretLength: secretLength
                });
            } else {
                games[gameId].currentTurn = games[gameId].players[Math.floor(Math.random() * 2)];
                
                io.to(inviterId).emit('gameStarted', { 
                    gameId, 
                    opponent: players[socket.id].name,
                    yourTurn: games[gameId].currentTurn === inviterId,
                    chatMessages: games[gameId].chatMessages,
                    gameMode: gameMode
                });
                
                io.to(socket.id).emit('gameStarted', { 
                    gameId, 
                    opponent: players[inviterId].name,
                    yourTurn: games[gameId].currentTurn === socket.id,
                    chatMessages: games[gameId].chatMessages,
                    gameMode: gameMode
                });
                
                // Iniciar temporizador para el primer turno
                changeTurn(games[gameId]);
            }
            
            io.emit('playerUpdate', players);
            
            // Limpiar invitación pendiente
            delete pendingInvitations[socket.id];
        } else {
            if (players[inviterId]) {
                io.to(inviterId).emit('invitationDeclined', {
                    inviteeName: players[socket.id].name
                });
            }
            
            // Limpiar invitación pendiente
            delete pendingInvitations[socket.id];
        }
    });
    
    // Recibir número secreto de jugador
    socket.on('submitSecretNumber', ({ gameId, secretNumber }) => {
        const game = games[gameId];
        if (!game || game.winner) return;
        
        if (!isValidNumber(secretNumber, game.secretLength)) {
            socket.emit('invalidSecretNumber', { 
                message: `El numero debe tener ${game.secretLength} digitos unicos` 
            });
            return;
        }
        
        game.secrets[socket.id] = secretNumber;
        game.readyPlayers++;
        
        socket.emit('secretNumberAccepted');
        
        if (game.readyPlayers === 2) {
            // Elegir jugador inicial aleatorio
            game.currentTurn = game.players[Math.floor(Math.random() * 2)];
            
            io.to(game.players[0]).emit('gameStarted', { 
                gameId, 
                opponent: players[game.players[1]].name,
                yourTurn: game.currentTurn === game.players[0],
                chatMessages: game.chatMessages,
                gameMode: game.gameMode
            });
            
            io.to(game.players[1]).emit('gameStarted', { 
                gameId, 
                opponent: players[game.players[0]].name,
                yourTurn: game.currentTurn === game.players[1],
                chatMessages: game.chatMessages,
                gameMode: game.gameMode
            });
            
            // Iniciar temporizador para el primer turno
            changeTurn(game);
        }
    });
    
    // Enviar mensaje de chat
    socket.on('sendChatMessage', ({ gameId, message }) => {
        const game = games[gameId];
        if (!game) return;
        
        const player = players[socket.id];
        if (!player) return;
        
        const processedMessage = message.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 
            match => `&#x${match.codePointAt(0).toString(16)};`);
        
        const chatMessage = {
            sender: player.name,
            message: processedMessage,
            timestamp: new Date().toLocaleTimeString()
        };
        
        game.chatMessages.push(chatMessage);
        
        game.players.forEach(playerId => {
            io.to(playerId).emit('receiveChatMessage', chatMessage);
        });
    });
    
    // Enviar guess
    socket.on('submitGuess', ({ gameId, guess }) => {
        const game = games[gameId];
        if (!game || game.winner) return;
        
        if (game.currentTurn !== socket.id) {
            socket.emit('notYourTurn', { message: 'No es tu turno' });
            return;
        }
            
        // Limpiar temporizador actual
        if (game.timer) {
            clearTimeout(game.timer);
            game.timer = null;
        }

        const playerId = socket.id;
        const opponentId = game.players.find(id => id !== playerId);
        
        const secret = game.gameMode === 'race' ? game.raceNumber : game.secrets[opponentId];
        
        const { bulls, cows } = calculateBullsAndCows(secret, guess);
        
        game.guesses[playerId].push({ guess, bulls, cows });
        
        if (bulls === game.secretLength) {
            game.winner = playerId;
            
            // Limpiar temporizador al terminar el juego
            if (game.timer) {
                clearTimeout(game.timer);
            }
            
            if (game.gameMode === 'race') {
                io.to(playerId).emit('gameWon', { 
                    secretNumber: game.raceNumber,
                    opponentSecret: null,
                    gameMode: game.gameMode
                });
                io.to(opponentId).emit('gameLost', { 
                    secretNumber: game.raceNumber,
                    opponentSecret: null,
                    gameMode: game.gameMode
                });
            } else {
                io.to(playerId).emit('gameWon', { 
                    secretNumber: game.secrets[playerId],
                    opponentSecret: game.secrets[opponentId],
                    gameMode: game.gameMode
                });
                io.to(opponentId).emit('gameLost', { 
                    secretNumber: game.secrets[opponentId],
                    opponentSecret: game.secrets[playerId],
                    gameMode: game.gameMode
                });
            }
            
            if (players[playerId]) players[playerId].currentGame = null;
            if (players[opponentId]) players[opponentId].currentGame = null;
            io.emit('playerUpdate', players);
        } else {
            // Cambiar turno y reiniciar temporizador
            changeTurn(game);
            
            io.to(playerId).emit('guessResult', { 
                guess, bulls, cows, 
                yourTurn: false,
                opponentGuess: null,
                gameMode: game.gameMode
            });
            
            io.to(opponentId).emit('opponentGuess', { 
                guess, bulls, cows, 
                yourTurn: true,
                gameMode: game.gameMode
            });
        }
    });
    
    // Abandonar partida
    socket.on('quitGame', ({ gameId }) => {
        const game = games[gameId];
        if (!game) return;

        const opponentId = game.players.find(id => id !== socket.id);
        if (opponentId) {
            if (game.readyPlayers < 2) {
                io.to(opponentId).emit('gameCancelled');
            } else {
                io.to(opponentId).emit('opponentQuit', {
                    opponentName: players[socket.id]?.name || 'El oponente'
                });
            }
            
            if (players[opponentId]) players[opponentId].currentGame = null;
            io.emit('playerUpdate', players);
        }

        // Limpiar temporizador
        if (game.timer) {
            clearTimeout(game.timer);
        }
        
        delete games[gameId];
        if (players[socket.id]) players[socket.id].currentGame = null;
        io.emit('playerUpdate', players);
    });
    
    // Cancelar partida antes de empezar
    socket.on('cancelGame', ({ gameId }) => {
        const game = games[gameId];
        if (!game) return;

        const opponentId = game.players.find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('gameCancelled');
            if (players[opponentId]) players[opponentId].currentGame = null;
        }

        // Limpiar temporizador si existe
        if (game.timer) {
            clearTimeout(game.timer);
        }
        
        delete games[gameId];
        if (players[socket.id]) players[socket.id].currentGame = null;
        io.emit('playerUpdate', players);
    });
    
    // Desconexión
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        
        // Actualizar estado en users.json
        for (const [username, user] of Object.entries(users)) {
            if (user.socketId === socket.id) {
                user.status = 'offline';
                user.socketId = null;
            }
        }
        saveUsers();
        
        // Cancelar cualquier invitación pendiente
        if (pendingInvitations[socket.id]) {
            const { inviterId } = pendingInvitations[socket.id];
            if (players[inviterId]) {
                io.to(inviterId).emit('invitationCancelled');
            }
            delete pendingInvitations[socket.id];
        }
        
        // Buscar invitaciones donde este jugador era el invitador
        for (const [inviteeId, invitation] of Object.entries(pendingInvitations)) {
            if (invitation.inviterId === socket.id) {
                if (players[inviteeId]) {
                    io.to(inviteeId).emit('invitationCancelled');
                }
                delete pendingInvitations[inviteeId];
            }
        }
        
        if (players[socket.id]) {
            if (players[socket.id].currentGame) {
                const game = games[players[socket.id].currentGame];
                if (game) {
                    const opponentId = game.players.find(id => id !== socket.id);
                    if (opponentId) {
                        if (game.readyPlayers < 2) {
                            io.to(opponentId).emit('gameCancelled');
                        } else {
                            io.to(opponentId).emit('opponentDisconnected', {
                                opponentName: players[socket.id].name
                            });
                        }
                        
                        if (players[opponentId]) players[opponentId].currentGame = null;
                    }
                    
                    // Limpiar temporizador
                    if (game.timer) {
                        clearTimeout(game.timer);
                    }
                    
                    delete games[players[socket.id].currentGame];
                }
            }
            
            delete players[socket.id];
            io.emit('playerUpdate', players);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});