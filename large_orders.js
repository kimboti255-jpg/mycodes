// Orodha ya API endpoints na majina ya exchange
const apiEndpoints = [
    { name: 'OKX', url: 'https://simotz255-odakubwa.hf.space/okx_fetch.php' },
    { name: 'Binance', url: 'https://simotz255-odakubwa.hf.space/binance_fetch.php' },
    { name: 'Coinbase', url: 'https://simotz255-odakubwa.hf.space/coinbase_fetch.php' }
];

let autoRefreshInterval = null;
let isAutoRefreshActive = true;
let isFirstLoad = true; // Variable ya kutambua ufunguzi wa kwanza

async function fetchOrderBookData() {
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

    // Upangaji (Sorting)
    // 1. Asks (Kuuza): Bei kubwa juu, bei ndogo chini (ili bei ndogo ikutane na Bids katikati)
    allAsks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    // 2. Bids (Kununua): Bei kubwa juu (karibu na Asks), bei ndogo chini
    allBids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    // Kuonyesha data kwenye HTML
    renderTable('bids-body', allBids, 'price-bid');
    renderTable('asks-body', allAsks, 'price-ask');

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
        lastUpdatedEl.innerText = `Updated: ${now.toLocaleTimeString()} ${statusText}`;
    }
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

        return `
            <tr>
                <td>${exchangeBadge}
                <div class="${priceClass}">${parseFloat(item.price).toLocaleString('en-US', {minimumFractionDigits: 1})}
</div>
</td>
<td>${parseFloat(item.amount).toFixed(4)}
<br>
${item.value_formatted || ('$' + parseFloat(item.value).toLocaleString('en-US'))}</rd><td>min <br> ${duration}</td>
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