const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

let points = [
    { id: 1, name: "PORT", x: 400, y: 500, owner: 'neutral', isCapturing: false },
    { id: 2, name: "BANK", x: 1000, y: 300, owner: 'neutral', isCapturing: false },
    { id: 3, name: "OFFICE", x: 800, y: 1200, owner: 'neutral', isCapturing: false }
];

let playerBalances = {}; 

io.on('connection', (socket) => {
    console.log(`Игрок подключен: ${socket.id}`);
    
    // Инициализация игрока
    playerBalances[socket.id] = 1000;
    socket.emit('init', points);
    socket.emit('money_update', playerBalances[socket.id]);

    // ЕДИНЫЙ таймер для начисления денег этому конкретному сокету
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

    // Логика захвата
    socket.on('capture', (id) => {
        const p = points.find(pt => pt.id === id);
        
        if (p && !p.isCapturing && p.owner !== socket.id) {
            p.isCapturing = true;
            p.captureStart = Date.now();
            p.captureEnd = Date.now() + 5000; 
            p.attacker = socket.id;

            io.emit('update', p); // Оповещаем всех о начале анимации

            setTimeout(() => {
                // Проверяем, что атакующий всё еще тот же (не перебит другим)
                if (p.attacker === socket.id) {
                    p.owner = socket.id;
                    p.isCapturing = false;
                    p.captureStart = null;
                    p.captureEnd = null;
                    p.attacker = null;
                    io.emit('update', p); // Финал: меняем цвет у всех
                }
            }, 5000);
        }
    });

    // Очистка при отключении
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        clearInterval(moneyInterval); // Важно остановить таймер денег!
        delete playerBalances[socket.id];
    });
});

server.listen(3000, () => console.log("Server: http://localhost:3000"));