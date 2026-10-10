// ==========================================
// 1. VARIABLE ZA KIMATAIFA (GLOBAL VARIABLES)
// ==========================================

let currentMode = 'buy'; // 'buy' au 'sell'
let currentPositionSize = 0;
let currentAvailableBalance = 0;
let currentLeverage = 23;

// Symbol iliyowekwa moja kwa moja
const HARDCODED_SYMBOL = 'SOLUSDT';

// --- BINANCE WEBSOCKET API CONFIGURATION ---
const API_KEY = 'FrK30aNhbasA9VRgMLCRIF6lF9tl8VMrW8csINQurVGuaPWFK7Ir8tQvNX7PkuV2';
const API_SECRET = '745JBvQU5gttAWsSzhVrhh7SlvAcQzE1gHb9brSX7p8J7ycHpxNoMa5nQPIHWHHI';
const WS_URL = 'ws://localhost:3003';

let ws = null;
let isWsReady = false;

// Function ya kufungua na kudumisha WebSocket connection
function initWebSocket() {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            resolve(ws);
            return;
        }

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WebSocket Connected to Local Proxy!");
            isWsReady = true;
            resolve(ws);
        };

        ws.onerror = (err) => {
            console.error("WebSocket Error:", err);
            isWsReady = false;
            reject(new Error("Shida ya muunganisho wa WebSocket (Hakikisha proxy inakimbia kwenye port 3003)"));
        };

        ws.onclose = () => {
            console.log("WebSocket Disconnected. Reconnecting in 2 seconds...");
            isWsReady = false;
            setTimeout(initWebSocket, 2000);
        };

        ws.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                console.log("Binance WS Response:", response);

                // Majibu ya kuweka oda (order.place)
                if (response.id && response.id.startsWith("order_")) {
                    if (response.status === 200) {
                        alert(`Oda imewekwa kikamilifu!\nOrder ID: ${response.result.orderId}\nSymbol: ${response.result.symbol}`);
                    } else if (response.error) {
                        alert(`Imeshindikana kuweka oda: [${response.error.code}] ${response.error.msg}`);
                    }
                }

                // Majibu ya kufuta oda (order.cancel)
                if (response.id && response.id.startsWith("cancel_")) {
                    if (response.status === 200) {
                        alert(`Oda ${response.result.orderId} imefutwa kikamilifu!`);
                    } else if (response.error) {
                        alert(`Imeshindikana kufuta oda: [${response.error.code}] ${response.error.msg}`);
                    }
                }
            } catch (e) {
                console.error("Error parsing WS message:", e);
            }
        };
    });
}

// Function ya kutengeneza Signature (HMAC-SHA256)
async function generateSignature(queryString, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(queryString);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}


// ==========================================
// 2. TUKIO LA KUANZA KUPAKIWA KWA UKURASA (INIT)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initWebSocket().catch(err => console.error("WS Init Failed:", err.message));

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', placeOrder);
    }

    const priceInput = document.getElementById('priceInput');
    if (priceInput) {
        priceInput.addEventListener('input', calculateAmountFromSlider);
    }

    const orderTypeSelect = document.getElementById('orderType');
    if (orderTypeSelect) {
        orderTypeSelect.addEventListener('change', handleOrderTypeChange);
    }
});


// ==========================================
// 3. FUNCTION ZA SHUGHULI ZA FOMU NA INTERFACE (UI)
// ==========================================

function changeLeverage() {
    const newLeverage = prompt("Ingiza Leverage (1x - 125x):", currentLeverage);
    if (newLeverage !== null && !isNaN(newLeverage) && newLeverage > 0) {
        currentLeverage = parseInt(newLeverage);
        const levBtn = document.getElementById('leverageBtn');
        if (levBtn) {
            levBtn.innerText = `${currentLeverage}x`;
        }
        calculateAmountFromSlider();
    }
}

function switchMode(mode) {
    currentMode = mode;
    const tabBuy = document.getElementById('tabBuy');
    const tabSell = document.getElementById('tabSell');

    if (mode === 'buy') {
        if (tabBuy) tabBuy.className = 'mode-tab active-open-buy';
        if (tabSell) tabSell.className = 'mode-tab';
    } else {
        if (tabSell) tabSell.className = 'mode-tab active-open-sell';
        if (tabBuy) tabBuy.className = 'mode-tab';
    }

    updateSubmitButton();
    calculateAmountFromSlider();
}

function handleReduceOnlyChange() {
    updateSubmitButton();
    calculateAmountFromSlider();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;

    const reduceOnly = document.getElementById('reduceOnlyCheck')?.checked;

    if (currentMode === 'buy') {
        submitBtn.className = 'submit-btn btn-buy';
        submitBtn.innerText = reduceOnly ? 'Close Short' : 'Buy / Long';
    } else {
        submitBtn.className = 'submit-btn btn-sell';
        submitBtn.innerText = reduceOnly ? 'Close Long' : 'Sell / Short';
    }
}

function calculateAmountFromSlider() {
    const slider = document.getElementById('percentSlider');
    const amountInput = document.getElementById('amountInput');
    const priceInput = document.getElementById('priceInput');
    
    if (!slider || !amountInput) return;

    const percent = parseFloat(slider.value) || 0;
    const reduceOnly = document.getElementById('reduceOnlyCheck')?.checked;
    const currentPrice = parseFloat(priceInput?.value) || 0;

    let calculatedUsdValue = 0;

    if (reduceOnly) {
        calculatedUsdValue = (currentPositionSize * (percent / 100));
        amountInput.value = calculatedUsdValue > 0 ? calculatedUsdValue.toFixed(2) : '0';
        return;
    } 

    calculatedUsdValue = (currentAvailableBalance * currentLeverage) * (percent / 100);

    if (currentPrice > 0 && calculatedUsdValue > 0) {
        const coinQuantity = calculatedUsdValue / currentPrice;
        amountInput.value = coinQuantity.toFixed(2);
    } else {
        amountInput.value = '0';
    }
}

function handleOrderTypeChange() {
    const orderType = document.getElementById('orderType')?.value;
    const priceGroup = document.getElementById('priceGroup');
    const triggerGroup = document.getElementById('triggerGroup');

    if (priceGroup) {
        priceGroup.style.display = (orderType === 'market') ? 'none' : 'flex';
    }
    if (triggerGroup) {
        triggerGroup.style.display = (orderType === 'conditional') ? 'flex' : 'none';
    }
}

function adjustValue(inputId, step) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let val = parseFloat(input.value) || 0;
    val += step;
    input.value = val > 0 ? val.toFixed(2) : '0.00';
}


// ==========================================
// 4. FUNCTION YA KUTUMA ODA KUPITIA WEBSOCKET (PLACE ORDER)
// ==========================================

async function placeOrder() {
    const submitBtn = document.getElementById('submitBtn');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Processing...';
    }

    try {
        const socket = await initWebSocket();

        // Symbol imethibitishwa kuwa SOLUSDT
        const symbol = HARDCODED_SYMBOL; 
        const side = currentMode.toUpperCase(); // BUY au SELL
        const orderTypeInput = document.getElementById('orderType')?.value || 'limit';
        const orderType = orderTypeInput.toUpperCase(); // LIMIT au MARKET

        const rawPrice = document.getElementById('priceInput')?.value || '0';
        const rawQuantity = document.getElementById('amountInput')?.value || '0';
        const timeInForce = document.querySelector('.gtc-select')?.value || 'GTC';
        const reduceOnly = document.getElementById('reduceOnlyCheck')?.checked || false;
        const timestamp = Date.now();

        if (parseFloat(rawQuantity) <= 0) {
            alert("Tafadhali ingiza kiasi (Quantity) kilicho halali!");
            return;
        }

        // Map ya parameters kwa ajili ya kutengeneza signature
        let paramsMap = {
            symbol: symbol,
            side: side,
            type: orderType,
            quantity: parseFloat(rawQuantity).toString(),
            reduceOnly: reduceOnly.toString(),
            timestamp: timestamp.toString()
        };

        if (orderType === 'LIMIT') {
            if (parseFloat(rawPrice) <= 0) {
                alert("Tafadhali ingiza bei (Price) kwa oda ya Limit!");
                return;
            }
            paramsMap.price = parseFloat(rawPrice).toString();
            paramsMap.timeInForce = timeInForce;
        }

        // Panga A-Z na tengeneza query string
        const sortedKeys = Object.keys(paramsMap).sort();
        const queryString = sortedKeys.map(key => `${key}=${paramsMap[key]}`).join('&');

        // Zalisha HMAC-SHA256 Signature
        const signature = await generateSignature(queryString, API_SECRET);

        // Payload inayotumwa kwenye Local Proxy
        let payloadParams = {
            apiKey: API_KEY,
            symbol: symbol,
            side: side,
            type: orderType,
            quantity: parseFloat(rawQuantity),
            reduceOnly: reduceOnly,
            timestamp: timestamp,
            signature: signature
        };

        if (orderType === 'LIMIT') {
            payloadParams.price = parseFloat(rawPrice);
            payloadParams.timeInForce = timeInForce;
        }

        const payload = {
            id: `order_${Date.now()}`,
            method: "order.place",
            params: payloadParams
        };

        console.log("Inatuma Payload kwa Binance Proxy:", payload);
        socket.send(JSON.stringify(payload));

    } catch (err) {
        alert("Shida ya kuweka oda: " + (err.message || err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            updateSubmitButton();
        }
    }
}


// ==========================================
// 5. FUNCTION ZA ZIADA (TABS NA CANCEL ORDER)
// ==========================================

function switchBottomTab(tabName) {
    const posCard = document.getElementById('posCardContainer');
    const noPosMsg = document.getElementById('noPositionMsg');
    const ordersList = document.getElementById('ordersListContainer');
    const tabs = document.querySelectorAll('.bottom-tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (posCard) posCard.style.display = 'none';
    if (noPosMsg) noPosMsg.style.display = 'none';
    if (ordersList) ordersList.style.display = 'none';

    if (tabName === 'positions') {
        const tabPos = document.getElementById('tabPositionsCount');
        if (tabPos) tabPos.classList.add('active');

        if (currentPositionSize > 0) {
            if (posCard) posCard.style.display = 'block';
        } else {
            if (noPosMsg) noPosMsg.style.display = 'block';
        }
    } else if (tabName === 'orders') {
        const tabOrd = document.getElementById('tabOrdersCount');
        if (tabOrd) tabOrd.classList.add('active');

        if (ordersList) ordersList.style.display = 'block';
    } else if (tabName === 'bots') {
        const tabBot = document.getElementById('tabBots');
        if (tabBot) tabBot.classList.add('active');
    }
}

async function cancelOrder(orderId) {
    if (!confirm(`Je, una uhakika unataka kufuta oda ${orderId}?`)) {
        return;
    }

    try {
        const socket = await initWebSocket();
        const timestamp = Date.now();
        const symbol = HARDCODED_SYMBOL;

        const paramsMap = {
            orderId: orderId.toString(),
            symbol: symbol,
            timestamp: timestamp.toString()
        };

        const sortedKeys = Object.keys(paramsMap).sort();
        const queryString = sortedKeys.map(key => `${key}=${paramsMap[key]}`).join('&');

        const signature = await generateSignature(queryString, API_SECRET);

        const payload = {
            id: `cancel_${Date.now()}`,
            method: "order.cancel",
            params: {
                apiKey: API_KEY,
                symbol: symbol,
                orderId: parseInt(orderId),
                timestamp: timestamp,
                signature: signature
            }
        };

        socket.send(JSON.stringify(payload));

    } catch (err) {
        alert("Shida wakati wa kufuta oda: " + (err.message || err));
    }
}
