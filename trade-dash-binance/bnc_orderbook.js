  let ws = null;
  let reconnectTimer = null;
  const symbol = "solusdc";
  const wsUrl = `wss://fstream.binance.com/ws/${symbol}@depth10@100ms`;

  function formatAmount(val) {
    const num = parseFloat(val);
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  function connectWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket imeunganishwa kikamilifu.");
      document.getElementById('status-banner').style.display = 'none';
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const asks = data.a;
      const bids = data.b;

      if (!asks || !bids) return;

      const topAsks = asks.slice(0, 6).reverse();
      const topBids = bids.slice(0, 6);

      let totalAskVol = topAsks.reduce((acc, curr) => acc + parseFloat(curr[1]), 0);
      let totalBidVol = topBids.reduce((acc, curr) => acc + parseFloat(curr[1]), 0);

      // Render Asks
      let asksHtml = '';
      let currentAskSum = totalAskVol;
      topAsks.forEach(([price, amount]) => {
        const depthPct = (currentAskSum / totalAskVol) * 100;
        asksHtml += `
          <div class="row">
            <div class="depth-bar" style="width: ${depthPct}%;"></div>
            <span class="price">${parseFloat(price).toFixed(2)}</span>
            <span class="amount">${formatAmount(amount)}</span>
          </div>
        `;
        currentAskSum -= parseFloat(amount);
      });
      document.getElementById('asks').innerHTML = asksHtml;

      // Render Bids
      let bidsHtml = '';
      let currentBidSum = 0;
      topBids.forEach(([price, amount]) => {
        currentBidSum += parseFloat(amount);
        const depthPct = (currentBidSum / totalBidVol) * 100;
        bidsHtml += `
          <div class="row">
            <div class="depth-bar" style="width: ${depthPct}%;"></div>
            <span class="price">${parseFloat(price).toFixed(2)}</span>
            <span class="amount">${formatAmount(amount)}</span>
          </div>
        `;
      });
      document.getElementById('bids').innerHTML = bidsHtml;

      // Middle Prices
      const currentPrice = parseFloat(topAsks[topAsks.length - 1][0]).toFixed(2);
      document.getElementById('mark-price').innerText = currentPrice;
       if (!triggerInput.dataset.priceSet)
      document.getElementById('priceInput').value = currentPrice ||'';
      triggerInput.dataset.priceSet = "true";
      document.getElementById('index-price').innerText = (parseFloat(currentPrice) - 0.01).toFixed(2);

      // Buy/Sell Ratio
      const grandTotal = totalBidVol + totalAskVol;
      if (grandTotal > 0) {
        const bidRatio = ((totalBidVol / grandTotal) * 100).toFixed(2);
        const askRatio = (100 - bidRatio).toFixed(2);

        document.getElementById('bid-pct').innerText = `${bidRatio}%`;
        document.getElementById('ask-pct').innerText = `${askRatio}%`;
        document.getElementById('bid-fill').style.width = `${bidRatio}%`;
        document.getElementById('ask-fill').style.width = `${askRatio}%`;
      }
    };

    // Mfumo wa kutambua disconnection au error
    ws.onclose = () => {
      console.warn("WebSocket imekatika! Inajaribu kuunganisha tena...");
      document.getElementById('status-banner').style.display = 'block';
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      ws.close(); // Inalazimisha kufunga ili `onclose` ijiendeshe na kuanzisha reconnect logic
    };
  }

  function scheduleReconnect() {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        connectWebSocket();
      }, 3000); // Inajaribu tena kila baada ya sekunde 3
    }
  }

  // Pia inasikiliza mfumo wa Browser internet status (Online/Offline event)
  window.addEventListener('online', () => {
    console.log("Internet imerudi, inajiunganisha maramoja...");
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  });

  // Anzisha connection mara ya kwanza
  connectWebSocket();