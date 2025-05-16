import React, { useRef, useState } from "react";

interface Props {
    obstacleId: string | number;
    onUploaded?: (imageS3Key: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const ObstacleImageUploader: React.FC<Props> = ({ obstacleId, onUploaded }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError("");
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            // 1. プリサインドURL取得
            const res = await fetch(`${API_BASE}/obstacles/${obstacleId}/image-upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name }),
            });
            if (!res.ok) throw new Error("プリサインドURL取得失敗");
            const { url, image_s3_key } = await res.json();

            // 2. S3にPUTアップロード
            const putRes = await fetch(url, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });
            if (!putRes.ok) throw new Error("S3アップロード失敗");

            // 3. image_s3_keyをAPIで保存
            const saveRes = await fetch(`${API_BASE}/obstacles/${obstacleId}/image`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_s3_key }),
            });
            if (!saveRes.ok) throw new Error("画像キー保存失敗");

            if (onUploaded) onUploaded(image_s3_key);
            alert("画像アップロード成功");
        } catch (e: any) {
            setError(e.message || "アップロード失敗");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploading}
            />
            {uploading && <span>アップロード中...</span>}
            {error && <div style={{ color: "red" }}>{error}</div>}
        </div>
    );
};

export default ObstacleImageUploader; 