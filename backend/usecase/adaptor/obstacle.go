package adaptor

import (
	"webhook/domain/db"
	"webhook/usecase/output"
)

// Convert from API model to DB model
func ToDBObstacle(obstacle output.Obstacle) *db.Obstacle {
	return &db.Obstacle{
		ID:          obstacle.ID,
		Position:    obstacle.Position,
		Type:        obstacle.Type,
		Description: obstacle.Description,
		DangerLevel: obstacle.DangerLevel,
		Nodes:       obstacle.Nodes,
		NearestDistance: obstacle.NearestDistance,
		NoNearbyRoad:  obstacle.NoNearbyRoad,
		ImageS3Key:  obstacle.ImageS3Key,
		CreatedAt:   obstacle.CreatedAt,
	}
}

// Convert from DB model to API model
func FromDBObstacle(dbObstacle *db.Obstacle) output.Obstacle {
	return output.Obstacle{
		ID:          dbObstacle.ID,
		Position:    dbObstacle.Position,
		Type:        dbObstacle.Type,
		Description: dbObstacle.Description,
		DangerLevel: dbObstacle.DangerLevel,
		Nodes:       dbObstacle.Nodes,
		NearestDistance: dbObstacle.NearestDistance,
		NoNearbyRoad:  dbObstacle.NoNearbyRoad,
		ImageS3Key:  dbObstacle.ImageS3Key,
		CreatedAt:   dbObstacle.CreatedAt,
		UserID:      dbObstacle.UserID,
	}
}
