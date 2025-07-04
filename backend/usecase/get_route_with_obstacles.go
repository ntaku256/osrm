package usecase

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"webhook/domain/db"
	"webhook/domain/valhalla"
	"webhook/usecase/adaptor"
	"webhook/usecase/input"
	"webhook/usecase/output"
)

// GetRouteWithObstacles はValhallaからルート情報を取得し、ルート上の障害物を検出して返す
func GetRouteWithObstacles(ctx context.Context, request input.RouteWithObstacles) (*output.ValhallaRouteResponse, int, error) {
	valhallaRepo := valhalla.NewValhallaRepo()
	// 1. /routeでルート取得
	routeResponse, err := valhallaRepo.GetRoute(ctx, request)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to get route from Valhalla: %w", err)
	}

	// 2. 複数ルートまたは単一ルートの処理
	var allTrips []output.Trip
	if routeResponse.Trip.Legs != nil {
		// まずメインルートを追加
		allTrips = append(allTrips, routeResponse.Trip)
	}
	if len(routeResponse.Alternates) > 0 {
		// 代替ルートも追加
		for _, alt := range routeResponse.Alternates {
			allTrips = append(allTrips, alt.Trip)
		}
	}

	// 3. DBから障害物取得（全ルート共通）
	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create obstacle repo: %w", err)
	}
	obstacles, statusCode, err := obstacleRepo.List(ctx)
	if err != nil {
		return nil, statusCode, fmt.Errorf("failed to get obstacles: %w", err)
	}

	// 4. 距離閾値の設定
	var distanceThreshold float64
	if request.DistanceThreshold == 0 {
		distanceThreshold = 0.04 // 40m in kilometers
	} else {
		distanceThreshold = request.DistanceThreshold
	}

	// 5. 各ルートに対して障害物検出を実行
	for tripIndex, trip := range allTrips {
		fmt.Printf("Processing route %d\n", tripIndex+1)
		
		// polylineデコード（最初のlegのみ）
		var shapePoints []valhalla.TraceAttributesRequestShapePoint
		if len(trip.Legs) > 0 && trip.Legs[0].Shape != "" {
			decoded := decodePolyline(trip.Legs[0].Shape, 6)
			for _, pt := range decoded {
				shapePoints = append(shapePoints, valhalla.TraceAttributesRequestShapePoint{Lat: pt[0], Lon: pt[1]})
			}
		}

		// /trace_attributesでway_idリスト取得
		traceReq := valhalla.TraceAttributesRequest{
			Shape:      shapePoints,
			Costing:    "pedestrian",
			ShapeMatch: "map_snap",
			Filters: &valhalla.TraceAttributesFilters{
				Attributes: []string{"edge.way_id", "edge.length", "edge.speed"},
			},
		}
		traceResp, err := valhallaRepo.GetTraceAttributes(ctx, traceReq)
		if err != nil {
			fmt.Printf("Warning: failed to get trace_attributes for route %d: %v\n", tripIndex+1, err)
			continue // このルートはスキップして次へ
		}
		
		var routeWayIds []int64
		for _, edge := range traceResp.Edges {
			routeWayIds = append(routeWayIds, edge.WayID)
		}
		fmt.Printf("Route %d wayIds: %v\n", tripIndex+1, routeWayIds)

		// このルート上の障害物を判定
		routeObstacles := findObstaclesOnRouteWithWayIds(&output.ValhallaRouteResponse{Trip: trip}, *obstacles, routeWayIds, input.DetectionMethodBoth, distanceThreshold)
		convertedObstacles := convertObstaclesToOutput(routeObstacles)

		// Trip構造体に障害物を格納
		if tripIndex == 0 {
			// 1つ目はメインルート
			routeResponse.Trip.Obstacles = convertedObstacles
		} else {
			// 2つ目以降はAlternates
			routeResponse.Alternates[tripIndex-1].Trip.Obstacles = convertedObstacles
		}
	}

	return routeResponse, http.StatusOK, nil
}

// findObstaclesOnRouteWithWayIds はルート上にある障害物を検出する（way_idリストを引数として受け取る版）
func findObstaclesOnRouteWithWayIds(routeResponse *output.ValhallaRouteResponse, obstacles []db.Obstacle, routeWayIds []int64, detectionMethod input.ObstacleDetectionMethod, distanceThreshold float64) []db.Obstacle {
	var routeObstacles []db.Obstacle
	
	for _, obstacle := range obstacles {
		wayIdMatch := isObstacleOnRouteByWayId(obstacle, routeWayIds)
		distanceMatch := isObstacleNearRouteByDistance(obstacle, routeResponse, distanceThreshold)
		if wayIdMatch && distanceMatch {
			routeObstacles = append(routeObstacles, obstacle)
		}
	}
	
	return routeObstacles
}

// isObstacleOnRouteByWayId は障害物のWayIDがルートのway_idと一致するかチェック
func isObstacleOnRouteByWayId(obstacle db.Obstacle, routeWayIds []int64) bool {
	// 障害物のWayIDとルートのway_idに共通するものがあるかチェック
	for _, routeWayId := range routeWayIds {
		if obstacle.WayID == routeWayId {
			return true
		}
	}
	
	return false
}

// isObstacleNearRouteByDistance は障害物がルートから指定距離内にあるかチェック
func isObstacleNearRouteByDistance(obstacle db.Obstacle, routeResponse *output.ValhallaRouteResponse, distanceThreshold float64) bool {
	obstacleLatLon := [2]float64{obstacle.Position[0], obstacle.Position[1]}
	
	// まず境界ボックスでの大まかなフィルタリング
	minLat := routeResponse.Trip.Summary.MinLat
	maxLat := routeResponse.Trip.Summary.MaxLat
	minLon := routeResponse.Trip.Summary.MinLon
	maxLon := routeResponse.Trip.Summary.MaxLon
	
	if !isObstacleInBounds(obstacle, minLat, maxLat, minLon, maxLon) {
		return false
	}
	
	// ルートのポリライン全体をチェック
	for _, leg := range routeResponse.Trip.Legs {
		if leg.Shape != "" {
			// polylineをデコードしてルートライン上の全ての点をチェック
			routePoints := decodePolyline(leg.Shape, 6) // Valhallaは精度6を使用
			
			// 連続する点の間の線分に対して最短距離を計算
			for i := 0; i < len(routePoints)-1; i++ {
				point1 := [2]float64{routePoints[i][0], routePoints[i][1]}
				point2 := [2]float64{routePoints[i+1][0], routePoints[i+1][1]}
				
				distance := distanceFromPointToLineSegment(obstacleLatLon, point1, point2)
				if distance <= distanceThreshold {
					return true
				}
			}
			
			// 最初と最後の点も個別にチェック
			if len(routePoints) > 0 {
				firstDistance := calculateDistance(obstacleLatLon, [2]float64{routePoints[0][0], routePoints[0][1]})
				lastDistance := calculateDistance(obstacleLatLon, [2]float64{routePoints[len(routePoints)-1][0], routePoints[len(routePoints)-1][1]})
				
				if firstDistance <= distanceThreshold || lastDistance <= distanceThreshold {
					return true
				}
			}
		}
	}
	
	// フォールバック: 開始点と終了点での判定
	for _, location := range routeResponse.Trip.Locations {
		locationLatLon := [2]float64{location.Lat, location.Lon}
		distance := calculateDistance(obstacleLatLon, locationLatLon)
		
		if distance <= distanceThreshold {
			return true
		}
	}
	
	return false
}

// isObstacleInBounds は障害物がルートの境界ボックス内にあるかチェック
func isObstacleInBounds(obstacle db.Obstacle, minLat, maxLat, minLon, maxLon float64) bool {
	lat := obstacle.Position[0]
	lon := obstacle.Position[1]
	return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
}

// calculateDistance は2点間の距離をキロメートル単位で計算（ハヴァサイン公式）
func calculateDistance(point1, point2 [2]float64) float64 {
	const earthRadius = 6371 // 地球の半径（キロメートル）
	
	lat1 := point1[0] * math.Pi / 180
	lon1 := point1[1] * math.Pi / 180
	lat2 := point2[0] * math.Pi / 180
	lon2 := point2[1] * math.Pi / 180
	
	dlat := lat2 - lat1
	dlon := lon2 - lon1
	
	a := math.Sin(dlat/2)*math.Sin(dlat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dlon/2)*math.Sin(dlon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	
	return earthRadius * c
}

// decodePolyline はポリラインエンコードされた文字列をデコードする
func decodePolyline(encoded string, precision int) [][2]float64 {
	var coordinates [][2]float64
	index := 0
	lat := 0
	lng := 0
	factor := int(math.Pow(10, float64(precision)))

	for index < len(encoded) {
		// Decode latitude
		var byte int
		shift := 0
		result := 0

		for {
			if index >= len(encoded) {
				break
			}
			byte = int(encoded[index]) - 63
			index++
			result |= (byte & 0x1f) << shift
			shift += 5
			if byte < 0x20 {
				break
			}
		}

		var deltaLat int
		if (result & 1) != 0 {
			deltaLat = ^(result >> 1)
		} else {
			deltaLat = result >> 1
		}
		lat += deltaLat

		// Decode longitude
		shift = 0
		result = 0

		for {
			if index >= len(encoded) {
				break
			}
			byte = int(encoded[index]) - 63
			index++
			result |= (byte & 0x1f) << shift
			shift += 5
			if byte < 0x20 {
				break
			}
		}

		var deltaLng int
		if (result & 1) != 0 {
			deltaLng = ^(result >> 1)
		} else {
			deltaLng = result >> 1
		}
		lng += deltaLng

		coordinates = append(coordinates, [2]float64{
			float64(lat) / float64(factor),
			float64(lng) / float64(factor),
		})
	}

	return coordinates
}

// distanceFromPointToLineSegment は点から線分への最短距離をキロメートル単位で計算
func distanceFromPointToLineSegment(point, lineStart, lineEnd [2]float64) float64 {
	// 線分の長さが0の場合（同じ点）、点間距離を返す
	if lineStart[0] == lineEnd[0] && lineStart[1] == lineEnd[1] {
		return calculateDistance(point, lineStart)
	}
	
	// 線分をベクトルとして扱う
	// A = lineStart, B = lineEnd, P = point
	// ベクトルAB = B - A
	// ベクトルAP = P - A
	
	// 地球の曲率を考慮した計算のため、投影座標系を使用
	// 簡易的にメルカトル投影を使用
	startX, startY := latLonToMercator(lineStart[0], lineStart[1])
	endX, endY := latLonToMercator(lineEnd[0], lineEnd[1])
	pointX, pointY := latLonToMercator(point[0], point[1])
	
	// ベクトルAB
	abX := endX - startX
	abY := endY - startY
	
	// ベクトルAP
	apX := pointX - startX
	apY := pointY - startY
	
	// AB・APの内積
	dotProduct := abX*apX + abY*apY
	
	// ABの長さの二乗
	abLengthSquared := abX*abX + abY*abY
	
	// 線分上での最近点のパラメータt（0から1の範囲にクランプ）
	t := dotProduct / abLengthSquared
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}
	
	// 線分上の最近点
	closestX := startX + t*abX
	closestY := startY + t*abY
	
	// 最近点を緯度経度に戻す
	closestLat, closestLon := mercatorToLatLon(closestX, closestY)
	
	// 点と最近点間の距離を計算
	return calculateDistance(point, [2]float64{closestLat, closestLon})
}

// latLonToMercator は緯度経度をメルカトル投影座標に変換
func latLonToMercator(lat, lon float64) (float64, float64) {
	x := lon * math.Pi / 180.0
	y := math.Log(math.Tan(math.Pi/4.0 + lat*math.Pi/360.0))
	return x, y
}

// mercatorToLatLon はメルカトル投影座標を緯度経度に変換
func mercatorToLatLon(x, y float64) (float64, float64) {
	lon := x * 180.0 / math.Pi
	lat := (2.0*math.Atan(math.Exp(y)) - math.Pi/2.0) * 180.0 / math.Pi
	return lat, lon
}

// convertObstaclesToOutput はDB形式の障害物をAPI出力形式に変換
func convertObstaclesToOutput(obstacles []db.Obstacle) []output.Obstacle {
	var result []output.Obstacle
	for _, obs := range obstacles {
		result = append(result, adaptor.FromDBObstacle(&obs))
	}
	return result
}

// removeDuplicateObstacles は重複する障害物を排除する
func removeDuplicateObstacles(obstacles []output.Obstacle) []output.Obstacle {
	seen := make(map[int]bool)
	var unique []output.Obstacle
	
	for _, obstacle := range obstacles {
		if !seen[obstacle.ID] {
			seen[obstacle.ID] = true
			unique = append(unique, obstacle)
		}
	}
	
	return unique
} 