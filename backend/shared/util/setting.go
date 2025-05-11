package util

import (
	"os"
)

type Setting struct {
	ObstacleTable struct {
		TableName string
	}
}

// Get settings from environment variables
func GetSetting() *Setting {
	setting := &Setting{}

	// Get Obstacle table name from environment
	setting.ObstacleTable.TableName = os.Getenv("OBSTACLE_TABLE_NAME")
	if setting.ObstacleTable.TableName == "" {
		setting.ObstacleTable.TableName = "dev-obstacle-table" // Default for local development
	}

	return setting
} 