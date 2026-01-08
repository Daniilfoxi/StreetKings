const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// --- БАЗА ДАННЫХ ГОРОДА ---
let points = [
    { id: 1, name: "ПОРТ", x: 400, y: 500, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 },
    { id: 2, name: "БАНК", x: 1000, y: 300, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 },
    { id: 3, name: "ОФИС", x: 800, y: 1200, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 }
];

// Хранилища данных игроков (имя игрока является ключом)
let playerBalances = {}; 
let playerNames = {}; 
let playerCooldowns = {}; 

// --- ЛОГИКА НОВОСТЕЙ ---
const cityEvents = [
    "Полиция провела рейд в южном порту. Контрабанда изъята.",
    "Мэр обещает покончить с преступностью к концу года.",
    "Курс доллара стабилен: мафия контролирует обменники.",
    "Слухи: в городе появилась новая банда из соседнего штата.",
    "Внимание: замечена активность ФБР в центре города.",
    "Подпольные бои в самом разгаре. Ставки приняты.",
    "Местная газета: 'Кто станет королем ночных улиц?'",
    "Шериф объявил награду за головы лидеров банд."
];

function broadcastNews(text) {
    io.emit('news_update', text);
}

// Случайные новости города каждые 2 минуты
setInterval(() => {
    const randomNews = cityEvents[Math.floor(Math.random() * cityEvents.length)];
    broadcastNews(`📰 ГОРЯЧИЕ НОВОСТИ: ${randomNews}`);
}, 120000);

// --- СЕТЕВАЯ ЛОГИКА ---
io.on('connection', (socket) => {
    let currentUserKey = null; 

    // 1. Авторизация игрока по имени из Telegram
    socket.on('set_name', (name) => {
        currentUserKey = name;
        
        if (!playerBalances[currentUserKey]) {
            playerBalances[currentUserKey] = 1000;
        }
        playerNames[currentUserKey] = name;

        socket.emit('init', points);
        socket.emit('money_update', playerBalances[currentUserKey]);

        if (playerCooldowns[currentUserKey] && playerCooldowns[currentUserKey] > Date.now()) {
            socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
        }
        
        console.log(`Игрок ${currentUserKey} зашел в сеть`);
    });

    // 2. Начисление дохода (1 раз в секунду)
    const moneyInterval = setInterval(() => {
        if (!currentUserKey) return;

        let totalIncome = 0;
        points.forEach(p => {
            if (p.owner === currentUserKey) totalIncome += p.income;
        });
        
        if (totalIncome > 0) {
            playerBalances[currentUserKey] += totalIncome;
            socket.emit('money_update', playerBalances[currentUserKey]);
        }
    }, 1000);

    // 3. Улучшение здания
    socket.on('upgrade_point', (id) => {
        if (!currentUserKey) return;
        
        const p = points.find(pt => pt.id === id);
        const upgradeCost = 5000;

        if (p && p.owner === currentUserKey) {
            if (p.level >= 5) return socket.emit('error_msg', "Максимальный уровень!");
            if (p.isCapturing) return socket.emit('error_msg', "Объект под атакой!");

            if (playerBalances[currentUserKey] >= upgradeCost) {
                playerBalances[currentUserKey] -= upgradeCost;
                p.level += 1;
                p.income += 5; 
                
                io.emit('update', p); 
                socket.emit('money_update', playerBalances[currentUserKey]);
                broadcastNews(`📈 БИЗНЕС: ${currentUserKey} улучшил ${p.name} до LVL ${p.level}`);
            } else {
                socket.emit('error_msg', "Недостаточно денег ($5000)");
            }
        }
    });

    // 4. Захват здания
    socket.on('capture', (id) => {
        if (!currentUserKey) return;

        const p = points.find(pt => pt.id === id);
        const now = Date.now();

        if (!p || p.owner === currentUserKey) return;

        // Проверка личного КД игрока
        if (playerCooldowns[currentUserKey] && playerCooldowns[currentUserKey] > now) {
            return socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
        }

        // Проверка защиты точки (КД после последнего захвата)
        if (p.lastCapturedAt + 30000 > now) {
            return socket.emit('error_msg', "Объект под защитой полиции после штурма!");
        }

        if (!p.isCapturing) {
            p.isCapturing = true;
            p.captureStart = now;
            p.captureEnd = now + 5000;
            p.attacker = currentUserKey;
            p.attackerName = playerNames[currentUserKey] || "Аноним";

            io.emit('update', p);
            broadcastNews(`⚔️ КРИМИНАЛ: ${p.attackerName} начал штурм объекта ${p.name}!`);

            setTimeout(() => {
                if (p.attacker === currentUserKey && p.isCapturing) {
                    const oldOwner = p.ownerName;
                    p.owner = currentUserKey;
                    p.ownerName = playerNames[currentUserKey];
                    p.isCapturing = false;
                    p.lastCapturedAt = Date.now(); 
                    p.level = 1; 
                    p.income = 10;
                    
                    playerCooldowns[currentUserKey] = Date.now() + 60000; // 1 мин КД
                    
                    io.emit('update', p);
                    socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
                    broadcastNews(`🚩 ВЛАСТЬ: ${p.ownerName} захватил ${p.name}, выбив оттуда ${oldOwner}!`);
                }
            }, 5000);
        }
    });

    socket.on('disconnect', () => {
        clearInterval(moneyInterval);
        if (currentUserKey) {
            points.forEach(p => {
                if (p.isCapturing && p.attacker === currentUserKey) {
                    p.isCapturing = false;
                    io.emit('update', p);
                }
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`--- MAFIA CITY SERVER STARTED ---`);
    console.log(`Port: ${PORT}`);
    broadcastNews("🚨 ГОРОД ПРОСНУЛСЯ. НОВАЯ СМЕНА ВЛАСТИ НАЧИНАЕТСЯ.");
});