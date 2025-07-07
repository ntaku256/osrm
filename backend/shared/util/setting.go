package util

import (
	"os"
)

type Setting struct {
	ObstacleTable struct {
		TableName string
	}
	ObstacleImageBucket struct {
		BucketName string
	}
	ShelterTable struct {
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

	// Get Obstacle image bucket name from environment
	setting.ObstacleImageBucket.BucketName = os.Getenv("OBSTACLE_IMAGE_BUCKET_NAME")
	if setting.ObstacleImageBucket.BucketName == "" {
		setting.ObstacleImageBucket.BucketName = "dev-obstacle-image-bucket" // Default for local development
	}

	// Get Shelter table name from environment
	setting.ShelterTable.TableName = os.Getenv("SHELTER_TABLE_NAME")
	if setting.ShelterTable.TableName == "" {
		setting.ShelterTable.TableName = "dev-shelter-table" // Default for local development
	}

	return setting
}
