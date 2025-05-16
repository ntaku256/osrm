package s3

import (
	"context"
	"fmt"
	"time"

	"webhook/shared/util"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Repo struct {
	BucketName string
	Client     *s3.Client
}

func NewS3Repo() (*S3Repo, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config: %w", err)
	}
	return &S3Repo{
		BucketName: util.GetSetting().ObstacleImageBucket.BucketName,
		Client:     s3.NewFromConfig(cfg),
	}, nil
}

// S3画像削除
func (r *S3Repo) DeleteObject(s3Key string) error {
	if s3Key == "" {
		return nil
	}
	_, err := r.Client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: aws.String(r.BucketName),
		Key:    aws.String(s3Key),
	})
	return err
}

// プリサインドURL生成（PUT）
func (r *S3Repo) GeneratePresignedPUTURL(s3Key string) (string, error) {
	presignClient := s3.NewPresignClient(r.Client)

	req, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(r.BucketName),
		Key:    aws.String(s3Key),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned PUT URL: %w", err)
	}
	return req.URL, nil
}
