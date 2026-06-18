import { Upload } from 'lucide-react';

type FileUploadDropzoneProps = {
  fileName?: string;
  onFileSelect: (file: File) => void;
};

export function FileUploadDropzone({ fileName, onFileSelect }: FileUploadDropzoneProps) {
  return (
    <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
      <Upload className="mb-2 text-[#073B91]" size={28} />
      <span className="text-sm font-black text-[#071b4d]">{fileName || 'Arrastra o selecciona un archivo'}</span>
      <span className="mt-1 text-xs font-semibold text-[#6b7d98]">CSV, XLS, XLSX o XLSM</span>
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
