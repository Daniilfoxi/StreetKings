const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// База данных точек
let points = [
    { id: 1, name: "PORT", x: 400, y: 500, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false },
    { id: 2, name: "BANK", x: 1000, y: 300, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false },
    { id: 3, name: "OFFICE", x: 800, y: 1200, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false }
];

let playerBalances = {}; 
let playerNames = {}; // Хранилище ников { socketId: "Nickname" }

io.on('connection', (socket) => {
    console.log(`Connection: ${socket.id}`);
    
    // 1. Инициализация игрока
    playerBalances[socket.id] = 1000;
    playerNames[socket.id] = "Аноним"; // Временное имя
    
    socket.emit('init', points);
    socket.emit('money_update', playerBalances[socket.id]);

    // 2. Получение реального имени из Telegram
    socket.on('set_name', (name) => {
        playerNames[socket.id] = name;
        console.log(`Игрок ${socket.id} теперь известен как: ${name}`);
    });

    // 3. Таймер начисления денег (доход от захваченных точек)
    const moneyInterval = setInterval(() => {
        let income = 0;
        points.forEach(p => {
            if (p.owner === socket.id) income += 10;
        });
        
        if (income > 0) {
            playerBalances[socket.id] += income;
            socket.emit('money_update', playerBalances[socket.id]);
        }
    }, 1000);

    // 4. Логика захвата
    socket.on('capture', (id) => {
        const p = points.find(pt => pt.id === id);
        
        // Условие: точка существует, сейчас не захватывается и игрок не владелец
        if (p && !p.isCapturing && p.owner !== socket.id) {
            p.isCapturing = true;
            p.captureStart = Date.now();
            p.captureEnd = Date.now() + 5000; // 5 секунд
            p.attacker = socket.id;
            p.attackerName = playerNames[socket.id] || "Неизвестный";

            io.emit('update', p); // Оповещаем всех о начале захвата

            setTimeout(() => {
                // Проверка: тот же ли игрок удерживает точку спустя время
                if (p.attacker === socket.id) {
                    p.owner = socket.id;
                    p.ownerName = playerNames[socket.id] || "Мафиози"; // Сохраняем ник владельца
                    p.isCapturing = false;
                    p.captureStart = null;
                    p.captureEnd = null;
                    p.attacker = null;
                    p.attackerName = null;
                    
                    io.emit('update', p); // Финал захвата
                }
            }, 5000);
        }
    });

    // 5. Очистка при отключении
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${playerNames[socket.id]}`);
        clearInterval(moneyInterval);
        delete playerBalances[socket.id];
        delete playerNames[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));