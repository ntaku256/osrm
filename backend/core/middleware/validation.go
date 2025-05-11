package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"reflect"

	"street-view/core/pkg/validation"

	"github.com/go-chi/chi/v5"
)

func ValidateBody(next http.Handler, v interface{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if err := json.Unmarshal(body, v); err != nil {
			http.Error(w, "Invalid JSON format", http.StatusBadRequest)
			return
		}
		if err := validation.ValidateStruct(v); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ValidateParams(next http.Handler, v interface{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// URLパラメータを構造体にセット
		id := chi.URLParam(r, "id")

		// 構造体のIDフィールドにURLパラメータの値をセット
		val := reflect.ValueOf(v).Elem()
		if val.Kind() == reflect.Struct {
			idField := val.FieldByName("ID")
			if idField.IsValid() && idField.CanSet() && idField.Kind() == reflect.String {
				idField.SetString(id)
			}
		}

		if err := validation.ValidateStruct(v); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ValidateBodyAndParams はリクエストボディとパラメータの両方をバリデーションするミドルウェア
func ValidateBodyAndParams(next http.Handler, bodyStruct interface{}, paramsStruct interface{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// パラメータのバリデーション
		id := chi.URLParam(r, "id")
		paramsVal := reflect.ValueOf(paramsStruct).Elem()
		if paramsVal.Kind() == reflect.Struct {
			idField := paramsVal.FieldByName("ID")
			if idField.IsValid() && idField.CanSet() && idField.Kind() == reflect.String {
				idField.SetString(id)
			}
		}
		if err := validation.ValidateStruct(paramsStruct); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// リクエストボディのバリデーション
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if err := json.Unmarshal(body, bodyStruct); err != nil {
			http.Error(w, "Invalid JSON format", http.StatusBadRequest)
			return
		}
		if err := validation.ValidateStruct(bodyStruct); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		next.ServeHTTP(w, r)
	})
}
