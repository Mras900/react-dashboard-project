import { Upload } from 'lucide-react';

type FileUploadDropzoneProps = {
  fileName?: string;
  onFileSelect: (file: File) => void;
};

export function FileUploadDropzone({ fileName, onFileSelect }: FileUploadDropzoneProps) {
  return (
    <label className="cc-import-dropzone cc-focus-ring flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition" data-has-file={fileName ? 'true' : 'false'}>
      <Upload className="cc-import-dropzone-icon mb-2" size={28} />
      <span className="cc-import-dropzone-title text-sm font-black">{fileName || 'Arrastra o selecciona un archivo'}</span>
      <span className="cc-import-dropzone-meta mt-1 text-xs font-semibold">CSV, XLS, XLSX o XLSM</span>
      <input
        accept=".csv,.xls,.xlsx,.xlsm"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.currentTarget.value = '';
        }}
        type="file"
      />
    </label>
  );
}
