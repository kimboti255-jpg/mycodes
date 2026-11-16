// Orodha ya API endpoints na majina ya exchange
const apiEndpoints = [
    { name: 'OKX', url: 'https://simotz255-odakubwa.hf.space/okx_fetch.php' },
    { name: 'Binance', url: 'https://simotz255-odakubwa.hf.space/binance_fetch.php' },
    { name: 'Coinbase', url: 'https://simotz255-odakubwa.hf.space/coinbase_fetch.php' }, 
   { name: 'Bybit', url: 'https://simotz255-odakubwa.hf.space/bybit_fetch.php' } 
];

let autoRefreshInterval = null;
let isAutoRefreshActive = true;
let isFirstLoad = true; // Variable ya kutambua ufunguzi wa kwanza
let isFetchingInProgress = false; // Kinga ya kuzuia maombi ya fetch kurundikana na kufanya app iwe nzito

// Vigezo vya kimataifa vya kupata bei ili zitumike kwenye faili jingine la chati
window.allBidsData = [];
window.allAsksData = [];
window.mi
var element = document.getElementById('last-updated');
var data = element.innerText;

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
        } catch (error) {
            console.error(`Kosa wakati wa kuvuta data kutoka ${endpoint.name}:`, error);
        }
    });

    await Promise.allSettled(fetchPromises);
    
        // ===== FILTER: Qty (value) na Duration (minutes) =====
const qtyFilter = parseFloat(kiasi) || 0;
const minFilter = parseFloat(currentMin) || 0;

allBids = allBids.filter(bid => {
    const v = parseFloat(bid.value) || 0;
    const d = parseFloat(bid.duration_minutes) || 0;
    return v >= qtyFilter && d >= minFilter;
});

allAsks = allAsks.filter(ask => {
    const v = parseFloat(ask.value) || 0;
    const d = parseFloat(ask.duration_minutes) || 0;
    return v >= qtyFilter && d >= minFilter;
});
// ===== MWISHO WA FILTER =====

    // Upangaji (Sorting)
    // 1. Asks (Kuuza): Bei kubwa juu, bei ndogo chini (ili bei ndogo ikutane na Bids katikati)
    allAsks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    // 2. Bids (Kununua): Bei kubwa juu (karibu na Asks), bei ndogo chini
    allBids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    // Kupunguza idadi ya data kuwa oda 30 za juu tu ili kupunguza mzigo wa kuchora kwenye DOM na Chati
    const limitedBids = allBids.slice(0, currentNum);
    const limitedAsks = allAsks.slice(0, currentNum);

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
                <div class="${priceClass}">${parseFloat(item.price).toLocaleString('en-US', {minimumFractionDigits: 1})}
</div>
</td>
<td><center>${parseFloat(item.amount).toFixed(4)}
<br>
${item.value_formatted || ('$' + parseFloat(item.value).toLocaleString('en-US'))}</rd></center><td> ${duration}</td>
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

//===========ORDERBOOK BUTTONS============
//List
// 1. Tunapata thamani ya awali
let currentNum = localStorage.getItem('numFilter') || 30;

// 2. Tunahakikisha button inaonyesha namba hiyo ukurasa unapofunguka
document.addEventListener("DOMContentLoaded", () => {
   const levBtn = document.getElementById('numBtn');
   if (levBtn) levBtn.innerHTML = `${currentNum} List <span>▼</span>`;
});

function changeNum() {
    const numMin = prompt("Inter Number Filter(1 - 100):", currentNum);

    // Tunahakikisha input ni namba na iko ndani ya range (1-100)
    if (numMin !== null && !isNaN(numMin) && numMin > 0 && numMin <= 100) {
        currentNum = numMin;
        
        // 1. Hifadhi kwenye localStorage
        localStorage.setItem('numFilter', currentNum);
        
        // 2. HAPA NDIPO UCHAWI ULIPO: Badilisha maandishi ya button papo hapo
        const levBtn = document.getElementById('numBtn');
        if (levBtn) {
            levBtn.innerHTML = `${currentNum} List <span>▼</span>`;
        }
        
        // Kama una kazi nyingine inapaswa kufanyika (mfano: ku-filter data), 
        // iite hapa, mfano: filterData(currentNum);
    } else if (numMin !== null) {
        alert("Tafadhali ingiza namba kati ya 1 na 100");
    }
}

//Qty
// 1. Tunapata thamani ya awali
let currentQty = localStorage.getItem('myQty') || 1;
let kiasi = currentQty + '000000';

// 2. Tunahakikisha button inaonyesha namba hiyo ukurasa unapofunguka
document.addEventListener("DOMContentLoaded", () => {
   const levBtn = document.getElementById('qtyBtn');
   if (levBtn) levBtn.innerHTML = `${currentQty}$ <span>▼</span>`;
});

function changeQty() {
    const newQty = prompt("Inter Qty Filter(1$ - 100$):", currentQty);

    // Tunahakikisha input ni namba na iko ndani ya range (1-100)
    if (newQty !== null && !isNaN(newQty) && newQty > 0 && newQty <= 1000000000) {
        currentQty = newQty;
        
        // 1. Hifadhi kwenye localStorage
        localStorage.setItem('myQty', currentQty);
        
        // 2. HAPA NDIPO UCHAWI ULIPO: Badilisha maandishi ya button papo hapo
        const levBtn = document.getElementById('qtyBtn');
        if (levBtn) {
            levBtn.innerHTML = `${currentQty}$ <span>▼</span>`;
        }
        
        // Kama una kazi nyingine inapaswa kufanyika (mfano: ku-filter data), 
        // iite hapa, mfano: filterData(currentQty);
    } else if (newQty !== null) {
        alert("Tafadhali ingiza namba kati ya 1 na 100");
    }
}

//Minutes 
// 1. Tunapata thamani ya awali
let currentMin = localStorage.getItem('minFilter') || 0.00;

// 2. Tunahakikisha button inaonyesha namba hiyo ukurasa unapofunguka
document.addEventListener("DOMContentLoaded", () => {
   const levBtn = document.getElementById('minBtn');
   if (levBtn) levBtn.innerHTML = `${currentMin} mins <span>▼</span>`;
});

function changeMin() {
    const newMin = prompt("Inter Min Filter(1Min - 100Mins):", currentMin);

    // Tunahakikisha input ni namba na iko ndani ya range (1-100)
    if (newMin !== null && !isNaN(newMin) && newMin > 0 && newMin <= 100) {
        currentMin = newMin;
        
        // 1. Hifadhi kwenye localStorage
        localStorage.setItem('minFilter', currentMin);
        
        // 2. HAPA NDIPO UCHAWI ULIPO: Badilisha maandishi ya button papo hapo
        const levBtn = document.getElementById('minBtn');
        if (levBtn) {
            levBtn.innerHTML = `${currentMin} mins <span>▼</span>`;
        }
        
        // Kama una kazi nyingine inapaswa kufanyika (mfano: ku-filter data), 
        // iite hapa, mfano: filterData(currentMin);
        fetchOrderBookData();
    } else if (newMin !== null) {
        alert("Tafadhali ingiza namba kati ya 1 na 100");
    }
} 

// Weka window.toggleAutoRefresh ili batani ya HTML iweze kuiona bila tatizo
window.toggleAutoRefresh = toggleAutoRefresh;

// Kuvuta data mara ya kwanza ukurasa unapofunguka
fetchOrderBookData();

// Kujirudia kuvuta data kila baada ya sekunde 7 (7000 ms)
autoRefreshInterval = setInterval(fetchOrderBookData, 7000);