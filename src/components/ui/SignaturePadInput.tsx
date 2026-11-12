import React, { useRef, useState, useEffect } from 'react';
import { Upload, PenTool, Trash2, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface SignaturePadInputProps {
  value: string;
  onChange: (dataUrl: string) => void;
  companyName?: string;
  label?: string;
}

export const SignaturePadInput: React.FC<SignaturePadInputProps> = ({
  value,
  onChange,
  companyName = 'COMPANY',
  label = 'Authorised E-Signature / Company Stamp',
}) => {
  const [mode, setMode] = useState<'UPLOAD' | 'DRAW'>('UPLOAD');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize blank white/transparent canvas when switching to DRAW mode
  useEffect(() => {
    if (mode === 'DRAW' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#172554'; // deep navy ink
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [mode]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    onChange('');
  };

  // Handle Photo / Scan Upload and convert to clean PNG data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        const maxW = 420;
        const maxH = 160;
        let w = img.width;
        let h = img.height;

        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        if (h > maxH) {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }

        offCanvas.width = w;
        offCanvas.height = h;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const pngDataUrl = offCanvas.toDataURL('image/png');
          onChange(pngDataUrl);
        }
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-800">{label}</label>
          <p className="text-[11px] text-slate-500">
            Saved permanently for all future GST Invoices & Challans so you never have to re-add it manually
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('UPLOAD')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'UPLOAD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Sign / Stamp Photo
          </button>
          <button
            type="button"
            onClick={() => setMode('DRAW')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'DRAW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Draw E-Sign
          </button>
          {value && (
            <button
              type="button"
              onClick={clearCanvas}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
              title="Remove Signature"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        {/* Input Area */}
        <div>
          {mode === 'UPLOAD' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-xl p-4 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <ImageIcon className="w-7 h-7 text-blue-500 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-slate-800">
                Click to Upload Signature or Stamp Photo
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Supports PNG, JPG (Transparent or white background)
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="border-2 border-blue-300 bg-white rounded-xl overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={endDrawing}
                  onMouseLeave={endDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={endDrawing}
                  className="w-full h-[100px] cursor-crosshair touch-none"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 px-1">
                <span>Sign inside the box using mouse or touch</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-rose-600 font-semibold hover:underline cursor-pointer"
                >
                  Reset Pad
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Invoice Signatory Box Preview */}
        <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-between min-h-[115px] text-center">
          <div className="text-[10px] font-bold text-blue-950 uppercase">
            For {companyName.toUpperCase()}
          </div>
          {value ? (
            <div className="my-1 flex flex-col items-center">
              <img
                src={value}
                alt="Authorised Signature"
                className="max-h-14 max-w-[180px] object-contain"
              />
              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> E-Sign Ready for Invoices
              </span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 my-4 italic">
              (No signature uploaded yet)
            </div>
          )}
          <div className="text-[10px] font-bold text-slate-900 tracking-wider">
            PROPRIETOR
          </div>
        </div>
      </div>
    </div>
  );
};
