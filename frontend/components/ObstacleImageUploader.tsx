import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, X } from "lucide-react";

interface Props {
    obstacleId: string | number;
    onUploaded?: (imageS3Key: string, updatedObstacle?: any) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_SIZE = 5 * 1024 * 1024;

async function compressImage(file: File, maxSize = MAX_SIZE): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            // 最大幅・高さを制限（例: 2000px）
            const maxDimension = 2000;
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject("canvas error");
            ctx.drawImage(img, 0, 0, width, height);

            // 画質を下げて5MB以下になるまで繰り返す
            let quality = 0.92;
            function tryCompress() {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject("blob error");
                        if (blob.size <= maxSize || quality < 0.5) {
                            resolve(new File([blob], file.name, { type: file.type }));
                        } else {
                            quality -= 0.07;
                            tryCompress();
                        }
                    },
                    file.type,
                    quality
                );
            }
            tryCompress();
        };
        img.onerror = reject;
        img.src = url;
    });
}

const ObstacleImageUploader: React.FC<Props> = ({ obstacleId, onUploaded }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
        setError("");
        let fileObj: File | null = null;
        if (e instanceof File) {
            fileObj = e;
        } else {
            fileObj = e.target.files?.[0] || null;
        }
        if (!fileObj) return;

        // 5MB超なら圧縮
        if (fileObj.size > MAX_SIZE) {
            try {
                fileObj = await compressImage(fileObj, MAX_SIZE);
            } catch (err) {
                setError("画像圧縮に失敗しました");
                return;
            }
        }

        setFile(fileObj);
        setPreview(URL.createObjectURL(fileObj));
        setUploading(true);
        try {
            // 1. プリサインドURL取得
            const res = await fetch(`${API_BASE}/obstacles/${obstacleId}/image-upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: fileObj.name }),
            });
            if (!res.ok) throw new Error("プリサインドURL取得失敗");
            const { url, image_s3_key } = await res.json();

            // 2. S3にPUTアップロード
            const putRes = await fetch(url, {
                method: "PUT",
                body: fileObj,
                headers: { "Content-Type": fileObj.type },
            });
            if (!putRes.ok) throw new Error("S3アップロード失敗");

            // 3. image_s3_keyをAPIで保存
            const saveRes = await fetch(`${API_BASE}/obstacles/${obstacleId}/image`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_s3_key }),
            });
            if (!saveRes.ok) throw new Error("画像キー保存失敗");

            const updatedObstacle = await saveRes.json();
            if (onUploaded) onUploaded(image_s3_key, updatedObstacle);
            alert("画像アップロード成功");
        } catch (e: any) {
            setError(e.message || "アップロード失敗");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setError("");
        const f = e.dataTransfer.files?.[0];
        if (f) {
            handleFileChange(f);
        }
    };

    const handleRemove = () => {
        setFile(null);
        setPreview(null);
        setError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div
            className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
        >
            {preview ? (
                <div className="flex flex-col items-center gap-2">
                    <img src={preview} alt="preview" className="max-h-32 rounded shadow" />
                    <div className="flex gap-2 items-center">
                        <span className="text-sm">{file?.name}</span>
                        <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); handleRemove(); }}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-8 h-8 text-blue-500" />
                    <span className="text-sm text-gray-600">画像をドラッグ＆ドロップ、またはクリックして選択</span>
                </div>
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
            />
            {uploading && <span>アップロード中...</span>}
            {error && <div style={{ color: "red" }}>{error}</div>}
        </div>
    );
};

export default ObstacleImageUploader; 
