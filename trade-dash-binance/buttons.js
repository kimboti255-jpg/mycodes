// ==========================================
// 1. CONFIGURATION NA GLOBAL VARIABLES
// ==========================================
const API_KEY = 'FrK30aNhbasA9VRgMLCRIF6lF9tl8VMrW8csINQurVGuaPWFK7Ir8tQvNX7PkuV2';
const API_SECRET = '745JBvQU5gttAWsSzhVrhh7SlvAcQzE1gHb9brSX7p8J7ycHpxNoMa5nQPIHWHHI';
const WS_URL = 'wss://ws-fapi.binance.com/ws-fapi/v1';

let ws = null;
let autoRefreshTimer = null;
let currentLeverage = 23;
let currentMode = 'buy';
let currentAvailableBalance = 0.5; // Huonyeshwa dynamically kupitia API
let currentPositionSize = 0;
const HARDCODED_SYMBOL = 'SOLUSDC';

// ==========================================
// 2. TOAST NOTIFICATION & HELPER LOGIC
// ==========================================
function showToast(message, isError = false) {
    let toastPopup = document.getElementById('toastPopup');
    if (!toastPopup) {
        toastPopup = document.createElement('div');
        toastPopup.id = 'toastPopup';
        toastPopup.style.cssText = `
            position: fixed; top: 20px; right: 20px; background-color: #0ecb81; color: #000;
            padding: 12px 20px; border-radius: 6px; font-size: 14px; font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4); display: none; z-index: 9999;
            transition: all 0.3s ease-in-out;
        `;
        document.body.appendChild(toastPopup);
    }

    toastPopup.textContent = message;
    if (isError) {
        toastPopup.style.backgroundColor = '#f6465d';
        toastPopup.style.color = '#fff';
    } else {
        toastPopup.style.backgroundColor = '#0ecb81';
        toastPopup.style.color = '#000';
    }
    toastPopup.style.display = 'block';

    setTimeout(() => {
        toastPopup.style.display = 'none';
    }, 3000);
}

// ==========================================
// 3. WEBSOCKET CONNECTION & SIGNATURE LOGIC
// ==========================================
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Umeunganishwa na Binance Futures WebSocket API.');

        // Chukua Salio na Pending Orders mara moja unaponaganishwa
        getAccountBalance();
        fetchPendingOrdersREST();

        // Anzisha Live Refresh kila baada ya sekunde 3
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(() => {
            getAccountBalance();
            fetchPendingOrdersREST();
        }, 3000);
    };

    ws.onmessage = (event) => {
        const response = JSON.parse(event.data);

        // Angalia ikiwa ni jibu la salio
        if (response.status === 200 && response.result !== undefined) {
            if (response.id && response.id.startsWith('bal_req_')) {
                displayBalances(response.result);
            } else if (response.result && response.result.orderId) {
                const order = response.result;
                alert(`✅ ODA IMEKUBALIWA SEHEMU YA SOKO!\n\nSymbol: ${order.symbol}\nSide: ${order.side}\nBei: $${order.price}\nKiasi: ${order.origQty}\nOrder ID: ${order.orderId}`);
                fetchPendingOrdersREST();
            }
        } 
        // Ukipata Error
        else if (response.status && response.status !== 200) {
            console.error(`❌ KOSA LIMETOKEA (${response.status}):`, response.error ? response.error.msg : 'Ombi limeshindikana');
        }
    };

    ws.onerror = (err) => {
        console.error('Kosa la WebSocket:', err);
    };

    ws.onclose = () => {
        console.warn('WebSocket imekatika. Inajaribu kuunganisha tena...');
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        setTimeout(connectWebSocket, 3000);
    };
}

async function initWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return ws;
    }
    return new Promise((resolve) => {
        connectWebSocket();
        const checkConn = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                clearInterval(checkConn);
                resolve(ws);
            }
        }, 200);
    });
}

// Generator ya HMAC SHA-256
async function generateHMACSignature(secret, message) {
    const encoder = new TextEncoder();
    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const generateSignature = generateHMACSignature;

// ==========================================
// 4. LOGIC YA KUCHUKUA SALIO NA ORDERS
// ==========================================

// 1. Kuchukua Salio kupitia WebSocket RPC
async function getAccountBalance() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const params = {
        apiKey: API_KEY,
        timestamp: Date.now()
    };

    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const signature = await generateHMACSignature(API_SECRET, queryString);
    params.signature = signature;

    const payload = {
        id: `bal_req_${Date.now()}`,
        method: 'v2/account.balance',
        params: params
    };

    ws.send(JSON.stringify(payload));
}

// 2. Onyesha Salio kwenye fomu
function displayBalances(balanceData) {
    if (!Array.isArray(balanceData)) return;

    const usdcAsset = balanceData.find(b => b.asset === 'USDC') || balanceData.find(b => b.asset === 'USDT');
    
    if (usdcAsset) {
        const walletBal = parseFloat(usdcAsset.balance || usdcAsset.wb || usdcAsset.crossWalletBalance || 0);
        currentAvailableBalance = walletBal;

        const avblElem = document.getElementById('avblBalance');
        if (avblElem) {
            avblElem.innerHTML = `${walletBal.toFixed(2)} ${usdcAsset.asset} <span class="plus-icon">+</span>`;
        }
    }
}

// 3. Kuchukua Open Orders kupitia REST API
async function fetchPendingOrdersREST() {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = await generateHMACSignature(API_SECRET, queryString);
        const url = `https://fapi.binance.com/fapi/v1/openOrders?${queryString}&signature=${signature}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'X-MBX-APIKEY': API_KEY }
        });

        const data = await response.json();

        if (Array.isArray(data)) {
            displayPendingOrders(data);
        }
    } catch (err) {
        console.error(`Kosa la REST API (Open Orders): ${err.message}`);
    }
}

// 4. Onyesha Pending Orders kwenye sehemu yake katika fomu
function displayPendingOrders(ordersData) {
    const ordersContainer = document.getElementById('ordersListContainer');
    const tabOrdersCount = document.getElementById('tabOrdersCount');

    if (tabOrdersCount) {
        tabOrdersCount.innerText = `Open Orders (${ordersData.length})`;
    }

    if (!ordersContainer) return;

    if (!Array.isArray(ordersData) || ordersData.length === 0) {
        ordersContainer.innerHTML = `<div style="text-align: center; color: #848e9c; font-size: 12px; padding: 20px 0;" id="noOrdersMsg">No Open Orders</div>`;
        return;
    }

    let html = '';
    ordersData.forEach(ord => {
        const isBuy = ord.side === 'BUY';
        const sideColor = isBuy ? '#0ecb81' : '#f6465d';
        const price = parseFloat(ord.price || ord.stopPrice || 0).toFixed(4);
        const qty = parseFloat(ord.origQty || ord.qty || 0);

        html += `
            <div style="background-color: #2b313a; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; border-left: 4px solid ${sideColor}; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 6px;">
                    <span>${ord.symbol} <small style="color:${sideColor};">${ord.side} (${ord.type})</small></span>
                    <span style="color:#f0b90b;">${ord.status || 'NEW'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #848e9c; margin-bottom: 2px;">
                    <span>Price:</span>
                    <span style="color:#fff;">${price}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #848e9c; margin-bottom: 2px;">
                    <span>Qty:</span>
                    <span style="color:#fff;">${qty}</span>
                </div>
                <button onclick="cancelOrderREST('${ord.symbol}', ${ord.orderId})" style="background-color: #f6465d; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; float: right; margin-top: 4px;">Cancel Order</button>
            </div>
        `;
    });

    ordersContainer.innerHTML = html;
}

// 5. Function ya kughairi Oda yenye Pop-up Notification
async function cancelOrderREST(symbol, orderId) {
    try {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = await generateHMACSignature(API_SECRET, queryString);
        const url = `https://fapi.binance.com/fapi/v1/order?${queryString}&signature=${signature}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'X-MBX-APIKEY': API_KEY }
        });

        const data = await response.json();

        if (data.status === 'CANCELED' || data.orderId) {
            showToast(`✅ Oda #${orderId} (${symbol}) Imefutwa Kwa Mafanikio!`);
            fetchPendingOrdersREST();
        } else if (data.msg) {
            showToast(`❌ Imefeli: ${data.msg}`, true);
        }
    } catch (err) {
        showToast(`❌ Kosa: ${err.message}`, true);
    }
}

// ==========================================
// 5. LOGIC YA KUTUMA ODA (SUBMIT ORDER)
// ==========================================
async function submitOrder() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket haijaunganishwa bado! Subiri sekunde chache.');
        return;
    }

    const symbolElem = document.getElementById('coin');
    const symbol = (symbolElem && symbolElem.innerText.trim()) ? symbolElem.innerText.trim().toUpperCase() : HARDCODED_SYMBOL;
    
    const side = (currentMode === 'buy') ? 'BUY' : 'SELL';
    
    const orderTypeSelect = document.getElementById('orderType');
    const rawOrderType = orderTypeSelect ? orderTypeSelect.value : 'limit';
    
    let type = 'LIMIT';
    if (rawOrderType === 'market') {
        type = 'MARKET';
    } else if (rawOrderType === 'conditional') {
        type = 'STOP';
    }

    const priceInput = document.getElementById('priceInput');
    const amountInput = document.getElementById('amountInput');

    const priceVal = parseFloat(priceInput ? priceInput.value : 0);
    const amountVal = parseFloat(amountInput ? amountInput.value : 0);

    if (type !== 'MARKET' && (isNaN(priceVal) || priceVal <= 0)) {
        alert('Tafadhali weka bei halali (Price).');
        return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
        alert('Tafadhali weka kiasi halali (Amount).');
        return;
    }

    const price = priceVal.toFixed(2);
    const quantity = amountVal.toFixed(2);
    const timestamp = Date.now();
    const timeInForce = 'GTC';

    let queryString = `apiKey=${API_KEY}&quantity=${quantity}&side=${side}&symbol=${symbol}&timestamp=${timestamp}&type=${type}`;
    
    if (type === 'LIMIT') {
        queryString = `apiKey=${API_KEY}&price=${price}&quantity=${quantity}&side=${side}&symbol=${symbol}&timeInForce=${timeInForce}&timestamp=${timestamp}&type=${type}`;
    }

    const signature = await generateHMACSignature(API_SECRET, queryString);

    const payload = {
        id: `order_${Date.now()}`,
        method: 'order.place',
        params: {
            apiKey: API_KEY,
            symbol: symbol,
            side: side,
            type: type,
            quantity: quantity,
            timestamp: timestamp,
            signature: signature
        }
    };

    if (type === 'LIMIT') {
        payload.params.price = price;
        payload.params.timeInForce = timeInForce;
    }

    ws.send(JSON.stringify(payload));
    console.log(`Inatuma Oda ya ${side} (${type}) kwa ${symbol}...`);
}

// ==========================================
// 6. EMBEDDED FORM LOGIC (HAPANA SHIKWA)
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

// ==========================================
// 7. FUNCTION ZA ZIADA (TABS NA CANCEL ORDER)
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

// ==========================================
// 8. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitOrder();
        });
    }

    const priceInput = document.getElementById('priceInput');
    if (priceInput) {
        priceInput.addEventListener('input', calculateAmountFromSlider);
    }
});
