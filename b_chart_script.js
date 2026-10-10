      // Variables za kimataifa (Global Variables)
      let mainSeries; // Inahifadhi series ya chati ili WebSocket iweze kuisasisha live
      let pingInterval; // Inahifadhi timer ya kutuma Ping ili WebSocket isikatike
      let chart; // Imehifadhiwa kimataifa ili iweze kufikiwa na kazi nyingine
      let allCandles = []; // Inahifadhi mkusanyiko wote wa mishumaa kwa ajili ya indicators
      let socket; // Inahifadhi muunganisho wa WebSocket
      let maSeries, upperBandSeries, middleBandSeries, lowerBandSeries; // Global references za indicators

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
          // Angalia kama response imefanikiwa na kama ina data
          if (!apiResponse || !apiResponse.data || !apiResponse.data.time) {
              console.error('API error au data structure sio sahihi:', apiResponse);
              return [];
          }
          
          const data = apiResponse.data;
          const chartData = [];
          
          // Loop through time array
          for (let i = 0; i < data.time.length; i++) {
              // Kama timestamp iko katika milliseconds, convert kwenda seconds
              const timeInSeconds = data.time[i] > 1000000000000 
                  ? Math.floor(data.time[i] / 1000) 
                  : data.time[i];
              
              // Badilisha strings za bei kuwa Floats/Numbers za JS zisomeke kwenye chati
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
              const response = await fetch(`b_dataapis1.php?pair=${pea}`);
              const apiResponse = await response.json();
              
              // Convert data kwenda format ya chart
              const chartData = convertAPIDataToChartFormat(apiResponse);
              setTimeout(fetchCandlestickData, 20000);
              
              return chartData;
          } catch (error) {
              console.error('Error fetching data:', error);
              return [];
          }
      }

      // Function ya kuhesabu Moving Average
      function calculateMovingAverageSeriesData(candleData, maLength) {
          const maData = [];

          for (let i = 0; i < candleData.length; i++) {
              if (i < maLength) {
                  // Provide whitespace data points until the MA can be calculated
                  maData.push({ time: candleData[i].time });
              } else {
                  // Calculate the moving average
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

      // Function ya kuhesabu Bollinger Bands
      function calculateBollingerBands(candleData, period = 20, multiplier = 2) {
          const bollingerData = {
              upper: [],
              middle: [],
              lower: [],
          };

          for (let i = 0; i < candleData.length; i++) {
              if (i < period - 1) {
                  // Hakuna data za kutosha bado
                  bollingerData.upper.push({ time: candleData[i].time });
                  bollingerData.middle.push({ time: candleData[i].time });
                  bollingerData.lower.push({ time: candleData[i].time });
              } else {
                  // Chukua mishumaa ya period iliyopita
                  const periodCandles = candleData.slice(i - period + 1, i + 1);
                  
                  // Calculate Simple Moving Average (Middle Band)
                  const sum = periodCandles.reduce((acc, candle) => acc + candle.close, 0);
                  const sma = sum / period;
                  
                  // Calculate Standard Deviation
                  const squaredDifferences = periodCandles.map(candle => 
                      Math.pow(candle.close - sma, 2)
                  );
                  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / period;
                  const stdDev = Math.sqrt(variance);
                  
                  // Calculate Upper and Lower Bands
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
          // 1. Taja URL ya WebSocket
          const endpoint = "wss://contract.mexc.com/edge";

          // 2. Fungua muunganisho (Connection) wa WebSocket
          socket = new WebSocket(endpoint);

          // 3. Tukio la kufunguka kwa muunganisho
          socket.onopen = function(event) {
              console.log("WebSocket imeunganishwa kikamilifu!");
              
              // Tuma ombi la kujiunga (Subscribe) kwenye kline/mishumaa ya Min5
              socket.send(JSON.stringify({ 
                  "method": "sub.kline", 
                  "param": { 
                      "symbol": pea, 
                      "interval": "Min5" 
                  }, 
                  "id": "kline_" + Date.now() 
              }));

              // Tuma PING kila sekunde 15 ili kuzuia server ya MEXC kumuondoa mteja
              pingInterval = setInterval(() => {
                  if (socket.readyState === WebSocket.OPEN) {
                      socket.send(JSON.stringify({ "method": "ping" }));
                  }
              }, 15000);
          };

          // 4. Tukio la kupokea data (Hapa ndipo data inapoingia kila sekunde)
          socket.onmessage = function(event) {
              let jsonData = JSON.parse(event.data);

              // Puuza majibu ya Ping/Pong ili yasiharibu mzunguko wa chati
              if (jsonData.channel === "rs.ping" || jsonData.method === "ping") return;

              // Hakikisha channel ni ya push.kline na ina data
              if (jsonData.channel === "push.kline" && jsonData.data) {
                  const kData = jsonData.data;

                  // Badilisha timestamp kuwa ya sekunde
                  const timeInSeconds = kData.t > 1000000000000 
                      ? Math.floor(kData.t / 1000) 
                      : kData.t;

                  // Tengeneza object ya mshumaa wa sasa (Live Candle)
                  const liveCandle = {
                      time: timeInSeconds,
                      open: parseFloat(kData.ro !== undefined ? kData.ro : kData.o),
                      high: parseFloat(kData.rh !== undefined ? kData.rh : kData.h),
                      low: parseFloat(kData.rl !== undefined ? kData.rl : kData.l),
                      close: parseFloat(kData.rc !== undefined ? kData.rc : kData.c)
                  };

                  // Sasisha au ongeza mshumaa kwenye chati moja kwa moja LIVE
                  if (mainSeries && !isNaN(liveCandle.close)) {
                      mainSeries.update(liveCandle);

                      // Sasisha data ndani ya allCandles ili indicators zisiachwe nyuma
                      const lastIndex = allCandles.length - 1;
                      if (lastIndex >= 0 && allCandles[lastIndex].time === liveCandle.time) {
                          allCandles[lastIndex] = liveCandle;
                      } else if (lastIndex >= 0 && liveCandle.time > allCandles[lastIndex].time) {
                          allCandles.push(liveCandle);
                      }

                      // Recalculate and update indicators live
                      const maData = calculateMovingAverageSeriesData(allCandles, 20);
                      if (maSeries) maSeries.setData(maData);

                      const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
                      if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
                      if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
                      if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
                  }
              }
          };

          // 5. Tukio la kutokea kwa hitilafu (Error)
          socket.onerror = function(error) {
              console.error("WebSocket Error: ", error);
          };

          // 6. Tukio la kufungwa kwa muunganisho
          socket.onclose = function(event) {
              console.log("WebSocket imefungwa. Inajaribu kuunganisha tena...");
              clearInterval(pingInterval); // Futa ping timer
              setTimeout(initWebSocket, 3000); // Jaribu kuunganisha tena baada ya sekunde 3
          };
      }

      // Main function ya kuanzisha chart
      async function initChart() {
          // Pata data kutoka API (kupitia faili la PHP)
          const candleStickData = await fetchCandlestickData();
          
          if (candleStickData.length === 0) {
              console.error('No data received from API');
              return;
          }

          // Hifadhi kwenye variable ya kimataifa ili iweze kutumika kusasisha indicators
          allCandles = candleStickData;
          
          // Create the Lightweight Chart within the container element
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
              }
          );

          // Setting the border color for the vertical axis
          chart.priceScale('right').applyOptions({
              borderColor: "#71649C",
          });

          // Setting the border color for the horizontal axis
          chart.timeScale().applyOptions({
              borderColor: "#71649C",
          });

          // Adjust the starting bar width (essentially the horizontal zoom)
          chart.timeScale().applyOptions({
              barSpacing: 10,
          });

          // Customizing the Crosshair
          chart.applyOptions({
              crosshair: {
                  // Change mode from default 'magnet' to 'normal'.
                  // Allows the crosshair to move freely without snapping to datapoints
                  mode: LightweightCharts.CrosshairMode.Normal,

                  // Vertical crosshair line (showing Date in Label)
                  vertLine: {
                      width: 4,
                      color: "#9B7DFF",
                      style: LightweightCharts.LineStyle.Solid,
                      labelBackgroundColor: "#9B7DFF",
                  },

                  // Horizontal crosshair line (showing Price in Label)
                  horzLine: {
                      color: "#9B7DFF",
                      labelBackgroundColor: "#9B7DFF",
                  },
              },
          });

          // Kupata idadi ya decimals kiotomatiki kutoka kwenye data ya kwanza ya API
          const samplePrice = candleStickData[0].close;
          const autoPrecision = getDecimalsCount(samplePrice);
          const autoMinMove = Math.pow(10, -autoPrecision);

          // Create the Main Series (Candlesticks) - Hapa tunaipanga kwenye variable ya Global ikifuata decimals za API
          mainSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
              priceFormat: {
                  type: 'price',
                  precision: autoPrecision, // Weka decimals kiotomatiki kulingana na data ya API
                  minMove: autoMinMove,
              },
          });
          
          // Set the data for the Main Series
          mainSeries.setData(candleStickData);
          
          // Changing the Candlestick colors
          mainSeries.applyOptions({
              wickUpColor: "rgb(54, 116, 217)",
              upColor: "rgb(54, 116, 217)",
              wickDownColor: "rgb(225, 50, 85)",
              downColor: "rgb(225, 50, 85)",
              borderVisible: false,
          });

          
          // Kuhesabu na kuongeza Moving Average
          const maData = calculateMovingAverageSeriesData(candleStickData, 20);
          maSeries = chart.addSeries(LightweightCharts.LineSeries, {
              color: '#2962FF',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
          });
          maSeries.setData(maData);

          // Kuhesabu Bollinger Bands
          const bollingerBands = calculateBollingerBands(candleStickData, 20, 2);

          // Kuongeza Upper Band
          upperBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
              color: 'green',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
          });
          upperBandSeries.setData(bollingerBands.upper);

          // Kuongeza Middle Band (SMA)
          middleBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
              color: 'orange',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
          });
          middleBandSeries.setData(bollingerBands.middle);

          // Kuongeza Lower Band
          lowerBandSeries = chart.addSeries(LightweightCharts.LineSeries, {
              color: 'red',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
          });
          lowerBandSeries.setData(bollingerBands.lower);

          // Adjust the options for the priceScale of the mainSeries
          mainSeries.priceScale().applyOptions({
              autoScale: true,
              scaleMargins: {
                  top: 0.1,
                  bottom: 0.2,
              },
          });

          // Adding a window resize event handler
          const container = document.getElementById('container');
          window.addEventListener("resize", () => {
              chart.resize(container.clientWidth, container.clientHeight);
          });

          // Anzisha muunganisho wa WebSocket LIVE mara baada ya chati na data za awali kupakiwa
          initWebSocket();
      }
      
      // Page Visibility API - Inasawazisha chati na kuwasha WebSocket pindi mtumiaji anaporudi kwenye ukurasa kutoka recents
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

                  const maData = calculateMovingAverageSeriesData(allCandles, 20);
                  if (maSeries) maSeries.setData(maData);

                  const bollingerBands = calculateBollingerBands(allCandles, 20, 2);
                  if (upperBandSeries) upperBandSeries.setData(bollingerBands.upper);
                  if (middleBandSeries) middleBandSeries.setData(bollingerBands.middle);
                  if (lowerBandSeries) lowerBandSeries.setData(bollingerBands.lower);
              }
          }
      });

      // Call initChart function to start everything
      initChart();
