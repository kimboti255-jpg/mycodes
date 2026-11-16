<?php
// Ruhusu kodi ya JavaScript isome data hii
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Pata jina la sarafu (pair) - Default ni BTC_USDT
$pea = $_GET['pair'] ?? '';

// Pata thamani ya min - Default ni 15
$dk = $_GET['minutes'] ?? ''; 

// Unda URL ya API
$mexcUrl ="https://api.mexc.com/api/v1/contract/kline/$pea?interval=Min$dk&limit=300";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $mexcUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
curl_close($ch);

if (!$response) {
    echo json_encode(["success" => false, "message" => "Failed to fetch data from source"]);
    exit();
}

// 2. Geuza JSON kuwa PHP Array
$rawData = json_decode($response, true);

// Kama data imewekwa kwenye array ya nje kabisa [0], ichukue kupitia index ya 0
if (isset($rawData[0])) {
    $rawData = $rawData[0];
}

// 3. Hakikisha data zipo na badilisha Strings kuwa Numbers/Floats
if (isset($rawData['data']) && isset($rawData['data']['time'])) {
   
    $open = isset($rawData['data']['realOpen']) ? $rawData['data']['realOpen'] : $rawData['data']['open'];
    $high = isset($rawData['data']['realHigh']) ? $rawData['data']['realHigh'] : $rawData['data']['high'];
    $low = isset($rawData['data']['realLow']) ? $rawData['data']['realLow'] : $rawData['data']['low'];
    $close = isset($rawData['data']['realClose']) ? $rawData['data']['realClose'] : $rawData['data']['close'];

    // Badilisha strings zote kuwa floats (Numbers)
    $cleanData = [
        "success" => true,
        "code" => 0,
        "data" => [
            "time" => $rawData['data']['time'],
            "open" => array_map('floatval', $open),
            "high" => array_map('floatval', $high),
            "low" => array_map('floatval', $low),
            "close" => array_map('floatval', $close),
        ]
    ];

    echo json_encode($cleanData);
} else {
    echo json_encode(["success" => false, "message" => "Invalid MEXC structure"]);
}
?> 