// Orodha ya API endpoints na majina ya exchange
const apiEndpoints = [
    { name: 'Binance', url: 'https://binance-doge-9ykiif.hostkb.com/json-data' },
    { name: 'Combined', url: 'https://whale-orders-mvmnne.hostkb.com/json-data-two' }
];

let autoRefreshInterval = null;
let isAutoRefreshActive = true;
let isFirstLoad = true; // Variable ya kutambua ufunguzi wa kwanza
let isFetchingInProgress = false; // Kinga ya kuzuia maombi ya fetch kurundikana na kufanya app iwe nzito

// Vigezo vya kimataifa vya kupata bei ili zitumike kwenye faili jingine la chati
window.allBidsData = [];
window.allAsksData = [];

async function fetchOrderBookData() {
    if (isFetchingInProgress) return; // Zuia kama bado inafanya fetch ya awali ili kulinda mtandao na CPU
    isFetchingInProgress = true;

    let allBids = [];
    let allAsks = [];

    // Kuvuta data kutoka API zote kwa pamoja
    const fetchPromises = apiEndpoints.map(async (endpoint) => {
        try {
            const response = await fetch(endpoint.url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Kuongeza jina la exchange kwenye kila oda
            if (data.bids || data.asks) {
                // Muundo wa kawaida (API moja = exchange moja, mfano Binance)
                if (data.bids && Array.isArray(data.bids)) {
                    data.bids.forEach(bid => {
                        bid.exchange = endpoint.name;
                        allBids.push(bid);
                    });
                }

                if (data.asks && Array.isArray(data.asks)) {
                    data.asks.forEach(ask => {
                        ask.exchange = endpoint.name;
                        allAsks.push(ask);
                    });
                }
            } else if (data.coinbase || data.okx) {
                // Muundo uliounganisha majukwaa 2 (Coinbase + OKX)
                if (data.coinbase) {
                    if (data.coinbase.bids && Array.isArray(data.coinbase.bids)) {
                        data.coinbase.bids.forEach(bid => {
                            bid.exchange = 'Coinbase';
                            allBids.push(bid);
                        });
                    }
                    if (data.coinbase.asks && Array.isArray(data.coinbase.asks)) {
                        data.coinbase.asks.forEach(ask => {
                            ask.exchange = 'Coinbase';
                            allAsks.push(ask);
                        });
                    }
                }
                if (data.okx) {
                    if (data.okx.bids && Array.isArray(data.okx.bids)) {
                        data.okx.bids.forEach(bid => {
                            bid.exchange = 'OKX';
                            allBids.push(bid);
                        });
                    }
                    if (data.okx.asks && Array.isArray(data.okx.asks)) {
                        data.okx.asks.forEach(ask => {
                            ask.exchange = 'OKX';
                            allAsks.push(ask);
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Kosa wakati wa kuvuta data kutoka ${endpoint.name}:`, error);
        }
    });

    await Promise.allSettled(fetchPromises);

    // Upangaji (Sorting)
    // 1. Asks (Kuuza): Bei kubwa juu, bei ndogo chini (ili bei ndogo ikutane na Bids katikati)
    allAsks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    // 2. Bids (Kununua): Bei kubwa juu (karibu na Asks), bei ndogo chini
    allBids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    // Kupunguza idadi ya data kuwa oda 30 za juu tu ili kupunguza mzigo wa kuchora kwenye DOM na Chati
    const limitedBids = allBids.slice(0, 60);
    const limitedAsks = allAsks.slice(0, 60);

    // Kuhifadhi bei zilizopunguzwa kwenye vigezo vya kimataifa ili ziweze kusomwa na faili la chati kwa wepesi
    window.allBidsData = limitedBids;
    window.allAsksData = limitedAsks;
    
    // Kutumia requestAnimationFrame kupunguza uzito kwenye browser wakati wa kusambaza EVENT
    window.requestAnimationFrame(() => {
        const updateEvent = new CustomEvent('orderbookDataUpdated');
        document.dispatchEvent(updateEvent);
    });

    // Kuonyesha data kwenye HTML
    renderTable('bids-body', limitedBids, 'price-bid');
    renderTable('asks-body', limitedAsks, 'price-ask');

    // CENTER ORDERBOOK
    if (isFirstLoad) {
        const target = document.getElementById('middleTarget');
        const container = document.getElementById('overflowTest'); // au div inayoscroolika

        if (target && container) {
            // Inasogeza scroll bar ili 'middleTarget' (box la BIDS) ianze katikati ya box
            container.scrollTop = target.offsetTop - (container.clientHeight / 2) + (target.clientHeight / 2);
        } else if (target) {
            // Au kutumia block: 'start' badala ya 'center'
            target.scrollIntoView({
                behavior: 'auto',
                block: 'start'
            });
        }
        isFirstLoad = false;
    }

    // Kusasisha muda wa mwisho wa Fetch
    const now = new Date();
    const statusText = isAutoRefreshActive ? '' : '(Auto-update turn off)';
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.innerText = `ORDERBOOK Updated: ${now.toLocaleTimeString()} ${statusText}`;
    }

    isFetchingInProgress = false; // Ruhusu mzunguko unaofuata baada ya kumaliza
}

function renderTable(elementId, items, priceClass) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Hakuna data iliyopatikana.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        // Kuweka mtindo wa lebo ya exchange
        const exchangeBadge = `<span class="badge badge-${item.exchange.toLowerCase()}">${item.exchange}</span>`;

        // Kuweka vizuri muda iliyodumu oda
        let duration = item.duration_minutes !== undefined ? item.duration_minutes : 0;
        duration = typeof duration === 'number' ? duration.toFixed(1) : duration;
        
if (duration  > 1439) {
let siku = Math.floor(duration / 1440);
if (siku > 1) {
duration = siku + "Days";
} else {
duration = siku + "Day";
        } 
      } else if (duration > 59) {
    let masaa = Math.floor(duration / 60);
    if (masaa > 1) {
    duration = masaa + "Hours";
     } else {
     duration = masaa + "Hour";
    } 
 } else if (duration > 1) {
duration = duration + "Mins";
} else {
duration = duration + "Min";
} 
        return `
            <tr>
                <td>${exchangeBadge}
                <div class="${priceClass}">${parseFloat(item.price).toLocaleString('en-US', {minimumFractionDigits: 5})}
</div>
</td>
<td>${parseFloat(item.amount)}
<br>
${item.value_formatted || ('$' + parseFloat(item.value).toLocaleString('en-US'))}</rd><td> ${duration}</td>
            </tr>
        `;
    }).join('');
}

// Mfumo wa kudhibiti Auto-Refresh kupitia batani
function toggleAutoRefresh() {
    const btn = document.getElementById('toggle-refresh-btn');

    if (isAutoRefreshActive) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        isAutoRefreshActive = false;

        if (btn) {
            btn.innerText = '▶ START Auto-Update (7 sec)';
            btn.classList.remove('active');
        }
    } else {
        fetchOrderBookData(); // Kuvuta mara moja papo hapo unaponyeza
        autoRefreshInterval = setInterval(fetchOrderBookData, 7000);
        isAutoRefreshActive = true;

        if (btn) {
            btn.innerText = '⏸ STOP Auto-Update (7 sec)';
            btn.classList.add('active');
        }
    }
}

// Weka window.toggleAutoRefresh ili batani ya HTML iweze kuiona bila tatizo
window.toggleAutoRefresh = toggleAutoRefresh;

// Kuvuta data mara ya kwanza ukurasa unapofunguka
fetchOrderBookData();

// Kujirudia kuvuta data kila baada ya sekunde 7 (7000 ms)
autoRefreshInterval = setInterval(fetchOrderBookData, 7000);