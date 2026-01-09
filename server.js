const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// --- БАЗА ДАННЫХ ГОРОДА ---
let points = [
    { id: 1, name: "ПОРТ", x: 400, y: 500, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 },
    { id: 2, name: "БАНК", x: 1000, y: 300, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 },
    { id: 3, name: "ОФИС", x: 800, y: 1200, owner: 'neutral', ownerName: "ГОСУДАРСТВО", isCapturing: false, level: 1, income: 10, lastCapturedAt: 0 },
    { id: 4, name: "LUXURY SHOP", x: 1400, y: 800, type: 'shop' }
];

let playerAssets = {};
let playerBalances = {}; 
let playerNames = {}; 
let playerCooldowns = {}; 

// Вспомогательная функция для чистки имени (синхронизация с Telegram)
function normalize(name) {
    if (!name) return "unknown";
    return String(name).toLowerCase().replace('@', '').trim();
}

const cityEvents = [
    "Полиция провела рейд в южном порту. Контрабанда изъята.",
    "Мэр обещает покончить с преступностью к концу года.",
    "Курс доллара стабилен: мафия контролирует обменники.",
    "Внимание: замечена активность ФБР в центре города."
];

function broadcastNews(text) {
    io.emit('news_update', text);
}

// Новости каждые 2 минуты
setInterval(() => {
    const randomNews = cityEvents[Math.floor(Math.random() * cityEvents.length)];
    broadcastNews(`📰 ГОРЯЧИЕ НОВОСТИ: ${randomNews}`);
}, 120000);

// --- СЕТЕВАЯ ЛОГИКА ---
io.on('connection', (socket) => {
    let currentUserKey = null; 

    // 1. Авторизация
    socket.on('set_name', (rawName) => {
        currentUserKey = normalize(rawName);
        
        if (!playerBalances[currentUserKey]) {
            playerBalances[currentUserKey] = 100000000; // Стартовый капитал
        }
        playerNames[currentUserKey] = rawName;

        socket.emit('init', points);
        socket.emit('money_update', playerBalances[currentUserKey]);
        socket.emit('set_name_confirmed', currentUserKey);

        if (playerCooldowns[currentUserKey] && playerCooldowns[currentUserKey] > Date.now()) {
            socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
        }
    });

    // Доход раз в секунду
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

    // --- УЛУЧШЕНИЕ ЗДАНИЯ ---
    socket.on('upgrade_point', (id) => {
        if (!currentUserKey) return socket.emit('error_msg', "Ошибка авторизации!");
        
        const p = points.find(pt => pt.id === id);
        const upgradeCost = 5000;

        if (p) {
            if (p.owner === currentUserKey) {
                if (p.level >= 5) return socket.emit('error_msg', "Максимальный уровень достигнут!");
                
                if (playerBalances[currentUserKey] >= upgradeCost) {
                    playerBalances[currentUserKey] -= upgradeCost;
                    p.level += 1;
                    p.income += 10; // Существенный бонус к доходу за апгрейд
                    
                    io.emit('update', p); 
                    socket.emit('money_update', playerBalances[currentUserKey]);
                    broadcastNews(`📈 БИЗНЕС: ${playerNames[currentUserKey]} улучшил ${p.name} до уровня ${p.level}!`);
                } else {
                    socket.emit('error_msg', `Нужно $${upgradeCost}`);
                }
            } else {
                socket.emit('error_msg', "Это не ваше здание!");
            }
        }
    });

    socket.on('buy_luxury', (item) => {
        if (!currentUserKey) return;
        const price = item.price;
        
        if (playerBalances[currentUserKey] >= price) {
            playerBalances[currentUserKey] -= price;
            
            if (!playerAssets[currentUserKey]) playerAssets[currentUserKey] = [];
            playerAssets[currentUserKey].push(item.name);
            
            socket.emit('money_update', playerBalances[currentUserKey]);
            socket.emit('buy_success', item.name);
            broadcastNews(`💎 РОСКОШЬ: ${playerNames[currentUserKey]} купил ${item.name}!`);
        } else {
            socket.emit('error_msg', "Недостаточно золота для такой роскоши!");
        }
    });

    // --- ЗАХВАТ ЗДАНИЯ ---
    socket.on('capture', (id) => {
        if (!currentUserKey) return;
        const p = points.find(pt => pt.id === id);
        
        if (p && p.type === 'shop') return socket.emit('error_msg', "Это общественное место, его нельзя захватить!");
        const now = Date.now();
        


        if (!p || p.owner === currentUserKey || p.isCapturing) return;

        if (playerCooldowns[currentUserKey] && playerCooldowns[currentUserKey] > now) {
            return socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
        }
        if (p.lastCapturedAt + 30000 > now) {
            return socket.emit('error_msg', "Объект под защитой полиции!");
        }

        p.isCapturing = true;
        p.captureStart = now;
        p.captureEnd = now + 5000;
        p.attacker = currentUserKey;
        p.attackerName = playerNames[currentUserKey];
        
        io.emit('update', p);
        broadcastNews(`⚔️ ШТУРМ: ${p.attackerName} атакует ${p.name}!`);

        setTimeout(() => {
            if (p.attacker === currentUserKey && p.isCapturing) {
                p.owner = currentUserKey;
                p.ownerName = playerNames[currentUserKey];
                p.isCapturing = false;
                p.lastCapturedAt = Date.now(); 
                p.level = 1; 
                p.income = 10;
                playerCooldowns[currentUserKey] = Date.now() + 60000; // КД на следующий захват
                
                io.emit('update', p);
                socket.emit('player_cooldown', playerCooldowns[currentUserKey]);
                broadcastNews(`🚩 ЗАХВАТ: ${p.ownerName} теперь контролирует ${p.name}!`);
            }
        }, 5000);
    });

    socket.on('disconnect', () => {
        clearInterval(moneyInterval);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`--- SERVER READY ON PORT ${PORT} ---`));