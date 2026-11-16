// Variables za kimataifa (Global Variables)
let mainSeries; // Inahifadhi series ya chati ili WebSocket iweze kuisasisha live
let pingInterval; // Inahifadhi timer ya kutuma Ping ili WebSocket isikatike
let chart; // Imehifadhiwa kimataifa ili iweze kufikiwa na kazi nyingine
let allCandles = []; // Inahifadhi mkusanyiko wote wa mishumaa kwa ajili ya indicators
let socket; // Inahifadhi muunganisho wa WebSocket
let maSeries, emaSeries, upperBandSeries, middleBandSeries, lowerBandSeries; // Global references za indicators (imeongezwa emaSeries hapa)

// Function ya kuhesabu decimals kiotomatiki kutoka kwenye namba ya API
function getDecimalsCount(num) {
    const str = num.toString();
    if (str.includes('.')) {
        return str.split('.')[1].length;
    }
    return 0; // Kama ni namba kamili haina decimal
}

// Function ya kuconvert data kutoka API kwenda Lightweight Charts format
function convertAPIDataToChartFormat(apiResponse) {
    if (!apiResponse || !apiResponse.data || !apiResponse.data.time) {
        console.error('API error au data structure sio sahihi:', apiResponse);
        return [];
    }
    
    const data = apiResponse.data;
    const chartData = [];
    
    for (let i = 0; i < data.time.length; i++) {
        const timeInSeconds = data.time[i] > 1000000000000 
            ? Math.floor(data.time[i] / 1000) 
            : data.time[i];
        
        chartData.push({
            time: timeInSeconds,
            open: parseFloat(data.realOpen ? data.realOpen[i] : data.open[i]),
            high: parseFloat(data.realHigh ? data.realHigh[i] : data.high[i]),
            low: parseFloat(data.realLow ? data.realLow[i] : data.low[i]),
            close: parseFloat(data.realClose ? data.realClose[i] : data.close[i]),
        });
    }
    
    return chartData;
}

// Function ya kupata data kutoka API (Hapa inatumia faili lako la local PHP)
async function fetchCandlestickData() {
    try {
        const response = await fetch(`b_dataapis1.php?pair=${pea}&minutes=${selectedMin}`);
        const apiResponse = await response.json();
        
        const chartData = convertAPIDataToChartFormat(apiResponse);
        
        if (mainSeries && chartData.length > 0) {
            allCandles = chartData;
            mainSeries.setData(allCandles);

            if (localStorage.getItem('show_MA') === 'true') {
                const maData = calculateMovingAverageSeriesData(allCandles, 20);
                if (maSeries) maSeries.setData(maData);
            }

            if (localStorage.getItem('show_EMA') === 'true') {
                const emaData = calculateExponentialMovingAverageData(allCandles, 200);
                if (emaSeries) emaSeries.setData(emaData);
            }

            if (localStorage.getItem('show_BB') === 'true') {
                const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
                if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
                if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
                if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
            }
        }
        setTimeout(fetchCandlestickData, 7000);

        return chartData;
    } catch (error) {
        console.error('Error fetching data:', error);
        setTimeout(fetchCandlestickData, 7000);
        return [];
    }
}

// Function ya kuhesabu Moving Average
function calculateMovingAverageSeriesData(candleData, maLength) {
    const maData = [];
    for (let i = 0; i < candleData.length; i++) {
        if (i < maLength) {
            maData.push({ time: candleData[i].time });
        } else {
            let sum = 0;
            for (let j = 0; j < maLength; j++) {
                sum += candleData[i - j].close;
            }
            const maValue = sum / maLength;
            maData.push({ time: candleData[i].time, value: maValue });
        }
    }
    return maData;
}

// Function mpya ya kuhesabu Exponential Moving Average (EMA)
function calculateExponentialMovingAverageData(candleData, emaLength) {
    const emaData = [];
    const multiplier = 2 / (emaLength + 1);

    for (let i = 0; i < candleData.length; i++) {
        if (i < emaLength - 1) {
            emaData.push({ time: candleData[i].time });
        } else if (i === emaLength - 1) {
            let sum = 0;
            for (let j = 0; j < emaLength; j++) {
                sum += candleData[i - j].close;
            }
            const smaValue = sum / emaLength;
            emaData.push({ time: candleData[i].time, value: smaValue });
        } else {
            const prevEma = emaData[i - 1].value;
            const currentClose = candleData[i].close;
            const emaValue = (currentClose - prevEma) * multiplier + prevEma;
            emaData.push({ time: candleData[i].time, value: emaValue });
        }
    }
    return emaData;
}

// Function ya kuhesabu Bollinger Bands
function calculateBollingerBands(candleData, period = 20, multiplier = 2) {
    const bollingerData = {
        upper: [],
        middle: [],
        lower: [],
    };

    for (let i = 0; i < candleData.length; i++) {
        if (i < period - 1) {
            bollingerData.upper.push({ time: candleData[i].time });
            bollingerData.middle.push({ time: candleData[i].time });
            bollingerData.lower.push({ time: candleData[i].time });
        } else {
            const periodCandles = candleData.slice(i - period + 1, i + 1);
            const sum = periodCandles.reduce((acc, candle) => acc + candle.close, 0);
            const sma = sum / period;
            
            const squaredDifferences = periodCandles.map(candle => 
                Math.pow(candle.close - sma, 2)
            );

            const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / period;
            const stdDev = Math.sqrt(variance);
            
            const upperBand = sma + (multiplier * stdDev);
            const lowerBand = sma - (multiplier * stdDev);
            
            bollingerData.upper.push({ 
                time: candleData[i].time, 
                value: upperBand 
            });

            bollingerData.middle.push({ 
                time: candleData[i].time, 
                value: sma 
            });

            bollingerData.lower.push({ 
                time: candleData[i].time, 
                value: lowerBand 
            });
        }
    }
    return bollingerData;
}

// Function ya kuanzisha WebSocket kwa ajili ya live updates
function initWebSocket() {
    const endpoint = "wss://contract.mexc.com/edge";
    socket = new WebSocket(endpoint);

    socket.onopen = function(event) {
        console.log("WebSocket imeunganishwa kikamilifu!");

        socket.send(JSON.stringify({ 
            "method": "sub.kline", 
            "param": { 
                "symbol": pea, 
                "interval": "Min" + selectedMin 
            }, 
            "id": "kline_" + Date.now() 
        }));

        pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ "method": "ping" }));
            }
        }, 15000);
    };

    socket.onmessage = function(event) {
        let jsonData = JSON.parse(event.data);

        if (jsonData.channel === "rs.ping" || jsonData.method === "ping") return;

        if (jsonData.channel === "push.kline" && jsonData.data) {
            const kData = jsonData.data;

            const timeInSeconds = kData.t > 1000000000000 
                ? Math.floor(kData.t / 1000) 
                : kData.t;

            const liveCandle = {
                time: timeInSeconds,
                open: parseFloat(kData.ro !== undefined ? kData.ro : kData.o),
                high: parseFloat(kData.rh !== undefined ? kData.rh : kData.h),
                low: parseFloat(kData.rl !== undefined ? kData.rl : kData.l),
                close: parseFloat(kData.rc !== undefined ? kData.rc : kData.c)
            };

            if (mainSeries && !isNaN(liveCandle.close)) {
                mainSeries.update(liveCandle);

                const lastIndex = allCandles.length - 1;

                if (lastIndex >= 0 && allCandles[lastIndex].time === liveCandle.time) {
                    allCandles[lastIndex] = liveCandle;
                } else if (lastIndex >= 0 && liveCandle.time > allCandles[lastIndex].time) {
                    allCandles.push(liveCandle);
                }

                // Sasisha mabox live sambamba na mshumaa wa WebSocket
                if (typeof drawOrderBoxes === 'function') {
                    drawOrderBoxes();
                }

                if (localStorage.getItem('show_MA') === 'true') {
                    const maData = calculateMovingAverageSeriesData(allCandles, 20);
                    if (maSeries) maSeries.setData(maData);
                }

                if (localStorage.getItem('show_EMA') === 'true') {
                    const emaData = calculateExponentialMovingAverageData(allCandles, 200);
                    if (emaSeries) emaSeries.setData(emaData);
                }

                if (localStorage.getItem('show_BB') === 'true') {
                    const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
                    if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
                    if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
                    if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
                }
            }
        }
    };

    socket.onerror = function(error) {
        console.error("WebSocket Error: ", error);
    };

    socket.onclose = function(event) {
        console.log("WebSocket imefungwa. Inajaribu kuunganisha tena...");
        clearInterval(pingInterval); 
        setTimeout(initWebSocket, 3000); 
    };
}

// Main function ya kuanzisha chart
async function initChart() {
    const candleStickData = await fetchCandlestickData();

    if (candleStickData.length === 0) {
        console.error('No data received from API');
        return;
    }

    allCandles = candleStickData;

    chart = LightweightCharts.createChart(
        document.getElementById('container'),
        {
            layout: {
                background: { color: "#222" },
                textColor: "#C3BCDB",
            },
            grid: {
                vertLines: { color: "#444" },
                horzLines: { color: "#444" },
            },
            priceScale: {
                autoScale: false,
            },
            localization: {
                timeFormatter: businessDayOrTimestamp => {
                    const date = new Date(businessDayOrTimestamp * 1000);
                    return date.toLocaleTimeString([], {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
                },
            },
        }
    );

    chart.priceScale('right').applyOptions({
        borderColor: "#71649C",
        autoScale: false,
    });

    chart.timeScale().applyOptions({
        borderColor: "#71649C",
        timeVisible: true,
        secondsVisible: false,
    });

    chart.timeScale().applyOptions({
        barSpacing: 10,
    });

    chart.applyOptions({
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 4,
                color: "#9B7DFF",
                style: LightweightCharts.LineStyle.Solid,
                labelBackgroundColor: "#9B7DFF",
            },
            horzLine: {
                color: "#9B7DFF",
                labelBackgroundColor: "#9B7DFF",
            },
        },
    });

    const samplePrice = candleStickData[0].close;
    const autoPrecision = getDecimalsCount(samplePrice);
    const autoMinMove = Math.pow(10, -autoPrecision);

    mainSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
        priceFormat: {
            type: 'price',
            precision: autoPrecision,
            minMove: autoMinMove,
        },
    });

    mainSeries.setData(candleStickData);

    // Changing the Candlestick colors
          mainSeries.applyOptions({
              wickUpColor: "rgb(17, 137, 1)",
              upColor: "rgb(17, 137, 1)",
              wickDownColor: "rgb(225, 50, 85)",
              downColor: "rgb(225, 50, 85)",
              borderVisible: false,
          });

    // 1. LALAMISHA HII ITENGENEZEWE KWANZA ILI KUZUIA AUTO-SCALE MARA MOJA
    mainSeries.priceScale().applyOptions({
        autoScale: false,
    });

    // ==========================================
    // 2. CHORA MABOX YA ODA KWANZA ILI YAKAE CHINI YA INDICATORS

// Tunatumia Map kuhifadhi kumbukumbu ya mabox ili tusifute na kuchora upya kila wakati (Optimize CPU)
    let activeOrderMap = new Map();

    function drawOrderBoxes() {
        if (typeof chart === 'undefined' || typeof allCandles === 'undefined' || allCandles.length === 0) return;

        const allOrders = [
            ...(window.allBidsData || []).map(b => ({ ...b, type: 'bid' })),
            ...(window.allAsksData || []).map(a => ({ ...a, type: 'ask' }))
        ];

        if (allOrders.length === 0) {
            // Kama hakuna oda kabisa, futa zote zilizokuwepo
            activeOrderMap.forEach((boxObj) => {
                chart.removeSeries(boxObj.topSeries);
                chart.removeSeries(boxObj.bottomSeries);
            });
            activeOrderMap.clear();
            return;
        }

        const currentCandleIndex = allCandles.length - 1;
        const currentOrderKeys = new Set();

        // 2. Chora au sasisha mabox yote ya oda kwa ufanisi mkubwa
        allOrders.forEach(order => {
            const orderPriceCenter = parseFloat(order.price); 
            let durationMinutes = parseFloat(order.duration_minutes || order.duration || selectedMin);
            let kiasiDola = parseFloat(order.value || order.dola || 0);
            
            let candleLength = Math.round(durationMinutes / selectedMin);
            candleLength = Math.max(1, candleLength);

            let baseLineWidth = 8; 
            let lineWidth = baseLineWidth;
            if (kiasiDola >= 1500000) {
                let multiplier = kiasiDola / 500000;
                lineWidth = Math.round(baseLineWidth * (1 + (multiplier * 0.05)));
            }

            const boxHeightRange = 0; 
            const boxHighValue = orderPriceCenter + boxHeightRange;
            const boxLowValue = orderPriceCenter;
            const boxColor = order.type === 'bid' ? 'rgba(0, 200, 100, 0.4)' : 'rgba(255, 50, 50, 0.4)';

            // Kitambulisho cha pekee cha oda hii (Bei + Aina)
            const orderKey = `${orderPriceCenter}_${order.type}`;
            currentOrderKeys.add(orderKey);

            let topData = [];
            let bottomData = [];
            
            const startIndex = Math.max(0, currentCandleIndex - candleLength); 
            const endIndex = currentCandleIndex; 

            for (let i = startIndex; i <= endIndex; i++) {
                let t = allCandles[i].time;
                topData.push({ time: t, value: boxHighValue });
                bottomData.push({ time: t, value: boxLowValue });
            }

            // Kama oda hii ilikuwepo tayari, fanya update tu bila kuifuta (Okoa CPU!)
            if (activeOrderMap.has(orderKey)) {
                let existingBox = activeOrderMap.get(orderKey);
                
                existingBox.topSeries.setData(topData);
                existingBox.bottomSeries.setData(bottomData);
                
                if (existingBox.lineWidth !== lineWidth) {
                    existingBox.topSeries.applyOptions({ lineWidth: lineWidth });
                    existingBox.lineWidth = lineWidth;
                }
            } else {
                // Kama ni oda mpya, ndipo tunaichora mara ya kwanza
                const orderBoxTop = chart.addSeries(LightweightCharts.LineSeries, {
                    color: boxColor,
                    lineWidth: lineWidth, 
                    priceLineVisible: false,
                    lastValueVisible: false,
                });

                const orderBoxBottom = chart.addSeries(LightweightCharts.LineSeries, {
                    color: boxColor,
                    lineWidth: 0,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });

                orderBoxTop.setData(topData);
                orderBoxBottom.setData(bottomData);

                // Hifadhi kwenye Map yetu
                activeOrderMap.set(orderKey, {
                    topSeries: orderBoxTop,
                    bottomSeries: orderBoxBottom,
                    lineWidth: lineWidth
                });
            }
        });

        // 3. Futa mara moja tu zile oda ambazo zimetoweka kwenye orderbook mpya
        activeOrderMap.forEach((boxObj, key) => {
            if (!currentOrderKeys.has(key)) {
                chart.removeSeries(boxObj.topSeries);
                chart.removeSeries(boxObj.bottomSeries);
                activeOrderMap.delete(key);
            }
        });

        // Lazimisha indiketa zisasishwe hapa hapa ili zikaye juu ya mabox
        refreshIndicatorsOnTop();
    }

    // Kazi ya kuleta indiketa juu ya mabox mara tu mabox yanapochorwa au kusasishwa
    function refreshIndicatorsOnTop() {
        if (!allCandles || allCandles.length === 0) return;

        if (localStorage.getItem('show_MA') === 'true' && maSeries) {
            const maData = calculateMovingAverageSeriesData(allCandles, 20);
            maSeries.setData(maData);
        }

        if (localStorage.getItem('show_EMA') === 'true' && emaSeries) {
            const emaData = calculateExponentialMovingAverageData(allCandles, 200);
            emaSeries.setData(emaData);
        }

        if (localStorage.getItem('show_BB') === 'true' && upperBandSeries) {
            const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
            upperBandSeries.setData(bollingerBands.upper);
            if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
            if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
        }
    }

    // Sikiliza tukio la oda kubadilika ili kuchora upya
    document.addEventListener('orderbookDataUpdated', function() {
        drawOrderBoxes();
    });

    // Weka kidogo kwenye setTimeout ili kuhakikisha chati imesimama kwanza ndipo mabox yachorwe
    setTimeout(() => {
        drawOrderBoxes();
    }, 100);

    // ==========================================
    // 3. ONGEZA INDICATORS BAADA YA MABOX ILI ZIKAE JUU YAKE

    // 1. MA Series
    maSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    if (localStorage.getItem('show_MA') === 'true') {
        const maData = calculateMovingAverageSeriesData(candleStickData, 20);
        maSeries.setData(maData);
    } else {
        maSeries.setData([]);
    }

    // 2. EMA Series
    emaSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: 'yellow',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    if (localStorage.getItem('show_EMA') === 'true') {
        const emaData = calculateExponentialMovingAverageData(candleStickData, 200);
        emaSeries.setData(emaData);
    } else {
        emaSeries.setData([]);
    }

    // 3. Bollinger Bands Series
    upperBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: 'green',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    middleBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: 'orange',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    lowerBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: 'red',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    if (localStorage.getItem('show_BB') === 'true') {
        const bollingerBands = calculateBollingerBands(candleStickData, 20, 2);
        upperBandSeries.setData(bollingerBands.upper);
        middleBandSeries.setData(bollingerBands.middle);
        lowerBandSeries.setData(bollingerBands.lower);
    } else {
        upperBandSeries.setData([]);
        middleBandSeries.setData([]);
        lowerBandSeries.setData([]);
    }

    const container = document.getElementById('container');
    window.addEventListener("resize", () => {
        chart.resize(container.clientWidth, container.clientHeight);
    });

    createIndicatorButtons();
    initWebSocket();
}
       
function createIndicatorButtons() {
    let btnContainer = document.getElementById('indicator-buttons-container');

    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'indicator-buttons-container';
        btnContainer.style.cssText = "display: flex; gap: 10px; padding: 10px; background: #1a1a1a; justify-content: center; align-items: center;";

        const chartContainer = document.getElementById('container');
        chartContainer.parentNode.insertBefore(btnContainer, chartContainer.nextSibling);
    }

    let showMA = localStorage.getItem('show_MA') === 'true';
    let showEMA = localStorage.getItem('show_EMA') === 'true';
    let showBB = localStorage.getItem('show_BB') === 'true';

    btnContainer.innerHTML = `
        <button id="btnMA" style="padding: 6px 12px; margin-top: 35px; background: ${showMA ? '#2962FF' : '#444'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">MA 20</button>
        <button id="btnEMA" style="padding: 6px 12px; margin-top: 35px; background: ${showEMA ? 'yellow' : '#444'}; color: ${showEMA ? 'black' : 'white'}; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">EMA 200</button>
        <button id="btnBB" style="padding: 6px 12px; margin-top: 35px; background: ${showBB ? '#26a69a' : '#444'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Bollinger Bands</button>
    `;

    document.getElementById('btnMA').addEventListener('click', () => {
        showMA = !showMA;
        localStorage.setItem('show_MA', showMA);
        document.getElementById('btnMA').style.background = showMA ? '#2962FF' : '#444';

        if (showMA && allCandles.length > 0) {
            const maData = calculateMovingAverageSeriesData(allCandles, 20);
            if (maSeries) maSeries.setData(maData);
        } else if (maSeries) {
            maSeries.setData([]);
        }
    });

    document.getElementById('btnEMA').addEventListener('click', () => {
        showEMA = !showEMA;
        localStorage.setItem('show_EMA', showEMA);
        document.getElementById('btnEMA').style.background = showEMA ? '#fbc02d' : '#444';
        document.getElementById('btnEMA').style.color = showEMA ? 'black' : 'white';

        if (showEMA && allCandles.length > 0) {
            const emaData = calculateExponentialMovingAverageData(allCandles, 200);
            if (emaSeries) emaSeries.setData(emaData);
        } else if (emaSeries) {
            emaSeries.setData([]);
        }
    });

    document.getElementById('btnBB').addEventListener('click', () => {
        showBB = !showBB;
        localStorage.setItem('show_BB', showBB);
        document.getElementById('btnBB').style.background = showBB ? '#26a69a' : '#444';

        if (showBB && allCandles.length > 0) {
            const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
            if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
            if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
            if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
        } else {
            if (upperBandSeries) upperBandSeries.setData([]);
            if (middleBandSeries) middleBandSeries.setData([]);
            if (lowerBandSeries) lowerBandSeries.setData([]);
        }
    });
}

document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
        console.log("Ukurasa umerudi kuwa hai, unasawazisha data...");

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            if (socket) socket.close();
            initWebSocket();
        }

        const freshData = await fetchCandlestickData();

        if (freshData && freshData.length > 0 && mainSeries) {
            allCandles = freshData;
            mainSeries.setData(allCandles);

            if (localStorage.getItem('show_MA') === 'true') {
                const maData = calculateMovingAverageSeriesData(allCandles, 20);
                if (maSeries) maSeries.setData(maData);
            }

            if (localStorage.getItem('show_EMA') === 'true') {
                const emaData = calculateExponentialMovingAverageData(allCandles, 200);
                if (emaSeries) emaSeries.setData(emaData);
            }

            if (localStorage.getItem('show_BB') === 'true') {
                const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
                if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
                if (middleBandSeries) middleBandSeries.setData(middleBandSeries.middle);
                if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
            }
        }
    }
});

initChart();