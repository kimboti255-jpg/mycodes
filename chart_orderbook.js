const asksList = document.getElementById('asks-list');
const bidsList = document.getElementById('bids-list');
const lastPriceEl = document.getElementById('last-price');
const lastPriceSubEl = document.getElementById('last-price-sub');
const buyBar = document.getElementById('buy-bar');
const sellBar = document.getElementById('sell-bar');
const buyPct = document.getElementById('buy-pct');
const sellPct = document.getElementById('sell-pct');

let orderBook = { bids: {}, asks: {} };

// Tengeneza Rows 8 za Asks na Bids
function initDOM() {
    asksList.innerHTML = '';
    bidsList.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        asksList.appendChild(createRow('ask'));
        bidsList.appendChild(createRow('bid'));
    }
}

function createRow(type) {
    const row = document.createElement('div');
    row.className = 'ob-row';

    const depthBg = document.createElement('div');
    depthBg.className = `depth-bg ${type}-depth`;

    const priceSpan = document.createElement('span');
    priceSpan.className = `price ${type}-price`;

    const qtySpan = document.createElement('span');
    qtySpan.className = 'quantity';

    row.appendChild(depthBg);
    row.appendChild(priceSpan);
    row.appendChild(qtySpan);

    return row;
}

initDOM();

function connect() {
    // Chukua symbol (k.m. BTCUSDT) na uibadili kuwa herufi ndogo (btcusdt) kwa ajili ya Binance Stream
    const symbolElem = document.getElementById('pea');
    const symbol = symbolElem ? symbolElem.value.toLowerCase() : 'btcusdt';

    // Unganisha na Binance Futures Depth Stream (@depth20@100ms kwa muunganisho wa haraka)
    const socket = new WebSocket(`wss://fstream.binance.com/ws/${symbol}@depth20@100ms`);

    socket.onopen = () => {
        console.log("Imeunganishwa na Binance Futures...");
    };

    socket.onmessage = (event) => {
        let msg = JSON.parse(event.data);
        if (msg.b || msg.a) {
            processUpdate(msg);
        }
    };

    socket.onclose = () => {
        console.log("Muunganisho umekatika, inajaribu tena...");
        setTimeout(connect, 3000);
    };

    socket.onerror = (err) => console.error("Hitilafu:", err);
}

function processUpdate(data) {
    // Kurekebisha Data ya Bids na Asks kutoka Binance Futures (b = bids, a = asks)
    if (data.b) {
        data.b.forEach(b => { 
            const qty = parseFloat(b[1]);
            if (qty === 0) delete orderBook.bids[b[0]]; 
            else orderBook.bids[b[0]] = qty; 
        });
    }
    
    if (data.a) {
        data.a.forEach(a => { 
            const qty = parseFloat(a[1]);
            if (qty === 0) delete orderBook.asks[a[0]]; 
            else orderBook.asks[a[0]] = qty; 
        });
    }

    render();
}

function render() {
    // Panga Asks (Sells) kutokea kubwa kwenda ndogo ili yenye bei ya chini kabisa ikae karibu na Last Price
    const sortedAsks = Object.entries(orderBook.asks)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .slice(-8); // Chukua 8 za chini kabisa

    // Panga Bids (Buys) kutokea kubwa kwenda ndogo
    const sortedBids = Object.entries(orderBook.bids)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .slice(0, 8);

    // Kina cha Volumes (Kutafuta Maximum Depth kwa ajili ya Bar Graph)
    let maxAskVol = Math.max(...sortedAsks.map(item => item[1]), 1);
    let maxBidVol = Math.max(...sortedBids.map(item => item[1]), 1);

    // Render Asks
    const askRows = asksList.children;
    for (let i = 0; i < 8; i++) {
        const row = askRows[i];
        if (sortedAsks[i]) {
            const price = parseFloat(sortedAsks[i][0]).toFixed(5);
            const qty = sortedAsks[i][1];
            const depthPct = Math.min((qty / maxAskVol) * 100, 100);

            row.children[0].style.width = depthPct + '%';
            row.children[1].innerText = price;
            row.children[2].innerText = qty.toLocaleString();
        } else {
            row.children[0].style.width = '0%';
            row.children[1].innerText = '-';
            row.children[2].innerText = '-';
        }
    }

    // Render Bids
    const bidRows = bidsList.children;
    for (let i = 0; i < 8; i++) {
        const row = bidRows[i];
        if (sortedBids[i]) {
            const price = parseFloat(sortedBids[i][0]).toFixed(5);
            const qty = sortedBids[i][1];
            const depthPct = Math.min((qty / maxBidVol) * 100, 100);

            row.children[0].style.width = depthPct + '%';
            row.children[1].innerText = price;
            row.children[2].innerText = qty.toLocaleString();
        } else {
            row.children[0].style.width = '0%';
            row.children[1].innerText = '-';
            row.children[2].innerText = '-';
        }
    }

    // Update Last Price na Ratio Bar
    if (sortedBids.length > 0) {
        const topBid = sortedBids[0][0];
        lastPriceEl.innerText = parseFloat(topBid).toFixed(5);
        lastPriceSubEl.innerText = parseFloat(topBid).toFixed(5);
    } 
        
    // Send price to form
    if (sortedBids.length > 0) {
        const Bid = sortedBids[0][0];
        const triggerInput = document.getElementById("triggerPrice");
        
        // Angalia kama bei tayari imewekwa kwenye data attribute
        if (!triggerInput.dataset.priceSet) {
            document.getElementById("triggerPrice").value = Bid;
            document.getElementById("exit").value = Bid;
            document.getElementById("executionPrice").value = Bid;
            triggerInput.dataset.priceSet = "true"; // Weka alama
        }
    }

    // Hesabu Uwiano wa Buyers vs Sellers (Buy/Sell Ratio)
    const totalBidVol = sortedBids.reduce((acc, curr) => acc + curr[1], 0);
    const totalAskVol = sortedAsks.reduce((acc, curr) => acc + curr[1], 0);
    const grandTotal = totalBidVol + totalAskVol;

    if (grandTotal > 0) {
        const bPct = Math.round((totalBidVol / grandTotal) * 100);
        const sPct = 100 - bPct;

        buyBar.style.width = bPct + '%';
        sellBar.style.width = sPct + '%';
        buyPct.innerText = bPct + '%';
        sellPct.innerText = sPct + '%';
    }
}

connect();
