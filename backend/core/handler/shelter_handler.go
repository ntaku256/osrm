package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"street-view/core/domain/model"
	"street-view/core/pkg/oapi"
	"street-view/core/usecase"

	"github.com/go-chi/chi/v5"
)

// ShelterHandler はシェルターAPIのハンドラーです
type ShelterHandler struct {
	useCase *usecase.ShelterUseCase
}

// NewShelterHandler は新しいShelterHandlerインスタンスを生成します
func NewShelterHandler(useCase *usecase.ShelterUseCase) *ShelterHandler {
	return &ShelterHandler{
		useCase: useCase,
	}
}

// GetAllShelters は全てのシェルターを取得します
func (h *ShelterHandler) GetAllShelters(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	response, err := h.useCase.GetAllShelters(ctx)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get shelters", err)
		return
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetShelter は指定IDのシェルターを取得します
func (h *ShelterHandler) GetShelter(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	shelter, err := h.useCase.GetShelter(ctx, id)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Shelter not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, shelter)
}

// CreateShelter は新しいシェルターを作成します
func (h *ShelterHandler) CreateShelter(w http.ResponseWriter, r *http.Request) {
	var shelter model.Shelter
	if err := json.NewDecoder(r.Body).Decode(&shelter); err != nil {
		http.Error(w, fmt.Sprintf(`{"message":"Invalid request body: %s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	createdShelter, err := h.useCase.CreateShelter(r.Context(), shelter)
	if err != nil {
		// バリデーションエラーの処理
		if strings.Contains(err.Error(), "validation failed") {
			http.Error(w, fmt.Sprintf(`{"message":"%s"}`, err.Error()), http.StatusBadRequest)
			return
		}
		
		http.Error(w, fmt.Sprintf(`{"message":"Failed to create shelter: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdShelter)
}

// UpdateShelter は指定IDのシェルターを更新します
func (h *ShelterHandler) UpdateShelter(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var updateShelter oapi.UpdateShelter
	if err := json.NewDecoder(r.Body).Decode(&updateShelter); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	// ドメインモデルに変換
	shelter := model.Shelter{
		ID:     id,
		Name:   updateShelter.Name,
		Lat:    float32(updateShelter.Lat),
		Lng:    float32(updateShelter.Lng),
		Height: float32(updateShelter.Height),
	}

	result, err := h.useCase.UpdateShelter(ctx, shelter)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update shelter", err)
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

// DeleteShelter は指定IDのシェルターを削除します
func (h *ShelterHandler) DeleteShelter(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	err := h.useCase.DeleteShelter(ctx, id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete shelter", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// レスポンスを返すヘルパー関数
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal JSON response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// エラーレスポンスを返すヘルパー関数
func respondWithError(w http.ResponseWriter, code int, message string, err error) {
	log.Printf("%s: %v", message, err)

	errorResponse := oapi.Error{
		StatusCode: code,
		Message:    message,
	}

	respondWithJSON(w, code, errorResponse)
}
