import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  onFileUpload,
  isProcessing 
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-full md:w-[400px]">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-slate-900 text-white flex items-center shadow-sm">
        <div className="p-2 bg-blue-500 rounded-lg mr-3">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-semibold">Census Agent</h2>
          <p className="text-xs text-blue-200">AI Quality Analyst</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-hide">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 mx-2 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-blue-100'}`}>
                {msg.role === 'user' ? <User size={14} className="text-slate-600"/> : <Bot size={14} className="text-blue-600"/>}
              </div>
              <div 
                className={`p-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start w-full">
            <div className="flex flex-row items-center ml-12 space-x-2 p-3 bg-white rounded-2xl rounded-tl-none border border-gray-200 shadow-sm">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-xs text-gray-500">Processing data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Upload Census (Excel/CSV)"
            disabled={isProcessing}
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".csv,.xlsx,.xls" 
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow bg-gray-100 border-transparent focus:border-blue-500 focus:bg-white focus:ring-0 rounded-full py-2 px-4 text-sm transition-all outline-none border"
            disabled={isProcessing}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing}
            className={`p-2 rounded-full transition-colors ${
              input.trim() && !isProcessing 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={18} />
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          AI Agent can make mistakes. Please verify critical data.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;