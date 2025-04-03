const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración del servidor
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    next();
});

// Estado del juego
const players = {};
const games = {};

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

// Conexiones Socket.io
io.on('connection', (socket) => {
    console.log(`Nuevo usuario conectado: ${socket.id}`);
    console.log('Jugadores registrados:', Object.keys(players)); // Debug
    
    // Registro de jugador
    socket.on('registerPlayer', (playerName) => {
        const normalizedName = normalizeText(playerName.toLowerCase());
        
        // Verificar si el nombre ya existe
        const nameExists = Object.values(players).some(player => 
            normalizeText(player.name.toLowerCase()) === normalizedName
        );
        
        if (nameExists) {
            socket.emit('nameAlreadyExists', {
                message: 'Este nombre de usuario ya esta en uso'
            });
            return;
        }
        
        players[socket.id] = {
            name: playerName,
            socketId: socket.id,
            status: 'online',
            currentGame: null
        };
        
        socket.broadcast.emit('playerUpdate', players);
        socket.emit('playerUpdate', players);
        socket.emit('registrationSuccess', { playerName });
        
        console.log(`Jugador registrado: ${playerName} (${socket.id})`); // Debug
    });
    
    // Invitación a jugar
    socket.on('invitePlayer', ({ inviterId, inviteeId }) => {
        const inviter = players[inviterId];
        const invitee = players[inviteeId];
        
        if (inviter && invitee && !invitee.currentGame) {
            // Pedir al invitador que seleccione el modo de juego
            io.to(inviterId).emit('selectGameMode', {
                inviteeId: inviteeId,
                inviteeName: invitee.name
            });
        }
    });
    
    // Enviar invitación con modo de juego seleccionado
    socket.on('sendInvitationWithMode', ({ inviterId, inviteeId, gameMode }) => {
        const inviter = players[inviterId];
        const invitee = players[inviteeId];
        
        if (inviter && invitee && !invitee.currentGame) {
            io.to(inviteeId).emit('receiveInvitation', {
                inviterName: inviter.name,
                inviterId: inviterId,
                gameMode: gameMode
            });
        }
    });
    
    // Respuesta a invitación
    socket.on('respondInvitation', ({ inviterId, accepted, gameMode }) => {
        if (accepted) {
            // Verificar que ambos jugadores existan
            if (!players[inviterId] || !players[socket.id]) {
                socket.emit('gameError', { message: 'Uno de los jugadores no está disponible.' });
                return;
            }

            const gameId = `${inviterId}-${socket.id}`;
            let secretLength;
            
            // Determinar longitud según modo de juego
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
                raceNumber: gameMode === 'race' ? generateRandomNumber(secretLength) : null
            };
            
            // Actualizar estado de los jugadores (solo si existen)
            if (players[inviterId]) players[inviterId].currentGame = gameId;
            if (players[socket.id]) players[socket.id].currentGame = gameId;
            
            // Notificar a ambos jugadores para que ingresen su número secreto (excepto en modo carrera)
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
                // Modo carrera: comenzar directamente
                games[gameId].currentTurn = games[gameId].players[0];
                
                io.to(inviterId).emit('gameStarted', { 
                    gameId, 
                    opponent: players[socket.id].name,
                    yourTurn: true,
                    chatMessages: games[gameId].chatMessages,
                    gameMode: gameMode
                });
                
                io.to(socket.id).emit('gameStarted', { 
                    gameId, 
                    opponent: players[inviterId].name,
                    yourTurn: false,
                    chatMessages: games[gameId].chatMessages,
                    gameMode: gameMode
                });
            }
            
            // Actualizar lista de jugadores
            io.emit('playerUpdate', players);
            console.log(`Nueva partida creada: ${gameId}`); // Debug
        } else {
            if (players[inviterId]) {
                io.to(inviterId).emit('invitationDeclined', {
                    inviteeName: players[socket.id].name
                });
            }
        }
    });
    
    // Recibir número secreto de jugador
    socket.on('submitSecretNumber', ({ gameId, secretNumber }) => {
        const game = games[gameId];
        if (!game || game.winner) return;
        
        // Validar número secreto según modo de juego
        if (!isValidNumber(secretNumber, game.secretLength)) {
            socket.emit('invalidSecretNumber', { 
                message: `El numero debe tener ${game.secretLength} digitos unicos` 
            });
            return;
        }
        
        // Guardar número secreto
        game.secrets[socket.id] = secretNumber;
        game.readyPlayers++;
        
        // Notificar al jugador que su número fue aceptado
        socket.emit('secretNumberAccepted');
        
        // Si ambos jugadores están listos, comenzar el juego
        if (game.readyPlayers === 2) {
            // El jugador que envió la invitación comienza primero
            game.currentTurn = game.players[0];
            
            // Notificar a ambos jugadores
            io.to(game.players[0]).emit('gameStarted', { 
                gameId, 
                opponent: players[game.players[1]].name,
                yourTurn: true,
                chatMessages: game.chatMessages,
                gameMode: game.gameMode
            });
            
            io.to(game.players[1]).emit('gameStarted', { 
                gameId, 
                opponent: players[game.players[0]].name,
                yourTurn: false,
                chatMessages: game.chatMessages,
                gameMode: game.gameMode
            });
        }
    });
    
    // Enviar mensaje de chat
    socket.on('sendChatMessage', ({ gameId, message }) => {
        const game = games[gameId];
        if (!game) return;
        
        const player = players[socket.id];
        if (!player) return;
        
        // Convertir emojis a su código
        const processedMessage = message.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 
            match => `&#x${match.codePointAt(0).toString(16)};`);
        
        // Agregar mensaje al historial del juego
        const chatMessage = {
            sender: player.name,
            message: processedMessage,
            timestamp: new Date().toLocaleTimeString()
        };
        
        game.chatMessages.push(chatMessage);
        
        // Enviar mensaje a ambos jugadores
        game.players.forEach(playerId => {
            io.to(playerId).emit('receiveChatMessage', chatMessage);
        });
    });
    
	
	
    // Enviar guess
    socket.on('submitGuess', ({ gameId, guess }) => {
    const game = games[gameId];
    if (!game || game.winner) return;
    
    // Validar que sea el turno del jugador
    if (game.currentTurn !== socket.id) {
        socket.emit('notYourTurn', { message: 'No es tu turno' });
        return;
    }
        
        const playerId = socket.id;
        const opponentId = game.players.find(id => id !== playerId);
        
        // En modo carrera, usar el número generado por el sistema
        const secret = game.gameMode === 'race' ? game.raceNumber : game.secrets[opponentId];
        
        // Calcular vacas y toros
        const { bulls, cows } = calculateBullsAndCows(secret, guess);
        
        // Actualizar estado del juego
        game.guesses[playerId].push({ guess, bulls, cows });
        game.currentTurn = opponentId;
        
        // Verificar si hay ganador
        if (bulls === game.secretLength) {
    game.winner = playerId;
    
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
            
            // Actualizar estado de los jugadores
            if (players[playerId]) players[playerId].currentGame = null;
            if (players[opponentId]) players[opponentId].currentGame = null;
            io.emit('playerUpdate', players);
        } else {
            // Notificar a los jugadores
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
                // Si la partida no ha comenzado completamente
                io.to(opponentId).emit('gameCancelled');
            } else {
                // Si la partida ya estaba en curso
                io.to(opponentId).emit('opponentQuit', {
                    opponentName: players[socket.id]?.name || 'El oponente'
                });
            }
            
            // Liberar al oponente
            if (players[opponentId]) players[opponentId].currentGame = null;
            io.emit('playerUpdate', players);
        }

        // Eliminar juego
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

        delete games[gameId];
        if (players[socket.id]) players[socket.id].currentGame = null;
        io.emit('playerUpdate', players);
    });
    
    // Desconexión
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`); // Debug
        if (players[socket.id]) {
            // Si estaba en un juego, notificar al oponente
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
                        
                        // Liberar al oponente
                        if (players[opponentId]) players[opponentId].currentGame = null;
                    }
                    delete games[players[socket.id].currentGame];
                }
            }
            
            delete players[socket.id];
            io.emit('playerUpdate', players);
            console.log('Jugadores restantes:', Object.keys(players)); // Debug
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});