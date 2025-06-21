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
	// Valhallaからルート情報を取得
	valhallaRepo := valhalla.NewValhallaRepo()
	routeResponse, err := valhallaRepo.GetRoute(ctx, request)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to get route from Valhalla: %w", err)
	}

	// データベースから全ての障害物を取得
	obstacleRepo, err := db.NewObstacleRepo(ctx)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create obstacle repo: %w", err)
	}
	obstacles, statusCode, err := obstacleRepo.List(ctx)
	if err != nil {
		return nil, statusCode, fmt.Errorf("failed to get obstacles: %w", err)
	}

	// ルート上の障害物を検出（パラメータに基づいて判定方法を切り替え）
	routeObstacles := findObstaclesOnRoute(routeResponse, *obstacles, request.DetectionMethod, request.DistanceThreshold)

	// 障害物情報をレスポンスに追加
	routeResponse.Obstacles = convertObstaclesToOutput(routeObstacles)

	return routeResponse, http.StatusOK, nil
}

// findObstaclesOnRoute はルート上にある障害物を検出する
func findObstaclesOnRoute(routeResponse *output.ValhallaRouteResponse, obstacles []db.Obstacle, detectionMethod input.ObstacleDetectionMethod, distanceThreshold float64) []db.Obstacle {
	var routeObstacles []db.Obstacle
	
	// ルートのway_idを取得
	var routeWayIds []int64
	for _, location := range routeResponse.Trip.Locations {
		if location.WayId != 0 {
			routeWayIds = append(routeWayIds, location.WayId)
		}
	}
	
	// 検出方法に応じて障害物をフィルタリング
	for _, obstacle := range obstacles {
		switch detectionMethod {
		case input.DetectionMethodNodes:
			// nodes一致のみで判定
			if isObstacleOnRouteByNodes(obstacle, routeWayIds) {
				routeObstacles = append(routeObstacles, obstacle)
			}
		case input.DetectionMethodDistance:
			// 距離判定のみ
			if isObstacleNearRouteByDistance(obstacle, routeResponse, distanceThreshold) {
				routeObstacles = append(routeObstacles, obstacle)
			}
		case input.DetectionMethodBoth:
			// 両方の条件をチェック
			nodeMatch := isObstacleOnRouteByNodes(obstacle, routeWayIds)
			distanceMatch := isObstacleNearRouteByDistance(obstacle, routeResponse, distanceThreshold)
			if nodeMatch || distanceMatch {
				routeObstacles = append(routeObstacles, obstacle)
			}
		default:
			// デフォルトは距離判定
			if isObstacleNearRouteByDistance(obstacle, routeResponse, distanceThreshold) {
				routeObstacles = append(routeObstacles, obstacle)
			}
		}
	}
	
	return routeObstacles
}

// isObstacleOnRouteByNodes は障害物のnodesがルートのway_idと一致するかチェック
func isObstacleOnRouteByNodes(obstacle db.Obstacle, routeWayIds []int64) bool {
	// 障害物にnodesが設定されていない場合はfalse
	if len(obstacle.Nodes) == 0 {
		return false
	}
	
	// 障害物のnodesとルートのway_idに共通するものがあるかチェック
	for _, obstacleNode := range obstacle.Nodes {
		for _, routeWayId := range routeWayIds {
			if obstacleNode == routeWayId {
				return true
			}
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