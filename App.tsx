import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImageData, ChatMessage } from './types';
import { editImageWithGemini } from './services/geminiService';
import { UploadIcon, SendIcon, SparklesIcon, UndoIcon, RedoIcon, BrushIcon, EraserIcon, TrashIcon, DownloadIcon, CloseIcon } from './components/icons';

const fileToData = (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/png' });
      };
      img.onerror = reject;
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      } else {
        reject(new Error('Failed to read file.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const MASK_COLORS = [
    'rgba(239, 68, 68, 0.7)', // Red
    'rgba(59, 130, 246, 0.7)', // Blue
    'rgba(34, 197, 94, 0.7)', // Green
];

const ImageDisplay: React.FC<{
  image: ImageData | null;
  onImageUpload: (file: File) => void;
  loading: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onMaskChange: (imageData: ImageData | null) => void;
  onClearImage: () => void;
}> = ({ image, onImageUpload, loading, onUndo, onRedo, canUndo, canRedo, onMaskChange, onClearImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState(MASK_COLORS[0]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    clearCanvas();
    onMaskChange(null);
  }, [image, clearCanvas, onMaskChange]);

  useEffect(() => {
    const imageEl = imageRef.current;
    const canvasEl = canvasRef.current;
    if (!imageEl || !canvasEl) return;

    const resizeObserver = new ResizeObserver(() => {
      canvasEl.width = imageEl.clientWidth;
      canvasEl.height = imageEl.clientHeight;
      const { top, left } = imageEl.getBoundingClientRect();
      const parentRect = imageEl.parentElement!.getBoundingClientRect();
      canvasEl.style.top = `${top - parentRect.top}px`;
      canvasEl.style.left = `${left - parentRect.left}px`;
    });

    resizeObserver.observe(imageEl);
    return () => resizeObserver.disconnect();
  }, [image]);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isBrushMode) return;
    const context = canvasRef.current?.getContext('2d');
    if(!context) return;
    
    setIsDrawing(true);
    const { x, y } = getMousePos(e);

    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    if (isErasing) {
      context.globalCompositeOperation = 'destination-out';
    } else {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = brushColor;
    }
    
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isBrushMode) return;
    e.preventDefault();
    const { x, y } = getMousePos(e);
    const context = canvasRef.current?.getContext('2d');
    if (context) {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
        const context = canvas.getContext('2d');
        context?.closePath();
        const base64 = canvas.toDataURL().split(',')[1];
        onMaskChange({ base64, mimeType: 'image/png' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  };
  
  const handleClearMask = () => {
      clearCanvas();
      onMaskChange(null);
  };

  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.base64}`;
    const filename = `gemini-edit-${Date.now()}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const toggleBrushMode = () => {
    const newMode = !isBrushMode;
    setIsBrushMode(newMode);
    if (newMode) {
      setIsErasing(false);
    }
  };

  return (
    <div className="w-full h-full bg-gray-900/50 rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-2xl">
      {image && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gray-900/50 backdrop-blur-sm p-2 rounded-full flex items-center gap-2 shadow-lg">
          <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all" title="Undo"><UndoIcon className="w-5 h-5" /></button>
          <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all" title="Redo"><RedoIcon className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-gray-600"></div>
          <button onClick={toggleBrushMode} className={`p-2 rounded-full transition-all ${isBrushMode ? 'bg-indigo-500 text-white' : 'hover:bg-gray-700'}`} title="Brush Mode"><BrushIcon className="w-5 h-5" /></button>
          
          {isBrushMode && (
            <>
                <div className="w-px h-6 bg-gray-600"></div>
                <button onClick={() => setIsErasing(true)} className={`p-2 rounded-full transition-all ${isErasing ? 'bg-indigo-500 text-white' : 'hover:bg-gray-700'}`} title="Eraser"><EraserIcon className="w-5 h-5" /></button>
                <div className="flex items-center gap-1">
                    {MASK_COLORS.map(color => (
                        <button 
                            key={color} 
                            onClick={() => { setBrushColor(color); setIsErasing(false); }}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${brushColor === color && !isErasing ? 'border-white' : 'border-transparent hover:border-gray-400'}`}
                            style={{ backgroundColor: color }}
                            title="Brush"
                        />
                    ))}
                </div>
                <div className="flex items-center gap-2 px-2">
                    <input 
                        type="range" 
                        min="2" 
                        max="50" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        title="Brush size"
                    />
                </div>
                <button onClick={handleClearMask} className="p-2 rounded-full hover:bg-red-500/50 transition-all text-red-400" title="Clear mask"><TrashIcon className="w-5 h-5" /></button>
                <div className="w-px h-6 bg-gray-600"></div>
            </>
          )}

          <button onClick={handleDownload} className="p-2 rounded-full hover:bg-gray-700 transition-all" title="Download Image"><DownloadIcon className="w-5 h-5" /></button>
          <button onClick={onClearImage} className="p-2 rounded-full hover:bg-gray-700 transition-all" title="Clear Image"><CloseIcon className="w-5 h-5" /></button>

        </div>
      )}
      <div className="relative w-full h-full flex items-center justify-center">
        {image ? (
          <>
            <img ref={imageRef} src={`data:${image.mimeType};base64,${image.base64}`} alt="Editable" className="max-w-full max-h-full object-contain rounded-lg select-none" />
            <canvas
              ref={canvasRef}
              className={`absolute top-0 left-0 ${isBrushMode ? 'cursor-crosshair' : 'cursor-default'} pointer-events-auto`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </>
        ) : (
          <label onDragOver={handleDragOver} onDrop={handleDrop} htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-500">PNG, JPG, WEBP, etc.</p>
            </div>
            <input id="file-upload" type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
          </label>
        )}
      </div>
      {loading && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10 transition-opacity">
          <SparklesIcon className="w-16 h-16 text-indigo-400 animate-pulse" />
          <p className="mt-4 text-lg font-semibold">Gemini is working its magic...</p>
        </div>
      )}
    </div>
  );
};


const ChatPanel: React.FC<{
  messages: ChatMessage[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: (prompt: string) => void;
  loading: boolean;
  imageLoaded: boolean;
}> = ({ messages, prompt, setPrompt, onSubmit, loading, imageLoaded }) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !loading && imageLoaded) {
      onSubmit(prompt);
    }
  };

  return (
    <div className="w-full h-full bg-gray-800 rounded-2xl flex flex-col p-4 shadow-inner">
      <div className="flex-grow overflow-y-auto pr-2 mb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-gray-500">
            <p>Your edit history will appear here.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="mb-4">
              <div className="bg-indigo-500/20 text-indigo-100 p-3 rounded-lg rounded-bl-none shadow">
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={imageLoaded ? "e.g., make it black and white" : "Upload an image first"}
            disabled={!imageLoaded || loading}
            className="w-full pl-4 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!imageLoaded || loading || !prompt.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

const App: React.FC = () => {
  const [image, setImage] = useState<ImageData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mask, setMask] = useState<ImageData | null>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const imageData = await fileToData(file);
      setImage(imageData);
      setHistory([imageData]);
      setHistoryIndex(0);
      setMessages([]);
      setMask(null);
    } catch (err) {
      setError("Failed to load image. Please try another file.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmitPrompt = useCallback(async (currentPrompt: string) => {
    if (!image) {
      setError("Please upload an image before submitting a prompt.");
      return;
    }
    setLoading(true);
    setError(null);
    setPrompt('');

    const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: currentPrompt };
    setMessages(prev => [...prev, newMessage]);

    try {
      const newImageBase64 = await editImageWithGemini(currentPrompt, image, mask);
      const newImageData = { ...image, base64: newImageBase64 };
      
      const newHistory = [...history.slice(0, historyIndex + 1), newImageData];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setImage(newImageData);
      setMask(null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [image, history, historyIndex, mask]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setImage(history[newIndex]);
      setMask(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setImage(history[newIndex]);
      setMask(null);
    }
  }, [history, historyIndex]);

  const handleClearImage = useCallback(() => {
    setImage(null);
    setMessages([]);
    setHistory([]);
    setHistoryIndex(-1);
    setMask(null);
    setError(null);
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-4 md:p-8 font-sans">
      <header className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
          Gemini Image Editor
        </h1>
        <p className="text-gray-400 mt-2">Edit images with the power of conversation.</p>
      </header>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-150px)]">
        <div className="lg:col-span-3 h-full">
            <ImageDisplay 
              image={image} 
              onImageUpload={handleImageUpload} 
              loading={loading}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onMaskChange={setMask}
              onClearImage={handleClearImage}
            />
        </div>
        <div className="lg:col-span-2 h-full">
            <ChatPanel 
              messages={messages} 
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={handleSubmitPrompt}
              loading={loading}
              imageLoaded={!!image}
            />
        </div>
      </main>
    </div>
  );
};

export default App;