<?php
// Ruhusu kodi ya JavaScript isome data hii
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

//PATA JINA LA SARAFU KUTOKA KWENYE LINK
$pea = $_GET['pair'] ?? '';

$symbol = isset($_GET['symbol']) ? $_GET['symbol'] : "$pea";


// 1. Vuta data kutoka MEXC (PHP haiathiriwi na CORS)
$mexcUrl = "https://api.mexc.com/api/v1/contract/kline/$pea?interval=Min5&limit=300";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $mexcUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
curl_close($ch);

if (!$response) {
    echo json_encode(["success" => false, "message" => "Failed to fetch data from MEXC"]);
    exit();
}

// 2. Geuza JSON ya MEXC kuwa PHP Array
$rawData = json_decode($response, true);

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