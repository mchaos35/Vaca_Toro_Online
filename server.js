const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración del servidor
const PORT = process.env.PORT || 3002;
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    next();
});

// Archivos para almacenamiento
const USERS_FILE = path.join(__dirname, 'users.json');
const SCORES_FILE = path.join(__dirname, 'scores.json');
const RANKINGS_FILE = path.join(__dirname, 'rankings.json');

// Cargar datos existentes o inicializar
let users = {};
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

let scores = {};
if (fs.existsSync(SCORES_FILE)) {
    scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf-8'));
}

let rankings = {
    global: [],  // Ahora contendrá objetos con más propiedades
    classic: [],
    '5digits': [],
    '6digits': [],
    race: []
};
if (fs.existsSync(RANKINGS_FILE)) {
    rankings = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf-8'));
}

// Funciones de guardado
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveScores() {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

function saveRankings() {
    fs.writeFileSync(RANKINGS_FILE, JSON.stringify(rankings, null, 2));
}

// Límites de tiempo por modo de juego
const gameTimeLimits = {
    'classic': 45000,  // 45 segundos para 4 dígitos
    '5digits': 60000,  // 1 minuto para 5 dígitos
    '6digits': 60000,  // 1 minuto para 6 dígitos
    'race': 45000      // 45 segundos para modo carrera
};

// Estado del juego
const players = {};
const games = {};
const pendingInvitations = {};

// Funciones de utilidad
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

function isValidNumber(number, length) {
    return number.length === length && 
           /^\d+$/.test(number) && 
           new Set(number.split('')).size === length;
}

// Sistema de puntuación
function calculateScore(gameMode, turnCount, timeUsed, timeLimit, isWinner) {
    let basePoints = 0;
    switch(gameMode) {
        case 'classic': basePoints = 100; break;
        case '5digits': basePoints = 150; break;
        case '6digits': basePoints = 200; break;
        case 'race': basePoints = 120; break;
        default: basePoints = 100;
    }
    
    const speedMultiplier = 1 + (1 - Math.min(turnCount / 10, 1));
    const timeMultiplier = 1 + (1 - (timeUsed / timeLimit));
    
    let finalScore = basePoints * speedMultiplier * timeMultiplier;
    
    if (isWinner) {
        finalScore *= 1.5;
    }
    
    return Math.round(finalScore);
}

function updateRankings(username, gameMode, score, isWinner) {
    if (!scores[username]) {
        scores[username] = {
            totalScore: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            classic: { score: 0, games: 0, wins: 0 },
            '5digits': { score: 0, games: 0, wins: 0 },
            '6digits': { score: 0, games: 0, wins: 0 },
            race: { score: 0, games: 0, wins: 0 }
        };
    }

    // Actualizar puntuación total
    scores[username].totalScore += score;
    scores[username].gamesPlayed += 1;
    scores[username][gameMode].score += score;
    scores[username][gameMode].games += 1;

    // Solo aumentar victorias si es el ganador
    if (isWinner) {
        scores[username].gamesWon += 1;
        scores[username][gameMode].wins += 1;
    }

    // Actualizar rankings
    updateSingleRanking('global', username, scores[username].totalScore);
    updateSingleRanking(gameMode, username, scores[username][gameMode].score);

    saveScores();
    saveRankings();
}

function updateSingleRanking(rankingType, username, score, stats = null) {
    const playerStats = stats || scores[username];
    
    const index = rankings[rankingType].findIndex(item => item.username === username);
    
    if (index !== -1) {
        rankings[rankingType][index].score = score;
        rankings[rankingType][index].gamesPlayed = playerStats.gamesPlayed;
        rankings[rankingType][index].gamesWon = playerStats.gamesWon;
        rankings[rankingType][index].winRate = playerStats.gamesPlayed > 0 
            ? Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100) 
            : 0;
    } else {
        rankings[rankingType].push({ 
            username,
            score,
            gamesPlayed: playerStats.gamesPlayed,
            gamesWon: playerStats.gamesWon,
            winRate: playerStats.gamesPlayed > 0 
                ? Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100) 
                : 0
        });
    }
    
    // Ordenar por puntuación descendente
    rankings[rankingType].sort((a, b) => b.score - a.score);
    
    // Limitar a 100 entradas
    if (rankings[rankingType].length > 100) {
        rankings[rankingType] = rankings[rankingType].slice(0, 100);
    }
}

// Lógica de cambio de turno
function changeTurn(game) {
    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }
    
    if (!game.winner) {
        game.currentTurn = game.players.find(id => id !== game.currentTurn);
        game.timeLeft = game.timeLimit;
        
        game.timer = setTimeout(() => {
            const playerTimedOut = game.currentTurn;
            const nextPlayer = game.players.find(id => id !== playerTimedOut);
            const playerName = players[playerTimedOut]?.name || "Un jugador";
            
            if (!game.winner) {
                const timeoutMessage = {
                    sender: "[Sistema]",
                    message: `¡A ${playerName} se le acabó el tiempo!`,
                    timestamp: new Date().toLocaleTimeString(),
                    isSystem: true
                };
                
                game.chatMessages.push(timeoutMessage);
                game.currentTurn = nextPlayer;
                
                game.players.forEach(playerId => {
                    if (players[playerId]) {
                        io.to(playerId).emit('receiveChatMessage', timeoutMessage);
                        io.to(playerId).emit('timeOut', {
                            playerTimedOut: playerTimedOut,
                            nextTurn: nextPlayer
                        });
                    }
                });
                
                if (game.timer) {
                    clearTimeout(game.timer);
                }
                game.timeLeft = game.timeLimit;
                game.timer = setTimeout(() => {
                    changeTurn(game);
                }, game.timeLimit);
                
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

        if (users[username]) {
            socket.emit('registrationError', {
                message: 'Este nombre de usuario ya está en uso'
            });
            return;
        }

        users[username] = {
            password: password,
            socketId: socket.id,
            status: 'online',
            currentGame: null
        };

        saveUsers();

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

    // Inicio de sesión
    socket.on('loginPlayer', ({ username, password }) => {
        if (!users[username] || users[username].password !== password) {
            socket.emit('loginError', {
                message: 'Usuario o contraseña incorrectos'
            });
            return;
        }

        users[username].socketId = socket.id;
        users[username].status = 'online';
        saveUsers();

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
    
    // Chat global
    socket.on('sendGlobalChatMessage', ({ message, mentionedUsers }) => {
        const player = players[socket.id];
        if (!player) return;
        
        const chatMessage = {
            sender: player.name,
            message: message,
            timestamp: new Date().toLocaleTimeString(),
            mentionedUsers: mentionedUsers || []
        };
        
        io.emit('receiveGlobalChatMessage', chatMessage);
    });
    
    // Invitaciones a jugar
    socket.on('sendInvitationWithMode', ({ inviterId, inviteeId, gameMode }) => {
        const inviter = players[inviterId];
        const invitee = players[inviteeId];
        
        if (inviter && invitee && !invitee.currentGame) {
            io.to(inviteeId).emit('beingInvited', {
                inviterName: inviter.name
            });
            
            pendingInvitations[inviteeId] = {
                inviterId,
                gameMode
            };
            
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
        delete pendingInvitations[inviteeId || socket.id];
        
        if (players[inviterId]) {
            io.to(inviterId).emit('inv  itationDeclined', {
                inviteeName: players[inviteeId || socket.id]?.name || 'El jugador'
            });
            io.to(inviterId).emit('invitationCancelled');
        }
        
        if (inviteeId && players[inviteeId]) {
            io.to(inviteeId).emit('invitationCancelled');
        }
    });
    
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
                case '5digits': secretLength = 5; break;
                case '6digits': secretLength = 6; break;
                case 'race': secretLength = 4; break;
                default: secretLength = 4;
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
				games[gameId].raceNumber = generateRandomNumber(secretLength);
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
    
    changeTurn(games[gameId]);
}
            
            io.emit('playerUpdate', players);
            delete pendingInvitations[socket.id];
        } else {
            if (players[inviterId]) {
                io.to(inviterId).emit('invitationDeclined', {
                    inviteeName: players[socket.id].name
                });
            }
            delete pendingInvitations[socket.id];
        }
    });
    
    // Número secreto
    socket.on('submitSecretNumber', ({ gameId, secretNumber }) => {
    const game = games[gameId];
    if (!game || game.winner) return;
    
    const secretLength = game.secretLength;
    const errorMessages = [];
    
    if (secretNumber.length !== secretLength) {
        errorMessages.push(`El número debe tener ${secretLength} dígitos`);
    }
    
    if (!/^\d+$/.test(secretNumber)) {
        errorMessages.push("Solo se permiten dígitos numéricos");
    }
    
    if (new Set(secretNumber.split('')).size !== secretLength) {
        errorMessages.push("Todos los dígitos deben ser diferentes");
    }
    
    if (secretNumber[0] === '0') {
        errorMessages.push("El primer dígito no puede ser 0");
    }
    
    if (errorMessages.length > 0) {
        socket.emit('invalidSecretNumber', { 
            message: errorMessages.join(', ') 
        });
        return;
    }
    
    // Si pasa todas las validaciones
    game.secrets[socket.id] = secretNumber;
    game.readyPlayers++;
    
    socket.emit('secretNumberAccepted');
    
    if (game.readyPlayers === 2) {
        game.currentTurn = game.players[Math.floor(Math.random() * 2)];
        
        io.to(game.players[0]).emit('gameStarted', { 
            gameId, 
            opponent: players[game.players[1]].name,
            yourTurn: game.currentTurn === game.players[0],
            chatMessages: games[gameId].chatMessages,
            gameMode: game.gameMode
        });
        
        io.to(game.players[1]).emit('gameStarted', { 
            gameId, 
            opponent: players[game.players[0]].name,
            yourTurn: game.currentTurn === game.players[1],
            chatMessages: games[gameId].chatMessages,
            gameMode: game.gameMode
        });
        
        changeTurn(game);
    }
});
    
    // Chat de juego
    socket.on('sendChatMessage', ({ gameId, message }) => {
        const game = games[gameId];
        if (!game) return;
        
        const player = players[socket.id];
        if (!player) return;
        
        const chatMessage = {
            sender: player.name,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        };
        
        game.chatMessages.push(chatMessage);
        
        game.players.forEach(playerId => {
            io.to(playerId).emit('receiveChatMessage', chatMessage);
        });
    });
    
    // Adivinanzas
    socket.on('submitGuess', ({ gameId, guess }) => {
    const game = games[gameId];
    if (!game || game.winner) return;

    if (game.currentTurn !== socket.id) {
        socket.emit('notYourTurn', { message: 'No es tu turno' });
        return;
    }

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    const playerId = socket.id;
    const opponentId = game.players.find(id => id !== playerId);
    const secret = game.gameMode === 'race' ? game.raceNumber : game.secrets[opponentId];
    
    // Validar que el intento cumple con las reglas
    if (!isValidNumber(guess, game.secretLength)) {
        socket.emit('invalidGuess', { 
            message: `El número debe tener ${game.secretLength} dígitos únicos sin repetir` 
        });
        return;
    }

    const { bulls, cows } = calculateBullsAndCows(secret, guess);
    game.guesses[playerId].push({ guess, bulls, cows });

    // Si adivinó el número (victoria)
    if (bulls === game.secretLength) {
        game.winner = playerId;
        clearTimeout(game.timer);

        // Calcular puntuaciones
        const turnCount = game.guesses[playerId].length;
        const timeUsed = game.timeLimit - game.timeLeft;
        
        // Puntuación del ganador (completa)
        const winnerScore = calculateScore(
            game.gameMode, 
            turnCount, 
            timeUsed, 
            game.timeLimit, 
            true
        );

        // Puntuación del perdedor (10% del ganador o 0)
        const loserScore = game.gameMode === 'race' ? 0 : Math.round(winnerScore * 0.1);

        // Actualizar estadísticas del GANADOR
        if (players[playerId]) {
            updateRankings(
                players[playerId].name, 
                game.gameMode, 
                winnerScore,
                true  // isWinner = true
            );
            
            io.to(playerId).emit('scoreUpdate', {
                score: winnerScore,
                isNewHighScore: scores[players[playerId].name]?.[game.gameMode]?.score <= winnerScore
            });
        }

        // Actualizar estadísticas del PERDEDOR
        if (players[opponentId]) {
            updateRankings(
                players[opponentId].name, 
                game.gameMode, 
                loserScore,
                false  // isWinner = false
            );
            
            io.to(opponentId).emit('scoreUpdate', {
                score: loserScore,
                isNewHighScore: false
            });
        }

        // Notificar resultados
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

        // Limpiar estado del juego
        [playerId, opponentId].forEach(id => {
            if (players[id]) players[id].currentGame = null;
        });
        
        delete games[gameId];
        io.emit('playerUpdate', players);

    } else {
        // Cambiar turno si no hubo acierto
        changeTurn(game);
        
        io.to(playerId).emit('guessResult', { 
            guess, 
            bulls, 
            cows, 
            yourTurn: false,
            gameMode: game.gameMode
        });
        
        io.to(opponentId).emit('opponentGuess', { 
            guess, 
            bulls, 
            cows, 
            yourTurn: true,
            gameMode: game.gameMode
        });
    }
});
    
    // Abandonar partida
    socket.on('quitGame',  ({ gameId }) => {
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

        if (game.timer) {
            clearTimeout(game.timer);
        }
        
        delete games[gameId];
        if (players[socket.id]) players[socket.id].currentGame = null;
        io.emit('playerUpdate', players);
    });
    
    // Cancelar partida
    socket.on('cancelGame',  ({ gameId }) => {
        const game = games[gameId];
        if (!game) return;

        const opponentId = game.players.find(id => id !== socket.id);
        if (opponentId) {
            io.to(opponentId).emit('gameCancelled');
            if (players[opponentId]) players[opponentId].currentGame = null;
        }

        if (game.timer) {
            clearTimeout(game.timer);
        }
        
        delete games[gameId];
        if (players[socket.id]) players[socket.id].currentGame = null;
        io.emit('playerUpdate', players);
    });
    
    // Solicitudes de ranking
    socket.on('requestRankings', ({ rankingType }) => {
    const validTypes = ['global', 'classic', '5digits', '6digits', 'race'];
    const type = validTypes.includes(rankingType) ? rankingType : 'global';
    
    // Enviar datos completos del ranking
    socket.emit('receiveRankings', {
        rankingType: type,
        rankings: rankings[type].slice(0, 50).map(player => ({
            ...player,
            winRate: player.winRate || 0
        }))
    });
});
    
    socket.on('requestPlayerStats',  ({ username }) => {
        const playerStats = scores[username] || null;
        socket.emit('receivePlayerStats', {
            username,
            stats: playerStats
        });
    });
    
	socket.on('createMultiplayerGame', (settings) => {
    const player = players[socket.id];
    if (!player || player.currentGame) return;

    const gameId = `multi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    games[gameId] = {
        id: gameId,
        creator: player.name,
        creatorId: socket.id,
        players: [socket.id],
        currentPlayers: 1,
        maxPlayers: settings.playerCount,
        gameMode: settings.gameMode,
        timeLimit: settings.timeLimit,
        status: 'waiting'
    };

    player.currentGame = gameId;
    io.emit('playerUpdate', players);
    io.emit('availableGamesUpdate', Object.values(games).filter(g => g.status === 'waiting'));
    
    // Enviar confirmación al creador
    socket.emit('multiplayerGameCreated', { 
        gameId,
        currentPlayers: 1,
        maxPlayers: settings.playerCount
    });
});
	
	// En server.js
socket.on('joinMultiplayerGame', ({ gameId }) => {
    const game = games[gameId];
    const player = players[socket.id];
    
    if (!game || !player || player.currentGame || game.players.length >= game.maxPlayers) {
        socket.emit('gameError', { message: 'No se pudo unir a la partida' });
        return;
    }
    
    game.players.push(socket.id);
    game.currentPlayers = game.players.length;
    player.currentGame = gameId;
    
    // Notificar a todos los jugadores en la partida
    game.players.forEach(playerId => {
        io.to(playerId).emit('playerJoinedGame', {
            gameId,
            playerName: player.name,
            currentPlayers: game.currentPlayers,
            maxPlayers: game.maxPlayers
        });
    });
    
    // Actualizar lista de partidas para todos
    io.emit('availableGamesUpdate', Object.values(games).filter(g => g.status === 'waiting'));
    
    // Si la partida está llena, notificar al creador para que pueda iniciar
    if (game.currentPlayers === game.maxPlayers) {
        io.to(game.creatorId).emit('gameReadyToStart', { gameId });
    }
});
	
	socket.on('startMultiplayerGame',  ({ gameId }) => {
    const game = games[gameId];
    if (!game || game.status !== 'waiting' || game.players.length < 2) return;

    game.status = 'playing';
    game.raceNumber = generateRandomNumber(
        game.gameMode === '5digits' ? 5 : 
        game.gameMode === '6digits' ? 6 : 4
    );
    
    // Seleccionar jugador inicial aleatorio
    game.currentTurn = game.players[Math.floor(Math.random() * game.players.length)];
    game.timeLeft = game.timeLimit;
    
    // Notificar a todos los jugadores
    game.players.forEach((playerId, index) => {
        io.to(playerId).emit('multiplayerGameStarted', {
            gameId,
            players: game.players.map(id => players[id].name),
            yourTurn: playerId === game.currentTurn,
            gameMode: game.gameMode,
            playerIndex: index
        });
    });
    
    // Iniciar temporizador
    changeTurn(game);
    
    // Actualizar lista de partidas
    io.emit('availableGamesUpdate', Object.values(games).filter(g => g.status === 'waiting'));
});
	
    // Desconexión
    socket.on('disconnect',  () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        
        // Actualizar estado en users.json
        for (const [username, user] of Object.entries(users)) {
            if (user.socketId === socket.id) {
                user.status = 'offline';
                user.socketId = null;
            }
        }
        saveUsers();
        
        // Cancelar invitaciones pendientes
        if (pendingInvitations[socket.id]) {
            const { inviterId } = pendingInvitations[socket.id];
            if (players[inviterId]) {
                io.to(inviterId).emit('invitationCancelled');
            }
            delete pendingInvitations[socket.id];
        }
        
        // Buscar invitaciones donde era el invitador
        for (const [inviteeId,  invitation] of Object.entries(pendingInvitations)) {
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

server.listen(PORT,  () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});