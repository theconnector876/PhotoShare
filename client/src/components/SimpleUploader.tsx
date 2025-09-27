import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";

interface SimpleUploaderProps {
  onComplete?: (result: { successful: { uploadURL: string }[] }) => void;
  onGetUploadParameters: () => Promise<{ method: "PUT"; url: string }>;
  maxNumberOfFiles?: number;
  buttonClassName?: string;
  children: React.ReactNode;
}

export function SimpleUploader({
  onComplete,
  onGetUploadParameters,
  maxNumberOfFiles = 1,
  buttonClassName,
  children,
}: SimpleUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files.slice(0, maxNumberOfFiles));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const successful = [];
      
      for (const file of selectedFiles) {
        const uploadParams = await onGetUploadParameters();
        
        // Create a mock upload URL for now (since we're using mock upload parameters)
        const uploadURL = uploadParams.url;
        
        // In a real implementation, you would upload the file to the URL
        // For now, we'll just simulate a successful upload
        console.log(`Uploading ${file.name} to ${uploadURL}`);
        
        successful.push({ uploadURL });
      }

      onComplete?.({ successful });
      setSelectedFiles([]);
      setShowModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className={buttonClassName}
        data-testid="button-upload-modal"
      >
        {children}
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upload Photos</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={maxNumberOfFiles > 1}
                onChange={handleFileSelect}
              />

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Selected Files:</h4>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}