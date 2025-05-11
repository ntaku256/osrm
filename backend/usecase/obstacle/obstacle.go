package obstacle

import (
	"net/http"
	"strconv"
	"time"

	"webhook/domain/db"
)

// Models for API layer
type Obstacle struct {
	ID          int        `json:"id"`
	Position    [2]float64 `json:"position"`
	Type        int        `json:"type"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel"`
	CreatedAt   string     `json:"createdAt"`
}

type ListObstacleResponse struct {
	Items []Obstacle `json:"items"`
}

type CreateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
}

type UpdateObstacleRequest struct {
	Position    [2]float64 `json:"position" validate:"required"`
	Type        int        `json:"type" validate:"required"`
	Description string     `json:"description"`
	DangerLevel int        `json:"dangerLevel" validate:"required"`
}

// Convert from API model to DB model
func toDBObstacle(obstacle Obstacle) *db.Obstacle {
	return &db.Obstacle{
		ID:          obstacle.ID,
		Position:    obstacle.Position,
		Type:        obstacle.Type,
		Description: obstacle.Description,
		DangerLevel: obstacle.DangerLevel,
		CreatedAt:   obstacle.CreatedAt,
	}
}

// Convert from DB model to API model
func fromDBObstacle(dbObstacle *db.Obstacle) Obstacle {
	return Obstacle{
		ID:          dbObstacle.ID,
		Position:    dbObstacle.Position,
		Type:        dbObstacle.Type,
		Description: dbObstacle.Description,
		DangerLevel: dbObstacle.DangerLevel,
		CreatedAt:   dbObstacle.CreatedAt,
	}
}

// GetObstacles retrieves all obstacles
func GetObstacles() (*ListObstacleResponse, int, error) {
	obstacleRepo := db.NewObstacleRepo()
	obstacles, statusCode, err := obstacleRepo.List()
	if err != nil {
		return nil, statusCode, err
	}

	// Convert DB obstacles to API obstacles
	var apiObstacles []Obstacle
	for _, obstacle := range *obstacles {
		apiObstacles = append(apiObstacles, fromDBObstacle(&obstacle))
	}

	response := &ListObstacleResponse{
		Items: apiObstacles,
	}

	return response, http.StatusOK, nil
}

// GetObstacleByID retrieves a single obstacle by ID
func GetObstacleByID(idStr string) (*Obstacle, int, error) {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	obstacle, statusCode, err := obstacleRepo.Get(id)
	if err != nil {
		return nil, statusCode, err
	}

	// Check if the obstacle was found
	if obstacle == nil {
		return nil, http.StatusNotFound, nil
	}

	apiObstacle := fromDBObstacle(obstacle)
	return &apiObstacle, http.StatusOK, nil
}

// CreateObstacle creates a new obstacle
func CreateObstacle(request CreateObstacleRequest) (*Obstacle, int, error) {
	// Generate a new ID
	// In a real application, you might use an auto-increment strategy or UUID
	id := int(time.Now().UnixNano() % 1000000)

	// Create a new obstacle
	obstacle := db.Obstacle{
		ID:          id,
		Position:    request.Position,
		Type:        request.Type,
		Description: request.Description,
		DangerLevel: request.DangerLevel,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	obstacleRepo := db.NewObstacleRepo()
	statusCode, err := obstacleRepo.CreateOrUpdate(&obstacle)
	if err != nil {
		return nil, statusCode, err
	}

	apiObstacle := fromDBObstacle(&obstacle)
	return &apiObstacle, http.StatusCreated, nil
}

// UpdateObstacle updates an existing obstacle
func UpdateObstacle(idStr string, request UpdateObstacleRequest) (*Obstacle, int, error) {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	
	// Check if the obstacle exists
	_, statusCode, err := obstacleRepo.Get(id)
	if err != nil {
		return nil, statusCode, err
	}

	// Update the obstacle
	obstacle := db.Obstacle{
		ID:          id,
		Position:    request.Position,
		Type:        request.Type,
		Description: request.Description,
		DangerLevel: request.DangerLevel,
		CreatedAt:   time.Now().Format(time.RFC3339), // Update the timestamp
	}

	statusCode, err = obstacleRepo.CreateOrUpdate(&obstacle)
	if err != nil {
		return nil, statusCode, err
	}

	apiObstacle := fromDBObstacle(&obstacle)
	return &apiObstacle, http.StatusOK, nil
}

// DeleteObstacle deletes an obstacle by ID
func DeleteObstacle(idStr string) (int, error) {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return http.StatusBadRequest, err
	}

	obstacleRepo := db.NewObstacleRepo()
	statusCode, err := obstacleRepo.Delete(id)
	if err != nil {
		return statusCode, err
	}

	return http.StatusNoContent, nil
} 